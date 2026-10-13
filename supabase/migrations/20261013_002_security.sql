-- Jalankan setelah 001. Semua operasi privat dilakukan endpoint server dengan service role.
create or replace function public.is_owner() returns boolean language sql stable security definer
set search_path=public,auth as $$ select exists(select 1 from public.owner_profiles where user_id=auth.uid() and role='OWNER') $$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

alter table public.owner_profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_color_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.hero_banners enable row level security;
alter table public.campaign_gallery enable row level security;
alter table public.community_reels enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_categories enable row level security;
alter table public.voucher_products enable row level security;
alter table public.checkout_reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.reservation_stock_allocations enable row level security;
alter table public.voucher_reservations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_fifo_allocations enable row level security;
alter table public.payments enable row level security;
alter table public.order_costs enable row level security;
alter table public.business_expenses enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;
alter table public.return_proofs enable row level security;
alter table public.refunds enable row level security;
alter table public.audit_logs enable row level security;
alter table public.telegram_outbox enable row level security;
alter table public.notification_markers enable row level security;

revoke all on all tables in schema public from anon,authenticated;
grant select on public.categories,public.products,public.product_sizes,public.product_colors,
  public.product_color_images,public.product_variants,public.hero_banners,public.campaign_gallery,
  public.community_reels to anon,authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

create policy owner_profile_self on public.owner_profiles for select to authenticated using(user_id=auth.uid());
create policy public_active_categories on public.categories for select to anon,authenticated using(is_active);
create policy public_active_products on public.products for select to anon,authenticated using(is_active and not is_archived);
create policy public_product_sizes on public.product_sizes for select to anon,authenticated
  using(exists(select 1 from public.products p where p.id=product_id and p.is_active and not p.is_archived));
create policy public_product_colors on public.product_colors for select to anon,authenticated
  using(exists(select 1 from public.products p where p.id=product_id and p.is_active and not p.is_archived));
create policy public_product_images on public.product_color_images for select to anon,authenticated
  using(exists(select 1 from public.product_colors c join public.products p on p.id=c.product_id where c.id=color_id and p.is_active and not p.is_archived));
create policy public_active_variants on public.product_variants for select to anon,authenticated
  using(is_active and exists(select 1 from public.products p where p.id=product_id and p.is_active and not p.is_archived));
create policy public_active_banners on public.hero_banners for select to anon,authenticated using(is_active);
create policy public_active_campaign on public.campaign_gallery for select to anon,authenticated using(is_active);
create policy public_active_reels on public.community_reels for select to anon,authenticated using(is_active);

-- Pengaturan publik sengaja berupa view dengan kolom terbatas. Payload QRIS merchant tidak pernah dibaca browser.
create view public.public_store_settings with (security_invoker=true) as
select whatsapp_number,qris_enabled,bank_transfer_enabled,bank_name,bank_account_number,bank_account_holder
from public.store_settings where id=true;
grant select on public.public_store_settings to anon,authenticated;

create view public.variant_stock with (security_invoker=true) as
select pv.id variant_id,
  coalesce((select sum(b.remaining_qty) from public.inventory_batches b where b.variant_id=pv.id),0)::integer physical_stock,
  coalesce((select sum(a.quantity) from public.reservation_stock_allocations a join public.checkout_reservations r on r.id=a.reservation_id
    where a.variant_id=pv.id and r.status='ACTIVE' and r.expires_at>now() and a.released_at is null),0)::integer active_reservations
from public.product_variants pv;
grant select on public.variant_stock to service_role;

-- Owner dapat mengelola data melalui API server. Policy ini juga melindungi akses dashboard langsung.
do $$ declare t text; begin
  foreach t in array array['store_settings','categories','products','product_sizes','product_colors','product_color_images',
    'product_variants','inventory_batches','stock_movements','hero_banners','campaign_gallery','community_reels','vouchers',
    'voucher_categories','voucher_products','checkout_reservations','reservation_items','reservation_stock_allocations',
    'voucher_reservations','orders','order_items','order_fifo_allocations','payments','order_costs','business_expenses',
    'return_requests','return_items','return_proofs','refunds','audit_logs','telegram_outbox','notification_markers'] loop
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())',t);
  end loop;
end $$;

grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('catalog-media','catalog-media',true,2000000,array['image/jpeg','image/png','image/webp']),
 ('payment-proofs','payment-proofs',false,2000000,array['image/jpeg','image/png','image/webp']),
 ('return-proofs','return-proofs',false,2000000,array['image/jpeg','image/png','image/webp']),
 ('expense-documents','expense-documents',false,2000000,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy public_catalog_files on storage.objects for select to anon,authenticated using(bucket_id='catalog-media');
create policy owner_storage_select on storage.objects for select to authenticated using(public.is_owner());
create policy owner_storage_insert on storage.objects for insert to authenticated with check(public.is_owner());
create policy owner_storage_update on storage.objects for update to authenticated using(public.is_owner()) with check(public.is_owner());
create policy owner_storage_delete on storage.objects for delete to authenticated using(public.is_owner());

alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public grant all on tables to service_role;
