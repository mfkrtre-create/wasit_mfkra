import { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Users } from 'lucide-react';
import { useDB } from '@/ui/lib/db';
import { fmtDateTime } from '@/ui/lib/format';
import { toast } from 'sonner';

interface AdminUser { id: string; email: string; name: string; phone: string; role: 'admin' | 'broker'; is_active: boolean; referral_code: string; created_at: string; email_confirmed_at: string | null }
interface AuditLog { id: string; action: string; details: Record<string, unknown>; created_at: string; admin_name: string | null; target_name: string | null }
interface Overview { users: AdminUser[]; stats: { users: number; active_users: number; admins: number; workspaces: number; records: number }; logs: AuditLog[] }

async function fetchOverview(): Promise<Overview> {
  const response = await fetch('/api/admin/overview', { cache: 'no-store' });
  const body = (await response.json().catch(() => null)) as (Overview & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error || 'تعذر تحميل لوحة الإدارة.');
  return body;
}

export function AdminPage() {
  const { profile } = useDB();
  const [data, setData] = useState<Overview | null>(null);
  const [busyId, setBusyId] = useState('');
  useEffect(() => {
    if (profile.role !== 'admin') return;
    let cancelled = false;
    void fetchOverview()
      .then((overview) => { if (!cancelled) setData(overview); })
      .catch((error) => { if (!cancelled) toast.error(error.message); });
    return () => { cancelled = true; };
  }, [profile.role]);
  if (profile.role !== 'admin') return <div className="p-8 text-center text-red-300">هذه الصفحة مخصصة لإدارة المنصة.</div>;
  const updateUser = async (id: string, patch: { isActive?: boolean; role?: 'admin' | 'broker' }) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || 'تعذر تحديث الحساب.');
      setData(await fetchOverview()); toast.success('تم تحديث الحساب');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر التحديث.'); }
    finally { setBusyId(''); }
  };
  return (
    <div className="max-w-6xl mx-auto px-4 py-5 md:py-8 space-y-5">
      <header><h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5"><span className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#0f1f3d]" /></span>إدارة المنصة</h1><p className="text-sm text-muted-foreground mt-1.5">إدارة الحسابات، الإحصائيات، وسجل عمليات الإدارة</p></header>
      {!data ? <p className="text-sm text-muted-foreground text-center py-10">جاري التحميل...</p> : <>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{Object.entries({ 'الحسابات': data.stats.users, 'النشطة': data.stats.active_users, 'المشرفون': data.stats.admins, 'مساحات العمل': data.stats.workspaces, 'السجلات': data.stats.records }).map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4 text-center"><p className="text-2xl font-extrabold text-white nums-latin">{value}</p><p className="text-[11px] text-muted-foreground mt-1">{label}</p></div>)}</div>
        <section className="rounded-2xl border border-border bg-card overflow-hidden"><h2 className="p-4 border-b border-border font-extrabold text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#e5bc55]" />الحسابات</h2><div className="divide-y divide-border/60">{data.users.map((user) => <div key={user.id} className="p-4 flex flex-wrap items-center gap-3"><div className="flex-1 min-w-56"><p className="font-bold text-white">{user.name}</p><p className="text-xs text-muted-foreground">{user.email} • {user.phone} • {user.referral_code}</p></div><select disabled={busyId === user.id} value={user.role} onChange={(event) => void updateUser(user.id, { role: event.target.value as 'admin' | 'broker' })} className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-white"><option value="broker">وسيط</option><option value="admin">مشرف</option></select><button disabled={busyId === user.id} onClick={() => void updateUser(user.id, { isActive: !user.is_active })} className={`rounded-xl border px-3 py-2 text-xs font-extrabold ${user.is_active ? 'border-red-500/30 text-red-300' : 'border-emerald-500/30 text-emerald-300'}`}>{user.is_active ? 'تعطيل' : 'تفعيل'}</button></div>)}</div></section>
        <section className="rounded-2xl border border-border bg-card p-4"><h2 className="font-extrabold text-white flex items-center gap-2 mb-3"><Activity className="w-5 h-5 text-[#e5bc55]" />سجل العمليات</h2><div className="space-y-2">{data.logs.map((log) => <div key={log.id} className="rounded-xl border border-border bg-secondary/40 p-3 text-sm"><p className="font-bold text-white">{log.action} — {log.target_name ?? 'حساب'}</p><p className="text-[10px] text-muted-foreground mt-1">{log.admin_name ?? 'مشرف'} • {fmtDateTime(log.created_at)}</p></div>)}{data.logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد عمليات إدارية بعد.</p>}</div></section>
      </>}
    </div>
  );
}
