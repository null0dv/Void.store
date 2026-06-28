-- Run this in Supabase Dashboard -> SQL Editor

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

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

create policy "Public read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "Service role manages products"
on public.products
for all
to service_role
using (true)
with check (true);

create policy "Public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "Service role manages product images"
on storage.objects
for all
to service_role
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');