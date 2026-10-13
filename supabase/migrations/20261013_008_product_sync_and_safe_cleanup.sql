alter table public.product_colors add column if not exists is_active boolean not null default true;
alter table public.product_sizes add column if not exists is_active boolean not null default true;

create or replace function public.save_product(p_product_id uuid,p_payload jsonb,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid:=coalesce(p_product_id,gen_random_uuid()); x jsonb; y jsonb; sid uuid; cid uuid; vid uuid; begin
  if coalesce(p_payload->>'name','')='' or coalesce(p_payload->>'categoryId','')='' or (p_payload->>'weightGrams')::integer<=0 then raise exception using errcode='22023',message='INVALID_PRODUCT'; end if;
  if p_product_id is null then
    insert into public.products(id,category_id,name,slug,description,base_price,discount_price,weight_grams,is_active,is_archived)
    values(pid,(p_payload->>'categoryId')::uuid,p_payload->>'name',p_payload->>'slug',coalesce(p_payload->>'description',''),(p_payload->>'basePrice')::numeric,nullif(p_payload->>'discountPrice','')::numeric,(p_payload->>'weightGrams')::integer,coalesce((p_payload->>'isActive')::boolean,true),false);
  else
    update public.products set category_id=(p_payload->>'categoryId')::uuid,name=p_payload->>'name',slug=p_payload->>'slug',description=coalesce(p_payload->>'description',''),base_price=(p_payload->>'basePrice')::numeric,discount_price=nullif(p_payload->>'discountPrice','')::numeric,weight_grams=(p_payload->>'weightGrams')::integer,updated_at=now() where id=pid;
    if not found then raise exception using errcode='P0001',message='PRODUCT_NOT_FOUND'; end if;
    update public.product_variants set is_active=false where product_id=pid;
    update public.product_colors set is_active=false where product_id=pid;
    update public.product_sizes set is_active=false where product_id=pid;
  end if;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'sizes','[]')) loop
    insert into public.product_sizes(product_id,name,sort_order,is_active) values(pid,x->>'name',(x->>'sortOrder')::integer,true)
      on conflict(product_id,name) do update set sort_order=excluded.sort_order,is_active=true returning id into sid;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'colors','[]')) loop
    insert into public.product_colors(product_id,name,hex,sort_order,is_active) values(pid,x->>'name',x->>'hex',(x->>'sortOrder')::integer,true)
      on conflict(product_id,name) do update set hex=excluded.hex,sort_order=excluded.sort_order,is_active=true returning id into cid;
    if x ? 'images' then
      delete from public.product_color_images where color_id=cid;
      for y in select * from jsonb_array_elements(x->'images') loop
        insert into public.product_color_images(color_id,storage_path,sort_order) values(cid,y->>'path',(y->>'sortOrder')::integer);
      end loop;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'variants','[]')) loop
    select id into cid from public.product_colors where product_id=pid and name=x->>'color' and is_active=true;
    select id into sid from public.product_sizes where product_id=pid and name=x->>'size' and is_active=true;
    if cid is null or sid is null then raise exception using errcode='22023',message='INVALID_VARIANT_RELATION'; end if;
    insert into public.product_variants(product_id,color_id,size_id,sku,is_active) values(pid,cid,sid,x->>'sku',true)
      on conflict(product_id,color_id,size_id) do update set is_active=true returning id into vid;
    if p_product_id is null and (x->>'initialStock')::integer>0 then
      perform public.restock_variant(vid,(x->>'initialStock')::integer,(x->>'costPerUnit')::numeric,current_date,x->>'batchCode',p_actor);
    end if;
  end loop;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id) values('ADMIN',p_actor::text,case when p_product_id is null then 'PRODUCT_CREATED' else 'PRODUCT_UPDATED' end,'PRODUCT',pid::text);
  return pid;
end $$;

