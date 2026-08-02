import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const { id } = await context.params;
  const result = await getDb().query(
    `
      update share_snapshots
      set revoked_at = now()
      where id = $1 and user_id = $2 and revoked_at is null
      returning id, record_id, title, expires_at, revoked_at, created_at
    `,
    [id, user.id],
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "الرابط غير موجود أو ملغى مسبقاً." }, { status: 404 });
  }

  return NextResponse.json({ share: result.rows[0] });
}
