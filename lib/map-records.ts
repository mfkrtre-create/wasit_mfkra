export type MapRecordType = "offer" | "request";
export type MapRecordStatus = "for_sale" | "for_rent" | "sold_or_rented" | "purchase" | "rental" | "fulfilled" | "archived";

export type MapRecord = {
  id: string;
  recordType: MapRecordType;
  status: MapRecordStatus;
  statusLabel: string;
  propertyType: string;
  city: string;
  district: string;
  price: number | null;
  budget: number | null;
  area: number | null;
  latitude: number | null;
  longitude: number | null;
  detailsUrl: string;
  thumbnailUrl?: string | null;
};

export type MapFeatureProperties = {
  id: string;
  recordType: MapRecordType;
  status: MapRecordStatus;
  statusLabel: string;
  propertyType: string;
  city: string;
  district: string;
  price: number | null;
  budget: number | null;
  area: number | null;
  detailsUrl: string;
  thumbnailUrl: string;
  markerColor: string;
  googleMapsUrl: string;
};

export type MapFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: MapFeatureProperties;
};

export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: MapFeature[];
};

export const riyadhCenter = {
  longitude: 46.6753,
  latitude: 24.7136,
  zoom: 10,
};

export function hasValidCoordinates(
  record: Pick<MapRecord, "latitude" | "longitude">,
): record is Pick<MapRecord, "latitude" | "longitude"> & { latitude: number; longitude: number } {
  return (
    typeof record.latitude === "number" &&
    Number.isFinite(record.latitude) &&
    record.latitude >= -90 &&
    record.latitude <= 90 &&
    typeof record.longitude === "number" &&
    Number.isFinite(record.longitude) &&
    record.longitude >= -180 &&
    record.longitude <= 180
  );
}

export function getMarkerColor(record: Pick<MapRecord, "recordType" | "status">) {
  const isOpenOffer = record.recordType === "offer" && (record.status === "for_sale" || record.status === "for_rent");
  const isOpenRequest = record.recordType === "request" && (record.status === "purchase" || record.status === "rental");

  if (!isOpenOffer && !isOpenRequest) {
    return "#6b7280";
  }

  return record.recordType === "offer" ? "#059669" : "#2563eb";
}

export function buildGoogleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function toMapFeature(record: MapRecord): MapFeature | null {
  if (!hasValidCoordinates(record)) {
    return null;
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [record.longitude, record.latitude],
    },
    properties: {
      id: record.id,
      recordType: record.recordType,
      status: record.status,
      statusLabel: record.statusLabel,
      propertyType: record.propertyType,
      city: record.city,
      district: record.district,
      price: record.price,
      budget: record.budget,
      area: record.area,
      detailsUrl: record.detailsUrl,
      thumbnailUrl: record.thumbnailUrl ?? "",
      markerColor: getMarkerColor(record),
      googleMapsUrl: buildGoogleMapsUrl(record.latitude, record.longitude),
    },
  };
}

export function toMapFeatureCollection(records: MapRecord[]): MapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: records.map(toMapFeature).filter((feature): feature is MapFeature => feature !== null),
  };
}

export function filterMapRecords(records: MapRecord[], filters: { query: string; status: string; city: string }) {
  const query = filters.query.trim().toLowerCase();

  return records.filter((record) => {
    const matchesStatus = filters.status === "all" || record.status === filters.status;
    const matchesCity = filters.city === "all" || record.city === filters.city;
    const matchesQuery =
      !query ||
      [record.propertyType, record.city, record.district, record.status, record.statusLabel, record.recordType].join(" ").toLowerCase().includes(query);

    return matchesStatus && matchesCity && matchesQuery;
  });
}
