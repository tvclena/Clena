-- ============================================================
-- CONFIGURAR / ATUALIZAR MERCADO PAGO DE UMA LOJA
-- Rode no Supabase SQL Editor.
--
-- SUBSTITUA:
--   SEU_DELIVERY_ID
--   APP_USR-SEU_ACCESS_TOKEN
--   SUA_WEBHOOK_SECRET
--   APP_USR-SUA_PUBLIC_KEY (opcional)
--
-- ATENÇÃO: Access Token é segredo. Nunca coloque no delivery.html.
-- ============================================================

insert into public.delivery_payment_integrations (
  delivery_id,
  provider,
  access_token,
  public_key,
  webhook_secret,
  active
)
values (
  'SEU_DELIVERY_ID',
  'mercadopago',
  'APP_USR-SEU_ACCESS_TOKEN',
  'APP_USR-SUA_PUBLIC_KEY',
  'SUA_WEBHOOK_SECRET',
  true
)
on conflict (delivery_id)
do update set
  provider = excluded.provider,
  access_token = excluded.access_token,
  public_key = excluded.public_key,
  webhook_secret = excluded.webhook_secret,
  active = true,
  updated_at = now();

-- Conferência SEGURA: não exibe o token completo.
select
  delivery_id,
  provider,
  active,
  case when access_token is not null and length(access_token) > 10
       then left(access_token, 7) || '••••••••' || right(access_token, 4)
       else 'não configurado'
  end as access_token_mascarado,
  case when webhook_secret is not null and length(webhook_secret) > 8
       then left(webhook_secret, 4) || '••••••••' || right(webhook_secret, 4)
       else 'não configurado'
  end as webhook_secret_mascarado,
  updated_at
from public.delivery_payment_integrations
where delivery_id = 'SEU_DELIVERY_ID';
