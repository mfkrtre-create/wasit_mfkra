import type { Listing, Profile, ShareOptions } from '@/ui/types';
import { PROPERTY_TYPE_LABELS, statusLabel } from '@/ui/types';
import { fmtMoney } from './format';
import { summaryChips } from './fieldDefs';

const TYPE_EMOJI: Record<string, string> = {
  land: '🗺️',
  villa: '🏡',
  apartment: '🏢',
  building: '🏬',
  farm: '🌴',
  tower: '🏙️',
  other: '🏪',
};

/** Build the formatted Arabic marketing message for WhatsApp / X */
export function buildShareMessage(listing: Listing, opts: ShareOptions, profile: Profile): string {
  const emoji = TYPE_EMOJI[listing.propertyType] ?? '🏠';
  const typeLabel = PROPERTY_TYPE_LABELS[listing.propertyType];
  const status = statusLabel(listing.kind, listing.status);
  const lines: string[] = [];

  lines.push(`${emoji} ${typeLabel} ${status} — ${listing.district ? `حي ${listing.district}` : listing.city}`);
  lines.push('━━━━━━━━━━━━━━');

  const chips = summaryChips(listing.propertyType, listing.fields);
  if (chips.length > 0) lines.push(`📐 ${chips.join(' • ')}`);

  if (opts.showPrice) {
    if (opts.showBidInstead && listing.priceBid) {
      lines.push(`💰 السوم واصل: ${fmtMoney(listing.priceBid)}`);
    } else if (listing.priceAsk) {
      lines.push(`💰 الحد: ${fmtMoney(listing.priceAsk)}`);
    } else if (listing.priceBid) {
      lines.push(`💰 السوم: ${fmtMoney(listing.priceBid)}`);
    }
  }

  if (listing.notes) lines.push(`📝 ${listing.notes}`);
  lines.push('━━━━━━━━━━━━━━');

  if (opts.includeQuickLink) {
    lines.push(`🔗 تصفح سريع: ${window.location.origin}/listing/${listing.id}`);
  }
  if (opts.showBrokerNumber) {
    lines.push(`📞 الوسيط: ${profile.name} — ${profile.phone}`);
    lines.push(`🪪 رخصة فال: ${profile.falLicense}`);
  }

  return lines.join('\n');
}

export function xShareUrl(message: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
}

/** Pre-written WhatsApp message asking the owner/client for a listing refresh */
export function buildRefreshMessage(listing: Listing, profile: Profile): string {
  const who = listing.kind === 'offer' ? listing.ownerName : listing.clientName;
  return [
    `السلام عليكم ${who ?? ''} 👋`,
    `معك ${profile.name} — الوسيط العقاري.`,
    `أرغب بتحديث بيانات الإعلان التالي لدي في المفكرة:`,
    `📌 ${listing.title}`,
    `هل ما زال ${listing.kind === 'offer' ? 'العقار متاحاً' : 'الطلب قائماً'}؟ وهل هناك تحديث على السعر؟`,
    `شاكر لك تعاونك 🌹`,
  ].join('\n');
}
