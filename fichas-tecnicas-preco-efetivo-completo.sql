-- ============================================================
-- CLENA — FICHAS TÉCNICAS DO DELIVERY / LOJA
-- Salva fichas, ingredientes, custos, CMV, impostos e lucro.
-- Execute no SQL Editor do Supabase.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1. TABELA PRINCIPAL DAS FICHAS
-- ============================================================

create table if not exists public.delivery_technical_sheets (
  id uuid primary key default gen_random_uuid(),

  delivery_id uuid not null
    references public.delivery_profiles(id)
    on update cascade
    on delete cascade,

  owner_id uuid not null
    references auth.users(id)
    on update cascade
    on delete cascade,

  item_id uuid null
    references public.delivery_items(id)
    on update cascade
    on delete set null,

  name text not null,
  category text null,
  sale_unit text not null default 'un',
  yield_quantity numeric(14,4) not null default 1,

  sale_price numeric(14,2) not null default 0,

  packaging_cost numeric(14,4) not null default 0,
  labor_cost numeric(14,4) not null default 0,
  energy_cost numeric(14,4) not null default 0,
  other_cost numeric(14,4) not null default 0,
  operational_loss_percent numeric(8,4) not null default 0,
  fixed_allocation numeric(14,4) not null default 0,

  tax_rate numeric(8,4) not null default 0,
  card_rate numeric(8,4) not null default 0,
  platform_rate numeric(8,4) not null default 0,
  commission_rate numeric(8,4) not null default 0,
  desired_margin numeric(8,4) not null default 20,

  note text null,
  active boolean not null default true,

  -- Resultados calculados e salvos para relatórios rápidos.
  ingredients_cost numeric(14,4) not null default 0,
  operational_cost numeric(14,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  fees_amount numeric(14,4) not null default 0,
  cmv_percent numeric(10,4) not null default 0,
  contribution_margin_percent numeric(10,4) not null default 0,
  net_margin_percent numeric(10,4) not null default 0,
  net_profit numeric(14,4) not null default 0,
  suggested_price numeric(14,4) not null default 0,
  markup numeric(14,6) not null default 0,
  break_even_units integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint delivery_technical_sheets_name_not_empty
    check (length(trim(name)) > 0),

  constraint delivery_technical_sheets_sale_unit_valid
    check (sale_unit in ('un', 'porcao', 'kg', 'l', 'combo')),

  constraint delivery_technical_sheets_values_nonnegative
    check (
      yield_quantity > 0
      and sale_price >= 0
      and packaging_cost >= 0
      and labor_cost >= 0
      and energy_cost >= 0
      and other_cost >= 0
      and operational_loss_percent >= 0
      and fixed_allocation >= 0
      and tax_rate >= 0
      and card_rate >= 0
      and platform_rate >= 0
      and commission_rate >= 0
      and desired_margin >= 0
      and ingredients_cost >= 0
      and operational_cost >= 0
      and total_cost >= 0
      and fees_amount >= 0
      and suggested_price >= 0
      and markup >= 0
      and break_even_units >= 0
    )
);

-- Uma ficha por produto dentro do delivery.
-- Fichas independentes, com item_id nulo, continuam permitidas.
create unique index if not exists ux_delivery_technical_sheet_item
  on public.delivery_technical_sheets(delivery_id, item_id)
  where item_id is not null;

create index if not exists idx_delivery_technical_sheets_delivery
  on public.delivery_technical_sheets(delivery_id, active, updated_at desc);

create index if not exists idx_delivery_technical_sheets_owner
  on public.delivery_technical_sheets(owner_id, updated_at desc);

create index if not exists idx_delivery_technical_sheets_profitability
  on public.delivery_technical_sheets(delivery_id, cmv_percent, net_margin_percent);

-- ============================================================
-- 2. INGREDIENTES / INSUMOS DA FICHA
-- ============================================================

create table if not exists public.delivery_technical_sheet_ingredients (
  id uuid primary key default gen_random_uuid(),

  technical_sheet_id uuid not null
    references public.delivery_technical_sheets(id)
    on update cascade
    on delete cascade,

  delivery_id uuid not null
    references public.delivery_profiles(id)
    on update cascade
    on delete cascade,

  owner_id uuid not null
    references auth.users(id)
    on update cascade
    on delete cascade,

  name text not null,

  purchase_quantity numeric(16,6) not null default 0,
  purchase_unit text not null default 'kg',
  purchase_cost numeric(14,4) not null default 0,

  used_quantity numeric(16,6) not null default 0,
  used_unit text not null default 'g',

  loss_rate numeric(8,4) not null default 0,
  calculated_cost numeric(14,6) not null default 0,

  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint delivery_technical_ingredients_name_not_empty
    check (length(trim(name)) > 0),

  constraint delivery_technical_ingredients_purchase_unit_valid
    check (purchase_unit in ('kg', 'g', 'l', 'ml', 'un')),

  constraint delivery_technical_ingredients_used_unit_valid
    check (used_unit in ('kg', 'g', 'l', 'ml', 'un')),

  constraint delivery_technical_ingredients_values_nonnegative
    check (
      purchase_quantity >= 0
      and purchase_cost >= 0
      and used_quantity >= 0
      and loss_rate >= 0
      and calculated_cost >= 0
      and position >= 0
    ),

  constraint delivery_technical_ingredients_units_compatible
    check (
      (
        purchase_unit in ('kg', 'g')
        and used_unit in ('kg', 'g')
      )
      or
      (
        purchase_unit in ('l', 'ml')
        and used_unit in ('l', 'ml')
      )
      or
      (
        purchase_unit = 'un'
        and used_unit = 'un'
      )
    )
);

create index if not exists idx_delivery_technical_ingredients_sheet
  on public.delivery_technical_sheet_ingredients(
    technical_sheet_id,
    position
  );

create index if not exists idx_delivery_technical_ingredients_delivery
  on public.delivery_technical_sheet_ingredients(delivery_id);

-- ============================================================
-- 3. TRIGGERS DE SEGURANÇA E updated_at
-- ============================================================

create or replace function public.set_delivery_technical_sheet_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id
  into v_owner
  from public.delivery_profiles
  where id = new.delivery_id;

  if v_owner is null then
    raise exception 'Delivery não encontrado.';
  end if;

  new.owner_id := v_owner;
  new.updated_at := now();

  if new.item_id is not null and not exists (
    select 1
    from public.delivery_items
    where id = new.item_id
      and delivery_id = new.delivery_id
  ) then
    raise exception 'O item informado não pertence ao delivery.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_delivery_technical_sheet_owner
on public.delivery_technical_sheets;

create trigger trg_delivery_technical_sheet_owner
before insert or update
on public.delivery_technical_sheets
for each row
execute function public.set_delivery_technical_sheet_owner();

create or replace function public.set_delivery_technical_ingredient_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery uuid;
  v_owner uuid;
begin
  select delivery_id, owner_id
  into v_delivery, v_owner
  from public.delivery_technical_sheets
  where id = new.technical_sheet_id;

  if v_delivery is null then
    raise exception 'Ficha técnica não encontrada.';
  end if;

  new.delivery_id := v_delivery;
  new.owner_id := v_owner;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_delivery_technical_ingredient_owner
on public.delivery_technical_sheet_ingredients;

create trigger trg_delivery_technical_ingredient_owner
before insert or update
on public.delivery_technical_sheet_ingredients
for each row
execute function public.set_delivery_technical_ingredient_owner();

-- ============================================================
-- 4. RLS
-- ============================================================

alter table public.delivery_technical_sheets
enable row level security;

alter table public.delivery_technical_sheet_ingredients
enable row level security;

drop policy if exists delivery_technical_sheets_owner_select
on public.delivery_technical_sheets;

create policy delivery_technical_sheets_owner_select
on public.delivery_technical_sheets
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists delivery_technical_sheets_owner_insert
on public.delivery_technical_sheets;

create policy delivery_technical_sheets_owner_insert
on public.delivery_technical_sheets
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.delivery_profiles
    where id = delivery_id
      and owner_id = auth.uid()
  )
);

