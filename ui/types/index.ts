// ===== Core domain types — mirrors the future Supabase schema =====

export type PropertyType =
  | 'land' // أرض
  | 'villa' // فيلا
  | 'apartment' // شقة
  | 'building' // عمارة
  | 'farm' // مزرعة
  | 'tower' // برج
  | 'other'; // استراحة / مكتب / محل

export type ListingKind = 'offer' | 'request';

// Offers: للبيع، للإيجار، مباع/مؤجر، مؤرشف
export type OfferStatus = 'for_sale' | 'for_rent' | 'closed' | 'archived';
// Requests: شراء، استئجار، تمت تلبية الطلب، مؤرشف
export type RequestStatus = 'buy' | 'rent' | 'fulfilled' | 'archived';
export type ListingStatus = OfferStatus | RequestStatus;

export type PriceMode = 'bid' | 'ask'; // سوم vs حد

export type ArchiveReason =
  | 'sold_by_me' // تم البيع عن طريقي
  | 'sold_externally' // بيع خارجياً
  | 'owner_changed_mind' // المالك غيّر رأيه
  | 'client_cancelled'; // العميل ألغى الطلب

export type InputSource = 'manual' | 'whatsapp' | 'voice';

export interface Commission {
  percent: number;
  amount: number;
  date: string; // ISO
  dealPrice: number;
}

export interface PropertyImage {
  id: string;
  url: string;
  name: string;
  main: boolean;
}

export interface Listing {
  id: string;
  kind: ListingKind;
  status: ListingStatus;
  propertyType: PropertyType;
  title: string;
  city: string;
  district: string;
  priceAsk?: number; // سعر البيع / الحد
  priceBid?: number; // سعر السوم
  priceMode: PriceMode; // which price is the headline
  lat?: number;
  lng?: number;
  // Dynamic per-type fields (area, frontage, streetWidth, age, floors, ...)
  fields: Record<string, string | number | boolean | undefined>;
  falLicense?: string; // رقم رخصة فال
  adLicense?: string; // رقم الإعلان العقاري
  ownerName?: string; // المالك (offers)
  ownerPhone?: string;
  clientName?: string; // العميل (requests)
  clientPhone?: string;
  images: PropertyImage[];
  notes?: string;
  source: InputSource;
  rawText?: string;
  refreshIntervalDays: 7 | 14 | 30;
  lastRefreshedAt: string; // ISO
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archiveReason?: ArchiveReason;
  commission?: Commission;
}

export type SharePlatform = 'whatsapp' | 'x';

export interface ShareOptions {
  showPrice: boolean;
  showBrokerNumber: boolean;
  showBidInstead: boolean; // إظهار السوم بدل الحد
  includeQuickLink: boolean;
}

export interface ShareLog {
  id: string;
  listingId: string;
  listingTitle: string;
  listingKind: ListingKind;
  recipientName: string;
  recipientPhone?: string;
  platform: SharePlatform;
  message: string;
  options: ShareOptions;
  createdAt: string;
}

export type ActivityType =
  | 'created'
  | 'updated'
  | 'price_update'
  | 'refreshed'
  | 'archived'
  | 'restored'
  | 'shared'
  | 'status_change';

export interface ActivityLog {
  id: string;
  listingId?: string;
  listingTitle?: string;
  type: ActivityType;
  detail: string;
  createdAt: string;
}

export interface Profile {
  name: string;
  falLicense: string;
  tier: string;
  phone: string;
  city: string;
  referralCode: string;
  apiKeys: {
    mapbox?: string;
    whatsappBusiness?: string;
    openai?: string;
    [key: string]: string | undefined;
  };
}

export interface DBShape {
  listings: Listing[];
  shareLogs: ShareLog[];
  activity: ActivityLog[];
  profile: Profile;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  land: 'أرض',
  villa: 'فيلا',
  apartment: 'شقة',
  building: 'عمارة',
  farm: 'مزرعة',
  tower: 'برج',
  other: 'استراحة / مكتب / محل',
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  for_sale: 'للبيع',
  for_rent: 'للإيجار',
  closed: 'مباع/مؤجر',
  archived: 'مؤرشف',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  buy: 'شراء',
  rent: 'استئجار',
  fulfilled: 'تمت تلبية الطلب',
  archived: 'مؤرشف',
};

export const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  sold_by_me: 'تم البيع عن طريقي',
  sold_externally: 'بيع خارجياً',
  owner_changed_mind: 'المالك غيّر رأيه',
  client_cancelled: 'العميل ألغى الطلب',
};

export const statusLabel = (kind: ListingKind, status: ListingStatus): string =>
  kind === 'offer'
    ? OFFER_STATUS_LABELS[status as OfferStatus] ?? status
    : REQUEST_STATUS_LABELS[status as RequestStatus] ?? status;

export const activeStatuses = (kind: ListingKind): ListingStatus[] =>
  kind === 'offer' ? ['for_sale', 'for_rent', 'closed'] : ['buy', 'rent', 'fulfilled'];

export const allStatuses = (kind: ListingKind): ListingStatus[] =>
  kind === 'offer' ? ['for_sale', 'for_rent', 'closed', 'archived'] : ['buy', 'rent', 'fulfilled', 'archived'];
