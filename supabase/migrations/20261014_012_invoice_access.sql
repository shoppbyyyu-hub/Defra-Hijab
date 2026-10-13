begin;

create table if not exists public.order_invoice_access (
  order_id uuid primary key references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_invoice_access_expiry_idx
  on public.order_invoice_access(expires_at);

alter table public.order_invoice_access enable row level security;
revoke all on table public.order_invoice_access from anon, authenticated;

commit;
