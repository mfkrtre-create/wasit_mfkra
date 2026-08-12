import type { ListingKind, PriceMode, PropertyCategory, PropertyType } from '@/ui/types';

export interface ParsedListing {
  kind: ListingKind;
  propertyType: PropertyType;
  category?: PropertyCategory;
  status: string;
  district: string;
  city: string;
  priceBid?: number;
  priceAsk?: number;
  priceMode: PriceMode;
  /** true when no سوم/حد keyword found — classified as حد by default, user can toggle */
  priceAmbiguous: boolean;
  fields: Record<string, string | number | boolean | undefined>;
  confidence: string[]; // human-readable list of what was detected
}

/** Convert Arabic-Indic digits + normalize separators/letters */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[‌‏‎]/g, ' ')
    .replace(/،/g, ',');
}

/** Parse a numeric token possibly followed by مليون/ألف multipliers */
/** Parse a numeric token with an optional immediately-adjacent multiplier */
function toAmount(token: string, mult?: string): number | undefined {
  const n = parseFloat(token.replace(/,/g, ''));
  if (isNaN(n)) return undefined;
  if (mult && /مليون|ملايين/.test(mult)) return Math.round(n * 1_000_000);
  if (mult && /الف|ألف/.test(mult)) return Math.round(n * 1_000);
  return Math.round(n);
}

/** word-exact matching (normalized) — avoids «العارض» matching «أرض» */
const TYPE_KEYWORDS: Array<{ type: PropertyType; words: string[] }> = [
  { type: 'villa', words: ['فيلا', 'الفيلا', 'فله', 'الفله', 'فلتين', 'فيلتين', 'فيلاين', 'فلل', 'دبلكس'] },
  { type: 'apartment', words: ['شقه', 'الشقه', 'شقتين', 'شقق'] },
  { type: 'building', words: ['عماره', 'العماره', 'عمارتين', 'عمائر'] },
  { type: 'block', words: ['بلك', 'البلك'] },
  { type: 'warehouse', words: ['مستودع', 'المستودع', 'مستودعات'] },
  { type: 'rest_house', words: ['استراحه', 'الاستراحه', 'شاليه'] },
  { type: 'office', words: ['مكتب', 'المكتب', 'مكتبي'] },
  { type: 'shop', words: ['محل', 'المحل', 'محلات'] },
  { type: 'farm', words: ['مزرعه', 'المزرعه', 'مزرعتين', 'مزارع', 'حقل'] },
  { type: 'tower', words: ['برج', 'البرج', 'برجين', 'ابراج'] },
  { type: 'land', words: ['ارض', 'الارض', 'قطعه', 'القطعه'] },
];

