import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { NextResponse } from 'next/server';
import { hashToken } from '@/lib/app-auth';
import { getDb } from '@/lib/db';
import type { PublicShareSnapshot } from '@/lib/share-snapshots';

const contentTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function imageRoot() { return process.env.PROPERTY_IMAGE_DIR || join(process.cwd(), '.data', 'property-images'); }

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await getDb().query(`select user_id, snapshot from share_snapshots where token_hash = $1 and revoked_at is null and (expires_at is null or expires_at > now()) limit 1`, [hashToken(token)]);
  if (!result.rows[0]) return NextResponse.json({ error: 'الصورة غير متاحة.' }, { status: 404 });
  const snapshot = result.rows[0].snapshot as PublicShareSnapshot;
  const imageId = snapshot.imageId;
  if (!imageId || !/^[a-zA-Z0-9_-]+_[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/i.test(imageId) || !imageId.startsWith(`${result.rows[0].user_id}_`)) return NextResponse.json({ error: 'الصورة غير متاحة.' }, { status: 404 });
  const filePath = join(imageRoot(), imageId);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) return NextResponse.json({ error: 'الصورة غير موجودة.' }, { status: 404 });
  return new Response(await readFile(filePath), { headers: { 'Content-Type': contentTypes[extname(imageId).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' } });
}
