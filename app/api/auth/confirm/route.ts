import { NextResponse } from "next/server";
import { createSession, hashToken, publicAppUrl } from "@/lib/app-auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  const redirectUrl = publicAppUrl(request);

  if (!token) {
    return NextResponse.redirect(`${redirectUrl}/?auth=invalid`);
  }

  const db = getDb();
  const result = await db.query(
    `
      select id, user_id, purpose
      from app_tokens
      where token_hash = $1 and used_at is null and expires_at > now()
      limit 1
    `,
    [hashToken(token)],
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.redirect(`${redirectUrl}/?auth=expired`);
  }

  await db.query("update app_tokens set used_at = now() where id = $1", [row.id]);

  if (row.purpose === "email_confirm") {
    await db.query("update app_users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1", [row.user_id]);
  }

  await createSession(String(row.user_id));
  return NextResponse.redirect(`${redirectUrl}/?auth=ok`);
}
