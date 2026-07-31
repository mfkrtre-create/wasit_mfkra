import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasValidSupabaseBrowserConfig, isValidHttpUrl, readTrimmedEnv } from "@/lib/env-config";

let browserClient: SupabaseClient | null = null;

export function hasSupabaseBrowserConfig() {
  return hasValidSupabaseBrowserConfig();
}

export function getSupabaseBrowserClient() {
  const url = readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!isValidHttpUrl(url) || !anonKey) {
    return null;
  }

  browserClient ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
