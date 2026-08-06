import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MP_CREDENTIALS_ENCRYPTION_KEY");

  if (!secret || secret.length < 32) {
    throw new Error(
      "MP_CREDENTIALS_ENCRYPTION_KEY não foi configurada corretamente.",
    );
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

async function decryptSecret(
  ciphertext: string,
  iv: string,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(iv),
    },
    await encryptionKey(),
    base64ToBytes(ciphertext),
  );

  return new TextDecoder().decode(decrypted);
}

function cleanText(value: unknown, max = 200): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function positiveInteger(value: unknown, max = 999): number {
  const number = Math.floor(Number(value || 0));

  if (!Number.isFinite(number) || number < 1) return 0;

  return Math.min(number, max);
}

function roundMoney(value: unknown): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeStatus(status: unknown): string {
  const value = String(status || "").toLowerCase();

  const map: Record<string, string> = {
    approved: "approved",
    processed: "approved",
    pending: "pending",
    in_process: "pending",
    action_required: "pending",
    authorized: "pending",
    rejected: "rejected",
    failed: "rejected",
    cancelled: "cancelled",
    canceled: "cancelled",
    expired: "expired",
    refunded: "refunded",
    charged_back: "charged_back",
  };

  return map[value] || value || "created";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    first_name: parts.shift() || "Cliente",
    last_name: parts.join(" ") || "CLENA",
  };
}

