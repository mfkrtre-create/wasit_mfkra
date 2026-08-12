export type ParsedCoordinates = { lat: number; lng: number };

const googleMapsUrlPattern = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[^\s/]+\/maps|maps\.google\.[^\s/]+)[^\s<>"'،)]+/i;

export function extractGoogleMapsUrl(text: string): string | null {
  const match = text.match(googleMapsUrlPattern)?.[0];
  return match ? match.replace(/[.,،؛]+$/, '') : null;
}

function validCoordinates(lat: number, lng: number): ParsedCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parsePair(latValue: string | undefined, lngValue: string | undefined): ParsedCoordinates | null {
  if (!latValue || !lngValue) return null;
  return validCoordinates(Number(latValue), Number(lngValue));
}

export function parseCoordinatesFromGoogleMapsUrl(url: string): ParsedCoordinates | null {
  const decoded = decodeURIComponent(url);
  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|z|\/|$)/);
  if (atMatch) return parsePair(atMatch[1], atMatch[2]);

  const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) return parsePair(bangMatch[1], bangMatch[2]);

  const queryMatch = decoded.match(/[?&](?:q|query|destination|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:&|$)/);
  if (queryMatch) return parsePair(queryMatch[1], queryMatch[2]);

  return null;
}
