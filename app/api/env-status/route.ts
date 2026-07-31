import { NextResponse } from "next/server";
import { isValidHttpUrl, readTrimmedEnv } from "@/lib/env-config";

export const runtime = "nodejs";

function hasEnv(name: string) {
  return Boolean(readTrimmedEnv(name));
}

export async function GET() {
  return NextResponse.json({
    supabaseUrl: isValidHttpUrl(readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL")),
    supabaseAnonKey: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    databaseUrl: hasEnv("DATABASE_URL"),
    groqApiKey: hasEnv("GROQ_API_KEY"),
    geminiApiKey: hasEnv("GEMINI_API_KEY"),
    smtpConfigured: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].every(hasEnv),
  });
}
