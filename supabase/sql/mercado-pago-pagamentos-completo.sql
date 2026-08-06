-- ============================================================
-- CLENA — PAGAMENTO ONLINE MERCADO PAGO
-- Checkout Pro + Pix QR Code + status + webhook
-- Execute no SQL Editor do Supabase.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1. CONFIGURAÇÃO SEGURA DO MERCADO PAGO POR LOJA
-- ============================================================

create table if not exists public.store_mercado_pago_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique
    references public.stores(id)
    on update cascade
    on delete cascade,
  owner_id uuid not null
    references auth.users(id)
    on update cascade
    on delete cascade,

  enabled boolean not null default false,
  environment text not null default 'test',
  checkout_mode text not null default 'checkout_pro',

  public_key text,

  access_token_ciphertext text,
  access_token_iv text,
  access_token_prefix text,
  access_token_last4 text,

  webhook_secret_ciphertext text,
  webhook_secret_iv text,
  has_webhook_secret boolean not null default false,

  statement_descriptor text,
  max_installments integer not null default 12,
  auto_return boolean not null default true,
  binary_mode boolean not null default false,

  notification_url text,
  success_url text,
  pending_url text,
  failure_url text,

  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint store_mp_environment_valid
    check (environment in ('test', 'production')),

  constraint store_mp_checkout_mode_valid
    check (checkout_mode in ('checkout_pro', 'orders')),

  constraint store_mp_installments_valid
    check (max_installments between 1 and 24),

  constraint store_mp_test_status_valid
    check (
      last_test_status is null
      or last_test_status in ('success', 'error')
    ),

  constraint store_mp_descriptor_valid
    check (
      statement_descriptor is null
      or length(statement_descriptor) <= 22
    ),

  constraint store_mp_token_pair_valid
    check (
      (
        access_token_ciphertext is null
        and access_token_iv is null
      )
      or
      (
        access_token_ciphertext is not null
        and access_token_iv is not null
      )
    )
);

create index if not exists idx_store_mp_owner
  on public.store_mercado_pago_integrations(owner_id);

create index if not exists idx_store_mp_enabled
  on public.store_mercado_pago_integrations(store_id, enabled);

-- ============================================================
-- 2. TRANSAÇÕES E PEDIDOS
-- ============================================================

create table if not exists public.store_mercado_pago_transactions (
  id uuid primary key default gen_random_uuid(),

  store_id uuid not null
    references public.stores(id)
    on update cascade
    on delete cascade,

  owner_id uuid not null
    references auth.users(id)
    on update cascade
    on delete cascade,

  external_reference text not null,
  checkout_type text not null default 'checkout_pro',

  preference_id text,
  payment_id text,
  mercado_pago_order_id text,

  status text not null default 'created',
  status_detail text,

  amount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  delivery_amount numeric(12,2) not null default 0,
  currency_id text not null default 'BRL',

  payer_name text,
  payer_email text,
  payer_phone text,
  payer_document text,

  delivery_fee_id uuid
    references public.store_delivery_fees(id)
    on delete set null,

  init_point text,
  sandbox_init_point text,

  pix_qr_code text,
  pix_ticket_url text,
  pix_expiration_at timestamptz,

  request_snapshot jsonb,
  response_snapshot jsonb,

  paid_at timestamptz,
  webhook_received_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint store_mp_transaction_checkout_valid
    check (checkout_type in ('checkout_pro', 'pix', 'orders')),

  constraint store_mp_transaction_amount_valid
    check (
      amount >= 0
      and subtotal >= 0
      and delivery_amount >= 0
    )
);

-- Compatibilidade quando a tabela já existia.
alter table public.store_mercado_pago_transactions
  add column if not exists checkout_type text not null default 'checkout_pro',
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists delivery_amount numeric(12,2) not null default 0,
  add column if not exists payer_name text,
  add column if not exists payer_phone text,
  add column if not exists payer_document text,
  add column if not exists delivery_fee_id uuid,
  add column if not exists pix_qr_code text,
  add column if not exists pix_ticket_url text,
  add column if not exists pix_expiration_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists webhook_received_at timestamptz;

