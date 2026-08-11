import { defaultPropertyData, propertySchema, type PropertyData } from "./property-schema";

function scalarToNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function scalarToNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function scalarToNullableInteger(value: unknown): number | null {
  const numberValue = scalarToNullableNumber(value);
  return numberValue === null ? null : Math.round(numberValue);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizePropertyData(input: unknown): PropertyData {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

  const candidate = {
    ...defaultPropertyData,
    ...source,
    city: scalarToNullableString(source.city),
    districts: stringList(source.districts),
    area: scalarToNullableNumber(source.area),
    streetWidth: scalarToNullableNumber(source.streetWidth),
    facade: scalarToNullableString(source.facade),
    price: scalarToNullableNumber(source.price),
    priceBid: scalarToNullableNumber(source.priceBid),
    maximumBudget: scalarToNullableNumber(source.maximumBudget),
    bedrooms: scalarToNullableInteger(source.bedrooms),
    minimumBedrooms: scalarToNullableInteger(source.minimumBedrooms),
    bathrooms: scalarToNullableInteger(source.bathrooms),
    licenseNumber: scalarToNullableString(source.licenseNumber),
    contactNumber: scalarToNullableString(source.contactNumber),
    description: scalarToNullableString(source.description),
    lengths: scalarToNullableString(source.lengths),
    planNumber: scalarToNullableString(source.planNumber),
    blockNumber: scalarToNullableString(source.blockNumber),
    plotNumber: scalarToNullableString(source.plotNumber),
    ownerName: scalarToNullableString(source.ownerName),
    clientName: scalarToNullableString(source.clientName),
    missingFields: stringList(source.missingFields),
    confidence: Math.min(Math.max(Number(source.confidence ?? 0), 0), 1),
  };

  const parsed = propertySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error("تعذر التحقق من البيانات المستخرجة.");
  }

  return parsed.data;
}
