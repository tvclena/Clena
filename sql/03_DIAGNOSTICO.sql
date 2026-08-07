-- Diagnóstico rápido após instalar.
select
  o.id,
  o.delivery_id,
  o.customer_name,
  o.payment_method,
  o.payment_online_method,
  o.payment_status,
  o.payment_provider,
  o.payment_provider_id,
  o.payment_preference_id,
  o.payment_paid_at,
  o.total
from public.delivery_orders o
where o.payment_method = 'Online'
order by o.updated_at desc nulls last
limit 50;

select
  order_id,
  delivery_id,
  method,
  status,
  status_detail,
  amount,
  provider_payment_id,
  provider_preference_id,
  updated_at
from public.delivery_payments
order by updated_at desc
limit 50;
