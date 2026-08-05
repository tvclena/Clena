-- MÓDULO PROFISSIONAL DE DELIVERY • CLENA
-- Execute depois do schema.sql principal da dashboard.
create extension if not exists "pgcrypto";

create table if not exists public.delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Meu delivery',
  description text,
  business_type text,
  instagram text,
  logo_url text,
  cover_url text,
  primary_color text not null default '#f97316',
  accent_color text not null default '#111827',
  item_layout text not null default 'cards' check(item_layout in ('cards','compact')),
  show_cover boolean not null default true,
  show_featured boolean not null default true,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  minimum_order numeric(12,2) not null default 0 check(minimum_order>=0),
  estimated_time text,
  default_delivery_fee numeric(12,2) not null default 0 check(default_delivery_fee>=0),
  max_distance_km numeric(8,2),
  pickup_address text,
  delivery_note text,
  force_open boolean not null default false,
  force_closed boolean not null default false,
  closed_message text,
  last_order_minutes integer not null default 0 check(last_order_minutes>=0),
  accepts_pix boolean not null default true,
  accepts_card boolean not null default true,
  accepts_cash boolean not null default true,
  accepts_online boolean not null default false,
  pix_key text,
  pix_receiver text,
  payment_note text,
  checkout_mode text not null default 'whatsapp' check(checkout_mode in ('whatsapp','internal','catalog_only')),
  order_whatsapp text,
  order_success_message text,
  allow_order_notes boolean not null default true,
  allow_scheduling boolean not null default false,
  slug text not null unique,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(not(force_open and force_closed))
);

create table if not exists public.delivery_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.delivery_profiles(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'ri-restaurant-line',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(delivery_id,name)
);

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.delivery_profiles(id) on delete cascade,
  category_id uuid references public.delivery_categories(id) on delete set null,
  name text not null,
  description text,
  sku text,
  image_url text,
  price numeric(12,2) not null default 0 check(price>=0),
  sale_price numeric(12,2) check(sale_price is null or sale_price>=0),
  prep_time_minutes integer check(prep_time_minutes is null or prep_time_minutes>=0),
  availability text not null default 'available' check(availability in ('available','soldout','scheduled')),
  available_from time,
  available_until time,
  active boolean not null default true,
  featured boolean not null default false,
  allow_notes boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_addon_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.delivery_profiles(id) on delete cascade,
  name text not null,
  selection_type text not null default 'single' check(selection_type in ('single','multiple')),
  min_selection integer not null default 0 check(min_selection>=0),
  max_selection integer not null default 1 check(max_selection>=1),
  required boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(min_selection<=max_selection)
);

