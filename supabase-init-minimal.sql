create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null default '',
  price numeric not null,
  category text not null default '其他',
  image text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "Public read products" on public.products;
create policy "Public read products"
on public.products for select to anon, authenticated using (true);

drop policy if exists "Service role manages products" on public.products;
create policy "Service role manages products"
on public.products for all to service_role using (true) with check (true);

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "Service role manages product images" on storage.objects;
create policy "Service role manages product images"
on storage.objects for all to service_role
using (bucket_id = 'product-images') with check (bucket_id = 'product-images');