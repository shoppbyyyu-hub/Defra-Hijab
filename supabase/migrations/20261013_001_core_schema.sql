-- Defra Hijab: skema inti. Aman dijalankan pada project Supabase kosong.
-- Tidak membuat akun, data contoh, pesanan, stok, maupun kredensial.
create extension if not exists pgcrypto;

create type public.owner_role as enum ('OWNER');
create type public.reservation_status as enum ('ACTIVE','CONVERTED','EXPIRED','CANCELLED','REQUIRES_RECOVERY');
create type public.payment_method as enum ('QRIS','BANK_TRANSFER');
create type public.payment_status as enum ('WAITING_VERIFICATION','REVISION_REQUESTED','VERIFIED','REFUNDED_PARTIAL','REFUNDED_FULL');
create type public.fulfillment_status as enum ('WAITING_PAYMENT_VERIFIED','PACKED','SHIPPED','DELIVERED','CANCELLED');
create type public.stock_movement_type as enum ('RESTOCK','RESERVE','RELEASE','SALE','RETURN_GOOD','DAMAGE','ADJUSTMENT');
create type public.outbox_status as enum ('PENDING','PROCESSING','SENT','FAILED');

create table public.owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.owner_role not null default 'OWNER',
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id boolean primary key default true check (id),
  whatsapp_number text not null default '',
  origin_address text not null default '',
  origin_destination_id text,
  origin_label text,
  origin_province text,
  origin_city text,
  origin_subdistrict text,
  origin_postal_code text,
  qris_enabled boolean not null default false,
  bank_transfer_enabled boolean not null default false,
  bank_name text not null default '',
  bank_account_number text not null default '',
  bank_account_holder text not null default '',
  qris_merchant_payload text,
  packaging_weight_grams integer not null default 0 check (packaging_weight_grams >= 0),
  packaging_cost numeric(14,2) not null default 0 check (packaging_cost >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  allow_voucher_on_discounted_products boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check ((origin_destination_id is null) = (origin_label is null))
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, image_path text, sort_order integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id),
  name text not null, slug text not null unique, description text not null default '',
  base_price numeric(14,2) not null check (base_price >= 0),
  discount_price numeric(14,2) check (discount_price >= 0 and discount_price < base_price),
  weight_grams integer not null check (weight_grams > 0), is_active boolean not null default true,
  is_archived boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_sizes (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  name text not null, sort_order integer not null default 0, unique(product_id,name)
);
create table public.product_colors (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  name text not null, hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'), sort_order integer not null default 0,
  unique(product_id,name)
);
create table public.product_color_images (
  id uuid primary key default gen_random_uuid(), color_id uuid not null references public.product_colors(id) on delete cascade,
  storage_path text not null, sort_order integer not null default 0, unique(color_id,storage_path)
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  color_id uuid not null references public.product_colors(id), size_id uuid not null references public.product_sizes(id),
  sku text not null unique, is_active boolean not null default true, created_at timestamptz not null default now(),
  unique(product_id,color_id,size_id)
);
create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id),
  batch_code text not null unique, initial_qty integer not null check (initial_qty > 0),
  remaining_qty integer not null check (remaining_qty >= 0 and remaining_qty <= initial_qty),
  cost_per_unit numeric(14,2) not null check (cost_per_unit >= 0), arrival_date date not null,
  created_at timestamptz not null default now()
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id),
  batch_id uuid references public.inventory_batches(id), movement_type public.stock_movement_type not null,
  quantity integer not null check (quantity <> 0), reference_type text, reference_id uuid,
  notes text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table public.hero_banners (
  id uuid primary key default gen_random_uuid(), desktop_path text not null, mobile_path text not null,
  focal_x numeric(5,2) not null default 50, focal_y numeric(5,2) not null default 50,
  mobile_focal_x numeric(5,2) not null default 50, mobile_focal_y numeric(5,2) not null default 50,
  is_active boolean not null default false, created_at timestamptz not null default now()
);
create table public.campaign_gallery (
  id uuid primary key default gen_random_uuid(), storage_path text not null, aspect_ratio text not null check (aspect_ratio in ('2:1','4:5')),
  sort_order integer not null default 0, is_active boolean not null default true
);
create table public.community_reels (
  id uuid primary key default gen_random_uuid(), title text not null, youtube_video_id text not null,
  poster_path text, sort_order integer not null default 0, is_active boolean not null default true
);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code = upper(code)), promo_name text not null,
  discount_type text not null check (discount_type in ('NOMINAL','PERCENTAGE')),
  discount_value numeric(14,2) not null check (discount_value > 0), min_order_amount numeric(14,2) not null default 0,
  max_discount_amount numeric(14,2), scope text not null check (scope in ('ALL','CATEGORY','PRODUCT')),
  quota integer not null check (quota >= 0), used_count integer not null default 0 check (used_count >= 0),
  reserved_quota integer not null default 0 check (reserved_quota >= 0), starts_at timestamptz not null,
  ends_at timestamptz not null, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (starts_at < ends_at), check (used_count + reserved_quota <= quota)
);
create table public.voucher_categories (voucher_id uuid references public.vouchers(id) on delete cascade, category_id uuid references public.categories(id) on delete cascade, primary key(voucher_id,category_id));
create table public.voucher_products (voucher_id uuid references public.vouchers(id) on delete cascade, product_id uuid references public.products(id) on delete cascade, primary key(voucher_id,product_id));

