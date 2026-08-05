-- MÓDULO EDITOR DE LOJA
-- Execute depois do schema.sql da dashboard.
create extension if not exists "pgcrypto";

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Minha loja',
  description text,
  whatsapp text,
  instagram text,
  logo_url text,
  banner_url text,
  primary_color text not null default '#2563eb',
  accent_color text not null default '#0f172a',
  product_layout text not null default 'grid' check (product_layout in ('grid','list')),
  checkout_mode text not null default 'whatsapp' check (checkout_mode in ('whatsapp','catalog_only')),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  estimated_time text,
  order_note text,
  accepts_pix boolean not null default true,
  accepts_card boolean not null default true,
  accepts_cash boolean not null default true,
  pix_key text,
  pix_receiver text,
  slug text not null unique,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'ri-price-tag-3-line',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,name)
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.store_categories(id) on delete set null,
  name text not null,
  description text,
  sku text,
  image_url text,
  price numeric(12,2) not null default 0 check(price >= 0),
  sale_price numeric(12,2) check(sale_price is null or sale_price >= 0),
  stock integer not null default 0 check(stock >= 0),
  stock_mode text not null default 'unlimited' check(stock_mode in ('unlimited','controlled','out')),
  external_url text,
  active boolean not null default true,
  featured boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_product_variations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  name text not null,
  price_adjustment numeric(12,2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists store_categories_store_idx on public.store_categories(store_id,position);
create index if not exists store_products_store_idx on public.store_products(store_id,active,position);
create index if not exists store_products_category_idx on public.store_products(category_id);
create index if not exists store_variations_product_idx on public.store_product_variations(product_id,position);

alter table public.stores enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_variations enable row level security;

-- Dono: acesso completo. Público: somente lojas publicadas e produtos ativos.
drop policy if exists stores_owner_all on public.stores;
create policy stores_owner_all on public.stores for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores for select to anon using(is_published=true);

drop policy if exists categories_owner_all on public.store_categories;
create policy categories_owner_all on public.store_categories for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
drop policy if exists categories_public_read on public.store_categories;
create policy categories_public_read on public.store_categories for select to anon using(exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));

drop policy if exists products_owner_all on public.store_products;
create policy products_owner_all on public.store_products for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
drop policy if exists products_public_read on public.store_products;
create policy products_public_read on public.store_products for select to anon using(active=true and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));

drop policy if exists variations_owner_all on public.store_product_variations;
create policy variations_owner_all on public.store_product_variations for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id);
drop policy if exists variations_public_read on public.store_product_variations;
create policy variations_public_read on public.store_product_variations for select to anon using(exists(select 1 from public.store_products p join public.stores s on s.id=p.store_id where p.id=product_id and p.active=true and s.is_published=true));

create or replace function public.store_set_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists stores_updated_at on public.stores; create trigger stores_updated_at before update on public.stores for each row execute function public.store_set_updated_at();
drop trigger if exists store_categories_updated_at on public.store_categories; create trigger store_categories_updated_at before update on public.store_categories for each row execute function public.store_set_updated_at();
drop trigger if exists store_products_updated_at on public.store_products; create trigger store_products_updated_at before update on public.store_products for each row execute function public.store_set_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('store-media','store-media',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists store_media_public_read on storage.objects;
create policy store_media_public_read on storage.objects for select to public using(bucket_id='store-media');
drop policy if exists store_media_insert_own on storage.objects;
create policy store_media_insert_own on storage.objects for insert to authenticated with check(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists store_media_update_own on storage.objects;
create policy store_media_update_own on storage.objects for update to authenticated using(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists store_media_delete_own on storage.objects;
create policy store_media_delete_own on storage.objects for delete to authenticated using(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text);
