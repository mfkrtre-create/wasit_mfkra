import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, createToken, hashToken, publicAppUrl, requireEmailConfirmation } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { hasSmtpConfig, sendMail } from "@/lib/mailer";
import { hashPassword } from "@/lib/passwords";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل بريداً صحيحاً وكلمة مرور لا تقل عن 8 أحرف." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);
  const confirmationRequired = requireEmailConfirmation();

  const result = await getDb()
    .query(
      `
        insert into app_users (email, name, password_hash, email_confirmed_at)
        values ($1, $2, $3, case when $4 then null else now() end)
        returning id, email, name, role, timezone, email_confirmed_at
      `,
      [email, parsed.data.name || "وسيط عقاري", passwordHash, confirmationRequired],
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
    name: String(result.rows[0].name),
    role: result.rows[0].role === "admin" ? "admin" : "broker",
    timezone: String(result.rows[0].timezone || "Asia/Riyadh"),
    emailConfirmed: Boolean(result.rows[0].email_confirmed_at),
  };

  if (confirmationRequired) {
    if (!hasSmtpConfig()) {
      return NextResponse.json({ error: "تأكيد البريد مطلوب لكن SMTP غير مهيأ على الخادم." }, { status: 503 });
    }

    const token = createToken();
    await getDb().query("insert into app_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, 'email_confirm', now() + interval '24 hours')", [
      user.id,
      hashToken(token),
    ]);
    const confirmUrl = `${publicAppUrl(request)}/api/auth/confirm?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: "تأكيد بريد مفكرة الوسيط",
      text: `لتأكيد بريدك افتح الرابط: ${confirmUrl}`,
      html: `<p>لتأكيد بريدك في مفكرة الوسيط اضغط الرابط:</p><p><a href="${confirmUrl}">تأكيد البريد</a></p>`,
    });

    return NextResponse.json({ user: null, message: "تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد، ثم سجّل الدخول." });
  }

  await createSession(user.id);
  return NextResponse.json({ user, message: "تم إنشاء الحساب وتسجيل الدخول بنجاح." });
}
