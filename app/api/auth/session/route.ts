import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/app-auth";
import { hasSmtpConfig } from "@/lib/mailer";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user, smtpConfigured: hasSmtpConfig() });
}
