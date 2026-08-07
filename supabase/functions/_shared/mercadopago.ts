import { createClient } from "npm:@supabase/supabase-js@2";

export const MP_API = "https://api.mercadopago.com";

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes nas Edge Functions.");
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function finiteMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalizePaymentStatus(status: unknown) {
  const value = String(status || "pending").toLowerCase();
  const allowed = new Set(["approved", "pending", "in_process", "rejected", "cancelled", "refunded", "charged_back", "authorized"]);
  return allowed.has(value) ? value : value || "pending";
}

export async function mpFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${MP_API}${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const message = data?.message || data?.error || data?.cause?.[0]?.description || `Mercado Pago HTTP ${response.status}`;
    const error: any = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function getIntegration(db: any, deliveryId: string) {
  const { data, error } = await db
    .from("delivery_payment_integrations")
    .select("delivery_id,provider,access_token,public_key,webhook_secret,active")
    .eq("delivery_id", deliveryId)
    .eq("provider", "mercadopago")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.access_token) throw new Error("Mercado Pago não está configurado para esta loja.");
  return data;
}

export async function verifyWebhookSignature(req: Request, secret: string | null | undefined, dataId: string) {
  if (!secret) return false;
  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  if (!xSignature || !xRequestId || !dataId) return false;

  let ts = "";
  let v1 = "";
  for (const part of xSignature.split(",")) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=").trim();
    if (key?.trim() === "ts") ts = value;
    if (key?.trim() === "v1") v1 = value;
  }
  if (!ts || !v1) return false;

  const normalizedId = /[A-Za-z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export async function syncPaymentToDatabase(db: any, deliveryId: string, payment: any) {
  const providerPaymentId = String(payment?.id || "");
  const orderId = String(payment?.external_reference || "");
  const status = normalizePaymentStatus(payment?.status);
  const statusDetail = payment?.status_detail ? String(payment.status_detail) : null;
  if (!orderId) throw new Error("Pagamento Mercado Pago sem external_reference.");

  const { data: order, error: orderError } = await db
    .from("delivery_orders")
    .select("id,delivery_id")
    .eq("id", orderId)
    .eq("delivery_id", deliveryId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error("Pedido correspondente ao pagamento não foi encontrado.");

  const paidAt = status === "approved" ? (payment?.date_approved || new Date().toISOString()) : null;
  const { error: updateOrderError } = await db
    .from("delivery_orders")
    .update({
      payment_status: status,
      payment_status_detail: statusDetail,
      payment_provider: "mercadopago",
      payment_provider_id: providerPaymentId || null,
      payment_paid_at: paidAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("delivery_id", deliveryId);
  if (updateOrderError) throw updateOrderError;

  const tx = payment?.point_of_interaction?.transaction_data || {};
  const { error: paymentUpsertError } = await db
    .from("delivery_payments")
    .upsert({
      order_id: orderId,
      delivery_id: deliveryId,
      provider: "mercadopago",
      provider_payment_id: providerPaymentId || null,
      method: payment?.payment_method_id === "pix" ? "pix" : "checkout",
      status,
      status_detail: statusDetail,
      amount: finiteMoney(payment?.transaction_amount),
      ticket_url: tx?.ticket_url || null,
      raw_response: payment,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
  if (paymentUpsertError) throw paymentUpsertError;

  return { order_id: orderId, status, status_detail: statusDetail, payment_id: providerPaymentId || null, paid_at: paidAt };
}
