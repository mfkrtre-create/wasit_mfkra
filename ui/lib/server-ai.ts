import type { ParsedListing } from '@/ui/lib/parser';
import type { ListingKind, PropertyType } from '@/ui/types';

export type ServerPropertyData = {
  recordType: 'offer' | 'request';
  transactionType: 'sale' | 'rent' | 'buy' | 'rent_request' | null;
  propertyType: 'residential_land' | 'commercial_land' | 'villa' | 'apartment' | 'building' | 'farm' | 'office' | 'warehouse' | 'other' | null;
  city: string | null;
  districts: string[];
  area: number | null;
  streetWidth: number | null;
  facade: string | null;
  price: number | null;
  priceBid?: number | null;
  maximumBudget: number | null;
  priceType: 'net' | 'negotiable' | 'unknown' | null;
  bedrooms: number | null;
  minimumBedrooms: number | null;
  bathrooms: number | null;
  licenseNumber: string | null;
  contactNumber: string | null;
  description: string | null;
  lengths?: string | null;
  planNumber?: string | null;
  blockNumber?: string | null;
  plotNumber?: string | null;
  ownerName?: string | null;
  clientName?: string | null;
  missingFields: string[];
  confidence: number;
};

export async function extractPropertyWithServerAI(text: string): Promise<ServerPropertyData> {
  const response = await fetch('/api/extract-property', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = (await response.json().catch(() => null)) as (ServerPropertyData & { error?: string }) | null;
  if (!response.ok || !body) {
    throw new Error(body?.error || 'تعذر تحليل النص عبر AI.');
  }
  return body;
}

export async function transcribeWithServerAI(audio: Blob, filename = 'recording.webm'): Promise<string> {
  const formData = new FormData();
  formData.set('audio', audio, filename);
  const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
  const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!response.ok || !body?.text) {
    throw new Error(body?.error || 'تعذر تحويل الصوت إلى نص.');
  }
  return body.text;
}

function propertyTypeFromAI(type: ServerPropertyData['propertyType']): PropertyType {
  if (type === 'villa') return 'villa';
  if (type === 'apartment') return 'apartment';
  if (type === 'building') return 'building';
  if (type === 'farm') return 'farm';
  if (type === 'office' || type === 'warehouse' || type === 'other') return 'other';
  return 'land';
}

export function parsedListingFromServerAI(data: ServerPropertyData, fallbackKind: ListingKind): ParsedListing & {
  adLicense?: string;
  contactNumber?: string;
  contactName?: string;
  notes?: string;
} {
  const kind: ListingKind = data.recordType ?? fallbackKind;
  const propertyType = propertyTypeFromAI(data.propertyType);
  const status =
    kind === 'offer'
      ? data.transactionType === 'rent' || data.transactionType === 'rent_request'
        ? 'for_rent'
        : 'for_sale'
      : data.transactionType === 'rent' || data.transactionType === 'rent_request'
        ? 'rent'
        : 'buy';
  const fields: ParsedListing['fields'] = {};
  if (data.area) fields.area = data.area;
  if (data.streetWidth) fields.streetWidth = data.streetWidth;
  if (data.facade) fields.frontage = data.facade;
  if (data.bedrooms ?? data.minimumBedrooms) fields.bedrooms = data.bedrooms ?? data.minimumBedrooms ?? undefined;
  if (data.bathrooms) fields.bathrooms = data.bathrooms;
  if (data.lengths) fields.lengths = data.lengths;
  if (data.planNumber) fields.planNo = data.planNumber;
  if (data.blockNumber) fields.blockNo = data.blockNumber;
  if (data.plotNumber) fields.plotNo = data.plotNumber;

  const confidence = [
    `AI Gemini: ثقة ${Math.round(data.confidence * 100)}%`,
    ...data.missingFields.slice(0, 4).map((field) => `يراجع: ${field}`),
  ];
  const priceAsk = kind === 'request' ? (data.maximumBudget ?? data.price ?? undefined) : (data.price ?? undefined);

  return {
    kind,
    propertyType,
    status,
    district: data.districts[0] ?? '',
    city: data.city ?? '',
    priceAsk,
    priceBid: data.priceBid ?? undefined,
    priceMode: data.priceBid ? 'bid' : 'ask',
    priceAmbiguous: data.priceType === 'unknown',
    fields,
    confidence,
    adLicense: data.licenseNumber ?? undefined,
    contactNumber: data.contactNumber ?? undefined,
    contactName: kind === 'offer' ? (data.ownerName ?? undefined) : (data.clientName ?? undefined),
    notes: data.description ?? undefined,
  };
}