create unique index if not exists idx_store_mp_tx_external
  on public.store_mercado_pago_transactions(
    store_id,
    external_reference
  );

create index if not exists idx_store_mp_tx_status
  on public.store_mercado_pago_transactions(
    store_id,
    status,
    created_at desc
  );

create index if not exists idx_store_mp_tx_payment
  on public.store_mercado_pago_transactions(payment_id)
  where payment_id is not null;

create index if not exists idx_store_mp_tx_preference
  on public.store_mercado_pago_transactions(preference_id)
  where preference_id is not null;

create index if not exists idx_store_mp_tx_mp_order
  on public.store_mercado_pago_transactions(mercado_pago_order_id)
  where mercado_pago_order_id is not null;

-- ============================================================
-- 3. TRIGGERS DE PROPRIETÁRIO E updated_at
-- ============================================================

create or replace function public.set_store_mp_owner()
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
  from public.stores
  where id = new.store_id;

  if v_owner is null then
    raise exception 'Loja não encontrada.';
  end if;

  new.owner_id := v_owner;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_store_mp_owner
on public.store_mercado_pago_integrations;

create trigger trg_store_mp_owner
before insert or update
on public.store_mercado_pago_integrations
for each row
execute function public.set_store_mp_owner();

drop trigger if exists trg_store_mp_transaction_owner
on public.store_mercado_pago_transactions;

create trigger trg_store_mp_transaction_owner
before insert or update
on public.store_mercado_pago_transactions
for each row
execute function public.set_store_mp_owner();

create or replace function public.touch_store_mp_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_store_mp_updated_at
on public.store_mercado_pago_integrations;

create trigger trg_store_mp_updated_at
before update
on public.store_mercado_pago_integrations
for each row
execute function public.touch_store_mp_updated_at();

drop trigger if exists trg_store_mp_transaction_updated_at
on public.store_mercado_pago_transactions;

create trigger trg_store_mp_transaction_updated_at
before update
on public.store_mercado_pago_transactions
for each row
execute function public.touch_store_mp_updated_at();

-- ============================================================
-- 4. RLS E PERMISSÕES
-- ============================================================

alter table public.store_mercado_pago_integrations
enable row level security;

alter table public.store_mercado_pago_transactions
enable row level security;

-- Credenciais nunca são consultadas diretamente pelo navegador.
revoke all
on public.store_mercado_pago_integrations
from public, anon, authenticated;

grant all
on public.store_mercado_pago_integrations
to service_role;

-- Clientes não podem criar, alterar ou aprovar pagamentos pelo navegador.
revoke all
on public.store_mercado_pago_transactions
from public, anon;

grant all
on public.store_mercado_pago_transactions
to service_role;

grant select
on public.store_mercado_pago_transactions
to authenticated;

drop policy if exists store_mp_tx_owner_select
on public.store_mercado_pago_transactions;

create policy store_mp_tx_owner_select
on public.store_mercado_pago_transactions
for select
to authenticated
using (owner_id = auth.uid());

-- ============================================================
-- 5. COMENTÁRIOS
-- ============================================================

comment on table public.store_mercado_pago_integrations is
'Configuração Mercado Pago por loja. Segredos ficam criptografados por AES-GCM.';

comment on table public.store_mercado_pago_transactions is
'Pedidos e pagamentos Mercado Pago criados pelo backend da CLENA.';

comment on column public.store_mercado_pago_transactions.request_snapshot is
'Pedido recalculado no servidor: itens, preços, entrega e cliente.';

comment on column public.store_mercado_pago_transactions.response_snapshot is
'Última resposta confirmada diretamente na API do Mercado Pago.';

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 6. VERIFICAÇÃO
-- ============================================================

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'store_mercado_pago_integrations',
    'store_mercado_pago_transactions'
  )
order by table_name;
