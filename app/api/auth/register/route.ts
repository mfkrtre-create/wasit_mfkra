import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertOtpRecipientAllowed, InvalidProductionEmailError } from "@/lib/email-policy";
import { hasSmtpConfig } from "@/lib/mailer";
import { sendEmailConfirmationOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/passwords";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(32),
  falLicense: z.string().trim().max(80).optional().or(z.literal("")),
});

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "").replace(/^0/, "966");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل بريداً صحيحاً وكلمة مرور لا تقل عن 8 أحرف." }, { status: 400 });
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

  if (!hasSmtpConfig()) {
    return NextResponse.json({ error: "لا يمكن إنشاء الحساب قبل تهيئة البريد لتفعيل OTP." }, { status: 503 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const phone = normalizePhone(parsed.data.phone);
  const username = phone;
  const result = await getDb()
    .query(
      `
        insert into app_users (email, username, phone, name, fal_license, password_hash, email_confirmed_at)
        values ($1, $2, $3, $4, $5, $6, null)
        returning id, email, username, phone, name, role, timezone, fal_license, email_confirmed_at
      `,
      [email, username, phone, parsed.data.name, parsed.data.falLicense || "", passwordHash],
    )
    .catch((error: unknown) => {
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        return null;
      }
      throw error;
    });

  if (!result) {
    return NextResponse.json({ error: "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول." }, { status: 409 });
  }

  const user = {
    id: String(result.rows[0].id),
    email: String(result.rows[0].email),
    username: String(result.rows[0].username),
    phone: String(result.rows[0].phone),
    name: String(result.rows[0].name),
    role: result.rows[0].role === "admin" ? "admin" : "broker",
    timezone: String(result.rows[0].timezone || "Asia/Riyadh"),
    falLicense: String(result.rows[0].fal_license || ""),
    emailConfirmed: Boolean(result.rows[0].email_confirmed_at),
  };

  await sendEmailConfirmationOtp({ userId: user.id, email: user.email, name: user.name });
  return NextResponse.json({ user: null, email: user.email, message: "تم إنشاء الحساب. أدخل رمز OTP المرسل إلى بريدك لتفعيل الحساب." });
}
