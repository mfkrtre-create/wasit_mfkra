import { useMemo, useState } from 'react';
import { UserCircle, BadgeCheck, Gift, KeyRound, ChevronDown, Banknote, Save, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { db, useDB } from '@/ui/lib/db';
import { fmtDate, fmtMoney, monthKey, monthLabel } from '@/ui/lib/format';
import { cn } from '@/ui/lib/utils';
import { toast } from 'sonner';

const API_KEY_FIELDS = [
  { key: 'mapbox', label: 'Mapbox Access Token', placeholder: 'pk.…' },
  { key: 'whatsappBusiness', label: 'WhatsApp Business API Key', placeholder: 'EAA…' },
  { key: 'openai', label: 'OpenAI API Key', placeholder: 'sk-…' },
  { key: 'nominatim', label: 'Geocoding Endpoint (بديل)', placeholder: 'https://…' },
];

export function AccountPage() {
  const { profile, listings } = useDB();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [fal, setFal] = useState(profile.falLicense);
  const [keysOpen, setKeysOpen] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(profile.apiKeys).map(([k, v]) => [k, v ?? ''])),
  );

  const deals = useMemo(
    () =>
      listings
        .filter((l) => l.commission)
        .sort((a, b) => (b.commission!.date > a.commission!.date ? 1 : -1)),
    [listings],
  );

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const k = monthKey(d.commission!.date);
      map.set(k, (map.get(k) ?? 0) + d.commission!.amount);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-6);
  }, [deals]);

  const maxMonth = Math.max(1, ...monthly.map(([, v]) => v));
  const total = deals.reduce((s, d) => s + d.commission!.amount, 0);

  const saveProfile = () => {
    db.updateProfile({ name: name.trim() || profile.name, phone: phone.trim(), falLicense: fal.trim() });
    toast.success('تم حفظ بيانات الحساب ✅');
  };

  const saveKeys = () => {
    db.updateProfile({ apiKeys: Object.fromEntries(Object.entries(keys).filter(([, v]) => v.trim() !== '')) });
    toast.success('تم حفظ المفاتيح بأمان 🔐');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 md:py-8 space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-[#0f1f3d]" strokeWidth={2.5} />
          </span>
          حسابي
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">بياناتك وإحصائياتك المالية الخاصة — لا تُشارك مع أحد 🔒</p>
      </header>

      {/* profile card */}
      <section className="rounded-2xl border border-[#c9972f]/25 navy-gradient card-glow p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center text-2xl font-extrabold text-[#0f1f3d] shadow-xl">
              {profile.name.charAt(0)}
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{profile.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <BadgeCheck className="w-4 h-4 text-[#e5bc55]" />
                رخصة فال: <span className="nums-latin font-bold text-slate-200">{profile.falLicense}</span>
              </p>
              <span className="inline-block mt-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#c9972f]/15 text-[#e5bc55] border border-[#c9972f]/30">
                {profile.tier}
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-[#0a1730]/70 border border-[#c9972f]/20 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 justify-center">
              <Gift className="w-3.5 h-3.5 text-[#e5bc55]" />
              كود الإحالة
            </p>
            <p className="font-extrabold text-[#e5bc55] nums-latin tracking-wider mt-1">{profile.referralCode}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">شاركه مع زملائك الوسطاء (قريباً)</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-2.5 mt-4">
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">الاسم</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0a1730]/70 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">الجوال</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#0a1730]/70 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">رخصة فال</span>
            <input value={fal} onChange={(e) => setFal(e.target.value)} className="w-full bg-[#0a1730]/70 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin" />
          </label>
        </div>
        <button onClick={saveProfile} className="mt-3 flex items-center gap-1.5 text-sm font-extrabold px-4 py-2.5 rounded-xl gold-gradient text-[#0f1f3d] hover:brightness-110 transition-all">
          <Save className="w-4 h-4" />
          حفظ البيانات
        </button>
      </section>

      {/* financial stats */}
      <section className="rounded-2xl border border-border bg-card card-glow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#e5bc55]" />
            الإحصائيات المالية (خاصة)
          </h2>
          <div className="text-end">
            <p className="text-[10px] text-muted-foreground">إجمالي العمولات</p>
            <p className="font-extrabold text-[#e5bc55] nums-latin">{fmtMoney(total)}</p>
          </div>
        </div>

        {monthly.length > 0 ? (
          <div className="flex items-end gap-3 h-44 border-b border-border pb-1 mb-2">
            {monthly.map(([k, v]) => (
              <div key={k} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-bold text-[#e5bc55] nums-latin">{v >= 1000 ? `${Math.round(v / 1000)}k` : v}</span>
                <div
                  className="w-full max-w-14 rounded-t-lg gold-gradient transition-all"
                  style={{ height: `${Math.max(6, (v / maxMonth) * 100)}%` }}
                />
                <span className="text-[10px] text-muted-foreground font-semibold whitespace-nowrap">{monthLabel(k).split(' ')[0]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            لا عمولات بعد — عند أرشفة إعلان بسبب «تم البيع عن طريقي» تُسجَّل العمولة هنا تلقائياً
          </p>
        )}

        {deals.length > 0 && (
          <div className="divide-y divide-border/60 mt-3">
            {deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-slate-100 truncate">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    صفقة {fmtMoney(d.commission!.dealPrice)} • نسبة {d.commission!.percent}% • {fmtDate(d.commission!.date)}
                  </p>
                </div>
                <span className="font-extrabold text-emerald-300 nums-latin shrink-0 ms-3">{fmtMoney(d.commission!.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* hidden API keys */}
      <section className="rounded-2xl border border-border bg-card card-glow overflow-hidden">
        <button
          onClick={() => setKeysOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors"
        >
          <span className="flex items-center gap-2 font-extrabold text-slate-200 text-sm">
            <KeyRound className="w-4.5 h-4.5 text-[#e5bc55]" />
            إعدادات المفاتيح
            <span className="text-[10px] font-semibold text-muted-foreground">(قسم مخفي — للمطوّر)</span>
          </span>
          <ChevronDown className={cn('w-4.5 h-4.5 text-muted-foreground transition-transform', keysOpen && 'rotate-180')} />
        </button>
        {keysOpen && (
          <div className="border-t border-border/70 px-5 py-4 space-y-3 bg-secondary/20">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">أدخل/تجاوز أي مفاتيح API خارجية يدوياً — تُخزَّن محلياً فقط.</p>
              <button onClick={() => setShowKeys((v) => !v)} className="text-muted-foreground hover:text-white transition-colors">
                {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {API_KEY_FIELDS.map((f) => (
              <label key={f.key} className="block space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground">{f.label}</span>
                <input
                  type={showKeys ? 'text' : 'password'}
                  value={keys[f.key] ?? ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-[#0a1730]/70 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin"
                  dir="ltr"
                />
              </label>
            ))}
            <button onClick={saveKeys} className="flex items-center gap-1.5 text-sm font-extrabold px-4 py-2.5 rounded-xl gold-gradient text-[#0f1f3d] hover:brightness-110 transition-all">
              <Save className="w-4 h-4" />
              حفظ المفاتيح
            </button>
          </div>
        )}
      </section>

      {/* danger zone */}
      <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-red-300">إعادة ضبط البيانات التجريبية</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">يعيد التطبيق لحالته الأولى مع البيانات المزروعة</p>
        </div>
        <button
          onClick={() => {
            db.resetAll();
            toast.success('تمت إعادة الضبط 🔄');
          }}
          className="flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-2.5 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          إعادة ضبط
        </button>
      </section>
    </div>
  );
}
