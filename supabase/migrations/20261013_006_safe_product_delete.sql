-- Hapus produk hanya ketika tidak pernah direferensikan reservasi, pesanan, atau retur.
-- Seluruh pemeriksaan dan penghapusan berjalan dalam satu transaksi PostgreSQL.
create or replace function public.delete_product_if_unreferenced(
  p_product_id uuid,
  p_actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_count integer := 0;
  order_count integer := 0;
  return_count integer := 0;
begin
  if not exists (
    select 1 from public.owner_profiles
    where user_id = p_actor and role = 'OWNER'
  ) then
    raise exception 'OWNER_REQUIRED';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'NOT_FOUND');
  end if;

  select count(*) into reservation_count
  from public.reservation_items
  where product_id = p_product_id;

  select count(*) into order_count
  from public.order_items oi
  join public.product_variants pv on pv.id = oi.variant_id
  where pv.product_id = p_product_id;

  select count(*) into return_count
  from public.return_items ri
  join public.order_items oi on oi.id = ri.order_item_id
  join public.product_variants pv on pv.id = oi.variant_id
  where pv.product_id = p_product_id;

  if reservation_count > 0 or order_count > 0 or return_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'PRODUCT_REFERENCED',
      'references', jsonb_build_object(
        'reservations', reservation_count,
        'orders', order_count,
        'returns', return_count
      )
    );
  end if;

  -- Relasi katalog dan inventaris boleh dibersihkan karena tidak memiliki
  -- referensi transaksi. Audit log lama sengaja tidak dihapus.
  delete from public.voucher_products where product_id = p_product_id;
  delete from public.stock_movements
  where variant_id in (select id from public.product_variants where product_id = p_product_id);
  delete from public.inventory_batches
  where variant_id in (select id from public.product_variants where product_id = p_product_id);
  delete from public.product_variants where product_id = p_product_id;
  delete from public.products where id = p_product_id;

  insert into public.audit_logs(actor_type, actor_id, action, entity_type, entity_id)
  values ('ADMIN', p_actor::text, 'PRODUCT_DELETED', 'PRODUCT', p_product_id::text);

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.delete_product_if_unreferenced(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_product_if_unreferenced(uuid, uuid) to service_role;
