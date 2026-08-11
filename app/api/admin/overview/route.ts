import { NextResponse } from 'next/server';
import { requireAuthenticatedRequest } from '@/lib/app-auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) return response;
  if (user.role !== 'admin') return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  const db = getDb();
  const [users, totals, logs] = await Promise.all([
    db.query(`select id, email, name, phone, role, is_active, referral_code, created_at, email_confirmed_at from app_users order by created_at desc limit 200`),
    db.query(`select count(*)::int as users, count(*) filter (where is_active)::int as active_users, count(*) filter (where role = 'admin')::int as admins from app_users`),
    db.query(`select l.id, l.action, l.details, l.created_at, a.name as admin_name, t.name as target_name from admin_audit_logs l left join app_users a on a.id = l.admin_user_id left join app_users t on t.id = l.target_user_id order by l.created_at desc limit 100`),
  ]);
  const workspace = await db.query(`select count(*)::int as workspaces, coalesce(sum(jsonb_array_length(coalesce(state->'records', '[]'::jsonb))), 0)::int as records from workspace_snapshots`);
  return NextResponse.json({ users: users.rows, stats: { ...totals.rows[0], ...workspace.rows[0] }, logs: logs.rows });
}
