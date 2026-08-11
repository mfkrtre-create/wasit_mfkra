'use client';

import { useSyncExternalStore } from 'react';
import type {
  ActivityLog,
  ActivityType,
  ArchiveReason,
  Commission,
  DBShape,
  Listing,
  ListingKind,
  Profile,
  ShareLog,
} from '@/ui/types';

type JsonRecord = Record<string, unknown>;

export interface BackendUser {
  id: string;
  email: string;
  username: string;
  phone: string;
  name: string;
  role: 'admin' | 'broker';
  timezone: string;
  falLicense: string;
  emailConfirmed: boolean;
}

const emptyProfile: Profile = {
  name: 'وسيط عقاري',
  falLicense: 'غير مضاف',
  tier: 'وسيط نشط',
  phone: '',
  city: 'الرياض',
  referralCode: '',
  apiKeys: {},
};

let state: DBShape = { listings: [], shareLogs: [], activity: [], profile: emptyProfile };
let backendWorkspace: JsonRecord = {};
let initialized = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asListingFields(value: unknown): Listing['fields'] {
  return Object.fromEntries(
    Object.entries(asObject(value)).filter((entry): entry is [string, string | number | boolean] => {
      const fieldValue = entry[1];
      return typeof fieldValue === 'string' || typeof fieldValue === 'boolean' || (typeof fieldValue === 'number' && Number.isFinite(fieldValue));
    }),
  );
}

function asPropertyImages(value: unknown): Listing['images'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const image = asObject(item);
      const id = asString(image.id);
      const url = asString(image.url);
      if (!id || !url) return null;
      return {
        id,
        url,
        name: asString(image.name, 'property-image'),
        main: image.main === true,
      };
    })
    .filter((item): item is Listing['images'][number] => item !== null);
}

function propertyTypeFromBackend(value: unknown): Listing['propertyType'] {
  const type = asString(value).toLowerCase();
  if (type.includes('villa') || type.includes('فيلا')) return 'villa';
  if (type.includes('apartment') || type.includes('شقة')) return 'apartment';
  if (type.includes('building') || type.includes('عمارة')) return 'building';
  if (type.includes('farm') || type.includes('مزرعة')) return 'farm';
  if (type.includes('tower') || type.includes('برج')) return 'tower';
  if (type.includes('land') || type.includes('أرض') || type.includes('ارض')) return 'land';
  return 'other';
}

function statusFromBackend(kind: ListingKind, value: unknown): Listing['status'] {
  const status = asString(value);
  if (kind === 'offer') {
    if (status === 'for_rent') return 'for_rent';
    if (status === 'sold_or_rented' || status === 'closed') return 'closed';
    if (status === 'archived') return 'archived';
    return 'for_sale';
  }
  if (status === 'rental' || status === 'rent') return 'rent';
  if (status === 'fulfilled') return 'fulfilled';
  if (status === 'archived') return 'archived';
  return 'buy';
}

