-- ============================================================
-- CLENA — MERCADO PAGO: CONFIGURAÇÃO SEGURA POR LOJA
-- O Access Token é salvo SOMENTE criptografado pela Edge Function.
-- Execute no SQL Editor do Supabase.
-- ============================================================

begin;
create extension if not exists pgcrypto;

create table if not exists public.store_mercado_pago_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on update cascade on delete cascade,
  owner_id uuid not null references auth.users(id) on update cascade on delete cascade,
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
  constraint store_mp_environment_valid check (environment in ('test','production')),
  constraint store_mp_checkout_mode_valid check (checkout_mode in ('checkout_pro','orders')),
  constraint store_mp_installments_valid check (max_installments between 1 and 24),
  constraint store_mp_test_status_valid check (last_test_status is null or last_test_status in ('success','error')),
  constraint store_mp_descriptor_valid check (statement_descriptor is null or length(statement_descriptor) <= 22),
  constraint store_mp_token_pair_valid check (
    (access_token_ciphertext is null and access_token_iv is null)
    or
    (access_token_ciphertext is not null and access_token_iv is not null)
  )
);

create index if not exists idx_store_mp_owner on public.store_mercado_pago_integrations(owner_id);
create index if not exists idx_store_mp_enabled on public.store_mercado_pago_integrations(store_id,enabled);

create or replace function public.set_store_mp_owner()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.stores where id=new.store_id;
  if v_owner is null then raise exception 'Loja não encontrada.'; end if;
  new.owner_id:=v_owner;
  return new;
end;$$;

drop trigger if exists trg_store_mp_owner on public.store_mercado_pago_integrations;
create trigger trg_store_mp_owner before insert or update of store_id
on public.store_mercado_pago_integrations for each row execute function public.set_store_mp_owner();

create or replace function public.touch_store_mp_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at:=now(); return new; end;$$;

drop trigger if exists trg_store_mp_updated_at on public.store_mercado_pago_integrations;
create trigger trg_store_mp_updated_at before update
on public.store_mercado_pago_integrations for each row execute function public.touch_store_mp_updated_at();

alter table public.store_mercado_pago_integrations enable row level security;

-- A tabela contém material criptografado e não é consultada diretamente pelo navegador.
-- Somente a Edge Function com SERVICE_ROLE acessa os registros.
revoke all on public.store_mercado_pago_integrations from public, anon, authenticated;
grant all on public.store_mercado_pago_integrations to service_role;

-- Tabela opcional para registrar preferências/pagamentos criados pela API.
create table if not exists public.store_mercado_pago_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  external_reference text not null,
  preference_id text,
  payment_id text,
  mercado_pago_order_id text,
  status text not null default 'created',
  status_detail text,
  amount numeric(12,2) not null default 0,
  currency_id text not null default 'BRL',
  payer_email text,
  init_point text,
  sandbox_init_point text,
  request_snapshot jsonb,
  response_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_mp_transaction_amount_valid check (amount >= 0)
);
create unique index if not exists idx_store_mp_tx_external on public.store_mercado_pago_transactions(store_id,external_reference);
create index if not exists idx_store_mp_tx_status on public.store_mercado_pago_transactions(store_id,status,created_at desc);

create or replace function public.set_store_mp_transaction_owner()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.stores where id=new.store_id;
  if v_owner is null then raise exception 'Loja não encontrada.'; end if;
  new.owner_id:=v_owner; new.updated_at:=now(); return new;
end;$$;
drop trigger if exists trg_store_mp_transaction_owner on public.store_mercado_pago_transactions;
create trigger trg_store_mp_transaction_owner before insert or update
on public.store_mercado_pago_transactions for each row execute function public.set_store_mp_transaction_owner();

alter table public.store_mercado_pago_transactions enable row level security;
drop policy if exists store_mp_tx_owner_select on public.store_mercado_pago_transactions;
create policy store_mp_tx_owner_select on public.store_mercado_pago_transactions
for select to authenticated using (owner_id=auth.uid());
revoke all on public.store_mercado_pago_transactions from public, anon;
grant select on public.store_mercado_pago_transactions to authenticated;
grant all on public.store_mercado_pago_transactions to service_role;

comment on table public.store_mercado_pago_integrations is 'Configuração Mercado Pago por loja. Segredos são ciphertext AES-GCM gerado pela Edge Function.';
comment on column public.store_mercado_pago_integrations.access_token_ciphertext is 'Access Token criptografado; nunca armazene token em texto puro.';
comment on column public.store_mercado_pago_integrations.access_token_iv is 'IV exclusivo usado na criptografia AES-GCM.';
comment on table public.store_mercado_pago_transactions is 'Registro de preferências, orders e pagamentos Mercado Pago vinculados à loja.';

notify pgrst, 'reload schema';
commit;

select table_name from information_schema.tables
where table_schema='public' and table_name in ('store_mercado_pago_integrations','store_mercado_pago_transactions')
order by table_name;
