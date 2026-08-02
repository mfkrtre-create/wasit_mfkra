import { NextResponse } from "next/server";
import { z } from "zod";
import { createToken, hashToken, publicAppUrl } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { hasSmtpConfig, sendMail } from "@/lib/mailer";

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
    return NextResponse.json({ error: "أدخل البريد الإلكتروني أولاً." }, { status: 400 });
  }

  const result = await getDb().query("select id, email from app_users where lower(email) = lower($1) limit 1", [parsed.data.email]);
  if (result.rows[0]) {
    const token = createToken();
    await getDb().query("insert into app_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, 'magic_login', now() + interval '30 minutes')", [
      result.rows[0].id,
      hashToken(token),
    ]);
    const loginUrl = `${publicAppUrl(request)}/api/auth/confirm?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: String(result.rows[0].email),
      subject: "رابط دخول مفكرة الوسيط",
      text: `رابط الدخول صالح لمدة 30 دقيقة: ${loginUrl}`,
      html: `<p>رابط الدخول صالح لمدة 30 دقيقة:</p><p><a href="${loginUrl}">دخول مفكرة الوسيط</a></p>`,
    });
  }

  return NextResponse.json({ message: "إذا كان البريد مسجلاً، سيصلك رابط الدخول خلال لحظات." });
}