function listingFromBackend(rawValue: unknown, clientValue?: unknown): Listing {
  const raw = asObject(rawValue);
  const client = asObject(clientValue);
  const kind: ListingKind = raw.kind === 'request' ? 'request' : 'offer';
  const savedFields = asListingFields(raw.fields);
  const fields: Listing['fields'] = {
    ...savedFields,
    area: asNumber(raw.area) ?? savedFields.area,
    streetWidth: asNumber(raw.streetWidth) ?? savedFields.streetWidth,
    frontage: asString(raw.facade) || savedFields.frontage,
    lengths: asString(raw.lengths) || savedFields.lengths,
    planNo: asString(raw.planNumber) || savedFields.planNo,
    blockNo: asString(raw.blockNumber) || savedFields.blockNo,
    plotNo: asString(raw.plotNumber) || savedFields.plotNo,
    age: asString(raw.propertyAge) || savedFields.age,
    bedrooms: asNumber(raw.bedrooms) ?? savedFields.bedrooms,
    bathrooms: asNumber(raw.bathrooms) ?? savedFields.bathrooms,
  };
  return {
    id: asString(raw.id, uid()),
    kind,
    status: statusFromBackend(kind, raw.status),
    propertyType: propertyTypeFromBackend(raw.propertyType),
    title: asString(raw.title, kind === 'offer' ? 'عرض عقاري' : 'طلب عقاري'),
    city: asString(raw.city, 'الرياض'),
    district: asString(raw.district),
    priceAsk: asNumber(raw.price) ?? (kind === 'request' ? asNumber(raw.budget) : undefined),
    priceBid: asNumber(raw.askingPrice),
    priceMode: raw.basePriceMode === 'asking' ? 'bid' : 'ask',
    lat: asNumber(raw.lat),
    lng: asNumber(raw.lng),
    fields,
    falLicense: asString(raw.falLicense),
    adLicense: asString(raw.license),
    ownerName: asString(raw.ownerName),
    ownerPhone: asString(raw.ownerPhone) || asString(raw.contact),
    clientName: asString(raw.clientName) || asString(client.name),
    clientPhone: asString(raw.clientPhone) || asString(client.phone) || (kind === 'request' ? asString(raw.contact) : ''),
    images: asPropertyImages(raw.images),
    notes: asString(raw.notes),
    source: raw.source === 'ai-text' ? 'whatsapp' : raw.source === 'ai-voice' ? 'voice' : 'manual',
    rawText: asString(raw.rawText) || undefined,
    refreshIntervalDays: raw.reminderDays === 7 || raw.reminderDays === 30 ? raw.reminderDays : 14,
    lastRefreshedAt: asString(raw.lastRefreshedAt) || asString(raw.updatedAt) || now(),
    createdAt: asString(raw.createdAt) || now(),
    updatedAt: asString(raw.updatedAt) || now(),
    archivedAt: asString(raw.archivedAt) || undefined,
    archiveReason: raw.archiveReason as ArchiveReason | undefined,
    commission: raw.commission as Commission | undefined,
  };
}

function backendStatus(listing: Listing): string {
  if (listing.kind === 'offer') return listing.status === 'closed' ? 'sold_or_rented' : listing.status;
  if (listing.status === 'buy') return 'purchase';
  if (listing.status === 'rent') return 'rental';
  return listing.status;
}

function backendPropertyType(type: Listing['propertyType']): string {
  return ({ land: 'أرض', villa: 'فيلا', apartment: 'شقة', building: 'عمارة', farm: 'مزرعة', tower: 'برج', other: 'أخرى' } as const)[type];
}

function listingToBackend(listing: Listing, previousValue: unknown): JsonRecord {
  const previous = asObject(previousValue);
  const fields = listing.fields;
  return {
    ...previous,
    id: listing.id,
    kind: listing.kind,
    title: listing.title,
    propertyType: backendPropertyType(listing.propertyType),
    transaction: listing.kind === 'offer' ? (listing.status === 'for_rent' ? 'إيجار' : 'بيع') : listing.status === 'rent' ? 'طلب إيجار' : 'شراء',
    status: backendStatus(listing),
    city: listing.city,
    district: listing.district,
    area: asNumber(fields.area) ?? null,
    price: listing.priceAsk ?? null,
    askingPrice: listing.priceBid ?? null,
    budget: listing.kind === 'request' ? listing.priceAsk ?? null : null,
    basePriceMode: listing.priceMode === 'bid' ? 'asking' : 'limit',
    streetWidth: asNumber(fields.streetWidth) ?? null,
    facade: asString(fields.frontage),
    facades: fields.frontage ? [String(fields.frontage)] : [],
    lengths: asString(fields.lengths),
    planNumber: asString(fields.planNo),
    blockNumber: asString(fields.blockNo),
    plotNumber: asString(fields.plotNo),
    bedrooms: asNumber(fields.bedrooms) ?? null,
    bathrooms: asNumber(fields.bathrooms) ?? null,
    ownerName: listing.ownerName ?? '',
    ownerPhone: listing.ownerPhone ?? '',
    clientName: listing.clientName ?? '',
    clientPhone: listing.clientPhone ?? '',
    images: listing.images,
    falLicense: listing.falLicense ?? '',
    contact: listing.kind === 'offer' ? listing.ownerPhone ?? '' : listing.clientPhone ?? '',
    license: listing.adLicense ?? '',
    reminderDays: listing.refreshIntervalDays,
    notes: listing.notes ?? '',
    source: listing.source === 'whatsapp' ? 'ai-text' : listing.source === 'voice' ? 'ai-voice' : 'manual',
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    deletedAt: undefined,
    lastRefreshedAt: listing.lastRefreshedAt,
    archivedAt: listing.archivedAt,
    archiveReason: listing.archiveReason,
    commission: listing.commission,
    fields,
  };
}

