-- Jalankan setelah 002. RPC berikut hanya boleh dipanggil service role dari server.
create or replace function public.payment_method_for_total(p_total numeric, p_qris boolean, p_bank boolean)
returns public.payment_method language plpgsql immutable as $$ begin
  if not p_qris and not p_bank then raise exception using errcode='P0001',message='PAYMENT_DISABLED'; end if;
  if p_qris and p_bank then return case when p_total < 2000000 then 'QRIS'::public.payment_method else 'BANK_TRANSFER'::public.payment_method end; end if;
  return case when p_qris then 'QRIS'::public.payment_method else 'BANK_TRANSFER'::public.payment_method end;
end $$;

create or replace function public.upsert_checkout_reservation(
  p_reservation_id uuid, p_session_token text, p_request_key text, p_items jsonb, p_shipping_origin_id text,
  p_destination_id text, p_destination_label text, p_provider text, p_service_code text,
  p_service_label text, p_shipping_fee numeric, p_shipping_etd text, p_voucher_code text default null
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.checkout_reservations; s public.store_settings; item jsonb; v public.vouchers;
  vrow record; product_subtotal numeric:=0; discount numeric:=0; total_weight integer:=0;
  qty integer; available integer; unit_price numeric; new_id uuid; fixed_expiry timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(encode(digest(p_session_token,'sha256'),'hex')||p_request_key,0));
  select * into s from public.store_settings where id=true for share;
  if s.origin_destination_id is null then raise exception using errcode='P0001',message='SHIPPING_ORIGIN_INVALID'; end if;
  if s.origin_destination_id<>p_shipping_origin_id then raise exception using errcode='P0001',message='SHIPPING_ORIGIN_CHANGED'; end if;
  if p_shipping_fee < 0 or jsonb_array_length(p_items)=0 then raise exception using errcode='22023',message='INVALID_RESERVATION'; end if;

  if p_reservation_id is not null then
    select * into r from public.checkout_reservations where id=p_reservation_id for update;
    if not found or r.session_token_hash<>encode(digest(p_session_token,'sha256'),'hex') then raise exception using errcode='P0001',message='RESERVATION_NOT_FOUND'; end if;
    if r.status<>'ACTIVE' then raise exception using errcode='P0001',message='RESERVATION_NOT_ACTIVE'; end if;
    if r.expires_at<=now() then raise exception using errcode='P0001',message='RESERVATION_EXPIRED'; end if;
    fixed_expiry:=r.expires_at; new_id:=r.id;
    update public.vouchers x set reserved_quota=greatest(0,x.reserved_quota-1)
      from public.voucher_reservations vr where vr.reservation_id=r.id and vr.voucher_id=x.id and vr.released_at is null and vr.converted_at is null;
    update public.voucher_reservations set released_at=now() where reservation_id=r.id and released_at is null and converted_at is null;
    delete from public.reservation_stock_allocations where reservation_id=r.id;
    delete from public.reservation_items where reservation_id=r.id;
  else
    select * into r from public.checkout_reservations where session_token_hash=encode(digest(p_session_token,'sha256'),'hex') and request_key=p_request_key;
    if found then
      return jsonb_build_object('id',r.id,'expiresAt',r.expires_at,'shippingOriginId',r.shipping_origin_id,'destinationId',r.destination_id,
        'subtotal',r.subtotal,'discountAmount',r.discount_amount,'shippingFee',r.shipping_fee,'shippingService',r.shipping_service_label,
        'shippingServiceCode',r.shipping_service_code,'totalAmount',r.total_amount,'voucherId',r.voucher_id,'paymentMethod',r.payment_method,'status',r.status);
    end if;
    fixed_expiry:=now()+interval '24 hours'; new_id:=gen_random_uuid();
    insert into public.checkout_reservations(id,session_token_hash,status,expires_at,shipping_origin_id,destination_id,destination_label,
      shipping_provider,shipping_service_code,shipping_service_label,shipping_fee,shipping_etd,weight_grams,subtotal,discount_amount,payment_method,request_key)
    values(new_id,encode(digest(p_session_token,'sha256'),'hex'),'ACTIVE',fixed_expiry,s.origin_destination_id,p_destination_id,p_destination_label,
      upper(p_provider),upper(p_service_code),p_service_label,p_shipping_fee,p_shipping_etd,1,0,0,
      public.payment_method_for_total(p_shipping_fee,s.qris_enabled,s.bank_transfer_enabled),p_request_key);
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty:=(item->>'quantity')::integer;
    if qty<=0 then raise exception using errcode='22023',message='INVALID_QUANTITY'; end if;
    select pv.id variant_id,p.id product_id,p.name,c.name color_name,z.name size_name,
      coalesce(p.discount_price,p.base_price) price,p.weight_grams,
      (select pci.storage_path from public.product_color_images pci where pci.color_id=c.id order by pci.sort_order limit 1) image_path
      into vrow from public.product_variants pv join public.products p on p.id=pv.product_id
      join public.product_colors c on c.id=pv.color_id join public.product_sizes z on z.id=pv.size_id
      where pv.id=(item->>'variantId')::uuid and pv.is_active and p.is_active and not p.is_archived for update of pv;
    if not found then raise exception using errcode='P0001',message='VARIANT_UNAVAILABLE'; end if;
    select coalesce(sum(b.remaining_qty),0)-coalesce((select sum(a.quantity) from public.reservation_stock_allocations a
      join public.checkout_reservations cr on cr.id=a.reservation_id where a.variant_id=vrow.variant_id and cr.status='ACTIVE' and cr.expires_at>now()),0)
      into available from public.inventory_batches b where b.variant_id=vrow.variant_id;
    if available<qty then raise exception using errcode='P0001',message='INSUFFICIENT_STOCK'; end if;
    unit_price:=vrow.price; product_subtotal:=product_subtotal+(unit_price*qty); total_weight:=total_weight+(vrow.weight_grams*qty);
    insert into public.reservation_items(id,reservation_id,product_id,variant_id,quantity,product_name,color_name,size_name,unit_price,weight_grams,image_path)
      values(gen_random_uuid(),new_id,vrow.product_id,vrow.variant_id,qty,vrow.name,vrow.color_name,vrow.size_name,unit_price,vrow.weight_grams,vrow.image_path);
    insert into public.reservation_stock_allocations(reservation_id,variant_id,quantity) values(new_id,vrow.variant_id,qty);
  end loop;
  total_weight:=total_weight+s.packaging_weight_grams;

  if nullif(upper(p_voucher_code),'') is not null then
    select * into v from public.vouchers where code=upper(p_voucher_code) for update;
    if not found or not v.is_active or now()<v.starts_at or now()>v.ends_at or v.used_count+v.reserved_quota>=v.quota or product_subtotal<v.min_order_amount
      then raise exception using errcode='P0001',message='VOUCHER_INVALID'; end if;
    if v.scope='CATEGORY' and not exists(select 1 from public.reservation_items ri join public.product_variants pv on pv.id=ri.variant_id join public.products p on p.id=pv.product_id join public.voucher_categories vc on vc.category_id=p.category_id where ri.reservation_id=new_id and vc.voucher_id=v.id)
      then raise exception using errcode='P0001',message='VOUCHER_SCOPE_INVALID'; end if;
    if v.scope='PRODUCT' and not exists(select 1 from public.reservation_items ri join public.product_variants pv on pv.id=ri.variant_id join public.voucher_products vp on vp.product_id=pv.product_id where ri.reservation_id=new_id and vp.voucher_id=v.id)
      then raise exception using errcode='P0001',message='VOUCHER_SCOPE_INVALID'; end if;
    discount:=case when v.discount_type='NOMINAL' then v.discount_value else product_subtotal*v.discount_value/100 end;
    discount:=least(product_subtotal,discount,coalesce(v.max_discount_amount,discount));
    update public.vouchers set reserved_quota=reserved_quota+1 where id=v.id;
    insert into public.voucher_reservations(reservation_id,voucher_id) values(new_id,v.id)
      on conflict(reservation_id) do update set voucher_id=excluded.voucher_id,released_at=null,converted_at=null;
  end if;

  insert into public.checkout_reservations(id,session_token_hash,status,expires_at,shipping_origin_id,destination_id,destination_label,
    shipping_provider,shipping_service_code,shipping_service_label,shipping_fee,shipping_etd,weight_grams,subtotal,discount_amount,voucher_id,payment_method,request_key)
  values(new_id,encode(digest(p_session_token,'sha256'),'hex'),'ACTIVE',fixed_expiry,s.origin_destination_id,p_destination_id,p_destination_label,
    upper(p_provider),upper(p_service_code),p_service_label,p_shipping_fee,p_shipping_etd,total_weight,product_subtotal,discount,v.id,
    public.payment_method_for_total(product_subtotal-discount+p_shipping_fee,s.qris_enabled,s.bank_transfer_enabled),p_request_key)
  on conflict(id) do update set destination_id=excluded.destination_id,destination_label=excluded.destination_label,
    shipping_origin_id=excluded.shipping_origin_id,shipping_provider=excluded.shipping_provider,shipping_service_code=excluded.shipping_service_code,
    shipping_service_label=excluded.shipping_service_label,shipping_fee=excluded.shipping_fee,shipping_etd=excluded.shipping_etd,
    weight_grams=excluded.weight_grams,subtotal=excluded.subtotal,discount_amount=excluded.discount_amount,voucher_id=excluded.voucher_id,
    payment_method=excluded.payment_method,request_key=excluded.request_key,updated_at=now();
  select * into r from public.checkout_reservations where id=new_id;
  for vrow in select distinct variant_id from public.reservation_items where reservation_id=new_id loop perform public.enqueue_stock_transition(vrow.variant_id); end loop;
  return jsonb_build_object('id',r.id,'expiresAt',r.expires_at,'shippingOriginId',r.shipping_origin_id,'destinationId',r.destination_id,
    'subtotal',r.subtotal,'discountAmount',r.discount_amount,'shippingFee',r.shipping_fee,'shippingService',r.shipping_service_label,
    'shippingServiceCode',r.shipping_service_code,'totalAmount',r.total_amount,'voucherId',r.voucher_id,'paymentMethod',r.payment_method,'status',r.status);