drop policy if exists delivery_technical_sheets_owner_update
on public.delivery_technical_sheets;

create policy delivery_technical_sheets_owner_update
on public.delivery_technical_sheets
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists delivery_technical_sheets_owner_delete
on public.delivery_technical_sheets;

create policy delivery_technical_sheets_owner_delete
on public.delivery_technical_sheets
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists delivery_technical_ingredients_owner_select
on public.delivery_technical_sheet_ingredients;

create policy delivery_technical_ingredients_owner_select
on public.delivery_technical_sheet_ingredients
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists delivery_technical_ingredients_owner_insert
on public.delivery_technical_sheet_ingredients;

create policy delivery_technical_ingredients_owner_insert
on public.delivery_technical_sheet_ingredients
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.delivery_technical_sheets
    where id = technical_sheet_id
      and owner_id = auth.uid()
  )
);

drop policy if exists delivery_technical_ingredients_owner_update
on public.delivery_technical_sheet_ingredients;

create policy delivery_technical_ingredients_owner_update
on public.delivery_technical_sheet_ingredients
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists delivery_technical_ingredients_owner_delete
on public.delivery_technical_sheet_ingredients;

create policy delivery_technical_ingredients_owner_delete
on public.delivery_technical_sheet_ingredients
for delete
to authenticated
using (owner_id = auth.uid());

