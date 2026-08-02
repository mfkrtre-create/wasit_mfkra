import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertOtpRecipientAllowed, InvalidProductionEmailError } from "@/lib/email-policy";
import { hasSmtpConfig } from "@/lib/mailer";
import { sendEmailConfirmationOtp } from "@/lib/otp";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  if (!hasSmtpConfig()) {
    return NextResponse.json({ error: "إرسال البريد غير مهيأ على الخادم." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل البريد الإلكتروني." }, { status: 400 });
  }

  let email: string;
  try {
    email = assertOtpRecipientAllowed(parsed.data.email);
  } catch (error) {
    if (error instanceof InvalidProductionEmailError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const result = await getDb().query(
    "select id, email, name, email_confirmed_at from app_users where lower(email) = lower($1) limit 1",
    [email],
  );
  const row = result.rows[0];
  if (row && !row.email_confirmed_at) {
    await sendEmailConfirmationOtp({ userId: String(row.id), email: String(row.email), name: String(row.name || "وسيط عقاري") });
  }

  return NextResponse.json({ message: "إذا كان البريد يحتاج تفعيل، سيصلك رمز OTP جديد." });
}
