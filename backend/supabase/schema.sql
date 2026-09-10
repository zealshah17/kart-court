begin;
create table if not exists public.product_extractions (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  asin text not null check (asin ~ '^[A-Z0-9]{10}$'),
  product jsonb not null check (jsonb_typeof(product) = 'object'),
  reviews jsonb not null default '[]'::jsonb check (jsonb_typeof(reviews) = 'array'),
  extraction jsonb not null check (jsonb_typeof(extraction) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists product_extractions_asin_created_at_idx
  on public.product_extractions (asin, created_at desc);
alter table public.product_extractions enable row level security;
revoke all on table public.product_extractions from public, anon, authenticated;
grant select, insert on table public.product_extractions to service_role;
commit;