end $$;

create or replace function public.release_expired_reservations(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=public as $$
declare ids uuid[]; n integer:=0; stock_row record;
begin
  select array_agg(id) into ids from (select id from public.checkout_reservations where status='ACTIVE' and expires_at<=now() order by expires_at for update skip locked limit p_limit) q;
  if ids is null then return 0; end if;
  update public.checkout_reservations set status='EXPIRED',updated_at=now() where id=any(ids);
  update public.reservation_stock_allocations set released_at=now() where reservation_id=any(ids) and released_at is null and converted_at is null;
  update public.vouchers v set reserved_quota=greatest(0,v.reserved_quota-x.n) from
    (select voucher_id,count(*) n from public.voucher_reservations where reservation_id=any(ids) and released_at is null and converted_at is null group by voucher_id) x where v.id=x.voucher_id;
  update public.voucher_reservations set released_at=now() where reservation_id=any(ids) and released_at is null and converted_at is null;
  for stock_row in select distinct a.variant_id from public.reservation_stock_allocations a where a.reservation_id=any(ids) loop perform public.enqueue_stock_transition(stock_row.variant_id); end loop;
  get diagnostics n=row_count; return cardinality(ids);
end $$;

create or replace function public.enqueue_stock_transition(p_variant_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare available integer; threshold integer; next_state text; previous text; sku_value text; begin
  select low_stock_threshold into threshold from public.store_settings where id=true;
  select coalesce(sum(b.remaining_qty),0)-coalesce((select sum(a.quantity) from public.reservation_stock_allocations a join public.checkout_reservations r on r.id=a.reservation_id where a.variant_id=p_variant_id and r.status='ACTIVE' and r.expires_at>now() and a.released_at is null),0)
    into available from public.inventory_batches b where b.variant_id=p_variant_id;
  next_state:=case when available<=0 then 'OUT' when available<=threshold then 'LOW' else 'OK' end;
  select state->>'value' into previous from public.notification_markers where marker_key='stock:'||p_variant_id for update;
  if previous is distinct from next_state then
    insert into public.notification_markers(marker_key,state) values('stock:'||p_variant_id,jsonb_build_object('value',next_state)) on conflict(marker_key) do update set state=excluded.state,updated_at=now();
    if next_state<>'OK' then select sku into sku_value from public.product_variants where id=p_variant_id;
      insert into public.telegram_outbox(event_key,event_type,payload) values('stock:'||p_variant_id||':'||next_state||':'||extract(epoch from clock_timestamp())::bigint,'LOW_STOCK',jsonb_build_object('variantId',p_variant_id,'sku',sku_value,'available',greatest(available,0),'state',next_state));
    end if;
  end if;
end $$;

create or replace function public.finalize_checkout_order(p_reservation_id uuid,p_session_token text,p_customer jsonb,p_proof_path text,p_proof_mime text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.checkout_reservations; s public.store_settings; oid uuid; ono text; ri record; b record; need integer; take_qty integer; oi uuid;
begin
  select * into r from public.checkout_reservations where id=p_reservation_id for update;
  if not found or r.session_token_hash<>encode(digest(p_session_token,'sha256'),'hex') then raise exception using errcode='P0001',message='RESERVATION_NOT_FOUND'; end if;
  if r.status='CONVERTED' then select id,order_number into oid,ono from public.orders where reservation_id=r.id; return jsonb_build_object('id',oid,'orderNumber',ono,'alreadyFinalized',true); end if;
  if r.status<>'ACTIVE' or r.expires_at<=now() then
    update public.checkout_reservations set status='REQUIRES_RECOVERY',updated_at=now() where id=r.id and status='ACTIVE';
    return jsonb_build_object('error','RESERVATION_REQUIRES_RECOVERY');
  end if;
  select * into s from public.store_settings where id=true for share;
  if s.origin_destination_id is null or s.origin_destination_id<>r.shipping_origin_id then
    update public.checkout_reservations set status='REQUIRES_RECOVERY',updated_at=now() where id=r.id;
    return jsonb_build_object('error','SHIPPING_ORIGIN_CHANGED');
  end if;
  if coalesce(p_customer->>'name','')='' or coalesce(p_customer->>'email','')='' or coalesce(p_customer->>'whatsapp','')='' or
     coalesce(p_customer->>'birthDate','')='' or coalesce(p_customer->>'addressLine','')='' or coalesce(p_customer->>'village','')='' then
    raise exception using errcode='22023',message='CUSTOMER_DATA_INCOMPLETE'; end if;
  oid:=gen_random_uuid();
  loop ono:='DFR-'||upper(substr(encode(gen_random_bytes(8),'hex'),1,12)); exit when not exists(select 1 from public.orders where order_number=ono); end loop;
  insert into public.orders(id,order_number,reservation_id,customer_name,customer_email,customer_whatsapp,customer_birth_date,address_line,province,city,subdistrict,village,postal_code,
    shipping_origin_id,destination_id,subtotal,discount_amount,shipping_fee,shipping_provider,shipping_service_code,shipping_service_label,total_amount,voucher_id,voucher_code,payment_method)
  select oid,ono,r.id,p_customer->>'name',p_customer->>'email',p_customer->>'whatsapp',(p_customer->>'birthDate')::date,p_customer->>'addressLine',p_customer->>'province',p_customer->>'city',p_customer->>'subdistrict',p_customer->>'village',p_customer->>'postalCode',
    r.shipping_origin_id,r.destination_id,r.subtotal,r.discount_amount,r.shipping_fee,r.shipping_provider,r.shipping_service_code,r.shipping_service_label,r.total_amount,r.voucher_id,v.code,r.payment_method
  from public.vouchers v where v.id=r.voucher_id
  union all select oid,ono,r.id,p_customer->>'name',p_customer->>'email',p_customer->>'whatsapp',(p_customer->>'birthDate')::date,p_customer->>'addressLine',p_customer->>'province',p_customer->>'city',p_customer->>'subdistrict',p_customer->>'village',p_customer->>'postalCode',
    r.shipping_origin_id,r.destination_id,r.subtotal,r.discount_amount,r.shipping_fee,r.shipping_provider,r.shipping_service_code,r.shipping_service_label,r.total_amount,null,null,r.payment_method where r.voucher_id is null;
  for ri in select * from public.reservation_items where reservation_id=r.id order by id loop
    oi:=gen_random_uuid(); need:=ri.quantity;
    insert into public.order_items(id,order_id,variant_id,product_name,color_name,size_name,unit_price,quantity,line_total)
      values(oi,oid,ri.variant_id,ri.product_name,ri.color_name,ri.size_name,ri.unit_price,ri.quantity,ri.unit_price*ri.quantity);
    for b in select * from public.inventory_batches where variant_id=ri.variant_id and remaining_qty>0 order by arrival_date,created_at for update loop
      exit when need=0; take_qty:=least(need,b.remaining_qty);
      update public.inventory_batches set remaining_qty=remaining_qty-take_qty where id=b.id;
      insert into public.order_fifo_allocations(order_item_id,batch_id,quantity,cost_per_unit) values(oi,b.id,take_qty,b.cost_per_unit);
      insert into public.stock_movements(variant_id,batch_id,movement_type,quantity,reference_type,reference_id) values(ri.variant_id,b.id,'SALE',-take_qty,'ORDER',oid);
      need:=need-take_qty;
    end loop;
    if need>0 then raise exception using errcode='P0001',message='INSUFFICIENT_STOCK'; end if;
  end loop;
  insert into public.payments(order_id,method,amount,proof_path,proof_mime) values(oid,r.payment_method,r.total_amount,p_proof_path,p_proof_mime);
  insert into public.order_costs(order_id,packaging_cost) values(oid,s.packaging_cost);
  update public.checkout_reservations set status='CONVERTED',converted_order_id=oid,updated_at=now() where id=r.id;
  update public.reservation_stock_allocations set converted_at=now() where reservation_id=r.id and released_at is null;
  if r.voucher_id is not null then
    update public.vouchers set reserved_quota=greatest(0,reserved_quota-1),used_count=used_count+1 where id=r.voucher_id;
    update public.voucher_reservations set converted_at=now() where reservation_id=r.id;
  end if;
  insert into public.telegram_outbox(event_key,event_type,payload) values('order:'||oid,'NEW_ORDER',jsonb_build_object('orderId',oid));
  for ri in select distinct variant_id from public.reservation_items where reservation_id=r.id loop perform public.enqueue_stock_transition(ri.variant_id); end loop;
  insert into public.audit_logs(actor_type,action,entity_type,entity_id) values('BUYER','ORDER_FINALIZED','ORDER',oid::text);
  return jsonb_build_object('id',oid,'orderNumber',ono,'alreadyFinalized',false);
end $$;

create or replace function public.restock_variant(p_variant_id uuid,p_quantity integer,p_cost numeric,p_arrival date,p_batch_code text,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$ declare bid uuid:=gen_random_uuid(); begin
  if p_quantity<=0 or p_cost<0 then raise exception using errcode='22023',message='INVALID_RESTOCK'; end if;
  perform 1 from public.product_variants where id=p_variant_id for update; if not found then raise exception using errcode='P0001',message='VARIANT_NOT_FOUND'; end if;
  insert into public.inventory_batches(id,variant_id,batch_code,initial_qty,remaining_qty,cost_per_unit,arrival_date) values(bid,p_variant_id,p_batch_code,p_quantity,p_quantity,p_cost,p_arrival);
  insert into public.stock_movements(variant_id,batch_id,movement_type,quantity,reference_type,reference_id,created_by) values(p_variant_id,bid,'RESTOCK',p_quantity,'BATCH',bid,p_actor);
  perform public.enqueue_stock_transition(p_variant_id);
  return bid;
end $$;

create or replace function public.save_product(p_product_id uuid,p_payload jsonb,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid:=coalesce(p_product_id,gen_random_uuid()); x jsonb; y jsonb; sid uuid; cid uuid; vid uuid; begin
  if coalesce(p_payload->>'name','')='' or coalesce(p_payload->>'categoryId','')='' or (p_payload->>'weightGrams')::integer<=0 then raise exception using errcode='22023',message='INVALID_PRODUCT'; end if;
  if p_product_id is null then
    insert into public.products(id,category_id,name,slug,description,base_price,discount_price,weight_grams,is_active,is_archived)
    values(pid,(p_payload->>'categoryId')::uuid,p_payload->>'name',p_payload->>'slug',coalesce(p_payload->>'description',''),(p_payload->>'basePrice')::numeric,nullif(p_payload->>'discountPrice','')::numeric,(p_payload->>'weightGrams')::integer,coalesce((p_payload->>'isActive')::boolean,true),false);
  else
    update public.products set category_id=(p_payload->>'categoryId')::uuid,name=p_payload->>'name',slug=p_payload->>'slug',description=coalesce(p_payload->>'description',''),base_price=(p_payload->>'basePrice')::numeric,
      discount_price=nullif(p_payload->>'discountPrice','')::numeric,weight_grams=(p_payload->>'weightGrams')::integer,updated_at=now() where id=pid;
    if not found then raise exception using errcode='P0001',message='PRODUCT_NOT_FOUND'; end if;
  end if;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'sizes','[]')) loop
    insert into public.product_sizes(product_id,name,sort_order) values(pid,x->>'name',(x->>'sortOrder')::integer)
      on conflict(product_id,name) do update set sort_order=excluded.sort_order returning id into sid;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'colors','[]')) loop
    insert into public.product_colors(product_id,name,hex,sort_order) values(pid,x->>'name',x->>'hex',(x->>'sortOrder')::integer)
      on conflict(product_id,name) do update set hex=excluded.hex,sort_order=excluded.sort_order returning id into cid;
    if x ? 'images' then
      delete from public.product_color_images where color_id=cid;
      for y in select * from jsonb_array_elements(x->'images') loop
        insert into public.product_color_images(color_id,storage_path,sort_order) values(cid,y->>'path',(y->>'sortOrder')::integer);
      end loop;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'variants','[]')) loop
    select id into cid from public.product_colors where product_id=pid and name=x->>'color';
    select id into sid from public.product_sizes where product_id=pid and name=x->>'size';
    insert into public.product_variants(product_id,color_id,size_id,sku) values(pid,cid,sid,x->>'sku')
      on conflict(product_id,color_id,size_id) do update set is_active=true returning id into vid;
    if p_product_id is null and (x->>'initialStock')::integer>0 then
      perform public.restock_variant(vid,(x->>'initialStock')::integer,(x->>'costPerUnit')::numeric,current_date,x->>'batchCode',p_actor);
    end if;
  end loop;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id) values('ADMIN',p_actor::text,case when p_product_id is null then 'PRODUCT_CREATED' else 'PRODUCT_UPDATED' end,'PRODUCT',pid::text);
  return pid;
