import type { PropertyType } from '@/ui/types';

export interface FieldDef {
  key: string;
  label: string;
  input: 'number' | 'text' | 'boolean' | 'select' | 'multiselect';
  options?: string[];
  unit?: string;
  placeholder?: string;
  /** shown as sub-field when a boolean toggle is on */
  childOf?: string;
}

// الحقول المشتركة لكل الأنواع
export const COMMON_FIELDS: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'bedrooms', label: 'عدد الغرف', input: 'number' },
  { key: 'bathrooms', label: 'عدد دورات المياه', input: 'number' },
  { key: 'age', label: 'عمر العقار', input: 'number', unit: 'سنة' },
  { key: 'frontages', label: 'الواجهات', input: 'multiselect', options: ['شمالية', 'جنوبية', 'شرقية', 'غربية'] },
  { key: 'streetWidth', label: 'عرض الشارع', input: 'number', unit: 'م' },
];

export const REQUEST_FIELDS: FieldDef[] = [
  { key: 'preferredDistricts', label: 'الأحياء المطلوبة', input: 'text', placeholder: 'العارض، النرجس' },
  { key: 'areaMin', label: 'المساحة من', input: 'number', unit: 'م²' },
  { key: 'areaMax', label: 'المساحة إلى', input: 'number', unit: 'م²' },
  { key: 'minimumBedrooms', label: 'الحد الأدنى للغرف', input: 'number' },
  { key: 'maxAge', label: 'العمر الأقصى', input: 'number', unit: 'سنة' },
  { key: 'targetMeterPrice', label: 'سعر المتر المستهدف', input: 'number', unit: 'ر.س' },
  { key: 'preferredFrontages', label: 'الواجهات المفضلة', input: 'multiselect', options: ['شمالية', 'جنوبية', 'شرقية', 'غربية'] },
  { key: 'technicalRequirements', label: 'المواصفات الفنية المطلوبة', input: 'text' },
];

const LAND: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'meterPrice', label: 'سعر المتر', input: 'number', unit: 'ر.س' },
  { key: 'frontages', label: 'الواجهات', input: 'multiselect', options: ['شمالية', 'جنوبية', 'شرقية', 'غربية'] },
  { key: 'lengths', label: 'الأطوال', input: 'text', placeholder: '20×30' },
  { key: 'streetWidth', label: 'عرض الشارع', input: 'number', unit: 'م' },
  { key: 'planNo', label: 'رقم المخطط', input: 'text' },
  { key: 'blockNo', label: 'رقم البلك', input: 'text' },
  { key: 'plotNo', label: 'رقم القطعة', input: 'text' },
];

const VILLA: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'streetWidth', label: 'عرض الشارع', input: 'number', unit: 'م' },
  { key: 'age', label: 'العمر', input: 'number', unit: 'سنة' },
  { key: 'stairType', label: 'نوع الدرج', input: 'select', options: ['صالة', 'جانبين'] },
  { key: 'occupancy', label: 'الوضع', input: 'select', options: ['يسكنها المالك', 'جاهزة'] },
  { key: 'hasLoan', label: 'هل عليها قرض؟', input: 'boolean' },
  { key: 'rented', label: 'مؤجرة؟', input: 'boolean' },
  { key: 'leaseRemaining', label: 'مدة العقد المتبقية', input: 'text', placeholder: 'مثال: 8 أشهر', childOf: 'rented' },
  { key: 'buildingLicense', label: 'رخصة بناء', input: 'boolean' },
  { key: 'completionCert', label: 'شهادة إتمام بناء', input: 'boolean' },
];

const APARTMENT: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'age', label: 'العمر', input: 'number', unit: 'سنة' },
  { key: 'unitsInBuilding', label: 'عدد الشقق بالعمارة', input: 'number' },
  { key: 'rented', label: 'مؤجرة؟', input: 'boolean' },
  { key: 'leaseRemaining', label: 'مدة العقد المتبقية', input: 'text', placeholder: 'مثال: 6 أشهر', childOf: 'rented' },
  { key: 'ownersUnion', label: 'وجود اتحاد ملاك', input: 'boolean' },
];

const BUILDING: FieldDef[] = [
  { key: 'area', label: 'مساحة الأرض', input: 'number', unit: 'م²' },
  { key: 'builtUpArea', label: 'المسطحات البنائية', input: 'number', unit: 'م²' },
  { key: 'floors', label: 'عدد الأدوار', input: 'number' },
  { key: 'basementFloors', label: 'أدوار البدروم', input: 'number' },
  { key: 'parkingPerBasement', label: 'مواقف لكل بدروم', input: 'number' },
  { key: 'parkingTotal', label: 'إجمالي المواقف', input: 'number' },
  { key: 'electricMeters', label: 'عدد عدادات الكهرباء', input: 'number' },
  { key: 'apartmentsCount', label: 'عدد الشقق', input: 'number' },
  { key: 'shopsCount', label: 'عدد المحلات', input: 'number' },
  { key: 'apartmentsIncome', label: 'الدخل السنوي للشقق', input: 'number', unit: 'ر.س' },
  { key: 'shopsIncome', label: 'الدخل السنوي للمحلات', input: 'number', unit: 'ر.س' },
  { key: 'rentalOfferAmount', label: 'عرض الاستئجار', input: 'number', unit: 'ر.س' },
  { key: 'occupancyStatus', label: 'حالة الإشغال', input: 'select', options: ['غير مؤجر حالياً', 'مؤجر', 'جاهز للاستخدام'] },
  { key: 'finishing', label: 'التشطيب والجاهزية', input: 'text' },
  { key: 'conversionPotential', label: 'قابلية التحويل / الاستخدام', input: 'text' },
  { key: 'transferTaxNote', label: 'ملاحظة التصرفات العقارية', input: 'text' },
  { key: 'paymentDates', label: 'تاريخ الدفعات', input: 'text', placeholder: 'مثال: نصف سنوية' },
  { key: 'contractsRemaining', label: 'المدة المتبقية للعقود', input: 'text', placeholder: 'مثال: 8 - 20 شهر' },
];

