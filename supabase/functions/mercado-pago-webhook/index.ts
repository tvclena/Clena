import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MP_CREDENTIALS_ENCRYPTION_KEY");

  if (!secret || secret.length < 32) {
    throw new Error("Chave de criptografia não configurada.");
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

async function decryptSecret(ciphertext: string, iv: string) {
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

function normalizeStatus(status: unknown): string {
  const value = String(status || "").toLowerCase();

  const map: Record<string, string> = {
    approved: "approved",
    processed: "approved",
    pending: "pending",
    in_process: "pending",
    action_required: "pending",
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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("ok", { status: 200 });
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

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const paymentId = String(
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      "",
    );

    if (!paymentId) {
      return new Response("ok", { status: 200 });
    }

    const { data: transaction, error: transactionError } = await admin
      .from("store_mercado_pago_transactions")
      .select("*")
      .or(
        `payment_id.eq.${paymentId},mercado_pago_order_id.eq.${paymentId}`,
      )
      .maybeSingle();

    if (transactionError) throw transactionError;

    if (!transaction) {
      return new Response("ok", { status: 200 });
    }

    const { data: integration, error: integrationError } = await admin
      .from("store_mercado_pago_integrations")
      .select(
        "access_token_ciphertext,access_token_iv",
      )
      .eq("store_id", transaction.store_id)
      .maybeSingle();

    if (integrationError) throw integrationError;

    if (
      !integration?.access_token_ciphertext ||
      !integration?.access_token_iv
    ) {
      return new Response("ok", { status: 200 });
    }

    const token = await decryptSecret(
      integration.access_token_ciphertext,
      integration.access_token_iv,
    );

    const endpoint = transaction.payment_id
      ? `/v1/payments/${encodeURIComponent(transaction.payment_id)}`
      : `/v1/orders/${encodeURIComponent(
          transaction.mercado_pago_order_id,
        )}`;

    const response = await fetch(
      `https://api.mercadopago.com${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    const remote = await response.json().catch(() => null);

    if (!response.ok || !remote) {
      throw new Error(
        remote?.message ||
        `Erro HTTP ${response.status} ao confirmar pagamento.`,
      );
    }

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
        webhook_received_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("mercado-pago-webhook:", error);

    // Mercado Pago pode reenviar. Retorna 500 somente em falha real.
    return new Response("error", { status: 500 });
  }
});