create table if not exists public.delivery_addon_options (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.delivery_addon_groups(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0 check(price>=0),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_item_addons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.delivery_items(id) on delete cascade,
  group_id uuid not null references public.delivery_addon_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(item_id,group_id)
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.delivery_profiles(id) on delete cascade,
  name text not null,
  fee numeric(12,2) not null default 0 check(fee>=0),
  minimum_order numeric(12,2) not null default 0 check(minimum_order>=0),
  areas text,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_hours (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.delivery_profiles(id) on delete cascade,
  day_of_week integer not null check(day_of_week between 0 and 6),
  is_open boolean not null default false,
  open_time time not null default '18:00',
  close_time time not null default '23:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(delivery_id,day_of_week)
);

-- Estrutura pronta para pedidos internos na próxima etapa.
create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.delivery_profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_number bigint generated by default as identity,
  customer_name text not null,
  customer_phone text not null,
  fulfillment_type text not null check(fulfillment_type in ('delivery','pickup')),
  address jsonb,
  zone_id uuid references public.delivery_zones(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled')),
  payment_method text,
  payment_status text not null default 'pending' check(payment_status in ('pending','paid','refunded')),
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders(id) on delete cascade,
  item_id uuid references public.delivery_items(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check(quantity>0),
  unit_price numeric(12,2) not null default 0,
  addons jsonb not null default '[]'::jsonb,
  notes text,
  total numeric(12,2) not null default 0
);

create index if not exists delivery_categories_idx on public.delivery_categories(delivery_id,position);
create index if not exists delivery_items_idx on public.delivery_items(delivery_id,active,position);
create index if not exists delivery_items_category_idx on public.delivery_items(category_id);
create index if not exists delivery_addon_groups_idx on public.delivery_addon_groups(delivery_id,position);
create index if not exists delivery_addon_options_idx on public.delivery_addon_options(group_id,position);
create index if not exists delivery_zones_idx on public.delivery_zones(delivery_id,active,position);
create index if not exists delivery_hours_idx on public.delivery_hours(delivery_id,day_of_week);
create index if not exists delivery_orders_idx on public.delivery_orders(delivery_id,status,created_at desc);

alter table public.delivery_profiles enable row level security;
alter table public.delivery_categories enable row level security;
alter table public.delivery_items enable row level security;
alter table public.delivery_addon_groups enable row level security;
alter table public.delivery_addon_options enable row level security;
alter table public.delivery_item_addons enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.delivery_hours enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_order_items enable row level security;

-- Dono autenticado: controle completo.
do $$
declare t text;
begin
  foreach t in array array['delivery_profiles','delivery_categories','delivery_items','delivery_addon_groups','delivery_addon_options','delivery_item_addons','delivery_zones','delivery_hours','delivery_orders'] loop
    execute format('drop policy if exists %I_owner_all on public.%I',t,t);
    execute format('create policy %I_owner_all on public.%I for all to authenticated using(auth.uid()=owner_id) with check(auth.uid()=owner_id)',t,t);
  end loop;
end $$;

drop policy if exists delivery_order_items_owner_all on public.delivery_order_items;
create policy delivery_order_items_owner_all on public.delivery_order_items for all to authenticated
using(exists(select 1 from public.delivery_orders o where o.id=order_id and o.owner_id=auth.uid()))
with check(exists(select 1 from public.delivery_orders o where o.id=order_id and o.owner_id=auth.uid()));

-- Leitura pública somente para deliveries publicados.
drop policy if exists delivery_profiles_public_read on public.delivery_profiles;
create policy delivery_profiles_public_read on public.delivery_profiles for select to anon using(is_published=true);

drop policy if exists delivery_categories_public_read on public.delivery_categories;
create policy delivery_categories_public_read on public.delivery_categories for select to anon
using(active=true and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published=true));

drop policy if exists delivery_items_public_read on public.delivery_items;
create policy delivery_items_public_read on public.delivery_items for select to anon
using(active=true and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published=true));

drop policy if exists delivery_addon_groups_public_read on public.delivery_addon_groups;
create policy delivery_addon_groups_public_read on public.delivery_addon_groups for select to anon
using(active=true and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published=true));

drop policy if exists delivery_addon_options_public_read on public.delivery_addon_options;
create policy delivery_addon_options_public_read on public.delivery_addon_options for select to anon
using(active=true and exists(select 1 from public.delivery_addon_groups g join public.delivery_profiles d on d.id=g.delivery_id where g.id=group_id and g.active=true and d.is_published=true));

drop policy if exists delivery_item_addons_public_read on public.delivery_item_addons;
create policy delivery_item_addons_public_read on public.delivery_item_addons for select to anon
using(exists(select 1 from public.delivery_items i join public.delivery_profiles d on d.id=i.delivery_id where i.id=item_id and i.active=true and d.is_published=true));

drop policy if exists delivery_zones_public_read on public.delivery_zones;
create policy delivery_zones_public_read on public.delivery_zones for select to anon
using(active=true and exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published=true));

drop policy if exists delivery_hours_public_read on public.delivery_hours;
create policy delivery_hours_public_read on public.delivery_hours for select to anon
using(exists(select 1 from public.delivery_profiles d where d.id=delivery_id and d.is_published=true));

create or replace function public.delivery_set_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
do $$
declare t text;
begin
  foreach t in array array['delivery_profiles','delivery_categories','delivery_items','delivery_addon_groups','delivery_zones','delivery_hours','delivery_orders'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.delivery_set_updated_at()',t,t);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('delivery-media','delivery-media',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists delivery_media_public_read on storage.objects;
create policy delivery_media_public_read on storage.objects for select to public using(bucket_id='delivery-media');
drop policy if exists delivery_media_insert_own on storage.objects;
create policy delivery_media_insert_own on storage.objects for insert to authenticated with check(bucket_id='delivery-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists delivery_media_update_own on storage.objects;
create policy delivery_media_update_own on storage.objects for update to authenticated using(bucket_id='delivery-media' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='delivery-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists delivery_media_delete_own on storage.objects;
create policy delivery_media_delete_own on storage.objects for delete to authenticated using(bucket_id='delivery-media' and (storage.foldername(name))[1]=auth.uid()::text);
