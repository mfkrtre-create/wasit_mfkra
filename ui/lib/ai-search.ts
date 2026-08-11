import type { Listing, PropertyType } from '@/ui/types';

export interface ListingSearchFilters {
  propertyType: PropertyType | null;
  city: string | null;
  districts: string[];
  minArea: number | null;
  maxArea: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  transaction: 'sale' | 'rent' | 'buy' | 'rent_request' | null;
}

export async function analyzeListingSearch(query: string): Promise<ListingSearchFilters> {
  const response = await fetch('/api/search-listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = (await response.json().catch(() => null)) as (ListingSearchFilters & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error || 'تعذر تحليل عبارة البحث.');
  return body;
}

export function matchesAiSearch(listing: Listing, filters: ListingSearchFilters): boolean {
  const area = typeof listing.fields.area === 'number' ? listing.fields.area : undefined;
  const amount = listing.priceAsk ?? listing.priceBid;
  if (filters.propertyType && listing.propertyType !== filters.propertyType) return false;
  if (filters.city && !listing.city.includes(filters.city)) return false;
  if (filters.districts.length && !filters.districts.some((district) => listing.district.includes(district) || String(listing.fields.preferredDistricts ?? '').includes(district))) return false;
  if (filters.minArea !== null && (area === undefined || area < filters.minArea)) return false;
  if (filters.maxArea !== null && (area === undefined || area > filters.maxArea)) return false;
  if (filters.minPrice !== null && (amount === undefined || amount < filters.minPrice)) return false;
  if (filters.maxPrice !== null && (amount === undefined || amount > filters.maxPrice)) return false;
  if (filters.transaction === 'rent' && listing.status !== 'for_rent') return false;
  if (filters.transaction === 'sale' && listing.status !== 'for_sale') return false;
  if (filters.transaction === 'buy' && listing.status !== 'buy') return false;
  if (filters.transaction === 'rent_request' && listing.status !== 'rent') return false;
  return true;
}
