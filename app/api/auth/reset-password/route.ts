import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { consumeOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/passwords";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل البريد ورمز OTP وكلمة مرور جديدة لا تقل عن 8 أحرف." }, { status: 400 });
  }

  const userId = await consumeOtp(parsed.data.email, "password_reset", parsed.data.code);
  if (!userId) {
    return NextResponse.json({ error: "رمز الاستعادة غير صحيح أو منتهي." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await getDb().query("update app_users set password_hash = $1, email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $2", [
    passwordHash,
    userId,
  ]);
  await createSession(userId);

  return NextResponse.json({ message: "تم تغيير كلمة المرور وتسجيل الدخول." });
}