end $$;

create or replace function public.claim_telegram_jobs(p_worker text,p_limit integer default 10,p_lease_seconds integer default 60)
returns setof public.telegram_outbox language plpgsql security definer set search_path=public as $$ begin
  return query update public.telegram_outbox o set status='PROCESSING',leased_by=p_worker,lease_until=now()+make_interval(secs=>p_lease_seconds),attempts=attempts+1
  where o.id in (select id from public.telegram_outbox where available_at<=now() and (status='PENDING' or (status='PROCESSING' and lease_until<now())) and attempts<5 order by created_at for update skip locked limit p_limit)
  returning o.*;
end $$;

create or replace function public.check_monthly_negative_profit()
returns numeric language plpgsql security definer set search_path=public as $$
declare month_start date:=(date_trunc('month',now() at time zone 'Asia/Jakarta'))::date; month_end date:=(month_start+interval '1 month')::date;
  revenue numeric; hpp numeric; direct_cost numeric; expenses numeric; refunds_total numeric; profit numeric; key text:='profit:'||to_char(month_start,'YYYY-MM'); prior text;
begin
  select coalesce(sum(o.subtotal-o.discount_amount),0),coalesce(sum(o.refund_amount),0) into revenue,refunds_total from public.orders o where o.created_at>=month_start and o.created_at<month_end and o.payment_status in ('VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL');
  select coalesce(sum(a.quantity*a.cost_per_unit),0) into hpp from public.order_fifo_allocations a join public.order_items i on i.id=a.order_item_id join public.orders o on o.id=i.order_id where o.created_at>=month_start and o.created_at<month_end and o.payment_status in ('VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL');
  select coalesce(sum(c.packaging_cost+c.payment_fee+c.shipping_subsidy),0) into direct_cost from public.order_costs c join public.orders o on o.id=c.order_id where o.created_at>=month_start and o.created_at<month_end and o.payment_status in ('VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL');
  select coalesce(sum(amount),0) into expenses from public.business_expenses where expense_date>=month_start and expense_date<month_end;
  profit:=revenue-hpp-direct_cost-expenses-refunds_total;
  select state->>'value' into prior from public.notification_markers where marker_key=key for update;
  if profit<0 and prior is distinct from 'NEGATIVE' then
    insert into public.telegram_outbox(event_key,event_type,payload) values(key||':negative','NET_PROFIT_NEGATIVE',jsonb_build_object('month',to_char(month_start,'YYYY-MM'),'netProfit',profit)) on conflict(event_key) do nothing;
  end if;
  insert into public.notification_markers(marker_key,state) values(key,jsonb_build_object('value',case when profit<0 then 'NEGATIVE' else 'NORMAL' end,'netProfit',profit)) on conflict(marker_key) do update set state=excluded.state,updated_at=now();
  return profit;
