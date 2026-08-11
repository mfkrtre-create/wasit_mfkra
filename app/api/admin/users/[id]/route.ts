import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedRequest } from '@/lib/app-auth';
import { getDb } from '@/lib/db';

const schema = z.object({ isActive: z.boolean().optional(), role: z.enum(['admin', 'broker']).optional() }).refine((value) => value.isActive !== undefined || value.role !== undefined);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) return response;
  if (user.role !== 'admin') return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: 'التعديل غير صالح.' }, { status: 400 });
  const { id } = await context.params;
  if (id === user.id && payload.data.isActive === false) return NextResponse.json({ error: 'لا يمكنك تعطيل حسابك الإداري.' }, { status: 400 });
  const result = await getDb().query(`update app_users set is_active = coalesce($2, is_active), role = coalesce($3, role) where id = $1 returning id, email, name, phone, role, is_active, referral_code, created_at, email_confirmed_at`, [id, payload.data.isActive ?? null, payload.data.role ?? null]);
  if (!result.rows[0]) return NextResponse.json({ error: 'الحساب غير موجود.' }, { status: 404 });
  await getDb().query(`insert into admin_audit_logs (admin_user_id, action, target_user_id, details) values ($1, 'user_updated', $2, $3)`, [user.id, id, payload.data]);
  if (payload.data.isActive === false) await getDb().query('delete from app_sessions where user_id = $1', [id]);
  return NextResponse.json({ user: result.rows[0] });
}
