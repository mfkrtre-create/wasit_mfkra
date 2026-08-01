import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsUrl,
  filterMapRecords,
  getMarkerColor,
  toMapFeatureCollection,
  type MapRecord,
} from "./map-records";

const records: MapRecord[] = [
  {
    id: "offer-1",
    recordType: "offer",
    status: "for_sale",
    statusLabel: "للبيع",
    propertyType: "فيلا",
    city: "الرياض",
    district: "العقيق",
    price: 1400000,
    budget: null,
    area: 300,
    latitude: 24.78,
    longitude: 46.63,
    detailsUrl: "#record-offer-1",
  },
  {
    id: "request-1",
    recordType: "request",
    status: "purchase",
    statusLabel: "شراء",
    propertyType: "أرض",
    city: "الرياض",
    district: "النرجس",
    price: null,
    budget: 900000,
    area: null,
    latitude: 24.84,
    longitude: 46.68,
    detailsUrl: "#record-request-1",
  },
  {
    id: "closed-1",
    recordType: "offer",
    status: "sold_or_rented",
    statusLabel: "مباع/مؤجر",
    propertyType: "شقة",
    city: "الرياض",
    district: "الملقا",
    price: 85000,
    budget: null,
    area: 135,
    latitude: 24.8,
    longitude: 46.59,
    detailsUrl: "#record-closed-1",
  },
  {
    id: "missing-coordinates",
    recordType: "offer",
    status: "for_rent",
    statusLabel: "للإيجار",
    propertyType: "أرض",
    city: "الرياض",
    district: "حطين",
    price: 1200000,
    budget: null,
    area: 450,
    latitude: null,
    longitude: null,
    detailsUrl: "#record-missing-coordinates",
  },
];

describe("map records", () => {
  it("converts valid coordinate records to GeoJSON and excludes invalid coordinates", () => {
    const geojson = toMapFeatureCollection(records);

    expect(geojson.features).toHaveLength(3);
    expect(geojson.features[0]).toMatchObject({
      type: "Feature",
      geometry: { type: "Point", coordinates: [46.63, 24.78] },
      properties: { id: "offer-1", recordType: "offer", status: "for_sale", statusLabel: "للبيع", propertyType: "فيلا" },
    });
    expect(geojson.features.some((feature) => feature.properties.id === "missing-coordinates")).toBe(false);
  });

  it("uses approved marker colors for available offers, open requests, and completed records", () => {
    expect(getMarkerColor(records[0])).toBe("#059669");
    expect(getMarkerColor(records[1])).toBe("#2563eb");
    expect(getMarkerColor(records[2])).toBe("#6b7280");
  });

  it("filters visible features by query, status, and city", () => {
    expect(filterMapRecords(records, { query: "شراء", status: "purchase", city: "الرياض" })).toHaveLength(1);
    expect(filterMapRecords(records, { query: "", status: "sold_or_rented", city: "الرياض" })).toHaveLength(1);
    expect(filterMapRecords(records, { query: "", status: "for_sale", city: "جدة" })).toHaveLength(0);
  });

  it("builds Google Maps navigation URLs from coordinates", () => {
    expect(buildGoogleMapsUrl(24.7136, 46.6753)).toBe("https://www.google.com/maps/search/?api=1&query=24.7136,46.6753");
  });
});
