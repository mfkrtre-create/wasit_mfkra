import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "broker";
  timezone: string;
  emailConfirmed: boolean;
};

export const sessionCookieName = "wasit_session";
const sessionDays = 30;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export function publicAppUrl(request?: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return "http://localhost:3000";
}

function rowToUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name || "وسيط عقاري"),
    role: row.role === "admin" ? "admin" : "broker",
    timezone: String(row.timezone || "Asia/Riyadh"),
    emailConfirmed: Boolean(row.email_confirmed_at),
  };
}

export async function createSession(userId: string) {
  const token = createToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  await getDb().query("insert into app_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)", [userId, tokenHash, expiresAt]);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await getDb().query("delete from app_sessions where token_hash = $1", [hashToken(token)]).catch(() => {});
  }

  cookieStore.delete(sessionCookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return null;
  }

  const result = await getDb().query(
    `
      select u.id, u.email, u.name, u.role, u.timezone, u.email_confirmed_at
      from app_sessions s
      join app_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()
      limit 1
    `,
    [hashToken(token)],
  );

  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function requireAuthenticatedRequest() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "سجل الدخول أولاً لاستخدام هذه الخدمة." }, { status: 401 }),
    };
  }

  return { user, response: null };
}

export function requireEmailConfirmation() {
  return process.env.REQUIRE_EMAIL_CONFIRMATION === "true";
}
