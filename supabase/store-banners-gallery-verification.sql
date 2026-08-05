-- CLENA | Banners, galeria e verificação da Loja

alter table public.stores add column if not exists is_verified boolean not null default false;
update public.stores set is_verified=false where is_verified is distinct from false;
comment on column public.stores.is_verified is 'Controlado exclusivamente pelo painel administrativo da CLENA.';

create table if not exists public.store_banners (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, store_id uuid not null references public.stores(id) on delete cascade,
 title text, subtitle text, media_url text not null, media_type text not null default 'image' check(media_type in('image','video')),
 position text not null default 'after_hero', height text not null default 'medium', fit text not null default 'cover', object_x text not null default 'center', object_y text not null default 'center', text_align text not null default 'left', overlay integer not null default 25 check(overlay between 0 and 100),
 button_text text, link_type text not null default 'none', link_value text, link_target text not null default 'same', device text not null default 'all', starts_at timestamptz, ends_at timestamptz, active boolean not null default true, position_index integer not null default 0, position_order integer not null default 0, position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists store_banners_store_idx on public.store_banners(store_id,position);
alter table public.store_banners enable row level security;
drop policy if exists "store_banners_owner_all" on public.store_banners; create policy "store_banners_owner_all" on public.store_banners for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "store_banners_public_read" on public.store_banners; create policy "store_banners_public_read" on public.store_banners for select to anon,authenticated using(active=true and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));

create table if not exists public.store_gallery_items (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, store_id uuid not null references public.stores(id) on delete cascade, title text, description text, media_url text not null, media_type text not null default 'image' check(media_type in('image','video')), fit text not null default 'cover', object_x text not null default 'center', object_y text not null default 'center', link_type text not null default 'none', link_value text, link_target text not null default 'same', active boolean not null default true, position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists store_gallery_store_idx on public.store_gallery_items(store_id,position);
alter table public.store_gallery_items enable row level security;
drop policy if exists "store_gallery_owner_all" on public.store_gallery_items; create policy "store_gallery_owner_all" on public.store_gallery_items for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "store_gallery_public_read" on public.store_gallery_items; create policy "store_gallery_public_read" on public.store_gallery_items for select to anon,authenticated using(active=true and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));

-- O bucket store-media já deve existir. Atualiza limite e MIME types sem expor a service_role.
update storage.buckets set file_size_limit=52428800, allowed_mime_types=array['image/png','image/jpeg','image/webp','video/mp4','video/webm'] where id='store-media';
