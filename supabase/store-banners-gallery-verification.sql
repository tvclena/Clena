-- CLENA | Banners, galeria e verificação da Loja
-- Migração idempotente e segura para projetos novos ou já existentes.

create extension if not exists pgcrypto;

-- Verificação: lojas existentes ficam false apenas quando a coluna é criada ou está nula.
alter table public.stores add column if not exists is_verified boolean;
alter table public.stores alter column is_verified set default false;
update public.stores set is_verified = false where is_verified is null;
alter table public.stores alter column is_verified set not null;
comment on column public.stores.is_verified is 'Controlado exclusivamente pelo painel administrativo da CLENA.';

-- Corrige versões antigas que usavam position como texto para o local do banner.
do $$
begin
  if to_regclass('public.store_banners') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_banners' and column_name='position'
        and data_type in ('text','character varying')
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='store_banners' and column_name='placement'
    ) then
      alter table public.store_banners rename column position to placement;
    end if;
  end if;
end $$;

create table if not exists public.store_banners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text,
  subtitle text,
  media_url text not null,
  media_type text not null default 'image',
  placement text not null default 'after_hero',
  height text not null default 'medium',
  fit text not null default 'cover',
  object_x text not null default 'center',
  object_y text not null default 'center',
  text_align text not null default 'left',
  overlay integer not null default 25,
  button_text text,
  link_type text not null default 'none',
  link_value text,
  link_target text not null default 'same',
  device text not null default 'all',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Completa tabelas pré-existentes sem apagar dados.
alter table public.store_banners add column if not exists placement text not null default 'after_hero';
alter table public.store_banners add column if not exists height text not null default 'medium';
alter table public.store_banners add column if not exists fit text not null default 'cover';
alter table public.store_banners add column if not exists object_x text not null default 'center';
alter table public.store_banners add column if not exists object_y text not null default 'center';
alter table public.store_banners add column if not exists text_align text not null default 'left';
alter table public.store_banners add column if not exists overlay integer not null default 25;
alter table public.store_banners add column if not exists button_text text;
alter table public.store_banners add column if not exists link_type text not null default 'none';
alter table public.store_banners add column if not exists link_value text;
alter table public.store_banners add column if not exists link_target text not null default 'same';
alter table public.store_banners add column if not exists device text not null default 'all';
alter table public.store_banners add column if not exists starts_at timestamptz;
alter table public.store_banners add column if not exists ends_at timestamptz;
alter table public.store_banners add column if not exists active boolean not null default true;

-- Se ainda não houver a coluna numérica de ordem, cria agora.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_banners' and column_name='position') then
    alter table public.store_banners add column position integer not null default 0;
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_banners' and column_name='position' and data_type in ('text','character varying')) then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_banners' and column_name='placement') then
      alter table public.store_banners rename column position to placement;
    else
      alter table public.store_banners rename column position to position_legacy_text;
    end if;
    alter table public.store_banners add column position integer not null default 0;
  end if;
end $$;

-- Restrições adicionadas de forma tolerante.
do $$ begin
  alter table public.store_banners add constraint store_banners_media_type_chk check (media_type in ('image','video'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_banners add constraint store_banners_placement_chk check (placement in ('after_hero','before_categories','after_categories','before_products','after_products','before_footer'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.store_banners add constraint store_banners_overlay_chk check (overlay between 0 and 100);
exception when duplicate_object then null; end $$;

create index if not exists store_banners_store_idx on public.store_banners(store_id, placement, position);
alter table public.store_banners enable row level security;
drop policy if exists "store_banners_owner_all" on public.store_banners;
create policy "store_banners_owner_all" on public.store_banners for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "store_banners_public_read" on public.store_banners;
create policy "store_banners_public_read" on public.store_banners for select to anon,authenticated using(
 active=true
 and (starts_at is null or starts_at<=now())
 and (ends_at is null or ends_at>=now())
 and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true)
);

create table if not exists public.store_gallery_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text,
  description text,
  media_url text not null,
  media_type text not null default 'image',
  fit text not null default 'cover',
  object_x text not null default 'center',
  object_y text not null default 'center',
  link_type text not null default 'none',
  link_value text,
  link_target text not null default 'same',
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.store_gallery_items add constraint store_gallery_media_type_chk check (media_type in ('image','video'));
exception when duplicate_object then null; end $$;
create index if not exists store_gallery_store_idx on public.store_gallery_items(store_id,position);
alter table public.store_gallery_items enable row level security;
drop policy if exists "store_gallery_owner_all" on public.store_gallery_items;
create policy "store_gallery_owner_all" on public.store_gallery_items for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "store_gallery_public_read" on public.store_gallery_items;
create policy "store_gallery_public_read" on public.store_gallery_items for select to anon,authenticated using(active=true and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));

-- Storage: preserva o bucket existente e amplia os tipos permitidos.
update storage.buckets
set file_size_limit=52428800,
    allowed_mime_types=array['image/png','image/jpeg','image/webp','video/mp4','video/webm']
where id='store-media';