end $$;

create or replace function public.cancel_order_restore_stock(p_order_number text,p_reason text,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o public.orders; a record; begin
  select * into o from public.orders where order_number=p_order_number for update;
  if not found then raise exception using errcode='P0001',message='ORDER_NOT_FOUND'; end if;
  if o.fulfillment_status='CANCELLED' then return; end if;
  if o.fulfillment_status in ('SHIPPED','DELIVERED') then raise exception using errcode='P0001',message='ORDER_CANNOT_CANCEL'; end if;
  for a in select fa.*,oi.variant_id from public.order_fifo_allocations fa join public.order_items oi on oi.id=fa.order_item_id where oi.order_id=o.id for update of fa loop
    update public.inventory_batches set remaining_qty=remaining_qty+a.quantity where id=a.batch_id;
    insert into public.stock_movements(variant_id,batch_id,movement_type,quantity,reference_type,reference_id,created_by)
      values(a.variant_id,a.batch_id,'RELEASE',a.quantity,'ORDER_CANCEL',o.id,p_actor);
  end loop;
  if o.voucher_id is not null then update public.vouchers set used_count=greatest(0,used_count-1) where id=o.voucher_id; end if;
  update public.orders set fulfillment_status='CANCELLED',cancellation_reason=p_reason,updated_at=now() where id=o.id;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,details) values('ADMIN',p_actor::text,'ORDER_CANCELLED','ORDER',o.id::text,jsonb_build_object('reason',p_reason));
