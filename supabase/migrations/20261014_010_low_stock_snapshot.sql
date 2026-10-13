-- Memperkaya snapshot LOW_STOCK tanpa mengubah marker transisi atau event_key.
-- Jalankan setelah 20261013_009_inventory_corrections.sql.
create or replace function public.enqueue_stock_transition(p_variant_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  available integer; threshold integer; next_state text; previous text;
  variant_snapshot record; batch_snapshot jsonb;
begin
  select low_stock_threshold into threshold from public.store_settings where id=true;

  select pv.sku,p.name product_name,c.name color_name,s.name size_name
  into variant_snapshot
  from public.product_variants pv
  join public.products p on p.id=pv.product_id
  join public.product_colors c on c.id=pv.color_id
  join public.product_sizes s on s.id=pv.size_id
  where pv.id=p_variant_id;

  select coalesce(sum(b.remaining_qty),0)-coalesce((
    select sum(a.quantity)
    from public.reservation_stock_allocations a
    join public.checkout_reservations r on r.id=a.reservation_id
    where a.variant_id=p_variant_id and r.status='ACTIVE' and r.expires_at>now() and a.released_at is null
  ),0)
  into available from public.inventory_batches b where b.variant_id=p_variant_id;

  select coalesce(jsonb_agg(
    jsonb_build_object('batchCode',q.batch_code,'remainingQty',q.remaining_qty)
    order by q.arrival_date,q.created_at,q.id
  ),'[]'::jsonb)
  into batch_snapshot
  from (
    select id,batch_code,remaining_qty,arrival_date,created_at
    from public.inventory_batches
    where variant_id=p_variant_id and remaining_qty>0
  ) q;

  next_state:=case when available<=0 then 'OUT' when available<=threshold then 'LOW' else 'OK' end;
  select state->>'value' into previous
  from public.notification_markers where marker_key='stock:'||p_variant_id for update;

  if previous is distinct from next_state then
    insert into public.notification_markers(marker_key,state)
    values('stock:'||p_variant_id,jsonb_build_object('value',next_state))
    on conflict(marker_key) do update set state=excluded.state,updated_at=now();
    if next_state<>'OK' then
      insert into public.telegram_outbox(event_key,event_type,payload)
      values(
        'stock:'||p_variant_id||':'||next_state||':'||extract(epoch from clock_timestamp())::bigint,
        'LOW_STOCK',
        jsonb_build_object(
          'variantId',p_variant_id,'sku',variant_snapshot.sku,
          'productName',variant_snapshot.product_name,'color',variant_snapshot.color_name,
          'size',variant_snapshot.size_name,'available',greatest(available,0),
          'state',next_state,'batches',batch_snapshot
        )
      );
    end if;
  end if;
end $$;

revoke all on function public.enqueue_stock_transition(uuid) from public;
