import { useMemo, useState } from 'react';
import { Users, Phone, ChevronDown, MessageCircle, Plus, Share2 } from 'lucide-react';
import { db, useDB } from '@/ui/lib/db';
import { fmtDateTime, waLink } from '@/ui/lib/format';
import { cn } from '@/ui/lib/utils';

interface ContactRow {
  name: string;
  phone?: string;
  roles: Set<string>;
  listingTitles: Set<string>;
  shares: number;
  lastShareAt?: string;
  notes?: string;
}

export function ContactsPage() {
  const { listings, shareLogs, contacts: savedContacts } = useDB();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const contacts = useMemo(() => {
    const map = new Map<string, ContactRow>();

    const ensure = (name: string, phone?: string): ContactRow => {
      const key = name.trim() || 'بدون اسم';
      if (!map.has(key)) {
        map.set(key, { name: key, phone, roles: new Set(), listingTitles: new Set(), shares: 0 });
      }
      const row = map.get(key)!;
      if (phone && !row.phone) row.phone = phone;
      return row;
    };

    for (const contact of savedContacts) {
      const row = ensure(contact.name, contact.phone);
      row.roles.add(contact.type === 'owner' ? 'مالك' : contact.type === 'tenant' ? 'مستأجر' : contact.type === 'broker' ? 'وسيط' : 'مشتري');
      row.notes = contact.notes;
    }
    for (const l of listings.filter((item) => !item.deletedAt)) {
      if (l.kind === 'offer' && l.ownerName) {
        const row = ensure(l.ownerName, l.ownerPhone);
        row.roles.add('مالك');
        row.listingTitles.add(l.title);
      }
      if (l.kind === 'request' && l.clientName) {
        const row = ensure(l.clientName, l.clientPhone);
        row.roles.add('عميل');
        row.listingTitles.add(l.title);
      }
    }
    for (const s of shareLogs) {
      const row = ensure(s.recipientName, s.recipientPhone);
      row.roles.add('مستلم مشاركات');
      row.listingTitles.add(s.listingTitle);
      row.shares += 1;
      if (!row.lastShareAt || s.createdAt > row.lastShareAt) row.lastShareAt = s.createdAt;
    }

    return [...map.values()].sort((a, b) => b.shares - a.shares || a.name.localeCompare(b.name, 'ar'));
  }, [listings, savedContacts, shareLogs]);

  const timelineFor = (name: string) => shareLogs.filter((s) => s.recipientName === name);

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 md:py-8 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
            <Users className="w-5 h-5 text-[#0f1f3d]" strokeWidth={2.5} />
          </span>
          العملاء
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          مالكون، عملاء، ومستلمون للمشاركات — مع سجل زمني لكل تواصل 📇
        </p>
        </div>
        <button onClick={() => setAdding((value) => !value)} className="gold-gradient text-[#0f1f3d] rounded-xl px-4 py-2.5 text-sm font-extrabold flex items-center gap-1.5"><Plus className="w-4 h-4" />إضافة عميل</button>
      </header>

      {adding && (
        <form className="rounded-2xl border border-[#c9972f]/25 bg-card p-4 grid sm:grid-cols-2 gap-2.5" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          db.addContact({
            name: String(form.get('name') || '').trim(),
            phone: String(form.get('phone') || '').trim(),
            type: String(form.get('type') || 'buyer') as 'owner' | 'buyer' | 'tenant' | 'broker',
            priority: String(form.get('priority') || 'medium') as 'high' | 'medium' | 'low',
            notes: String(form.get('notes') || '').trim(),
          });
          event.currentTarget.reset();
          setAdding(false);
        }}>
          <input required name="name" placeholder="اسم العميل" className="bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white" />
          <input name="phone" placeholder="05xxxxxxxx" className="bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white nums-latin" />
          <select name="type" className="bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white"><option value="buyer">مشتري</option><option value="owner">مالك</option><option value="tenant">مستأجر</option><option value="broker">وسيط</option></select>
          <select name="priority" className="bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white"><option value="high">أولوية عالية</option><option value="medium">أولوية متوسطة</option><option value="low">أولوية منخفضة</option></select>
          <textarea name="notes" rows={3} placeholder="ملاحظات CRM" className="sm:col-span-2 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white" />
          <button className="sm:col-span-2 gold-gradient text-[#0f1f3d] rounded-xl py-2.5 text-sm font-extrabold">حفظ العميل</button>
        </form>
      )}

      {/* stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card card-glow p-4 text-center">
          <p className="text-2xl font-extrabold text-white nums-latin">{contacts.length}</p>
          <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">جهة اتصال</p>
        </div>
        <div className="rounded-2xl border border-border bg-card card-glow p-4 text-center">
          <p className="text-2xl font-extrabold text-[#e5bc55] nums-latin">{shareLogs.length}</p>
          <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">مشاركة مسجلة</p>
        </div>
        <div className="rounded-2xl border border-border bg-card card-glow p-4 text-center">
          <p className="text-2xl font-extrabold text-emerald-300 nums-latin">
            {shareLogs.filter((s) => s.platform === 'whatsapp').length}
          </p>
          <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">عبر واتساب</p>
        </div>
      </div>

      {contacts.length > 0 ? (
        <div className="space-y-2.5">
          {contacts.map((c) => {
            const isOpen = expanded === c.name;
            const timeline = isOpen ? timelineFor(c.name) : [];
            return (
              <div key={c.name} className="rounded-2xl border border-border bg-card card-glow overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : c.name)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-start hover:bg-secondary/40 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#c9972f]/15 border border-[#c9972f]/30 flex items-center justify-center text-lg font-extrabold text-[#e5bc55] shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {[...c.roles].map((r) => (
                        <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary border border-border text-slate-300">
                          {r}
                        </span>
                      ))}
                      {c.phone && <span className="text-[11px] text-muted-foreground nums-latin">{c.phone}</span>}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs font-extrabold text-[#e5bc55]">{c.shares} مشاركة</p>
                    {c.lastShareAt && <p className="text-[10px] text-muted-foreground mt-0.5">آخرها {fmtDateTime(c.lastShareAt)}</p>}
                  </div>
                  <ChevronDown className={cn('w-4.5 h-4.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <div className="border-t border-border/70 px-4 py-3.5 space-y-3 bg-secondary/20">
                    {c.phone && (
                      <a
                        href={waLink(c.phone, 'السلام عليكم 👋')}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        مراسلة واتساب
                      </a>
                    )}
                    <div>
                      {c.notes && <p className="text-xs text-slate-300 mb-3">{c.notes}</p>}
                      <p className="text-[11px] font-bold text-muted-foreground mb-1.5">الإعلانات المرتبطة:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...c.listingTitles].map((t) => (
                          <span key={t} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-card border border-border text-slate-200">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" />
                        السجل الزمني للمشاركات:
                      </p>
                      {timeline.length > 0 ? (
                        <div className="relative border-s-2 border-[#c9972f]/30 ms-1.5 space-y-3 ps-4 py-1">
                          {timeline.map((s) => (
                            <div key={s.id} className="relative">
                              <span
                                className={cn(
                                  'absolute -start-[23px] top-1 w-3 h-3 rounded-full border-2 border-[#0f1f3d]',
                                  s.platform === 'whatsapp' ? 'bg-emerald-400' : 'bg-zinc-300',
                                )}
                              />
                              <p className="text-sm font-bold text-slate-100">
                                {s.platform === 'whatsapp' ? '🟢 واتساب' : '⚫ منصة X'} — {s.listingTitle}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(s.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">لا مشاركات مسجلة لهذه الجهة بعد</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <span className="text-4xl">📇</span>
          <p className="font-bold text-slate-200 mt-3">لا جهات اتصال بعد</p>
          <p className="text-sm text-muted-foreground mt-1">تُبنى القائمة تلقائياً من إعلاناتك ومشاركاتك</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground justify-center">
        <Phone className="w-3.5 h-3.5" />
        كل مشاركة واتساب/X تُسجَّل تلقائياً هنا مع الوقت والمنصة والمستلم
      </div>
    </div>
  );
}
