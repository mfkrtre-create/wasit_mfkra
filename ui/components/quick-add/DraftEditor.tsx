import { useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, Image as ImageIcon, MapPin, Star, Trash2, UploadCloud } from 'lucide-react';
import type { InputSource, ListingKind, PriceMode, PropertyCategory, PropertyImage, PropertyType } from '@/ui/types';
import { OFFER_STATUS_LABELS, PROPERTY_CATEGORY_LABELS, PROPERTY_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/ui/types';
import { COMMON_FIELDS, REQUEST_FIELDS, TYPE_FIELDS, type FieldDef } from '@/ui/lib/fieldDefs';
import { landMeterFromTotal, landTotalFromMeter } from '@/ui/lib/parser';
import { getProfile } from '@/ui/lib/db';
import { formatInputNumber, parseInputNumber } from '@/ui/lib/format';
import { cn } from '@/ui/lib/utils';
import { Switch } from '@/ui/components/ui/switch';
import { MapPicker } from '@/ui/components/MapPicker';
import { toast } from 'sonner';

export interface Draft {
  kind: ListingKind;
  status: string;
  propertyType: PropertyType;
  category?: PropertyCategory;
  title: string;
  titleTouched: boolean;
  city: string;
  district: string;
  priceAsk?: number;
  priceBid?: number;
  priceMode: PriceMode;
  priceAmbiguous?: boolean;
  lat?: number;
  lng?: number;
  fields: Record<string, string | number | boolean | undefined>;
  falLicense?: string;
  adLicense?: string;
  ownerName?: string;
  ownerPhone?: string;
  clientName?: string;
  clientPhone?: string;
  images: PropertyImage[];
  notes?: string;
  source: InputSource;
  rawText?: string;
  refreshIntervalDays: number;
}

export const emptyDraft = (kind: ListingKind, source: InputSource): Draft => ({
  kind,
  status: kind === 'offer' ? 'for_sale' : 'buy',
  propertyType: 'land',
  title: '',
  titleTouched: false,
  city: getProfile().city || 'الرياض',
  district: '',
  priceMode: 'ask',
  fields: {},
  images: [],
  falLicense: getProfile().falLicense,
  source,
  refreshIntervalDays: getProfile().defaultReminderDays,
});

export function autoTitle(d: Pick<Draft, 'propertyType' | 'status' | 'district' | 'kind'>, typeOverride?: string): string {
  const type = typeOverride?.trim() || PROPERTY_TYPE_LABELS[d.propertyType].split(' ')[0];
  const action =
    d.kind === 'offer'
      ? OFFER_STATUS_LABELS[d.status as keyof typeof OFFER_STATUS_LABELS] ?? 'للبيع'
      : d.status === 'rent'
        ? 'استئجار'
        : 'شراء';
  const place = d.district ? ` في حي ${d.district}` : '';
  return d.kind === 'offer' ? `${type} ${action}${place}` : `مطلوب ${type} ${action}${place}`;
}

const OFFER_STATUSES = Object.entries(OFFER_STATUS_LABELS).filter(([k]) => k !== 'archived') as [string, string][];
const REQUEST_STATUSES = Object.entries(REQUEST_STATUS_LABELS).filter(([k]) => k !== 'archived') as [string, string][];

function FieldInput({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean | undefined) => void;
}) {
  if (def.input === 'boolean') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
        <span className="text-sm font-semibold text-slate-200">{def.label}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold', value ? 'text-emerald-400' : 'text-muted-foreground')}>
            {value ? 'نعم' : 'لا'}
          </span>
          <Switch checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      </div>
    );
  }
  if (def.input === 'select' || def.input === 'multiselect') {
    const selected = String(value ?? '').split(/[,،]/).map((item) => item.trim()).filter(Boolean);
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">{def.label}</span>
        <div className="flex flex-wrap gap-1.5">
          {def.options!.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (def.input === 'select') {
                  onChange(value === opt ? undefined : opt);
                  return;
                }
                const next = selected.includes(opt) ? selected.filter((item) => item !== opt) : [...selected, opt];
                onChange(next.length ? next.join('، ') : undefined);
              }}
              className={cn(
                'text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
                (def.input === 'select' ? value === opt : selected.includes(opt))
                  ? 'bg-[#c9972f]/20 border-[#c9972f] text-[#e5bc55]'
                  : 'bg-secondary/50 border-border text-slate-300 hover:border-[#c9972f]/40',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs font-bold text-muted-foreground">
        {def.label} {def.unit && <span className="text-[#c9972f]/80">({def.unit})</span>}
      </span>
      <input
        type={def.input === 'number' ? 'text' : def.input}
        inputMode={def.input === 'number' ? 'decimal' : undefined}
        value={def.input === 'number' ? formatInputNumber(typeof value === 'number' ? value : undefined) : value === undefined || value === null ? '' : String(value)}
        placeholder={def.placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (def.input === 'number') onChange(parseInputNumber(raw));
          else onChange(raw === '' ? undefined : raw);
        }}
        className={cn(
          'w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 placeholder:text-muted-foreground/60',
          def.input === 'number' && 'nums-latin',
        )}
      />
    </label>
  );
}

