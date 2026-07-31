export function readTrimmedEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function hasValidSupabaseBrowserConfig() {
  const supabaseUrl = readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return Boolean(isValidHttpUrl(supabaseUrl) && supabaseAnonKey);
}
