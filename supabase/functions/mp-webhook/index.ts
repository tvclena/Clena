import { json } from "../_shared/cors.ts";
import { adminClient, getIntegration, mpFetch, syncPaymentToDatabase, verifyWebhookSignature } from "../_shared/mercadopago.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(req, { ok: true }, 200);
  const db = adminClient();
  try {
    const url = new URL(req.url);
    const deliveryId = String(url.searchParams.get("delivery_id") || "").trim();
    const dataIdFromQuery = String(url.searchParams.get("data.id") || url.searchParams.get("data_id") || "").trim();
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const paymentId = dataIdFromQuery || String(body?.data?.id || "").trim();
    const type = String(url.searchParams.get("type") || body?.type || "payment").toLowerCase();
    if (!deliveryId || !paymentId) return json(req, { ok: true, ignored: true }, 200);
    if (type !== "payment") return json(req, { ok: true, ignored: true }, 200);

    const integration = await getIntegration(db, deliveryId);
    const signatureOk = await verifyWebhookSignature(req, integration.webhook_secret, paymentId);
    if (!signatureOk) return json(req, { ok: false, error: "Assinatura do webhook inválida ou secret não configurado." }, 401);

    const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`, integration.access_token, { method: "GET" });
    const result = await syncPaymentToDatabase(db, deliveryId, payment);
    return json(req, { ok: true, ...result }, 200);
  } catch (error: any) {
    console.error("[mp-webhook]", error);
    // 200 em erros de negócio evita tempestade de retries; 500 só em falha inesperada real seria outra política.
    return json(req, { ok: false, error: error?.message || "Falha ao processar webhook." }, 200);
  }
});
