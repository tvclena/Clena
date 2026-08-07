-- ============================================================
-- CLENA DELIVERY • MERCADO PAGO • MIGRAÇÃO COMPLETA
-- Execute uma vez no Supabase SQL Editor.
-- Esta migração NÃO apaga dados e NÃO altera as regras antigas
-- de PIX manual, cartão na entrega, dinheiro ou WhatsApp.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- 1) CAMPOS DE PAGAMENTO NO PEDIDO
alter table if exists public.delivery_orders
  add column if not exists customer_email text,
  add column if not exists payment_online_method text,
  add column if not exists payment_status text default 'pending',
  add column if not exists payment_status_detail text,
  add column if not exists payment_provider text,
  add column if not exists payment_provider_id text,
  add column if not exists payment_preference_id text,
  add column if not exists payment_paid_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_delivery_orders_payment_provider_id
  on public.delivery_orders (payment_provider_id);
create index if not exists idx_delivery_orders_payment_status
  on public.delivery_orders (payment_status);

-- 2) COFRE DE CREDENCIAIS POR LOJA
-- delivery_id é TEXT de propósito: funciona mesmo se o ID da sua loja
-- for UUID, bigint ou outro tipo no banco atual.
create table if not exists public.delivery_payment_integrations (
  delivery_id text primary key,
  provider text not null default 'mercadopago',
  access_token text not null,
  public_key text,
  webhook_secret text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_payment_integrations_provider_chk
    check (provider in ('mercadopago'))
);

comment on table public.delivery_payment_integrations is
  'Credenciais privadas de pagamento. Nunca consultar esta tabela pelo HTML público.';

alter table public.delivery_payment_integrations enable row level security;
revoke all on table public.delivery_payment_integrations from anon, authenticated;

-- 3) REGISTRO TÉCNICO DOS PAGAMENTOS
create table if not exists public.delivery_payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  delivery_id text not null,
  provider text not null default 'mercadopago',
  provider_payment_id text,
  provider_preference_id text,
  method text,
  status text not null default 'pending',
  status_detail text,
  amount numeric(14,2) not null default 0,
  ticket_url text,
  init_point text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_payments_delivery_id
  on public.delivery_payments (delivery_id);
create index if not exists idx_delivery_payments_provider_payment_id
  on public.delivery_payments (provider_payment_id);
create index if not exists idx_delivery_payments_status
  on public.delivery_payments (status);

alter table public.delivery_payments enable row level security;
revoke all on table public.delivery_payments from anon, authenticated;

-- 4) TRIGGER DE UPDATED_AT NAS NOVAS TABELAS
create or replace function public.clena_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_delivery_payment_integrations_updated_at on public.delivery_payment_integrations;
create trigger trg_delivery_payment_integrations_updated_at
before update on public.delivery_payment_integrations
for each row execute function public.clena_touch_updated_at();

drop trigger if exists trg_delivery_payments_updated_at on public.delivery_payments;
create trigger trg_delivery_payments_updated_at
before update on public.delivery_payments
for each row execute function public.clena_touch_updated_at();

commit;

-- ============================================================
-- IMPORTANTE
-- Depois de executar esta migração, abra o arquivo
-- 02_CONFIGURAR_CREDENCIAL_LOJA.sql e informe o ID da loja e
-- o Access Token que você já configurou no Mercado Pago.
-- ============================================================