end $$;

create or replace function public.submit_return_request(p_order_number text,p_email text,p_whatsapp text,p_resolution text,p_reason text,p_notes text,p_items jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare o public.orders; rid uuid:=gen_random_uuid(); rno text; x jsonb; oi public.order_items; begin
  select * into o from public.orders where order_number=p_order_number and customer_email=p_email and customer_whatsapp=p_whatsapp for share;
  if not found then raise exception using errcode='P0001',message='ORDER_NOT_FOUND'; end if;
  if o.fulfillment_status<>'DELIVERED' or o.actual_delivery_date is null or current_date-o.actual_delivery_date>7 then raise exception using errcode='P0001',message='RETURN_WINDOW_CLOSED'; end if;
  loop rno:='RTR-'||upper(substr(encode(gen_random_bytes(7),'hex'),1,10)); exit when not exists(select 1 from public.return_requests where return_number=rno); end loop;
  insert into public.return_requests(id,return_number,order_id,requested_resolution,reason_category,customer_notes) values(rid,rno,o.id,p_resolution,p_reason,p_notes);
  if p_items is null or jsonb_array_length(p_items)=0 then
    insert into public.return_items(return_id,order_item_id,quantity) select rid,id,quantity from public.order_items where order_id=o.id;
  else
    for x in select * from jsonb_array_elements(p_items) loop
      select * into oi from public.order_items where id=(x->>'orderItemId')::uuid and order_id=o.id;
      if not found or (x->>'quantity')::integer<1 or (x->>'quantity')::integer>oi.quantity then raise exception using errcode='22023',message='INVALID_RETURN_ITEM'; end if;
      insert into public.return_items(return_id,order_item_id,quantity) values(rid,oi.id,(x->>'quantity')::integer);
    end loop;
  end if;
  insert into public.telegram_outbox(event_key,event_type,payload) values('return:'||rid,'NEW_RETURN',jsonb_build_object('returnId',rid,'returnNumber',rno));
  return jsonb_build_object('id',rid,'returnNumber',rno,'status','PENDING','createdAt',now());
end $$;

create or replace function public.save_voucher(p_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare vid uuid:=coalesce(p_id,gen_random_uuid()); begin
  if p_id is null then
    insert into public.vouchers(id,code,promo_name,discount_type,discount_value,min_order_amount,max_discount_amount,scope,quota,starts_at,ends_at,is_active)
    values(vid,upper(p_data->>'code'),p_data->>'promoName',p_data->>'discountType',(p_data->>'discountValue')::numeric,coalesce((p_data->>'minOrderAmount')::numeric,0),nullif(p_data->>'maxDiscountAmount','')::numeric,p_data->>'scope',(p_data->>'quota')::integer,(p_data->>'startDate')::timestamptz,(p_data->>'endDate')::timestamptz,coalesce((p_data->>'isActive')::boolean,true));
  else
    update public.vouchers set code=coalesce(upper(p_data->>'code'),code),promo_name=coalesce(p_data->>'promoName',promo_name),discount_type=coalesce(p_data->>'discountType',discount_type),
      discount_value=coalesce((p_data->>'discountValue')::numeric,discount_value),min_order_amount=coalesce((p_data->>'minOrderAmount')::numeric,min_order_amount),
      max_discount_amount=case when p_data ? 'maxDiscountAmount' then nullif(p_data->>'maxDiscountAmount','')::numeric else max_discount_amount end,
      scope=coalesce(p_data->>'scope',scope),quota=coalesce((p_data->>'quota')::integer,quota),starts_at=coalesce((p_data->>'startDate')::timestamptz,starts_at),
      ends_at=coalesce((p_data->>'endDate')::timestamptz,ends_at),is_active=coalesce((p_data->>'isActive')::boolean,is_active),updated_at=now() where id=vid;
  end if;
  if p_data ? 'targetCategoryId' then delete from public.voucher_categories where voucher_id=vid; if nullif(p_data->>'targetCategoryId','') is not null then insert into public.voucher_categories values(vid,(p_data->>'targetCategoryId')::uuid); end if; end if;
  if p_data ? 'targetProductId' then delete from public.voucher_products where voucher_id=vid; if nullif(p_data->>'targetProductId','') is not null then insert into public.voucher_products values(vid,(p_data->>'targetProductId')::uuid); end if; end if;
  return vid;
end $$;

create or replace function public.record_order_refund(p_order_number text,p_amount numeric,p_reason text,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$ declare o public.orders; total_refund numeric; begin
  select * into o from public.orders where order_number=p_order_number for update;if not found then raise exception using errcode='P0001',message='ORDER_NOT_FOUND';end if;
  total_refund:=o.refund_amount+p_amount;if p_amount<=0 or total_refund>o.total_amount then raise exception using errcode='22023',message='INVALID_REFUND_AMOUNT';end if;
  insert into public.refunds(order_id,amount,reason,created_by) values(o.id,p_amount,p_reason,p_actor);
  update public.orders set refund_amount=total_refund,refund_reason=p_reason,payment_status=case when total_refund>=total_amount then 'REFUNDED_FULL'::public.payment_status else 'REFUNDED_PARTIAL'::public.payment_status end,updated_at=now() where id=o.id;
end $$;

create or replace function public.update_return_status(p_return_number text,p_status text,p_admin_notes text,p_inspection text,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.return_requests; item record; allocation record; remaining integer; restored integer; begin
  select * into r from public.return_requests where return_number=p_return_number for update;if not found then raise exception using errcode='P0001',message='RETURN_NOT_FOUND';end if;
  if r.status='COMPLETED' then return; end if;
  if p_inspection='RESTOCKED_GOOD' and r.inspection_result is distinct from 'RESTOCKED_GOOD' then
    for item in select ri.quantity,oi.id order_item_id,oi.variant_id from public.return_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.return_id=r.id loop
      remaining:=item.quantity;
      for allocation in select * from public.order_fifo_allocations where order_item_id=item.order_item_id order by id for update loop
        exit when remaining=0;restored:=least(remaining,allocation.quantity);
        update public.inventory_batches set remaining_qty=least(initial_qty,remaining_qty+restored) where id=allocation.batch_id;
        insert into public.stock_movements(variant_id,batch_id,movement_type,quantity,reference_type,reference_id,created_by) values(item.variant_id,allocation.batch_id,'RETURN_GOOD',restored,'RETURN',r.id,p_actor);
        remaining:=remaining-restored;
      end loop;
      perform public.enqueue_stock_transition(item.variant_id);
    end loop;
  end if;
  update public.return_requests set status=p_status,admin_notes=p_admin_notes,inspection_result=p_inspection,
    received_at=case when p_status in ('RECEIVED_INSPECTED','COMPLETED') then coalesce(received_at,now()) else received_at end,
    resolved_at=case when p_status='COMPLETED' then now() else resolved_at end,updated_at=now() where id=r.id;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,details) values('ADMIN',p_actor::text,'RETURN_STATUS_UPDATED','RETURN',r.id::text,jsonb_build_object('status',p_status,'inspection',p_inspection));
end $$;

revoke all on function public.payment_method_for_total(numeric,boolean,boolean) from public;
revoke all on function public.upsert_checkout_reservation(uuid,text,text,jsonb,text,text,text,text,text,text,numeric,text,text) from public;
revoke all on function public.release_expired_reservations(integer) from public;
revoke all on function public.enqueue_stock_transition(uuid) from public;
revoke all on function public.finalize_checkout_order(uuid,text,jsonb,text,text) from public;
revoke all on function public.restock_variant(uuid,integer,numeric,date,text,uuid) from public;
revoke all on function public.save_product(uuid,jsonb,uuid) from public;
revoke all on function public.claim_telegram_jobs(text,integer,integer) from public;
revoke all on function public.check_monthly_negative_profit() from public;
revoke all on function public.cancel_order_restore_stock(text,text,uuid) from public;
revoke all on function public.submit_return_request(text,text,text,text,text,text,jsonb) from public;
revoke all on function public.save_voucher(uuid,jsonb) from public;
revoke all on function public.record_order_refund(text,numeric,text,uuid) from public;
revoke all on function public.update_return_status(text,text,text,text,uuid) from public;
grant execute on all functions in schema public to service_role;