async function mpRequest(
  token: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const cause = Array.isArray(body?.cause)
      ? body.cause.map((item: Record<string, unknown>) =>
          item.description || item.code
        ).filter(Boolean).join("; ")
      : "";

    const message =
      cause ||
      body?.message ||
      body?.error ||
      `Mercado Pago respondeu HTTP ${response.status}.`;

    throw new Error(String(message));
  }

  return body;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Método não permitido." },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const input = await request.json();
    const action = cleanText(input?.action, 40);
    const storeId = cleanText(input?.store_id, 80);

    if (!storeId) {
      return jsonResponse(
        { ok: false, error: "store_id é obrigatório." },
        400,
      );
    }

    const { data: store, error: storeError } = await admin
      .from("stores")
      .select(
        "id,owner_id,name,slug,is_published,minimum_order,estimated_time,whatsapp",
      )
      .eq("id", storeId)
      .maybeSingle();

    if (storeError) throw storeError;

    if (!store || !store.is_published) {
      return jsonResponse(
        { ok: false, error: "Loja não encontrada ou indisponível." },
        404,
      );
    }

    const { data: integration, error: integrationError } = await admin
      .from("store_mercado_pago_integrations")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    if (integrationError) throw integrationError;

    if (action === "public_config") {
      return jsonResponse({
        ok: true,
        config: {
          enabled: Boolean(
            integration?.enabled &&
              integration?.access_token_ciphertext &&
              integration?.access_token_iv
          ),
          checkout_mode: integration?.checkout_mode || "checkout_pro",
          environment: integration?.environment || "test",
          public_key: integration?.public_key || null,
          max_installments: integration?.max_installments || 12,
        },
      });
    }

    if (
      !integration?.enabled ||
      !integration?.access_token_ciphertext ||
      !integration?.access_token_iv
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "O pagamento online não está habilitado nesta loja.",
        },
        400,
      );
    }

    const accessToken = await decryptSecret(
      integration.access_token_ciphertext,
      integration.access_token_iv,
    );

    if (action === "status") {
      const transactionId = cleanText(input?.transaction_id, 80);

      if (!transactionId) {
        return jsonResponse(
          { ok: false, error: "transaction_id é obrigatório." },
          400,
        );
      }

      const { data: transaction, error: transactionError } = await admin
        .from("store_mercado_pago_transactions")
        .select("*")
        .eq("id", transactionId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (transactionError) throw transactionError;

      if (!transaction) {
        return jsonResponse(
          { ok: false, error: "Pagamento não encontrado." },
          404,
        );
      }

      let remote = null;

      if (transaction.payment_id) {
        remote = await mpRequest(
          accessToken,
          `/v1/payments/${encodeURIComponent(transaction.payment_id)}`,
        );
      } else if (transaction.mercado_pago_order_id) {
        remote = await mpRequest(
          accessToken,
          `/v1/orders/${encodeURIComponent(
            transaction.mercado_pago_order_id,
          )}`,
        );
      }

      if (remote) {
        const status = normalizeStatus(remote.status);
        const statusDetail =
          remote.status_detail ||
          remote.transactions?.payments?.[0]?.status_detail ||
          null;

        await admin
          .from("store_mercado_pago_transactions")
          .update({
            status,
            status_detail: statusDetail,
            response_snapshot: remote,
            paid_at: status === "approved"
              ? transaction.paid_at || new Date().toISOString()
              : transaction.paid_at,
          })
          .eq("id", transaction.id);

        transaction.status = status;
        transaction.status_detail = statusDetail;
      }

      return jsonResponse({
        ok: true,
        payment: {
          transaction_id: transaction.id,
          external_reference: transaction.external_reference,
          status: transaction.status,
          status_detail: transaction.status_detail,
          amount: transaction.amount,
        },
      });
    }

    if (action !== "create") {
      return jsonResponse(
        { ok: false, error: "Ação não reconhecida." },
        400,
      );
    }

    const mode =
      input?.mode === "pix"
        ? "pix"
        : "checkout_pro";

    const rawItems = Array.isArray(input?.items)
      ? input.items.slice(0, 100)
      : [];

    if (!rawItems.length) {
      return jsonResponse(
        { ok: false, error: "O pedido não possui itens." },
        400,
      );
    }

    const customerName = cleanText(input?.customer?.name, 100);
    const customerPhone = onlyDigits(input?.customer?.phone);
    const customerEmail = cleanText(input?.customer?.email, 160)
      .toLowerCase();
    const customerCpf = onlyDigits(input?.customer?.cpf);

    if (!customerName) {
      return jsonResponse(
        { ok: false, error: "Nome do cliente é obrigatório." },
        400,
      );
    }

    if (customerPhone.length < 10) {
      return jsonResponse(
        { ok: false, error: "WhatsApp do cliente é inválido." },
        400,
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return jsonResponse(
        { ok: false, error: "E-mail do cliente é inválido." },
        400,
      );
    }

    if (customerCpf.length !== 11) {
      return jsonResponse(
        { ok: false, error: "CPF do cliente é inválido." },
        400,
      );
    }

    const productIds = [
      ...new Set(
        rawItems.map((item: Record<string, unknown>) =>
          cleanText(item.product_id, 80)
        ).filter(Boolean),
      ),
    ];

    const variationIds = [
      ...new Set(
        rawItems.map((item: Record<string, unknown>) =>
          cleanText(item.variation_id, 80)
        ).filter(Boolean),
      ),
    ];

    const { data: products, error: productsError } = await admin
      .from("store_products")
      .select(
        "id,store_id,name,description,sku,price,sale_price,active,stock,stock_mode",
      )
      .eq("store_id", storeId)
      .eq("active", true)
      .in("id", productIds);

    if (productsError) throw productsError;

    const productMap = new Map(
      (products || []).map((product) => [product.id, product]),
    );

    let variationMap = new Map<string, Record<string, unknown>>();

    if (variationIds.length) {
      const { data: variations, error: variationsError } = await admin
        .from("store_product_variations")
        .select("id,product_id,name,price_adjustment")
        .in("id", variationIds);

      if (variationsError) throw variationsError;

      variationMap = new Map(
        (variations || []).map((variation) => [variation.id, variation]),
      );
    }

    const serverItems: Array<Record<string, unknown>> = [];
    let subtotal = 0;

    for (const rawItem of rawItems) {
      const productId = cleanText(rawItem.product_id, 80);
      const variationId = cleanText(rawItem.variation_id, 80);
      const quantity = positiveInteger(rawItem.quantity, 100);
      const product = productMap.get(productId);

      if (!product || !quantity) {
        return jsonResponse(
          {
            ok: false,
            error: "Um produto do carrinho não está mais disponível.",
          },
          409,
        );
      }

      if (
        product.stock_mode === "out" ||
        (
          product.stock_mode === "controlled" &&
          Number(product.stock || 0) < quantity
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            error: `Estoque insuficiente para ${product.name}.`,
          },
          409,
        );
      }

      let variation = null;

      if (variationId) {
        variation = variationMap.get(variationId);

        if (!variation || variation.product_id !== product.id) {
          return jsonResponse(
            {
              ok: false,
              error: `Variação inválida para ${product.name}.`,
            },
            409,
          );
        }
      }

      const basePrice =
        product.sale_price !== null &&
          Number(product.sale_price) >= 0 &&
          Number(product.sale_price) < Number(product.price)
          ? Number(product.sale_price)
          : Number(product.price);

      const unitPrice = roundMoney(
        basePrice + Number(variation?.price_adjustment || 0),
      );

      if (unitPrice < 0) {
        throw new Error(`Preço inválido para ${product.name}.`);
      }

      subtotal = roundMoney(subtotal + unitPrice * quantity);

      serverItems.push({
        id: product.id,
        title: variation
          ? `${product.name} — ${variation.name}`
          : product.name,
        description: cleanText(product.description, 200) || undefined,
        category_id: "others",
        quantity,
        unit_price: unitPrice,
        currency_id: "BRL",
        note: cleanText(rawItem.note, 240) || null,
        variation_id: variationId || null,
      });
    }

    let deliveryFee = null;
    let deliveryAmount = 0;
    const deliveryFeeId = cleanText(input?.delivery_fee_id, 80);

    if (deliveryFeeId) {
      const { data, error } = await admin
        .from("store_delivery_fees")
        .select("*")
        .eq("id", deliveryFeeId)
        .eq("store_id", storeId)
        .eq("active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return jsonResponse(
          {
            ok: false,
            error: "A opção de entrega não está mais disponível.",
          },
          409,
        );
      }

      deliveryFee = data;
      deliveryAmount = roundMoney(data.fee);
    }

    const minimumOrder = Math.max(
      Number(store.minimum_order || 0),
      Number(deliveryFee?.minimum_order || 0),
    );

    if (subtotal < minimumOrder) {
      return jsonResponse(
        {
          ok: false,
          error: `O pedido mínimo é de R$ ${minimumOrder.toFixed(2)}.`,
        },
        409,
      );
    }

    const total = roundMoney(subtotal + deliveryAmount);
    const externalReference = `CLENA-${store.id.slice(0, 8)}-${
      crypto.randomUUID().replaceAll("-", "").slice(0, 18)
    }`;

    const address = {
      zip_code: onlyDigits(input?.customer?.address?.zip_code),
      street_name: cleanText(
        input?.customer?.address?.street_name,
        160,
      ),
      street_number: cleanText(
        input?.customer?.address?.street_number,
        20,
      ),
      neighborhood: cleanText(
        input?.customer?.address?.neighborhood,
        100,
      ),
      complement: cleanText(
        input?.customer?.address?.complement,
        120,
      ),
      city: cleanText(input?.customer?.address?.city, 100),
      state: cleanText(input?.customer?.address?.state, 2)
        .toUpperCase(),
    };

    if (deliveryFee?.delivery_type !== "pickup") {
      if (
        address.zip_code.length !== 8 ||
        !address.street_name ||
        !address.street_number ||
        !address.neighborhood ||
        !address.city ||
        address.state.length !== 2
      ) {
        return jsonResponse(
          { ok: false, error: "Endereço de entrega incompleto." },
          400,
        );
      }
    }

    const orderSnapshot = {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
      },
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        cpf: customerCpf,
        address,
      },
      items: serverItems,
      delivery: deliveryFee
        ? {
            id: deliveryFee.id,
            name: deliveryFee.name,
            delivery_type: deliveryFee.delivery_type,
            fee: deliveryAmount,
            estimated_time: deliveryFee.estimated_time,
          }
        : null,
      subtotal,
      delivery_amount: deliveryAmount,
      total,
      notes: cleanText(input?.notes, 400) || null,
    };

    const idempotencyKey = crypto.randomUUID();
    let remoteResponse: Record<string, unknown>;
    let preferenceId: string | null = null;
    let paymentId: string | null = null;
    let checkoutUrl: string | null = null;
    let sandboxCheckoutUrl: string | null = null;
    let mercadoPagoOrderId: string | null = null;
    let status = "created";
    let statusDetail: string | null = null;
    let qrCode: string | null = null;
    let qrCodeBase64: string | null = null;
    let ticketUrl: string | null = null;
    let expirationDate: string | null = null;

    if (mode === "checkout_pro") {
      const preferenceItems = serverItems.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: "BRL",
      }));

      if (deliveryAmount > 0) {
        preferenceItems.push({
          id: `delivery-${deliveryFee?.id || "fee"}`,
          title: `Taxa de entrega — ${deliveryFee?.name || "Entrega"}`,
          description: "Taxa de entrega do pedido",
          quantity: 1,
          unit_price: deliveryAmount,
          currency_id: "BRL",
        });
      }

      const backUrls = {
        success: integration.success_url ||
          `${request.headers.get("origin") || ""}/loja.html?slug=${store.slug}&payment=success`,
        pending: integration.pending_url ||
          `${request.headers.get("origin") || ""}/loja.html?slug=${store.slug}&payment=pending`,
        failure: integration.failure_url ||
          `${request.headers.get("origin") || ""}/loja.html?slug=${store.slug}&payment=failure`,
      };

      const preferencePayload = {
        items: preferenceItems,
        payer: {
          name: splitName(customerName).first_name,
          surname: splitName(customerName).last_name,
          email: customerEmail,
          phone: {
            area_code: customerPhone.slice(0, 2),
            number: customerPhone.slice(2),
          },
          identification: {
            type: "CPF",
            number: customerCpf,
          },
          address: deliveryFee?.delivery_type === "pickup"
            ? undefined
            : {
                zip_code: address.zip_code,
                street_name: address.street_name,
                street_number: Number(address.street_number) || 0,
              },
        },
        shipments: deliveryFee?.delivery_type === "pickup"
          ? {
              local_pickup: true,
              cost: 0,
            }
          : {
              local_pickup: false,
              cost: deliveryAmount,
              free_shipping: deliveryAmount <= 0,
              receiver_address: {
                zip_code: address.zip_code,
                street_name: address.street_name,
                street_number: Number(address.street_number) || 0,
                city_name: address.city,
                state_name: address.state,
              },
            },
        payment_methods: {
          installments: Number(integration.max_installments || 12),
        },
        back_urls: backUrls,
        auto_return: integration.auto_return ? "approved" : undefined,
        notification_url: integration.notification_url || undefined,
        external_reference: externalReference,
        statement_descriptor: integration.statement_descriptor || undefined,
        binary_mode: Boolean(integration.binary_mode),
        metadata: {
          clena_store_id: store.id,
          clena_external_reference: externalReference,
        },
      };

      remoteResponse = await mpRequest(
        accessToken,
        "/checkout/preferences",
        {
          method: "POST",
          headers: {
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(preferencePayload),
        },
      );

      preferenceId = String(remoteResponse.id || "");
      checkoutUrl = String(remoteResponse.init_point || "");
      sandboxCheckoutUrl = String(
        remoteResponse.sandbox_init_point || "",
      );

      const useSandbox =
        integration.environment === "test" &&
        sandboxCheckoutUrl;

      checkoutUrl = useSandbox
        ? sandboxCheckoutUrl
        : checkoutUrl;

      status = "created";
    } else {
      const expirationDateTo = new Date(
        Date.now() + 30 * 60 * 1000,
      ).toISOString();

      const pixPayload = {
        transaction_amount: total,
        description: `Pedido ${store.name}`,
        payment_method_id: "pix",
        external_reference: externalReference,
        date_of_expiration: expirationDateTo,
        notification_url: integration.notification_url || undefined,
        payer: {
          email: customerEmail,
          first_name: splitName(customerName).first_name,
          last_name: splitName(customerName).last_name,
          identification: {
            type: "CPF",
            number: customerCpf,
          },
          address: deliveryFee?.delivery_type === "pickup"
            ? undefined
            : {
                zip_code: address.zip_code,
                street_name: address.street_name,
                street_number: address.street_number,
                neighborhood: address.neighborhood,
                city: address.city,
                federal_unit: address.state,
              },
        },
        additional_info: {
          items: serverItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            category_id: "others",
          })),
          payer: {
            first_name: splitName(customerName).first_name,
            last_name: splitName(customerName).last_name,
            phone: {
              area_code: customerPhone.slice(0, 2),
              number: customerPhone.slice(2),
            },
            address: deliveryFee?.delivery_type === "pickup"
              ? undefined
              : {
                  zip_code: address.zip_code,
                  street_name: address.street_name,
                  street_number: address.street_number,
                },
          },
          shipments: deliveryFee?.delivery_type === "pickup"
            ? {
                receiver_address: null,
              }
            : {
                receiver_address: {
                  zip_code: address.zip_code,
                  street_name: address.street_name,
                  street_number: address.street_number,
                  city_name: address.city,
                  state_name: address.state,
                },
              },
        },
        metadata: {
          clena_store_id: store.id,
          clena_external_reference: externalReference,
        },
      };

      remoteResponse = await mpRequest(
        accessToken,
        "/v1/payments",
        {
          method: "POST",
          headers: {
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(pixPayload),
        },
      );

      paymentId = String(remoteResponse.id || "");
      status = normalizeStatus(remoteResponse.status);
      statusDetail = String(remoteResponse.status_detail || "");

      const transactionData =
        remoteResponse.point_of_interaction?.transaction_data || {};

      qrCode = transactionData.qr_code || null;
      qrCodeBase64 = transactionData.qr_code_base64 || null;
      ticketUrl = transactionData.ticket_url || null;
      expirationDate = remoteResponse.date_of_expiration || expirationDateTo;

      if (!qrCode && !ticketUrl) {
        throw new Error(
          "O Mercado Pago não devolveu os dados do QR Code Pix.",
        );
      }
    }

    const { data: transaction, error: insertError } = await admin
      .from("store_mercado_pago_transactions")
      .insert({
        store_id: store.id,
        owner_id: store.owner_id,
        external_reference: externalReference,
        checkout_type: mode,
        preference_id: preferenceId,
        payment_id: paymentId,
        mercado_pago_order_id: mercadoPagoOrderId,
        status,
        status_detail: statusDetail,
        amount: total,
        subtotal,
        delivery_amount: deliveryAmount,
        currency_id: "BRL",
        payer_name: customerName,
        payer_email: customerEmail,
        payer_phone: customerPhone,
        payer_document: customerCpf,
        delivery_fee_id: deliveryFee?.id || null,
        init_point: checkoutUrl,
        sandbox_init_point: sandboxCheckoutUrl,
        pix_qr_code: qrCode,
        pix_ticket_url: ticketUrl,
        pix_expiration_at: expirationDate,
        request_snapshot: orderSnapshot,
        response_snapshot: remoteResponse,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    if (mode === "checkout_pro") {
      return jsonResponse({
        ok: true,
        checkout_url: checkoutUrl,
        payment: {
          transaction_id: transaction.id,
          external_reference: externalReference,
          preference_id: preferenceId,
          amount: total,
          status,
        },
      });
    }

    return jsonResponse({
      ok: true,
      payment: {
        transaction_id: transaction.id,
        external_reference: externalReference,
        payment_id: paymentId,
        amount: total,
        status,
        status_detail: statusDetail,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        ticket_url: ticketUrl,
        expiration_date: expirationDate,
      },
    });
  } catch (error) {
    console.error("mercado-pago-checkout:", error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || "Erro interno ao processar pagamento.",
      },
      500,
    );
  }
});