function activityFromBackend(value: unknown): ActivityLog {
  const raw = asObject(value);
  const rawType = asString(raw.type);
  const type: ActivityType = rawType === 'record_created' ? 'created' : rawType === 'share_sent' ? 'shared' : rawType === 'record_updated' ? 'updated' : 'updated';
  return {
    id: asString(raw.id, uid()),
    listingId: asString(raw.recordId) || undefined,
    listingTitle: asString(raw.listingTitle) || asString(raw.title) || undefined,
    type,
    detail: asString(raw.details) || asString(raw.detail),
    createdAt: asString(raw.createdAt) || now(),
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function persistSoon() {
  if (!initialized || typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const previousRecords = Array.isArray(backendWorkspace.records) ? backendWorkspace.records : [];
    const previousById = new Map(previousRecords.map((record) => [asString(asObject(record).id), record]));
    backendWorkspace = {
      ...backendWorkspace,
      profile: { ...asObject(backendWorkspace.profile), name: state.profile.name },
      records: state.listings.map((listing) => listingToBackend(listing, previousById.get(listing.id))),
      activities: state.activity,
      referenceShareLogs: state.shareLogs,
      referenceProfile: state.profile,
    };
    void fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: backendWorkspace, version: 2 }),
    });
  }, 500);
}

function setState(updater: (current: DBShape) => DBShape) {
  state = updater(state);
  notify();
  persistSoon();
}

