import { NextResponse } from "next/server";

export const runtime = "nodejs";

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  return NextResponse.json({
    supabaseUrl: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    databaseUrl: hasEnv("DATABASE_URL"),
    groqApiKey: hasEnv("GROQ_API_KEY"),
    geminiApiKey: hasEnv("GEMINI_API_KEY"),
    smtpConfigured: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].every(hasEnv),
  });
}