export function parseListingText(raw: string): ParsedListing {
  const text = normalizeArabic(raw);
  const flat = text.replace(/\s+/g, ' ');
  const confidence: string[] = [];
  const fields: Record<string, string | number | boolean | undefined> = {};

  // ---- kind & status ----
  const isRequest = /مطلوب|ابحث|ابغي|أبحث|محتاج|زبون\s+(?:يبي|يدور)|عميل\s+(?:يبي|يدور)|يبي|يدور/.test(flat);
  const kind: ListingKind = isRequest ? 'request' : 'offer';
  let status: string;
  if (isRequest) {
    status = /استئجار|استاجر|ايجار|إيجار|للايجار/.test(flat) ? 'rent' : 'buy';
    confidence.push(`طلب ${status === 'rent' ? 'استئجار' : 'شراء'}`);
  } else {
    status = /للايجار|للإيجار|ايجار|إيجار|تاجيل|للتأجير/.test(flat) ? 'for_rent' : 'for_sale';
    confidence.push(status === 'for_rent' ? 'عرض للإيجار' : 'عرض للبيع');
  }

  // ---- property type (word-exact, priority order) ----
  const wordSet = new Set(flat.split(/\s+/));
  let propertyType: PropertyType = 'land';
  if (/مبن[ىي]\s+مكتبي/.test(flat)) {
    propertyType = 'office';
    fields.customPropertyType = 'مبنى مكتبي';
  } else {
    for (const { type, words } of TYPE_KEYWORDS) {
      if (words.some((w) => wordSet.has(w))) {
        propertyType = type;
        break;
      }
    }
  }
  confidence.push('تم التعرف على نوع العقار');
  const category: PropertyCategory | undefined = /تجاري/.test(flat) ? 'commercial' : /صناعي/.test(flat) ? 'industrial' : /زراعي/.test(flat) ? 'agricultural' : /سكني/.test(flat) ? 'residential' : undefined;

  // ---- district: حي X ----
  let district = '';
  const districtMatch = flat.match(/حي\s+([^\s,،.؟!]+(?:\s+[^\s,،.؟!]+)?)/);
  if (districtMatch) {
    district = districtMatch[1].trim();
    // stop at first known keyword boundary
    const stopWords = ['مساحه', 'مساحة', 'مساحتها', 'مساحته', 'شارع', 'سوم', 'حد', 'متر', 'الموقع', 'عمر', 'عمرها', 'مكونه', 'تتكون', 'على', 'في', 'موقع', 'الصافي', 'وصلت', 'درج', 'نظام', 'دخل', 'دخلها', 'قريب', 'تشطيب', 'تواصل', 'للتواصل', 'واتساب', 'السوم', 'سيمت', 'بئر', 'بير', 'كهرب', 'كهرباء', 'عدد', 'مطلوب', 'السعر'];
    for (const sw of stopWords) {
      const idx = district.indexOf(' ' + sw);
      if (idx > 0) district = district.slice(0, idx);
    }
    if (stopWords.includes(district)) district = '';
    if (district) confidence.push(`الحي: ${district}`);
  }

  // ---- city (common Saudi cities) ----
  let city = '';
  const cities = ['الرياض', 'جده', 'مكه', 'المدينه', 'الدمام', 'الخبر', 'الخرج', 'بريده', 'تبوك', 'ابها', 'الطايف', 'حايل'];
  for (const c of cities) {
    if (flat.includes(c)) {
      city = c === 'جده' ? 'جدة' : c === 'مكه' ? 'مكة' : c;
      break;
    }
  }

  // ---- area ----
  const areaMatch =
    flat.match(/مساح[هت][^0-9]{0,8}(\d[\d,]*)/) ||
    flat.match(/(\d[\d,]*)\s*متر(?:\s*مربع)?/) ||
    flat.match(/(\d[\d,]*)\s*م\b/);
  if (areaMatch) {
    const v = toAmount(areaMatch[1]);
    if (v && v < 10_000_000) {
      fields.area = v;
      confidence.push(`المساحة: ${v.toLocaleString('en-US')} م²`);
    }
  }
  const areaRange = flat.match(/مساح[هه]\s*(?:من)?\s*(\d[\d,]*)\s*(?:الى|إلى|-)\s*(\d[\d,]*)/);
  if (isRequest && areaRange) {
    fields.areaMin = toAmount(areaRange[1]);
    fields.areaMax = toAmount(areaRange[2]);
    delete fields.area;
  }

  // ---- street width ----
  const streetMatch = flat.match(/شارع\s*(\d{1,3})/) || flat.match(/عرض\s*الشارع\s*(\d{1,3})/);
  if (streetMatch) {
    fields.streetWidth = parseInt(streetMatch[1], 10);
    confidence.push(`عرض الشارع: ${streetMatch[1]}م`);
  }

  // ---- age ----
  const ageMatch = flat.match(/عمر[ها]{0,3}\s*(\d{1,3})/) || flat.match(/العمر\s*(\d{1,3})/);
  if (ageMatch) fields[isRequest && /لا\s*(?:يتجاوز|يزيد)/.test(flat) ? 'maxAge' : 'age'] = parseInt(ageMatch[1], 10);

  const directions = ['شماليه', 'جنوبيه', 'شرقيه', 'غربيه'].filter((direction) => flat.includes(direction));
  if (directions.length) fields[isRequest ? 'preferredFrontages' : 'frontages'] = directions.map((direction) => direction.replace(/ه$/, 'ة')).join('، ');

  // ---- meter price ----
  const meterMatch = flat.match(/(?:سعر\s*)?المتر\s*(\d[\d,]*)/) || flat.match(/متر\s*ب?\s*(\d[\d,]*)/);
  if (meterMatch) {
    const v = toAmount(meterMatch[1]);
    if (v && v < 1_000_000) fields.meterPrice = v;
  }

  // ---- villa-specific ----
  if (/درج\s*صاله|درج\s*صالة/.test(flat)) fields.stairType = 'صالة';
  else if (/جانبين/.test(flat)) fields.stairType = 'جانبين';
  if (/يسكنها\s*المالك/.test(flat)) fields.occupancy = 'يسكنها المالك';
  else if (/جاهزه|جاهزة/.test(flat)) fields.occupancy = 'جاهزة';
  if (/عليها\s*قرض/.test(flat)) fields.hasLoan = true;
  if (/موجره|مؤجره|مأجوره/.test(flat)) fields.rented = true;
  if (/بئر|بير/.test(flat)) fields.waterWell = true;
  if (/كهرب|الكهرباء/.test(flat) && propertyType === 'farm') fields.electricity = true;
  const treesMatch = flat.match(/(\d+)\s*(?:شجره|شجرة|نخله|نخلة)/);
  if (treesMatch) fields.treesCount = parseInt(treesMatch[1], 10);
  const floorsMatch = flat.match(/(\d+)\s*(?:دور|ادوار|أدوار|طوابق|طابق)/);
  if (floorsMatch) fields.floors = parseInt(floorsMatch[1], 10);

  // ---- price: explicit سوم / حد keywords, multiplier must be adjacent ----
  let priceBid: number | undefined;
  let priceAsk: number | undefined;
  let priceMode: PriceMode = 'ask';
  let priceAmbiguous = false;

  const bidMatch = flat.match(/(?:سوم|سيمت|وصلت|وصل|واصل|مسوم|سومت)[^0-9]{0,12}(\d[\d,]*(?:\.\d+)?)\s*(مليون|ملايين|الف|ألف)?/);
  const askMatch = flat.match(/(?:حد|الصافي|صافي|فرص[هة])\s*[هة]?\s*[^0-9]{0,10}(\d[\d,]*(?:\.\d+)?)\s*(مليون|ملايين|الف|ألف)?/);

  if (bidMatch) {
    priceBid = toAmount(bidMatch[1], bidMatch[2]);
    confidence.push('سعر السوم (كلمة سوم/وصلت)');
  }
  if (askMatch) {
    priceAsk = toAmount(askMatch[1], askMatch[2]);
    confidence.push('سعر الحد (كلمة حد/الصافي)');
  }

  if (priceBid !== undefined || priceAsk !== undefined) {
    // classify by which keyword appeared; سوم takes display priority when both exist
    priceMode = priceBid !== undefined ? 'bid' : 'ask';
  } else {
    // generic fallback: last big number that isn't area/street/age
    const generic = [...flat.matchAll(/(\d[\d,]{3,}(?:\.\d+)?)\s*(مليون|ملايين|الف|ألف|ر\.?س|ريال)?/g)]
      .map((m) => toAmount(m[1], m[2]))
      .filter((v): v is number => v !== undefined && v >= 1000 && v !== fields.area && v !== fields.streetWidth && v !== fields.age);
    if (generic.length > 0) {
      priceAsk = generic[generic.length - 1];
      priceMode = 'ask';
      priceAmbiguous = true;
    }
  }

  if (priceBid !== undefined) confidence.push(`السوم: ${priceBid.toLocaleString('en-US')} ر.س`);
  if (priceAsk !== undefined) confidence.push(`الحد: ${priceAsk.toLocaleString('en-US')} ر.س`);

  return { kind, propertyType, category, status, district, city, priceBid, priceAsk, priceMode, priceAmbiguous, fields, confidence };
}

/** Bidirectional land price: meter price × area */
export function landTotalFromMeter(meterPrice?: number, area?: number): number | undefined {
  if (meterPrice && area) return Math.round(meterPrice * area);
  return undefined;
}
export function landMeterFromTotal(total?: number, area?: number): number | undefined {
  if (total && area) return Math.round(total / area);
  return undefined;
}