create table public.checkout_reservations (
  id uuid primary key default gen_random_uuid(), session_token_hash text not null,
  status public.reservation_status not null default 'ACTIVE', expires_at timestamptz not null,
  shipping_origin_id text not null, destination_id text not null, destination_label text not null,
  shipping_provider text not null, shipping_service_code text not null, shipping_service_label text not null,
  shipping_fee numeric(14,2) not null check (shipping_fee >= 0), shipping_etd text,
  weight_grams integer not null check (weight_grams > 0), subtotal numeric(14,2) not null check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(14,2) generated always as (subtotal - discount_amount + shipping_fee) stored,
  voucher_id uuid references public.vouchers(id), payment_method public.payment_method not null,
  request_key text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  converted_order_id uuid, unique(session_token_hash,request_key), check (discount_amount <= subtotal)
);
create table public.reservation_items (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.checkout_reservations(id) on delete cascade,
  product_id uuid not null references public.products(id), variant_id uuid not null references public.product_variants(id), quantity integer not null check (quantity > 0),
  product_name text not null, color_name text not null, size_name text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0), weight_grams integer not null check (weight_grams > 0),
  image_path text, unique(reservation_id,variant_id)
);
create table public.reservation_stock_allocations (
  reservation_id uuid references public.checkout_reservations(id) on delete cascade,
  variant_id uuid references public.product_variants(id), quantity integer not null check(quantity > 0),
  released_at timestamptz, converted_at timestamptz, primary key(reservation_id,variant_id)
);
create table public.voucher_reservations (
  reservation_id uuid primary key references public.checkout_reservations(id) on delete cascade,
  voucher_id uuid not null references public.vouchers(id), released_at timestamptz, converted_at timestamptz
);