export function DraftEditor({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const [uploadingImages, setUploadingImages] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    if (!next.titleTouched && ['propertyType', 'status', 'district', 'kind'].includes(key as string)) {
      next.title = autoTitle(next);
    }
    onChange(next);
  };

  const setField = (key: string, value: string | number | boolean | undefined) => {
    const fields = { ...draft.fields, [key]: value };
    const next = { ...draft, fields };
    // land: سعر المتر → السعر الإجمالي
    if ((draft.propertyType === 'land' || draft.propertyType === 'block') && (key === 'meterPrice' || key === 'area')) {
      const total = landTotalFromMeter(
        key === 'meterPrice' ? (value as number) : (fields.meterPrice as number),
        key === 'area' ? (value as number) : (fields.area as number),
      );
      if (total !== undefined) next.priceAsk = total;
    }
    onChange(next);
  };

  const setPriceAsk = (v?: number) => {
    const next = { ...draft, priceAsk: v };
    // land: السعر الإجمالي → سعر المتر
    if ((draft.propertyType === 'land' || draft.propertyType === 'block') && v && draft.fields.area) {
      const mp = landMeterFromTotal(v, draft.fields.area as number);
      if (mp) next.fields = { ...next.fields, meterPrice: mp };
    }
    onChange(next);
  };

  const isRequest = draft.kind === 'request';

  const fieldDefs = useMemo(() => {
    const fields = isRequest
      ? [...REQUEST_FIELDS, ...COMMON_FIELDS, ...TYPE_FIELDS[draft.propertyType]]
      : [...COMMON_FIELDS, ...TYPE_FIELDS[draft.propertyType]];
    return fields.filter((f, index) => fields.findIndex((candidate) => candidate.key === f.key) === index && (!f.childOf || Boolean(draft.fields[f.childOf])));
  }, [draft.propertyType, draft.fields, isRequest]);

  const uploadImages = async (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (selected.length === 0) return;
    setUploadingImages(true);
    try {
      const uploaded: PropertyImage[] = [];
      for (const file of selected) {
        const formData = new FormData();
        formData.set('image', file);
        const response = await fetch('/api/property-images', { method: 'POST', body: formData });
        const body = (await response.json().catch(() => null)) as { image?: PropertyImage; error?: string } | null;
        if (!response.ok || !body?.image) {
          throw new Error(body?.error || 'تعذر رفع الصورة.');
        }
        uploaded.push(body.image);
      }
      const alreadyHasMain = draft.images.some((image) => image.main);
      const nextImages = [...draft.images, ...uploaded].map((image, index) => ({
        ...image,
        main: alreadyHasMain ? image.main : index === 0,
      }));
      onChange({ ...draft, images: nextImages });
      toast.success('تم رفع صور العقار');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر رفع الصور.');
    } finally {
      setUploadingImages(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* kind toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-secondary/60 border border-border">
        {(['offer', 'request'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                kind: k,
                status: k === 'offer' ? 'for_sale' : 'buy',
                title: draft.titleTouched ? draft.title : '',
              })
            }
            className={cn(
              'py-2.5 rounded-lg text-sm font-extrabold transition-all',
              draft.kind === k ? 'gold-gradient text-[#0f1f3d] shadow' : 'text-muted-foreground hover:text-white',
            )}
          >
            {k === 'offer' ? '🏷️ عرض (أعرض عقاراً)' : '📥 طلب (مطلوب من عميل)'}
          </button>
        ))}
      </div>

      {/* status pills */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">حالة الإعلان</span>
        <div className="flex flex-wrap gap-1.5">
          {(isRequest ? REQUEST_STATUSES : OFFER_STATUSES).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('status', value)}
              className={cn(
                'text-xs font-bold px-3.5 py-2 rounded-full border transition-colors',
                draft.status === value
                  ? 'bg-[#c9972f]/20 border-[#c9972f] text-[#e5bc55]'
                  : 'bg-secondary/50 border-border text-slate-300 hover:border-[#c9972f]/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* property type */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">التصنيف</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.entries(PROPERTY_CATEGORY_LABELS) as [PropertyCategory, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('category', value)}
              className={cn(
                'py-2 px-1 rounded-xl border text-xs font-bold transition-colors',
                draft.category === value
                  ? 'bg-[#c9972f]/20 border-[#c9972f] text-[#e5bc55]'
                  : 'bg-secondary/50 border-border text-slate-300 hover:border-[#c9972f]/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">نوع العقار</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...draft, propertyType: value, fields: {}, title: draft.titleTouched ? draft.title : autoTitle({ ...draft, propertyType: value }) })}
              className={cn(
                'py-2 px-1 rounded-xl border text-[11px] sm:text-xs font-bold transition-colors leading-tight',
                draft.propertyType === value
                  ? 'bg-[#c9972f]/20 border-[#c9972f] text-[#e5bc55]'
                  : 'bg-secondary/50 border-border text-slate-300 hover:border-[#c9972f]/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {draft.propertyType === 'other' && (
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">نوع العقار الآخر</span>
          <input
            value={String(draft.fields.customPropertyType ?? '')}
            onChange={(event) => setField('customPropertyType', event.target.value || undefined)}
            placeholder="اكتب نوع العقار"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60"
          />
        </label>
      )}

      {/* title + location */}
      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="space-y-1.5 block sm:col-span-2">
          <span className="text-xs font-bold text-muted-foreground">عنوان الإعلان</span>
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value, titleTouched: true })}
            placeholder="مثال: أرض للبيع في حي الياسمين"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60"
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">المدينة</span>
          <input
            value={draft.city}
            onChange={(e) => set('city', e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60"
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">الحي</span>
          <input
            value={draft.district}
            onChange={(e) => set('district', e.target.value)}
            placeholder="مثال: الياسمين"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60"
          />
        </label>
      </div>

      {/* prices: سوم vs حد */}
      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">
            🏷️ {isRequest ? 'الميزانية القصوى' : 'سعر البيع / الحد'} {(draft.propertyType === 'land' || draft.propertyType === 'block') && !isRequest && <span className="text-[#c9972f]/80">(إجمالي الأرض)</span>}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={formatInputNumber(draft.priceAsk)}
            onChange={(e) => setPriceAsk(parseInputNumber(e.target.value))}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin"
          />
        </label>
        {!isRequest && <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">💬 سعر السوم (قابل للتحديث)</span>
          <input
            type="text"
            inputMode="numeric"
            value={formatInputNumber(draft.priceBid)}
            onChange={(e) => set('priceBid', parseInputNumber(e.target.value))}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin"
          />
        </label>}
      </div>

      {/* price mode + ambiguous toggle */}
      {!isRequest && <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground">السعر الأساسي المعروض:</span>
        {(['ask', 'bid'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...draft, priceMode: m, priceAmbiguous: false })}
            className={cn(
              'text-xs font-bold px-3 py-1.5 rounded-full border transition-colors',
              draft.priceMode === m
                ? 'bg-[#c9972f]/20 border-[#c9972f] text-[#e5bc55]'
                : 'bg-secondary/50 border-border text-slate-300',
            )}
          >
            {m === 'ask' ? '🏷️ الحد' : '💬 السوم'}
          </button>
        ))}
        {draft.priceAmbiguous && (
          <button
            type="button"
            onClick={() => onChange({ ...draft, priceMode: draft.priceMode === 'ask' ? 'bid' : 'ask', priceAmbiguous: false })}
            className="text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
          >
            🔁 تبديل إلى {draft.priceMode === 'ask' ? 'سوم' : 'حد'}
          </button>
        )}
      </div>}
      {!isRequest && draft.priceAmbiguous && (
        <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          لم يُحدد النص ما إذا كان السعر «سوم» أم «حد» — صُنّف افتراضياً كـ«{draft.priceMode === 'ask' ? 'حد' : 'سوم'}».
        </p>
      )}

      {/* dynamic fields by type */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-muted-foreground">
          تفاصيل {PROPERTY_TYPE_LABELS[draft.propertyType]}
        </span>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {fieldDefs.map((def) => (
            <div key={def.key} className={cn(def.input === 'boolean' || def.input === 'select' ? 'sm:col-span-2' : '')}>
              <FieldInput def={def} value={draft.fields[def.key]} onChange={(v) => setField(def.key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* licenses */}
      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">🪪 رقم رخصة فال</span>
          <input
            value={draft.falLicense ?? ''}
            onChange={(e) => set('falLicense', e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin"
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">📢 رقم الإعلان العقاري (اختياري)</span>
          <input
            value={draft.adLicense ?? ''}
            onChange={(e) => set('adLicense', e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin"
          />
        </label>
      </div>
      {!isRequest && !draft.adLicense && (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          تنبيه: رقم الإعلان العقاري غير مُدخل — يمكنك الحفظ الآن وإضافته لاحقاً.
        </div>
      )}

      {/* contact */}
      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">{isRequest ? '👤 اسم العميل' : '👤 اسم المالك'}</span>
          <input
            value={(isRequest ? draft.clientName : draft.ownerName) ?? ''}
            onChange={(e) => set(isRequest ? 'clientName' : 'ownerName', e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60"
          />
        </label>
        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-muted-foreground">📞 الجوال</span>
          <input
            value={(isRequest ? draft.clientPhone : draft.ownerPhone) ?? ''}
            onChange={(e) => set(isRequest ? 'clientPhone' : 'ownerPhone', e.target.value)}
            placeholder="05xxxxxxxx"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin"
          />
        </label>
      </div>

      {/* map pin — mandatory */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#c9972f]" />
            موقع العقار على الخريطة <span className="text-red-400">* إلزامي</span>
          </span>
          {draft.lat && (
            <span className="text-[11px] font-bold text-emerald-400">
              ✅ {draft.lat.toFixed(4)}, {draft.lng!.toFixed(4)}
            </span>
          )}
        </div>
        <MapPicker
          value={draft.lat ? { lat: draft.lat, lng: draft.lng! } : null}
          onChange={(ll) => onChange({ ...draft, lat: ll.lat, lng: ll.lng })}
          onDistrictFound={(district) => {
            if (!draft.district) set('district', district);
          }}
        />
        {!draft.lat && (
          <p className="text-[11px] font-semibold text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
            يجب تثبيت الدبوس على الخريطة قبل الحفظ — استخدم البحث أو زر «GPS — أنا هنا».
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-[#c9972f]" />
            صور العقار
          </span>
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#c9972f]/35 bg-[#c9972f]/10 px-3 py-2 text-xs font-extrabold text-[#e5bc55] hover:bg-[#c9972f]/20 transition-colors cursor-pointer">
            <UploadCloud className="w-4 h-4" />
            {uploadingImages ? 'جاري الرفع...' : 'رفع صور'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              disabled={uploadingImages}
              onChange={(event) => {
                void uploadImages(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {draft.images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {draft.images.map((image) => (
              <div key={image.id} className="relative overflow-hidden rounded-xl border border-border bg-secondary/40 aspect-[4/3]">
                <Image src={image.url} alt={image.name} fill sizes="8rem" unoptimized className="object-cover" />
                <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, images: draft.images.map((item) => ({ ...item, main: item.id === image.id })) })}
                    className="rounded-lg bg-black/55 p-1.5 text-white hover:text-[#e5bc55]"
                    title="تعيين كصورة رئيسية"
                  >
                    <Star className={image.main ? 'w-3.5 h-3.5 fill-[#e5bc55] text-[#e5bc55]' : 'w-3.5 h-3.5'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = draft.images.filter((item) => item.id !== image.id);
                      onChange({
                        ...draft,
                        images: remaining.some((item) => item.main) ? remaining : remaining.map((item, index) => ({ ...item, main: index === 0 })),
                      });
                    }}
                    className="rounded-lg bg-black/55 p-1.5 text-red-300 hover:text-red-200"
                    title="حذف من السجل"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] font-semibold text-muted-foreground bg-secondary/30 border border-border rounded-lg px-2.5 py-2">
            يمكن رفع صور JPG أو PNG أو WebP حتى 5MB لكل صورة. تحفظ الصور عبر API محمي لكل حساب.
          </p>
        )}
      </div>

      {/* refresh interval */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">⏱️ فترة التذكير بتحديث الإعلان</span>
        <div className="flex gap-1.5">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => set('refreshIntervalDays', d)}
              className={cn(
                'flex-1 py-2 rounded-xl border text-xs font-extrabold transition-colors',
                draft.refreshIntervalDays === d
                  ? 'bg-[#c9972f]/20 border-[#c9972f] text-[#e5bc55]'
                  : 'bg-secondary/50 border-border text-slate-300 hover:border-[#c9972f]/40',
              )}
            >
              كل {d} يوم
            </button>
          ))}
        </div>
        <input type="number" min={1} max={365} value={draft.refreshIntervalDays} onChange={(event) => set('refreshIntervalDays', Math.max(1, Math.min(365, Number(event.target.value) || 14)))} className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 nums-latin" aria-label="فترة تذكير مخصصة بالأيام" />
      </div>

      {/* notes */}
      <label className="space-y-1.5 block">
        <span className="text-xs font-bold text-muted-foreground">📝 ملاحظات</span>
        <textarea
          value={draft.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#c9972f]/60 resize-none"
        />
      </label>
    </div>
  );
}
