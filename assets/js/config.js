let cachedConfig = null;

export async function getPublicConfig() {
  if (cachedConfig) return cachedConfig;

  const response = await fetch("/api/public-config", {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar as configurações públicas da Vercel.");
  }

  const config = await response.json();

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY não foram configuradas na Vercel.");
  }

  cachedConfig = Object.freeze(config);
  return cachedConfig;
}