create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique, reservation_id uuid not null unique references public.checkout_reservations(id),
  customer_name text not null, customer_email text not null, customer_whatsapp text not null, customer_birth_date date not null,
  address_line text not null, province text not null, city text not null, subdistrict text not null,
  village text not null, postal_code text not null, shipping_origin_id text not null, destination_id text not null,
  subtotal numeric(14,2) not null, discount_amount numeric(14,2) not null, shipping_fee numeric(14,2) not null,
  shipping_provider text not null, shipping_service_code text not null, shipping_service_label text not null,
  total_amount numeric(14,2) not null, voucher_id uuid references public.vouchers(id), voucher_code text,
  payment_method public.payment_method not null, payment_status public.payment_status not null default 'WAITING_VERIFICATION',
  fulfillment_status public.fulfillment_status not null default 'WAITING_PAYMENT_VERIFIED',
  rejection_reason text, rejection_deadline timestamptz, tracking_number text, actual_delivery_date date,
  cancellation_reason text, refund_amount numeric(14,2) not null default 0, refund_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.checkout_reservations add constraint checkout_reservation_order_fk foreign key(converted_order_id) references public.orders(id);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), variant_id uuid not null references public.product_variants(id),
  product_name text not null, color_name text not null, size_name text not null,
  unit_price numeric(14,2) not null, quantity integer not null check(quantity > 0), line_total numeric(14,2) not null,
  unique(order_id,variant_id)
);
create table public.order_fifo_allocations (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null references public.order_items(id),
  batch_id uuid not null references public.inventory_batches(id), quantity integer not null check(quantity > 0),
  cost_per_unit numeric(14,2) not null, unique(order_item_id,batch_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  method public.payment_method not null, amount numeric(14,2) not null, proof_bucket text not null default 'payment-proofs',
  proof_path text not null, proof_mime text not null, status public.payment_status not null default 'WAITING_VERIFICATION',
  verified_at timestamptz, verified_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.order_costs (
  order_id uuid primary key references public.orders(id), packaging_cost numeric(14,2) not null default 0,
  payment_fee numeric(14,2) not null default 0, shipping_actual_cost numeric(14,2) not null default 0,
  shipping_subsidy numeric(14,2) not null default 0, notes text
);
create table public.business_expenses (
  id uuid primary key default gen_random_uuid(), category text not null, description text not null,
  amount numeric(14,2) not null check(amount > 0), period_month text not null check(period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  expense_date date not null, receipt_bucket text, receipt_path text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);

create table public.return_requests (
  id uuid primary key default gen_random_uuid(), return_number text not null unique, order_id uuid not null references public.orders(id),
  requested_resolution text not null check(requested_resolution in ('REFUND','REPLACEMENT')),
  reason_category text not null check(reason_category in ('WRONG_ITEM','DAMAGED','DEFECTIVE')),
  customer_notes text not null, status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','RECEIVED_INSPECTED','COMPLETED')),
  admin_notes text, inspection_result text check(inspection_result in ('RESTOCKED_GOOD','RECORDED_DAMAGED_LOSS')),
  received_at timestamptz, resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.return_items (
  id uuid primary key default gen_random_uuid(), return_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id), quantity integer not null check(quantity > 0),
  resolution_amount numeric(14,2) not null default 0, unique(return_id,order_item_id)
);
create table public.return_proofs (
  id uuid primary key default gen_random_uuid(), return_id uuid not null references public.return_requests(id) on delete cascade,
  bucket text not null default 'return-proofs', storage_path text not null, unique(return_id,storage_path)
);
create table public.refunds (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), return_id uuid references public.return_requests(id),
  amount numeric(14,2) not null check(amount > 0), reason text not null, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_type text not null check(actor_type in ('BUYER','ADMIN','SYSTEM')),
  actor_id text, action text not null, entity_type text not null, entity_id text not null,
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.telegram_outbox (
  id uuid primary key default gen_random_uuid(), event_key text not null unique, event_type text not null,
  payload jsonb not null, status public.outbox_status not null default 'PENDING', attempts integer not null default 0,
  available_at timestamptz not null default now(), lease_until timestamptz, leased_by text,
  last_error text, sent_at timestamptz, created_at timestamptz not null default now()
);
create table public.notification_markers (
  marker_key text primary key, state jsonb not null, updated_at timestamptz not null default now()
);

create index categories_active_idx on public.categories(is_active,sort_order);
create index products_catalog_idx on public.products(is_active,is_archived,category_id,created_at desc);
create index variants_product_idx on public.product_variants(product_id,is_active);
create index batches_fifo_idx on public.inventory_batches(variant_id,arrival_date,created_at) where remaining_qty > 0;
create index reservations_expiry_idx on public.checkout_reservations(expires_at) where status='ACTIVE';
create index reservation_session_idx on public.checkout_reservations(session_token_hash,status);
create index orders_email_idx on public.orders(customer_email);
create index orders_whatsapp_idx on public.orders(customer_whatsapp);
create index orders_created_idx on public.orders(created_at desc);
create index returns_order_idx on public.return_requests(order_id,created_at desc);
create index expenses_period_idx on public.business_expenses(period_month,expense_date);
create index outbox_claim_idx on public.telegram_outbox(status,available_at,lease_until);
