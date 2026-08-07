import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getIntegration, mpFetch, normalizePaymentStatus, syncPaymentToDatabase } from "../_shared/mercadopago.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Método não permitido." }, 405);
  const db = adminClient();
  try {
    const body = await req.json();
    const deliveryId = String(body?.delivery_id || "").trim();
    const orderId = String(body?.order_id || "").trim();
    const suppliedPaymentId = String(body?.payment_id || "").trim();
    if (!deliveryId || !orderId) throw new Error("Identificadores do pagamento ausentes.");

    const { data: order, error: orderError } = await db.from("delivery_orders")
      .select("id,delivery_id,payment_status,payment_status_detail,payment_provider_id,payment_paid_at,total")
      .eq("id", orderId).eq("delivery_id", deliveryId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw new Error("Pedido não encontrado.");

    const { data: localPayment } = await db.from("delivery_payments").select("provider_payment_id,status,status_detail,ticket_url")
      .eq("order_id", orderId).eq("delivery_id", deliveryId).maybeSingle();
    const paymentId = suppliedPaymentId || String(localPayment?.provider_payment_id || order.payment_provider_id || "");

    let status = normalizePaymentStatus(order.payment_status || localPayment?.status || "pending");
    let statusDetail = order.payment_status_detail || localPayment?.status_detail || null;
    let paidAt = order.payment_paid_at || null;
    if (paymentId && status !== "approved") {
      const integration = await getIntegration(db, deliveryId);
      const payment = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`, integration.access_token, { method: "GET" });
      if (String(payment.external_reference || "") !== orderId) throw new Error("O pagamento não corresponde a este pedido.");
      const synced = await syncPaymentToDatabase(db, deliveryId, payment);
      status = synced.status; statusDetail = synced.status_detail; paidAt = synced.paid_at;
    }

    return json(req, { ok: true, order_id: orderId, payment_id: paymentId || null, status, status_detail: statusDetail, paid_at: paidAt, total: Number(order.total || 0) });
  } catch (error: any) {
    console.error("[mp-payment-status]", error);
    return json(req, { ok: false, error: error?.message || "Não foi possível consultar o pagamento." }, 400);
  }
});