const FARM: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'waterWell', label: 'وجود بئر ماء', input: 'boolean' },
  { key: 'treesCount', label: 'عدد الأشجار', input: 'number' },
  { key: 'electricity', label: 'توفر الكهرباء', input: 'boolean' },
];

const TOWER: FieldDef[] = [
  { key: 'floors', label: 'عدد الأدوار', input: 'number' },
  { key: 'elevators', label: 'عدد المصاعد', input: 'number' },
  { key: 'totalAnnualIncome', label: 'الدخل السنوي الإجمالي', input: 'number', unit: 'ر.س' },
];

const OTHER: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'streetWidth', label: 'عرض الشارع', input: 'number', unit: 'م' },
];

const COMMERCIAL_UNIT: FieldDef[] = [
  { key: 'area', label: 'المساحة', input: 'number', unit: 'م²' },
  { key: 'streetWidth', label: 'عرض الشارع', input: 'number', unit: 'م' },
  { key: 'age', label: 'عمر العقار', input: 'number', unit: 'سنة' },
  { key: 'builtUpArea', label: 'المسطحات البنائية', input: 'number', unit: 'م²' },
  { key: 'floors', label: 'عدد الأدوار', input: 'number' },
  { key: 'basementFloors', label: 'أدوار البدروم', input: 'number' },
  { key: 'parkingPerBasement', label: 'مواقف لكل بدروم', input: 'number' },
  { key: 'parkingTotal', label: 'إجمالي المواقف', input: 'number' },
  { key: 'annualIncome', label: 'الدخل السنوي', input: 'number', unit: 'ر.س' },
  { key: 'rentalOfferAmount', label: 'عرض الاستئجار', input: 'number', unit: 'ر.س' },
  { key: 'occupancyStatus', label: 'حالة الإشغال', input: 'select', options: ['غير مؤجر حالياً', 'مؤجر', 'جاهز للاستخدام'] },
  { key: 'finishing', label: 'التشطيب والجاهزية', input: 'text' },
  { key: 'conversionPotential', label: 'قابلية التحويل / الاستخدام', input: 'text' },
  { key: 'transferTaxNote', label: 'ملاحظة التصرفات العقارية', input: 'text' },
];

export const TYPE_FIELDS: Record<PropertyType, FieldDef[]> = {
  land: LAND,
  villa: VILLA,
  apartment: APARTMENT,
  building: BUILDING,
  block: LAND,
  warehouse: COMMERCIAL_UNIT,
  rest_house: OTHER,
  office: COMMERCIAL_UNIT,
  shop: COMMERCIAL_UNIT,
  farm: FARM,
  tower: TOWER,
  other: OTHER,
};

/** Returns only visible fields (child fields hidden unless parent toggle is on) */
export function visibleFields(
  type: PropertyType,
  values: Record<string, string | number | boolean | undefined>,
): FieldDef[] {
  return TYPE_FIELDS[type].filter((f) => !f.childOf || Boolean(values[f.childOf]));
}

/** Short chip summary for cards: top 3-4 meaningful fields */
export function summaryChips(
  _type: PropertyType,
  values: Record<string, string | number | boolean | undefined>,
): string[] {
  const chips: string[] = [];
  const fmt = (n: number) => n.toLocaleString('en-US');
  const num = (k: string) => (typeof values[k] === 'number' ? (values[k] as number) : undefined);
  const str = (k: string) => (typeof values[k] === 'string' && values[k] !== '' ? (values[k] as string) : undefined);

  const area = num('area');
  if (area) chips.push(`${fmt(area)} م²`);
  const sw = num('streetWidth');
  if (sw) chips.push(`شارع ${sw}م`);
  const age = num('age');
  if (age !== undefined) chips.push(`العمر ${age}`);
  if (str('frontages') || str('frontage')) chips.push(`واجهة ${str('frontages') ?? str('frontage')}`);
  if (str('stairType')) chips.push(`درج ${str('stairType')}`);
  if (num('floors')) chips.push(`${num('floors')} أدوار`);
  if (num('builtUpArea')) chips.push(`مسطحات ${fmt(num('builtUpArea')!)} م²`);
  if (num('parkingTotal')) chips.push(`${fmt(num('parkingTotal')!)} موقف`);
  if (num('rentalOfferAmount')) chips.push(`عرض إيجار ${fmt(num('rentalOfferAmount')!)}`);
  if (num('treesCount')) chips.push(`${fmt(num('treesCount')!)} شجرة`);
  if (values['waterWell']) chips.push('بئر ماء');
  if (num('apartmentsCount')) chips.push(`${num('apartmentsCount')} شقة`);
  if (num('shopsCount')) chips.push(`${num('shopsCount')} محل`);
  if (num('totalAnnualIncome')) chips.push(`دخل ${fmt(num('totalAnnualIncome')!)}`);
  if (str('planNo')) chips.push(`مخطط ${str('planNo')}`);
  return chips.slice(0, 4);
}
