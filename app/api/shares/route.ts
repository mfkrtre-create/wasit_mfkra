import { NextResponse } from "next/server";
import { z } from "zod";
import { createToken, hashToken, publicAppUrl, requireAuthenticatedRequest } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { buildPublicShareSnapshot } from "@/lib/share-snapshots";

export const runtime = "nodejs";

const recordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["offer", "request"]),
  title: z.string().min(1),
  status: z.string().min(1),
  city: z.string().default(""),
  district: z.string().default(""),
  propertyType: z.string().default(""),
  transaction: z.string().default(""),
  price: z.number().nullable(),
  budget: z.number().nullable(),
  area: z.number().nullable(),
  contact: z.string().default(""),
  notes: z.string().default(""),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

const shareSchema = z.object({
  record: recordSchema,
  options: z.object({
    includePrice: z.boolean().default(true),
    includeArea: z.boolean().default(true),
    includeContact: z.boolean().default(false),
    includeNotes: z.boolean().default(false),
    includeMap: z.boolean().default(true),
    expiresInDays: z.number().int().min(1).max(365).nullable().default(30),
  }),
});

export async function GET() {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const result = await getDb().query(
    `
      select id, record_id, title, expires_at, revoked_at, created_at
      from share_snapshots
      where user_id = $1
      order by created_at desc
      limit 50
    `,
    [user.id],
  );

  return NextResponse.json({ shares: result.rows });
}

export async function POST(request: Request) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const parsed = shareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات المشاركة غير صحيحة." }, { status: 400 });
  }

  const token = createToken();
  const snapshot = buildPublicShareSnapshot(parsed.data.record, parsed.data.options);
  const expiresAt = parsed.data.options.expiresInDays
    ? new Date(Date.now() + parsed.data.options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const result = await getDb().query(
    `
      insert into share_snapshots (user_id, record_id, token_hash, title, snapshot, expires_at)
      values ($1, $2, $3, $4, $5, $6)
      returning id, record_id, title, expires_at, revoked_at, created_at
    `,
    [user.id, parsed.data.record.id, hashToken(token), parsed.data.record.title, snapshot, expiresAt],
  );

  return NextResponse.json({
    share: result.rows[0],
    url: `${publicAppUrl(request)}/s/${token}`,
  });
}
