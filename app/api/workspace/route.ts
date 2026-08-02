import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const result = await getDb().query("select state, version from workspace_snapshots where user_id = $1 limit 1", [user.id]);
  return NextResponse.json({ state: result.rows[0]?.state ?? null, version: result.rows[0]?.version ?? 1, user });
}

export async function PUT(request: Request) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const payload = (await request.json().catch(() => null)) as { state?: unknown; version?: number } | null;
  if (!payload || typeof payload.state !== "object" || payload.state === null) {
    return NextResponse.json({ error: "بيانات الحفظ غير صحيحة." }, { status: 400 });
  }

  await getDb().query(
    `
      insert into workspace_snapshots (user_id, state, version)
      values ($1, $2, $3)
      on conflict (user_id)
      do update set state = excluded.state, version = excluded.version, updated_at = now()
    `,
    [user.id, payload.state, payload.version ?? 1],
  );

  return NextResponse.json({ ok: true });
}
