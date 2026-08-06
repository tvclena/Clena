import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MP_CREDENTIALS_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) throw new Error("Configure MP_CREDENTIALS_ENCRYPTION_KEY com pelo menos 32 caracteres.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    await encryptionKey(),
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

function safeConfig(row: Record<string, unknown> | null) {
  if (!row) return null;
  const prefix = String(row.access_token_prefix || "");
  const last4 = String(row.access_token_last4 || "");
  return {
    id: row.id,
    store_id: row.store_id,
    enabled: row.enabled,
    environment: row.environment,
    checkout_mode: row.checkout_mode,
    public_key: row.public_key,
    has_access_token: Boolean(row.access_token_ciphertext && row.access_token_iv),
    masked_access_token: last4 ? `${prefix || "TOKEN"}••••••••${last4}` : null,
    has_webhook_secret: Boolean(row.has_webhook_secret),
    statement_descriptor: row.statement_descriptor,
    max_installments: row.max_installments,
    auto_return: row.auto_return,
    binary_mode: row.binary_mode,
    notification_url: row.notification_url,
    success_url: row.success_url,
    pending_url: row.pending_url,
    failure_url: row.failure_url,
    last_tested_at: row.last_tested_at,
    last_test_status: row.last_test_status,
    last_test_message: row.last_test_message,
    updated_at: row.updated_at,
  };
}

async function testAccessToken(token: string) {
  const response = await fetch("https://api.mercadopago.com/v1/payment_methods", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || body?.error || `Mercado Pago respondeu HTTP ${response.status}.`;
    throw new Error(message);
  }
  return Array.isArray(body) ? body.length : 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") || "";

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ ok: false, error: "Sessão inválida ou expirada." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const input = await request.json();
    const action = String(input?.action || "");
    const storeId = String(input?.store_id || "");
    if (!storeId) return json({ ok: false, error: "store_id é obrigatório." }, 400);

    const { data: store, error: storeError } = await admin.from("stores").select("id,owner_id,is_published").eq("id", storeId).maybeSingle();
    if (storeError) throw storeError;
    if (!store || store.owner_id !== user.id) return json({ ok: false, error: "Loja não encontrada ou sem permissão." }, 403);

    const getRow = async () => {
      const { data, error } = await admin.from("store_mercado_pago_integrations").select("*").eq("store_id", storeId).maybeSingle();
      if (error) throw error;
      return data;
    };

    if (action === "get_config") return json({ ok: true, config: safeConfig(await getRow()) });

    if (action === "disconnect") {
      const { error } = await admin.from("store_mercado_pago_integrations").delete().eq("store_id", storeId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "test_connection") {
      const row = await getRow();
      let token = String(input?.access_token || "").trim();
      if (!token && row?.access_token_ciphertext && row?.access_token_iv) {
        token = await decryptSecret(row.access_token_ciphertext, row.access_token_iv);
      }
      if (!token) return json({ ok: false, error: "Informe ou salve um Access Token." }, 400);

      try {
        const count = await testAccessToken(token);
        if (row) await admin.from("store_mercado_pago_integrations").update({ last_tested_at: new Date().toISOString(), last_test_status: "success", last_test_message: `API conectada; ${count} métodos.` }).eq("store_id", storeId);
        return json({ ok: true, payment_methods_count: count });
      } catch (error) {
        if (row) await admin.from("store_mercado_pago_integrations").update({ last_tested_at: new Date().toISOString(), last_test_status: "error", last_test_message: error.message }).eq("store_id", storeId);
        throw error;
      }
    }

    if (action === "save_config") {
      const config = input?.config || {};
      const current = await getRow();
      const token = String(config.access_token || "").trim();
      const webhookSecret = String(config.webhook_secret || "").trim();
      if (!token && !current?.access_token_ciphertext) return json({ ok: false, error: "Informe o Access Token." }, 400);

      const payload: Record<string, unknown> = {
        store_id: storeId,
        owner_id: user.id,
        enabled: Boolean(config.enabled),
        environment: config.environment === "production" ? "production" : "test",
        checkout_mode: config.checkout_mode === "orders" ? "orders" : "checkout_pro",
        public_key: String(config.public_key || "").trim() || null,
        statement_descriptor: String(config.statement_descriptor || "").trim().toUpperCase().slice(0, 22) || null,
        max_installments: Math.max(1, Math.min(24, Number(config.max_installments || 12))),
        auto_return: config.auto_return !== false,
        binary_mode: Boolean(config.binary_mode),
        notification_url: String(config.notification_url || "").trim() || null,
        success_url: String(config.success_url || "").trim() || null,
        pending_url: String(config.pending_url || "").trim() || null,
        failure_url: String(config.failure_url || "").trim() || null,
      };

      if (token) {
        const encrypted = await encryptSecret(token);
        payload.access_token_ciphertext = encrypted.ciphertext;
        payload.access_token_iv = encrypted.iv;
        payload.access_token_prefix = token.split("-")[0]?.slice(0, 12) || "TOKEN";
        payload.access_token_last4 = token.slice(-4);
      }
      if (webhookSecret) {
        const encrypted = await encryptSecret(webhookSecret);
        payload.webhook_secret_ciphertext = encrypted.ciphertext;
        payload.webhook_secret_iv = encrypted.iv;
        payload.has_webhook_secret = true;
      }

      const { data, error } = await admin.from("store_mercado_pago_integrations").upsert(payload, { onConflict: "store_id" }).select("*").single();
      if (error) throw error;
      return json({ ok: true, config: safeConfig(data) });
    }

    return json({ ok: false, error: "Ação não reconhecida." }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error?.message || "Erro interno na integração Mercado Pago." }, 500);
  }
});
