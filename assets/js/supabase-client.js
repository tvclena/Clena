import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPublicConfig } from "./config.js";

let client = null;

export async function getSupabase() {
  if (client) return client;

  const config = await getPublicConfig();

  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return client;
}