create or replace function public.delete_unpaid_test_order(p_order_number text,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; a record; proof_paths jsonb; begin
  if not exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  select * into o from public.orders where order_number=p_order_number for update;
  if not found then return jsonb_build_object('deleted',false,'reason','NOT_FOUND'); end if;
  if o.payment_status in ('VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL') or o.refund_amount>0
    or o.fulfillment_status<>'WAITING_PAYMENT_VERIFIED' or o.tracking_number is not null or o.actual_delivery_date is not null
    or exists(select 1 from public.payments where order_id=o.id and status in ('VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL'))
    or exists(select 1 from public.refunds where order_id=o.id)
    or exists(select 1 from public.return_requests where order_id=o.id) then
    return jsonb_build_object('deleted',false,'reason','FINANCIAL_HISTORY_PROTECTED');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',proof_bucket,'path',proof_path)),'[]'::jsonb) into proof_paths from public.payments where order_id=o.id;
  for a in select fa.*,oi.variant_id from public.order_fifo_allocations fa join public.order_items oi on oi.id=fa.order_item_id where oi.order_id=o.id for update of fa loop
    update public.inventory_batches set remaining_qty=remaining_qty+a.quantity where id=a.batch_id;
  end loop;
  if o.voucher_id is not null then update public.vouchers set used_count=greatest(0,used_count-1) where id=o.voucher_id; end if;
  delete from public.stock_movements where reference_type='ORDER' and reference_id=o.id;
  delete from public.order_fifo_allocations where order_item_id in(select id from public.order_items where order_id=o.id);
  delete from public.order_costs where order_id=o.id;
  delete from public.payments where order_id=o.id;
  delete from public.order_items where order_id=o.id;
  update public.checkout_reservations set converted_order_id=null where id=o.reservation_id;
  delete from public.orders where id=o.id;
  delete from public.checkout_reservations where id=o.reservation_id;
  delete from public.telegram_outbox where event_key='order:'||o.id and status in ('PENDING','PROCESSING','FAILED');
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id) values('ADMIN',p_actor::text,'TEST_ORDER_DELETED','ORDER',o.id::text);
  return jsonb_build_object('deleted',true,'proofs',proof_paths);
end $$;

