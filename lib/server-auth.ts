import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasValidSupabaseBrowserConfig, readTrimmedEnv } from "@/lib/env-config";

function authError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuthenticatedRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) {
    return authError("سجل الدخول أولاً لاستخدام هذه الخدمة.", 401);
  }

  if (!hasValidSupabaseBrowserConfig()) {
    return authError("خدمة الدخول غير مهيأة على الخادم.", 503);
  }

  const supabase = createClient(readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL"), readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return authError("جلسة الدخول غير صالحة أو انتهت.", 401);
  }

  return null;
}
