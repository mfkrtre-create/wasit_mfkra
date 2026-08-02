import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, requireEmailConfirmation } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل البريد وكلمة المرور." }, { status: 400 });
  }

  const result = await getDb().query("select id, email, name, role, timezone, password_hash, email_confirmed_at from app_users where lower(email) = lower($1) limit 1", [
    parsed.data.email,
  ]);
  const row = result.rows[0];
  if (!row || !(await verifyPassword(parsed.data.password, String(row.password_hash)))) {
    return NextResponse.json({ error: "تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور." }, { status: 401 });
  }

  if (requireEmailConfirmation() && !row.email_confirmed_at) {
    return NextResponse.json({ error: "أكد بريدك الإلكتروني أولاً ثم سجّل الدخول." }, { status: 403 });
  }

  await createSession(String(row.id));
  return NextResponse.json({
    user: {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name || "وسيط عقاري"),
      role: row.role === "admin" ? "admin" : "broker",
      timezone: String(row.timezone || "Asia/Riyadh"),
      emailConfirmed: Boolean(row.email_confirmed_at),
    },
    message: "تم تسجيل الدخول بنجاح.",
  });
}