create or replace function public.move_category_products_and_delete(p_category_id uuid,p_target_category_id uuid,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$ declare moved integer; begin
  if not exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if p_category_id=p_target_category_id or not exists(select 1 from public.categories where id=p_target_category_id) then raise exception 'INVALID_TARGET_CATEGORY'; end if;
  update public.products set category_id=p_target_category_id,updated_at=now() where category_id=p_category_id; get diagnostics moved=row_count;
  delete from public.voucher_categories where category_id=p_category_id;
  delete from public.categories where id=p_category_id;
  return moved;
end $$;

create or replace function public.preview_testing_data_reset(p_actor uuid) returns jsonb language sql security definer set search_path=public as $$
  select case when exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then jsonb_build_object(
    'deletableUnpaidOrders',(select count(*) from public.orders o where o.payment_status in ('WAITING_VERIFICATION','REVISION_REQUESTED') and o.refund_amount=0 and o.fulfillment_status='WAITING_PAYMENT_VERIFIED' and o.tracking_number is null and not exists(select 1 from public.return_requests r where r.order_id=o.id)),
    'expiredOrCancelledReservations',(select count(*) from public.checkout_reservations where status in ('EXPIRED','CANCELLED')),
    'activeExpiredReservations',(select count(*) from public.checkout_reservations where status='ACTIVE' and expires_at<=now())
  ) else jsonb_build_object('error','OWNER_REQUIRED') end
$$;

-- Reservasi kedaluwarsa dilepas melalui fungsi transaksi existing, kemudian
-- baris terminal tanpa pesanan dibersihkan agar tidak mengunci katalog.
create or replace function public.delete_product_if_unreferenced(p_product_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare released integer:=0; reservation_count integer:=0; order_count integer:=0; return_count integer:=0; begin
  if not exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  perform 1 from public.products where id=p_product_id for update;
  if not found then return jsonb_build_object('deleted',false,'reason','NOT_FOUND'); end if;
  loop
    released:=public.release_expired_reservations(500);
    exit when released=0;
  end loop;
  delete from public.checkout_reservations r
  where r.status in ('EXPIRED','CANCELLED') and r.converted_order_id is null
    and exists(select 1 from public.reservation_items ri where ri.reservation_id=r.id and ri.product_id=p_product_id);
  select count(*) into reservation_count from public.reservation_items ri join public.checkout_reservations r on r.id=ri.reservation_id
    where ri.product_id=p_product_id and (r.status not in ('EXPIRED','CANCELLED') or r.converted_order_id is not null);
  select count(*) into order_count from public.order_items oi join public.product_variants pv on pv.id=oi.variant_id where pv.product_id=p_product_id;
  select count(*) into return_count from public.return_items ri join public.order_items oi on oi.id=ri.order_item_id join public.product_variants pv on pv.id=oi.variant_id where pv.product_id=p_product_id;
  if reservation_count>0 or order_count>0 or return_count>0 then
    return jsonb_build_object('deleted',false,'reason','PRODUCT_REFERENCED','references',jsonb_build_object('reservations',reservation_count,'orders',order_count,'returns',return_count));
  end if;
  delete from public.voucher_products where product_id=p_product_id;
  delete from public.stock_movements where variant_id in(select id from public.product_variants where product_id=p_product_id);
  delete from public.inventory_batches where variant_id in(select id from public.product_variants where product_id=p_product_id);
  delete from public.product_variants where product_id=p_product_id;
  delete from public.products where id=p_product_id;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id) values('ADMIN',p_actor::text,'PRODUCT_DELETED','PRODUCT',p_product_id::text);
  return jsonb_build_object('deleted',true);
end $$;

-- Prosedur reset terpisah ini sengaja mensyaratkan frasa eksplisit. Ia hanya
-- menghapus pesanan yang lolos perlindungan finansial dan reservasi terminal.
create or replace function public.execute_testing_data_reset(p_actor uuid,p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare row_data record; result jsonb; deleted_orders integer:=0; released integer:=0; cleaned_reservations integer:=0; begin
  if not exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if p_confirmation<>'HAPUS DATA TESTING DEFRA' then raise exception using errcode='22023',message='CONFIRMATION_REQUIRED'; end if;
  loop released:=released+public.release_expired_reservations(500); exit when not exists(select 1 from public.checkout_reservations where status='ACTIVE' and expires_at<=now()); end loop;
  for row_data in select order_number from public.orders o where o.payment_status in ('WAITING_VERIFICATION','REVISION_REQUESTED') and o.refund_amount=0 and o.fulfillment_status='WAITING_PAYMENT_VERIFIED' and o.tracking_number is null and o.actual_delivery_date is null order by o.created_at loop
    result:=public.delete_unpaid_test_order(row_data.order_number,p_actor);
    if coalesce((result->>'deleted')::boolean,false) then deleted_orders:=deleted_orders+1; end if;
  end loop;
  delete from public.checkout_reservations where status in ('EXPIRED','CANCELLED') and converted_order_id is null;
  get diagnostics cleaned_reservations=row_count;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,details) values('ADMIN',p_actor::text,'TEST_DATA_RESET','SYSTEM','testing',jsonb_build_object('deletedOrders',deleted_orders,'releasedReservations',released,'cleanedReservations',cleaned_reservations));
  return jsonb_build_object('deletedOrders',deleted_orders,'releasedReservations',released,'cleanedReservations',cleaned_reservations);
end $$;

revoke all on function public.delete_unpaid_test_order(text,uuid) from public,anon,authenticated;
revoke all on function public.move_category_products_and_delete(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.preview_testing_data_reset(uuid) from public,anon,authenticated;
revoke all on function public.delete_product_if_unreferenced(uuid,uuid) from public,anon,authenticated;
revoke all on function public.execute_testing_data_reset(uuid,text) from public,anon,authenticated;
grant execute on function public.delete_unpaid_test_order(text,uuid) to service_role;
grant execute on function public.move_category_products_and_delete(uuid,uuid,uuid) to service_role;
grant execute on function public.preview_testing_data_reset(uuid) to service_role;
grant execute on function public.delete_product_if_unreferenced(uuid,uuid) to service_role;
grant execute on function public.execute_testing_data_reset(uuid,text) to service_role;
