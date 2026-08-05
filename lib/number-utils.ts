const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeNumericInput(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/,/g, "");
}

export function parseOptionalPositiveDecimal(value: FormDataEntryValue | string | null | undefined) {
  const normalized = normalizeNumericInput(value);
  if (!normalized) {
    return null;
  }

  if (!/^\d*(?:\.\d+)?$/.test(normalized) || normalized === ".") {
    return null;
  }

  const parsed = Number(normalized);
  return parsed > 0 && Number.isFinite(parsed) ? parsed : null;
}

export function parseOptionalPositiveInteger(value: FormDataEntryValue | string | null | undefined) {
  const parsed = parseOptionalPositiveDecimal(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

export function formatDecimalNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "غير محدد";
  }

  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits,
  }).format(value);
}

export function formatArea(value: number | null) {
  return value === null || !Number.isFinite(value) ? "غير محدد" : `${formatDecimalNumber(value)} م²`;
}
