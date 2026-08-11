import type { Listing, ShareOptions } from '@/ui/types';
import { PROPERTY_TYPE_LABELS, statusLabel } from '@/ui/types';

export type PublicShareOptions = {
  includePrice: boolean;
  includeAskingPrice: boolean;
  includeArea: boolean;
  includeContact: boolean;
  includeNotes: boolean;
  includeMap: boolean;
  includeImage: boolean;
  expiresInDays: number | null;
};

export type PublicShareLink = {
  id: string;
  record_id: string;
  title: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export const defaultPublicShareOptions = (shareOptions: ShareOptions): PublicShareOptions => ({
  includePrice: shareOptions.showPrice,
  includeAskingPrice: shareOptions.showBidInstead,
  includeArea: true,
  includeContact: shareOptions.showBrokerNumber,
  includeNotes: false,
  includeMap: true,
  includeImage: shareOptions.includeImage,
  expiresInDays: 30,
});

export function publicShareRecord(listing: Listing) {
  return {
    id: listing.id,
    kind: listing.kind,
    title: listing.title,
    status:
      listing.kind === 'offer'
        ? listing.status === 'closed'
          ? 'sold_or_rented'
          : listing.status
        : listing.status === 'buy'
          ? 'purchase'
          : listing.status === 'rent'
            ? 'rental'
            : listing.status,
    city: listing.city,
    district: listing.district,
    propertyType: PROPERTY_TYPE_LABELS[listing.propertyType],
    transaction: statusLabel(listing.kind, listing.status),
    price: listing.priceAsk ?? null,
    askingPrice: listing.priceBid ?? null,
    budget: listing.kind === 'request' ? listing.priceAsk ?? null : null,
    area: typeof listing.fields.area === 'number' ? listing.fields.area : null,
    contact: listing.kind === 'offer' ? listing.ownerPhone ?? '' : listing.clientPhone ?? '',
    notes: listing.notes ?? '',
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
    imageId: (listing.images.find((image) => image.main) ?? listing.images[0])?.id ?? null,
  };
}

export async function createPublicShare(listing: Listing, options: PublicShareOptions): Promise<{ share: PublicShareLink; url: string }> {
  const response = await fetch('/api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record: publicShareRecord(listing), options }),
  });
  const body = (await response.json().catch(() => null)) as { share?: PublicShareLink; url?: string; error?: string } | null;
  if (!response.ok || !body?.share || !body.url) {
    throw new Error(body?.error || 'تعذر إنشاء الرابط العام.');
  }
  return { share: body.share, url: body.url };
}

export async function revokePublicShare(id: string): Promise<void> {
  const response = await fetch(`/api/shares/${encodeURIComponent(id)}`, { method: 'PATCH' });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.error || 'تعذر إلغاء الرابط العام.');
  }
}
