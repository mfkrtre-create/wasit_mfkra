import "server-only";

export type ShareRecordInput = {
  id: string;
  kind: "offer" | "request";
  title: string;
  status: string;
  city: string;
  district: string;
  propertyType: string;
  transaction: string;
  price: number | null;
  askingPrice: number | null;
  budget: number | null;
  area: number | null;
  contact: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  imageId: string | null;
};

export type ShareOptions = {
  includePrice: boolean;
  includeAskingPrice: boolean;
  includeArea: boolean;
  includeContact: boolean;
  includeNotes: boolean;
  includeMap: boolean;
  includeImage: boolean;
  expiresInDays: number | null;
};

export type PublicShareSnapshot = {
  title: string;
  kind: string;
  status: string;
  propertyType: string;
  transaction: string;
  city: string;
  district: string;
  price?: number | null;
  askingPrice?: number | null;
  budget?: number | null;
  area?: number | null;
  contact?: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
  imageId?: string | null;
};

const kindLabels = {
  offer: "عرض",
  request: "طلب",
};

const statusLabels: Record<string, string> = {
  for_sale: "للبيع",
  for_rent: "للإيجار",
  sold_or_rented: "مباع/مؤجر",
  purchase: "شراء",
  rental: "استئجار",
  fulfilled: "تمت تلبية الطلب",
  archived: "مؤرشف",
};

export function buildPublicShareSnapshot(record: ShareRecordInput, options: ShareOptions): PublicShareSnapshot {
  return {
    title: record.title,
    kind: kindLabels[record.kind],
    status: statusLabels[record.status] ?? record.status,
    propertyType: record.propertyType,
    transaction: record.transaction,
    city: record.city,
    district: record.district,
    price: options.includePrice ? record.price : undefined,
    askingPrice: options.includeAskingPrice ? record.askingPrice : undefined,
    budget: options.includePrice ? record.budget : undefined,
    area: options.includeArea ? record.area : undefined,
    contact: options.includeContact ? record.contact : undefined,
    notes: options.includeNotes ? record.notes : undefined,
    lat: options.includeMap ? record.lat : undefined,
    lng: options.includeMap ? record.lng : undefined,
    imageId: options.includeImage ? record.imageId : undefined,
  };
}
