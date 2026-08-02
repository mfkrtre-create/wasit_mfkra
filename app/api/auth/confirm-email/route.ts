import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { consumeOtp } from "@/lib/otp";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل البريد ورمز OTP المكون من 6 أرقام." }, { status: 400 });
  }

  const userId = await consumeOtp(parsed.data.email, "email_confirm", parsed.data.code);
  if (!userId) {
    return NextResponse.json({ error: "رمز التفعيل غير صحيح أو منتهي." }, { status: 400 });
  }

  const result = await getDb().query(
    `
      update app_users
      set email_confirmed_at = coalesce(email_confirmed_at, now())
      where id = $1
      returning id, email, username, phone, name, role, timezone, fal_license, email_confirmed_at
    `,
    [userId],
  );
  const row = result.rows[0];
  await createSession(userId);

  return NextResponse.json({
    user: {
      id: String(row.id),
      email: String(row.email),
      username: String(row.username || row.phone || row.email),
      phone: String(row.phone || ""),
      name: String(row.name || "وسيط عقاري"),
      role: row.role === "admin" ? "admin" : "broker",
      timezone: String(row.timezone || "Asia/Riyadh"),
      falLicense: String(row.fal_license || ""),
      emailConfirmed: Boolean(row.email_confirmed_at),
    },
    message: "تم تفعيل البريد وتسجيل الدخول.",
  });
}