grant select, insert, update, delete
on public.delivery_technical_sheets
to authenticated;

grant select, insert, update, delete
on public.delivery_technical_sheet_ingredients
to authenticated;

-- ============================================================
-- 5. VIEW PARA PREÇO EFETIVO DO CARDÁPIO
--
-- Regra:
-- 1. Ficha ativa vinculada ao produto: usa sale_price da ficha.
-- 2. Sem ficha ativa: usa sale_price promocional do cardápio.
-- 3. Sem promoção: usa price normal do cardápio.
-- ============================================================

create or replace view public.delivery_items_effective_price
with (security_invoker = true)
as
select
  item.id,
  item.delivery_id,
  item.owner_id,
  item.name,
  item.image_url,
  item.price as menu_price,
  item.sale_price as menu_sale_price,
  sheet.id as technical_sheet_id,
  sheet.active as technical_sheet_active,
  sheet.sale_price as technical_sheet_price,
  case
    when sheet.id is not null
      and sheet.active = true
      and sheet.sale_price > 0
      then sheet.sale_price
    when item.sale_price is not null
      and item.sale_price >= 0
      and item.sale_price < item.price
      then item.sale_price
    else item.price
  end as effective_price,
  case
    when sheet.id is not null
      and sheet.active = true
      and sheet.sale_price > 0
      then 'technical_sheet'
    when item.sale_price is not null
      and item.sale_price >= 0
      and item.sale_price < item.price
      then 'menu_sale'
    else 'menu'
  end as price_source,
  sheet.total_cost,
  sheet.cmv_percent,
  sheet.net_margin_percent,
  sheet.net_profit,
  sheet.updated_at as technical_sheet_updated_at
from public.delivery_items item
left join public.delivery_technical_sheets sheet
  on sheet.delivery_id = item.delivery_id
 and sheet.item_id = item.id
 and sheet.active = true;

grant select
on public.delivery_items_effective_price
to authenticated;

-- ============================================================
-- 6. FUNÇÃO PÚBLICA PARA PREÇOS DA LOJA PUBLICADA
--
-- Retorna somente dados não sensíveis e somente de delivery publicado.
-- Não expõe ingredientes, custos, impostos ou lucro.
-- ============================================================

