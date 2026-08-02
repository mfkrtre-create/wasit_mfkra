import "server-only";

import { randomInt } from "node:crypto";
import { createToken, hashToken, publicAppUrl } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

export type OtpPurpose = "email_confirm" | "password_reset";

export function createOtpCode() {
  return String(randomInt(100000, 1000000));
}

export async function createOtp(userId: string, purpose: OtpPurpose, minutes = 15) {
  const code = createOtpCode();
  await getDb().query("insert into app_tokens (user_id, token_hash, purpose, expires_at) values ($1, $2, $3, now() + ($4 || ' minutes')::interval)", [
    userId,
    hashToken(code),
    purpose,
    minutes,
  ]);
  return code;
}

export async function consumeOtp(email: string, purpose: OtpPurpose, code: string) {
  const result = await getDb().query(
    `
      select t.id, t.user_id
      from app_tokens t
      join app_users u on u.id = t.user_id
      where lower(u.email) = lower($1)
        and t.purpose = $2
        and t.token_hash = $3
        and t.used_at is null
        and t.expires_at > now()
      order by t.created_at desc
      limit 1
    `,
    [email, purpose, hashToken(code.trim())],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  await getDb().query("update app_tokens set used_at = now() where id = $1", [row.id]);
  return String(row.user_id);
}

export async function sendEmailConfirmationOtp(input: { userId: string; email: string; name: string }) {
  const code = await createOtp(input.userId, "email_confirm", 20);
  await sendMail({
    to: input.email,
    subject: "رمز تفعيل حساب مفكرة الوسيط",
    text: `رمز تفعيل حسابك هو: ${code}\nالرابط: ${publicAppUrl()}`,
    html: `<p>مرحباً ${input.name}</p><p>رمز تفعيل حسابك في مفكرة الوسيط هو:</p><h2>${code}</h2><p>ينتهي الرمز خلال 20 دقيقة.</p>`,
  });
}

export async function sendPasswordResetOtp(input: { userId: string; email: string; name: string }) {
  const code = await createOtp(input.userId, "password_reset", 20);
  await sendMail({
    to: input.email,
    subject: "رمز استعادة كلمة مرور مفكرة الوسيط",
    text: `رمز استعادة كلمة المرور هو: ${code}\nالرابط: ${publicAppUrl()}`,
    html: `<p>مرحباً ${input.name}</p><p>رمز استعادة كلمة المرور هو:</p><h2>${code}</h2><p>ينتهي الرمز خلال 20 دقيقة.</p>`,
  });
}

export function createCompatibilityLinkToken() {
  return createToken();
}
