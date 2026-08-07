import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, finiteMoney, getIntegration, mpFetch, onlyDigits } from "../_shared/mercadopago.ts";

type CartInput = { item_id: string; quantity: number; addon_ids?: string[]; note?: string };

function safeText(v: unknown, max = 500) { return String(v ?? "").trim().slice(0, max); }
function validEmail(v: unknown) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? "").trim()); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Método não permitido." }, 405);

  const db = adminClient();
  let createdOrderId: string | null = null;
  try {
    const body = await req.json();
    const deliveryId = safeText(body?.delivery_id, 120);
    const method = body?.method === "checkout" ? "checkout" : body?.method === "pix" ? "pix" : "";
    const fulfillment = body?.fulfillment_type === "pickup" ? "pickup" : body?.fulfillment_type === "delivery" ? "delivery" : "";
    const items: CartInput[] = Array.isArray(body?.items) ? body.items : [];
    const customer = body?.customer || {};
    if (!deliveryId || !method || !fulfillment || !items.length) throw new Error("Dados do pedido incompletos.");
    if (!validEmail(customer.email)) throw new Error("Informe um e-mail válido para o pagamento online.");
    if (!safeText(customer.name, 120)) throw new Error("Nome do cliente não informado.");
    if (onlyDigits(customer.phone).length < 10) throw new Error("WhatsApp do cliente inválido.");

    const [{ data: profile, error: profileError }, integration] = await Promise.all([
      db.from("delivery_profiles").select("*").eq("id", deliveryId).eq("is_published", true).maybeSingle(),
      getIntegration(db, deliveryId),
    ]);
    if (profileError) throw profileError;
    if (!profile) throw new Error("Loja não encontrada ou não publicada.");
    if (profile.accepts_online !== true) throw new Error("Pagamento online não está habilitado nesta loja.");
    if (fulfillment === "delivery" && profile.delivery_enabled === false) throw new Error("Entrega não está habilitada.");
    if (fulfillment === "pickup" && profile.pickup_enabled === false) throw new Error("Retirada não está habilitada.");

    const normalizedItems = items.slice(0, 100).map(row => ({
      item_id: safeText(row.item_id, 120),
      quantity: Math.max(1, Math.min(100, Math.floor(Number(row.quantity) || 1))),
      addon_ids: Array.isArray(row.addon_ids) ? row.addon_ids.slice(0, 50).map(v => safeText(v, 120)).filter(Boolean) : [],
      note: safeText(row.note, 500) || null,
    })).filter(row => row.item_id);
    if (!normalizedItems.length) throw new Error("Carrinho vazio.");

    const itemIds = [...new Set(normalizedItems.map(row => row.item_id))];
    const addonIds = [...new Set(normalizedItems.flatMap(row => row.addon_ids))];

    const [itemsRes, pricesRes, linksRes, addonsRes] = await Promise.all([
      db.from("delivery_items").select("id,name,price,sale_price,active,availability").eq("delivery_id", deliveryId).in("id", itemIds),
      db.rpc("get_public_delivery_effective_prices", { p_delivery_id: profile.id }),
      db.from("delivery_item_addons").select("item_id,group_id").in("item_id", itemIds),
      addonIds.length ? db.from("delivery_addon_options").select("id,group_id,name,price,active").in("id", addonIds).eq("active", true) : Promise.resolve({ data: [], error: null }),
    ]);
    if (itemsRes.error) throw itemsRes.error;
    if (linksRes.error) throw linksRes.error;
    if (addonsRes.error) throw addonsRes.error;

    const effectiveMap = new Map((pricesRes.data || []).map((row: any) => [String(row.item_id), finiteMoney(row.effective_price)]));
    const itemMap = new Map((itemsRes.data || []).map((row: any) => [String(row.id), row]));
    const addonMap = new Map((addonsRes.data || []).map((row: any) => [String(row.id), row]));
    const groupsByItem = new Map<string, Set<string>>();
    for (const link of (linksRes.data || [])) {
      const key = String(link.item_id); const set = groupsByItem.get(key) || new Set<string>();
      set.add(String(link.group_id)); groupsByItem.set(key, set);
    }

    const orderRows: any[] = [];
    let subtotal = 0;
    for (const row of normalizedItems) {
      const item: any = itemMap.get(row.item_id);
      if (!item || item.active === false || String(item.availability || "").toLowerCase() === "soldout") throw new Error("Um item do carrinho não está mais disponível.");
      const unitBase: number = effectiveMap.has(row.item_id) ? Number(effectiveMap.get(row.item_id) || 0) : finiteMoney(item.sale_price ?? item.price);
      const allowedGroups = groupsByItem.get(row.item_id) || new Set<string>();
      const addons: any[] = [];
      let addonTotal = 0;
      for (const addonId of row.addon_ids) {
        const addon: any = addonMap.get(addonId);
        if (!addon || !allowedGroups.has(String(addon.group_id))) throw new Error("Um adicional selecionado não pertence a este produto.");
        const price = finiteMoney(addon.price); addonTotal += price;
        addons.push({ id: addon.id, name: addon.name, price });
      }
      const lineTotal = finiteMoney((unitBase + addonTotal) * row.quantity);
      subtotal = finiteMoney(subtotal + lineTotal);
      orderRows.push({ item_id: item.id, item_name: item.name, quantity: row.quantity, unit_price: unitBase, addons, notes: row.note, total: lineTotal });
    }

    let deliveryFee = 0;
    let zone: any = null;
    if (fulfillment === "delivery") {
      if (body?.zone_id) {
        const zoneRes = await db.from("delivery_zones").select("*").eq("delivery_id", deliveryId).eq("id", safeText(body.zone_id, 120)).eq("active", true).maybeSingle();
        if (zoneRes.error) throw zoneRes.error;
        zone = zoneRes.data;
        if (!zone) throw new Error("Região de entrega inválida.");
      }
      deliveryFee = finiteMoney(zone?.fee ?? profile.default_delivery_fee ?? 0);
    }
    const minimum = Math.max(finiteMoney(profile.minimum_order), fulfillment === "delivery" ? finiteMoney(zone?.minimum_order) : 0);
    if (subtotal < minimum) throw new Error(`O pedido mínimo é R$ ${minimum.toFixed(2).replace(".", ",")}.`);
    const total = finiteMoney(subtotal + deliveryFee);
    if (total <= 0) throw new Error("Valor do pedido inválido.");

    const address = fulfillment === "delivery"
      ? { text: safeText(customer?.address?.text, 500), zone_name: zone?.name || null }
      : { text: profile.pickup_address || "Retirada na loja" };
    if (fulfillment === "delivery" && !address.text) throw new Error("Endereço de entrega não informado.");

    const paymentOnlineMethod = method;
    const orderPayload: any = {
      delivery_id: profile.id,
      owner_id: profile.owner_id,
      customer_name: safeText(customer.name, 120),
      customer_phone: onlyDigits(customer.phone),
      customer_email: safeText(customer.email, 180).toLowerCase(),
      fulfillment_type: fulfillment,
      address,
      zone_id: fulfillment === "delivery" ? zone?.id || null : null,
      payment_method: "Online",
      payment_online_method: paymentOnlineMethod,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      notes: safeText(body?.notes, 1000) || null,
      scheduled_for: body?.scheduled_for || null,
      status: "pending",
      payment_status: "pending",
      payment_provider: "mercadopago",
    };

    const orderRes = await db.from("delivery_orders").insert(orderPayload).select("id").single();
    if (orderRes.error) throw orderRes.error;
    createdOrderId = String(orderRes.data.id);

    const detailRows = orderRows.map(row => ({ ...row, order_id: orderRes.data.id }));
    const detailRes = await db.from("delivery_order_items").insert(detailRows);
    if (detailRes.error) throw detailRes.error;

    await db.from("delivery_payments").upsert({
      order_id: createdOrderId,
      delivery_id: deliveryId,
      provider: "mercadopago",
      method,
      status: "pending",
      amount: total,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const notificationUrl = `${supabaseUrl}/functions/v1/mp-webhook?delivery_id=${encodeURIComponent(deliveryId)}`;
    const requestedReturn = safeText(body?.return_url, 1500);
    let returnBase = requestedReturn;
    const configuredPublic = safeText(Deno.env.get("PUBLIC_SITE_URL"), 1500);
    if (configuredPublic) {
      const parsedRequested = requestedReturn ? new URL(requestedReturn) : null;
      const configured = new URL(configuredPublic);
      if (parsedRequested) configured.pathname = parsedRequested.pathname;
      configured.search = parsedRequested?.search || "";
      returnBase = configured.toString();
    }
    if (!returnBase) throw new Error("URL pública de retorno não configurada.");
    const returnUrl = new URL(returnBase);
    returnUrl.searchParams.set("slug", profile.slug || "");
    returnUrl.searchParams.set("order_id", createdOrderId);

    if (method === "pix") {
      const paymentBody = {
        transaction_amount: total,
        description: `Pedido ${profile.name || "Delivery"} #${createdOrderId.slice(0, 8)}`,
        payment_method_id: "pix",
        external_reference: createdOrderId,
        notification_url: notificationUrl,
        payer: { email: orderPayload.customer_email, first_name: orderPayload.customer_name },
      };
      const payment = await mpFetch("/v1/payments", integration.access_token, {
        method: "POST",
        headers: { "X-Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(paymentBody),
      });
      const tx = payment?.point_of_interaction?.transaction_data || {};
      await db.from("delivery_orders").update({
        payment_provider_id: String(payment.id), payment_status: payment.status || "pending", payment_status_detail: payment.status_detail || null,
      }).eq("id", createdOrderId).eq("delivery_id", deliveryId);
      await db.from("delivery_payments").update({
        provider_payment_id: String(payment.id), status: payment.status || "pending", status_detail: payment.status_detail || null,
        ticket_url: tx.ticket_url || null, raw_response: payment, updated_at: new Date().toISOString(),
      }).eq("order_id", createdOrderId);
      return json(req, { ok: true, method, order_id: createdOrderId, payment_id: String(payment.id), status: payment.status, qr_code: tx.qr_code || null, qr_code_base64: tx.qr_code_base64 || null, ticket_url: tx.ticket_url || null, subtotal, delivery_fee: deliveryFee, total });
    }

    const success = new URL(returnUrl); success.searchParams.set("mp_return", "success");
    const pending = new URL(returnUrl); pending.searchParams.set("mp_return", "pending");
    const failure = new URL(returnUrl); failure.searchParams.set("mp_return", "failure");
    const preferenceBody: any = {
      items: [{ id: createdOrderId, title: `Pedido ${profile.name || "Delivery"}`, quantity: 1, currency_id: "BRL", unit_price: total }],
      payer: { email: orderPayload.customer_email, name: orderPayload.customer_name },
      external_reference: createdOrderId,
      notification_url: notificationUrl,
      back_urls: { success: success.toString(), pending: pending.toString(), failure: failure.toString() },
      auto_return: "approved",
      metadata: { delivery_id: deliveryId, order_id: createdOrderId },
    };
    const preference = await mpFetch("/checkout/preferences", integration.access_token, { method: "POST", body: JSON.stringify(preferenceBody) });
    await db.from("delivery_orders").update({ payment_preference_id: String(preference.id) }).eq("id", createdOrderId).eq("delivery_id", deliveryId);
    await db.from("delivery_payments").update({ provider_preference_id: String(preference.id), init_point: preference.init_point || null, raw_response: preference, updated_at: new Date().toISOString() }).eq("order_id", createdOrderId);
    return json(req, { ok: true, method, order_id: createdOrderId, preference_id: String(preference.id), init_point: preference.init_point, sandbox_init_point: preference.sandbox_init_point || null, subtotal, delivery_fee: deliveryFee, total });
  } catch (error: any) {
    console.error("[mp-create-payment]", error?.data || error);
    if (createdOrderId) {
      await db.from("delivery_orders").update({ payment_status: "rejected", payment_status_detail: safeText(error?.message, 500) || "payment_creation_failed" }).eq("id", createdOrderId);
      await db.from("delivery_payments").update({ status: "rejected", status_detail: safeText(error?.message, 500) || "payment_creation_failed", updated_at: new Date().toISOString() }).eq("order_id", createdOrderId);
    }
    return json(req, { ok: false, error: error?.message || "Não foi possível iniciar o pagamento." }, Number(error?.status) >= 400 && Number(error?.status) < 500 ? 400 : 500);
  }
});
