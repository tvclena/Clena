-- ACESSO PÚBLICO DA LOJA
-- Execute apenas se as políticas públicas ainda não existirem.

alter table public.stores enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_variations enable row level security;

drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores
for select to anon using(is_published=true);

drop policy if exists categories_public_read on public.store_categories;
create policy categories_public_read on public.store_categories
for select to anon using(
  exists(select 1 from public.stores s where s.id=store_id and s.is_published=true)
);

drop policy if exists products_public_read on public.store_products;
create policy products_public_read on public.store_products
for select to anon using(
  active=true and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true)
);

drop policy if exists variations_public_read on public.store_product_variations;
create policy variations_public_read on public.store_product_variations
for select to anon using(
  exists(
    select 1 from public.store_products p
    join public.stores s on s.id=p.store_id
    where p.id=product_id and p.active=true and s.is_published=true
  )
);


-- BANNERS E GALERIA PÚBLICOS
alter table public.store_banners enable row level security;
alter table public.store_gallery_items enable row level security;
drop policy if exists store_banners_public_read on public.store_banners;
create policy store_banners_public_read on public.store_banners for select to anon using(active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));
drop policy if exists store_gallery_public_read on public.store_gallery_items;
create policy store_gallery_public_read on public.store_gallery_items for select to anon using(active=true and exists(select 1 from public.stores s where s.id=store_id and s.is_published=true));
