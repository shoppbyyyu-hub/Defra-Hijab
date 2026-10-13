-- Koreksi inventaris terpisah dari edit produk. Seluruh perubahan dikunci dan
-- dicatat; snapshot HPP pada order_fifo_allocations tidak pernah diubah.
create or replace function public.restock_variant_with_notes(p_variant_id uuid,p_quantity integer,p_cost numeric,p_arrival date,p_batch_code text,p_notes text,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_batch_id uuid; begin
  v_batch_id:=public.restock_variant(p_variant_id,p_quantity,p_cost,p_arrival,p_batch_code,p_actor);
  update public.stock_movements set notes=nullif(trim(coalesce(p_notes,'')),'') where batch_id=v_batch_id and movement_type='RESTOCK';
  return v_batch_id;
end $$;

create or replace function public.correct_variant_stock(
  p_variant_id uuid,
  p_target_physical integer,
  p_reason text,
  p_actor uuid
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare current_physical integer; active_reserved integer; difference integer; remaining_adjustment integer;
  batch_row record; new_batch_id uuid; latest_cost numeric; begin
  if not exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if p_target_physical<0 or length(trim(coalesce(p_reason,'')))<3 then raise exception using errcode='22023',message='INVALID_STOCK_CORRECTION'; end if;
  perform 1 from public.product_variants where id=p_variant_id for update;
  if not found then raise exception using errcode='P0001',message='VARIANT_NOT_FOUND'; end if;
  perform 1 from public.inventory_batches where variant_id=p_variant_id for update;
  select coalesce(sum(remaining_qty),0)::integer into current_physical from public.inventory_batches where variant_id=p_variant_id;
  select coalesce(sum(a.quantity),0)::integer into active_reserved
    from public.reservation_stock_allocations a join public.checkout_reservations r on r.id=a.reservation_id
    where a.variant_id=p_variant_id and a.released_at is null and a.converted_at is null and r.status='ACTIVE' and r.expires_at>now();
  if p_target_physical<active_reserved then raise exception using errcode='23514',message='STOCK_BELOW_ACTIVE_RESERVATIONS'; end if;
  difference:=p_target_physical-current_physical;
  if difference=0 then return jsonb_build_object('changed',false,'physicalStock',current_physical,'activeReservations',active_reserved); end if;
  if difference>0 then
    select cost_per_unit into latest_cost from public.inventory_batches where variant_id=p_variant_id order by arrival_date desc,created_at desc limit 1;
    if latest_cost is null then raise exception using errcode='22023',message='RESTOCK_REQUIRED_FOR_EMPTY_VARIANT'; end if;
    new_batch_id:=gen_random_uuid();
    insert into public.inventory_batches(id,variant_id,batch_code,initial_qty,remaining_qty,cost_per_unit,arrival_date)
      values(new_batch_id,p_variant_id,'ADJ-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'),difference,difference,latest_cost,current_date);
    insert into public.stock_movements(variant_id,batch_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
      values(p_variant_id,new_batch_id,'ADJUSTMENT',difference,'BATCH',new_batch_id,trim(p_reason),p_actor);
  else
    remaining_adjustment:=-difference;
    for batch_row in select id,remaining_qty from public.inventory_batches where variant_id=p_variant_id and remaining_qty>0 order by arrival_date desc,created_at desc for update loop
      exit when remaining_adjustment=0;
      difference:=least(remaining_adjustment,batch_row.remaining_qty);
      update public.inventory_batches set remaining_qty=remaining_qty-difference where id=batch_row.id;
      insert into public.stock_movements(variant_id,batch_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
        values(p_variant_id,batch_row.id,'ADJUSTMENT',-difference,'BATCH',batch_row.id,trim(p_reason),p_actor);
      remaining_adjustment:=remaining_adjustment-difference;
    end loop;
  end if;
  perform public.enqueue_stock_transition(p_variant_id);
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
    values('ADMIN',p_actor::text,'STOCK_CORRECTED','PRODUCT_VARIANT',p_variant_id::text,jsonb_build_object('before',current_physical,'after',p_target_physical,'activeReservations',active_reserved,'reason',trim(p_reason)));
  return jsonb_build_object('changed',true,'before',current_physical,'physicalStock',p_target_physical,'activeReservations',active_reserved);
end $$;

create or replace function public.correct_inventory_batch_cost(
  p_batch_id uuid,
  p_cost_per_unit numeric,
  p_reason text,
  p_actor uuid
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare batch_row public.inventory_batches; old_cost numeric; begin
  if not exists(select 1 from public.owner_profiles where user_id=p_actor and role='OWNER') then raise exception 'OWNER_REQUIRED'; end if;
  if p_cost_per_unit<0 or length(trim(coalesce(p_reason,'')))<3 then raise exception using errcode='22023',message='INVALID_BATCH_COST_CORRECTION'; end if;
  select * into batch_row from public.inventory_batches where id=p_batch_id for update;
  if not found then raise exception using errcode='P0001',message='BATCH_NOT_FOUND'; end if;
  if exists(select 1 from public.order_fifo_allocations where batch_id=p_batch_id) then
    raise exception using errcode='23514',message='BATCH_COST_ALREADY_USED';
  end if;
  old_cost:=batch_row.cost_per_unit;
  update public.inventory_batches set cost_per_unit=p_cost_per_unit where id=p_batch_id;
  insert into public.audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
    values('ADMIN',p_actor::text,'BATCH_COST_CORRECTED','INVENTORY_BATCH',p_batch_id::text,jsonb_build_object('before',old_cost,'after',p_cost_per_unit,'reason',trim(p_reason)));
  return jsonb_build_object('changed',old_cost<>p_cost_per_unit,'before',old_cost,'costPerUnit',p_cost_per_unit);
end $$;

revoke all on function public.correct_variant_stock(uuid,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.correct_inventory_batch_cost(uuid,numeric,text,uuid) from public,anon,authenticated;
revoke all on function public.restock_variant_with_notes(uuid,integer,numeric,date,text,text,uuid) from public,anon,authenticated;
grant execute on function public.correct_variant_stock(uuid,integer,text,uuid) to service_role;
grant execute on function public.correct_inventory_batch_cost(uuid,numeric,text,uuid) to service_role;
grant execute on function public.restock_variant_with_notes(uuid,integer,numeric,date,text,text,uuid) to service_role;
