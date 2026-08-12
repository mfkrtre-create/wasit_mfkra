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
    customPropertyType: scalarToNullableString(source.customPropertyType),
    city: scalarToNullableString(source.city),
    districts: stringList(source.districts),
    area: scalarToNullableNumber(source.area),
    minimumArea: scalarToNullableNumber(source.minimumArea),
    maximumArea: scalarToNullableNumber(source.maximumArea),
    streetWidth: scalarToNullableNumber(source.streetWidth),
    facade: scalarToNullableString(source.facade),
    facades: stringList(source.facades),
    price: scalarToNullableNumber(source.price),
    priceBid: scalarToNullableNumber(source.priceBid),
    maximumBudget: scalarToNullableNumber(source.maximumBudget),
    pricePerMeter: scalarToNullableNumber(source.pricePerMeter),
    targetPricePerMeter: scalarToNullableNumber(source.targetPricePerMeter),
    bedrooms: scalarToNullableInteger(source.bedrooms),
    minimumBedrooms: scalarToNullableInteger(source.minimumBedrooms),
    bathrooms: scalarToNullableInteger(source.bathrooms),
    propertyAge: scalarToNullableNumber(source.propertyAge),
    maximumPropertyAge: scalarToNullableNumber(source.maximumPropertyAge),
    licenseNumber: scalarToNullableString(source.licenseNumber),
    falLicenseNumber: scalarToNullableString(source.falLicenseNumber),
    advertisementNumber: scalarToNullableString(source.advertisementNumber),
    contactNumber: scalarToNullableString(source.contactNumber),
    description: scalarToNullableString(source.description),
    lengths: scalarToNullableString(source.lengths),
    planNumber: scalarToNullableString(source.planNumber),
    blockNumber: scalarToNullableString(source.blockNumber),
    plotNumber: scalarToNullableString(source.plotNumber),
    ownerName: scalarToNullableString(source.ownerName),
    clientName: scalarToNullableString(source.clientName),
    technicalRequirements: scalarToNullableString(source.technicalRequirements),
    builtUpArea: scalarToNullableNumber(source.builtUpArea),
    floors: scalarToNullableInteger(source.floors),
    basementFloors: scalarToNullableInteger(source.basementFloors),
    parkingPerBasement: scalarToNullableInteger(source.parkingPerBasement),
    parkingTotal: scalarToNullableInteger(source.parkingTotal),
    rentalOfferAmount: scalarToNullableNumber(source.rentalOfferAmount),
    occupancyStatus: scalarToNullableString(source.occupancyStatus),
    finishing: scalarToNullableString(source.finishing),
    conversionPotential: scalarToNullableString(source.conversionPotential),
    transferTaxNote: scalarToNullableString(source.transferTaxNote),
    missingFields: stringList(source.missingFields),
    confidence: Math.min(Math.max(Number(source.confidence ?? 0), 0), 1),
  };

  const parsed = propertySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error("تعذر التحقق من البيانات المستخرجة.");
  }

  return parsed.data;
}