create or replace function public.get_public_delivery_effective_prices(
  p_delivery_id uuid
)
returns table (
  item_id uuid,
  effective_price numeric,
  price_source text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    item.id as item_id,
    case
      when sheet.id is not null
        and sheet.active = true
        and sheet.sale_price > 0
        then sheet.sale_price
      when item.sale_price is not null
        and item.sale_price >= 0
        and item.sale_price < item.price
        then item.sale_price
      else item.price
    end as effective_price,
    case
      when sheet.id is not null
        and sheet.active = true
        and sheet.sale_price > 0
        then 'technical_sheet'
      when item.sale_price is not null
        and item.sale_price >= 0
        and item.sale_price < item.price
        then 'menu_sale'
      else 'menu'
    end as price_source
  from public.delivery_items item
  left join public.delivery_technical_sheets sheet
    on sheet.delivery_id = item.delivery_id
   and sheet.item_id = item.id
   and sheet.active = true
  where item.delivery_id = p_delivery_id
    and exists (
      select 1
      from public.delivery_profiles profile
      where profile.id = p_delivery_id
        and profile.is_published = true
    );
$$;

revoke all
on function public.get_public_delivery_effective_prices(uuid)
from public;

grant execute
on function public.get_public_delivery_effective_prices(uuid)
to anon, authenticated;

-- ============================================================
-- 7. COMENTÁRIOS E RELOAD
-- ============================================================

comment on table public.delivery_technical_sheets is
'Fichas técnicas dos produtos do delivery, com custos, CMV, impostos e lucro.';

comment on table public.delivery_technical_sheet_ingredients is
'Ingredientes e insumos vinculados às fichas técnicas do delivery.';

comment on view public.delivery_items_effective_price is
'Preço efetivo: ficha técnica ativa tem prioridade sobre preço do cardápio.';

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 8. VERIFICAÇÃO
-- ============================================================

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'delivery_technical_sheets',
    'delivery_technical_sheet_ingredients'
  )
order by table_name;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'get_public_delivery_effective_prices';


-- ============================================================
-- CORREÇÃO DE PREÇO EFETIVO — EXECUTE TAMBÉM
-- Garante que editor e página pública consigam consultar o preço
-- da ficha técnica ativa.
-- ============================================================

create or replace function public.get_public_delivery_effective_prices(
  p_delivery_id uuid
)
returns table (
  item_id uuid,
  effective_price numeric,
  price_source text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    item.id,
    case
      when sheet.id is not null
       and sheet.active = true
       and sheet.sale_price > 0
        then sheet.sale_price
      when item.sale_price is not null
       and item.sale_price >= 0
       and item.sale_price < item.price
        then item.sale_price
      else item.price
    end,
    case
      when sheet.id is not null
       and sheet.active = true
       and sheet.sale_price > 0
        then 'technical_sheet'::text
      when item.sale_price is not null
       and item.sale_price >= 0
       and item.sale_price < item.price
        then 'menu_sale'::text
      else 'menu'::text
    end
  from public.delivery_items item
  left join public.delivery_technical_sheets sheet
    on sheet.delivery_id = item.delivery_id
   and sheet.item_id = item.id
   and sheet.active = true
  where item.delivery_id = p_delivery_id
    and (
      exists (
        select 1
        from public.delivery_profiles profile
        where profile.id = p_delivery_id
          and profile.is_published = true
      )
      or exists (
        select 1
        from public.delivery_profiles profile
        where profile.id = p_delivery_id
          and profile.owner_id = auth.uid()
      )
    );
$$;

revoke all
on function public.get_public_delivery_effective_prices(uuid)
from public;

grant execute
on function public.get_public_delivery_effective_prices(uuid)
to anon, authenticated;

notify pgrst, 'reload schema';