export function initializeDB(workspaceValue: unknown, user: BackendUser) {
  backendWorkspace = asObject(workspaceValue);
  const records = Array.isArray(backendWorkspace.records)
    ? backendWorkspace.records
    : Array.isArray(backendWorkspace.listings)
      ? backendWorkspace.listings
      : [];
  const clients = Array.isArray(backendWorkspace.clients) ? backendWorkspace.clients : [];
  const clientsById = new Map(clients.map((client) => [asString(asObject(client).id), client]));
  const profileValue = asObject(backendWorkspace.referenceProfile);
  const backendProfile = asObject(backendWorkspace.profile);
  state = {
    listings: records
      .filter((record) => !asObject(record).deletedAt)
      .map((record) => listingFromBackend(record, clientsById.get(asString(asObject(record).clientId)))),
    shareLogs: Array.isArray(backendWorkspace.referenceShareLogs) ? (backendWorkspace.referenceShareLogs as ShareLog[]) : [],
    activity: Array.isArray(backendWorkspace.activities) ? backendWorkspace.activities.map(activityFromBackend) : [],
    profile: {
      ...emptyProfile,
      ...profileValue,
      name: user.name || asString(backendProfile.name, emptyProfile.name),
      phone: user.phone || asString(profileValue.phone),
      falLicense: user.falLicense || asString(profileValue.falLicense, 'غير مضاف'),
      tier: user.role === 'admin' ? 'ذهبي 🥇' : asString(profileValue.tier, 'وسيط نشط'),
      referralCode: asString(profileValue.referralCode) || `BROKER-${user.id.slice(-4).toUpperCase()}`,
      apiKeys: {},
    },
  };
  initialized = true;
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useDB(): DBShape {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const getProfile = () => state.profile;

export const isOverdue = (listing: Listing): boolean => {
  if (listing.status === 'archived' || listing.status === 'closed' || listing.status === 'fulfilled') return false;
  return Date.now() - new Date(listing.lastRefreshedAt).getTime() > listing.refreshIntervalDays * 86400000;
};

export const daysUntilDue = (listing: Listing): number => {
  const elapsed = Date.now() - new Date(listing.lastRefreshedAt).getTime();
  return Math.ceil((listing.refreshIntervalDays * 86400000 - elapsed) / 86400000);
};

function logActivity(current: DBShape, type: ActivityType, detail: string, listingId?: string, listingTitle?: string): ActivityLog[] {
  return [{ id: uid(), type, detail, listingId, listingTitle, createdAt: now() }, ...current.activity].slice(0, 300);
}

export const db = {
  addListing(input: Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'lastRefreshedAt'> & { lastRefreshedAt?: string }): string {
    const id = uid();
    setState((current) => ({
      ...current,
      listings: [{ ...input, id, lastRefreshedAt: input.lastRefreshedAt ?? now(), createdAt: now(), updatedAt: now() }, ...current.listings],
      activity: logActivity(current, 'created', `تمت إضافة ${input.kind === 'offer' ? 'عرض' : 'طلب'} جديد`, id, input.title),
    }));
    return id;
  },
  updateListing(id: string, patch: Partial<Listing>, activityDetail?: string) {
    setState((current) => ({ ...current, listings: current.listings.map((listing) => listing.id === id ? { ...listing, ...patch, updatedAt: now() } : listing), activity: activityDetail ? logActivity(current, 'updated', activityDetail, id) : current.activity }));
  },
  updatePrice(id: string, field: 'priceBid' | 'priceAsk', value: number) {
    setState((current) => {
      const listing = current.listings.find((item) => item.id === id);
      return { ...current, listings: current.listings.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: now() } : item), activity: logActivity(current, 'price_update', `تحديث السعر إلى ${value.toLocaleString('en-US')} ر.س`, id, listing?.title) };
    });
  },
  refreshListing(id: string) {
    setState((current) => {
      const listing = current.listings.find((item) => item.id === id);
      return { ...current, listings: current.listings.map((item) => item.id === id ? { ...item, lastRefreshedAt: now(), updatedAt: now() } : item), activity: logActivity(current, 'refreshed', 'تم التحديث وأعيد ضبط مؤقت المتابعة', id, listing?.title) };
    });
  },
  archiveListing(id: string, reason: ArchiveReason, commission?: Commission) {
    setState((current) => ({ ...current, listings: current.listings.map((listing) => listing.id === id ? { ...listing, status: reason === 'sold_by_me' ? (listing.kind === 'offer' ? 'closed' : 'fulfilled') : 'archived', archivedAt: now(), archiveReason: reason, commission, updatedAt: now() } : listing), activity: logActivity(current, 'archived', 'تمت أرشفة الإعلان', id) }));
  },
  restoreListing(id: string) {
    setState((current) => ({ ...current, listings: current.listings.map((listing) => listing.id === id ? { ...listing, status: listing.kind === 'offer' ? 'for_sale' : 'buy', archivedAt: undefined, archiveReason: undefined, lastRefreshedAt: now(), updatedAt: now() } : listing), activity: logActivity(current, 'restored', 'تمت استعادة الإعلان', id) }));
  },
  deleteListing(id: string) {
    setState((current) => ({ ...current, listings: current.listings.filter((listing) => listing.id !== id) }));
  },
  addShareLog(log: Omit<ShareLog, 'id' | 'createdAt'>) {
    setState((current) => ({ ...current, shareLogs: [{ ...log, id: uid(), createdAt: now() }, ...current.shareLogs], activity: logActivity(current, 'shared', `مشاركة عبر ${log.platform === 'whatsapp' ? 'واتساب' : 'منصة X'}`, log.listingId, log.listingTitle) }));
  },
  updateProfile(patch: Partial<Profile>) {
    setState((current) => ({ ...current, profile: { ...current.profile, ...patch, apiKeys: {} } }));
    if (patch.name !== undefined || patch.falLicense !== undefined) {
      void fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: patch.name, falLicense: patch.falLicense }) });
    }
  },
  resetAll() {
    setState((current) => ({ ...current, listings: [], shareLogs: [], activity: [] }));
  },
};

export const listingsByKind = (listings: Listing[], kind: ListingKind) => listings.filter((listing) => listing.kind === kind);
