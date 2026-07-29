import { describe, expect, it } from "vitest";
import { normalizePropertyData } from "./normalize-property-data";
import { defaultPropertyData, propertySchema } from "./property-schema";

describe("property data normalization", () => {
  it("keeps the default property data valid", () => {
    expect(propertySchema.safeParse(defaultPropertyData).success).toBe(true);
  });

  it("normalizes scalar values, lists, integers, and confidence bounds", () => {
    const normalized = normalizePropertyData({
      recordType: "request",
      transactionType: "buy",
      city: " الرياض ",
      districts: [" العارض ", "", "النرجس"],
      area: "450.5",
      bedrooms: 3.6,
      confidence: 2,
    });

    expect(normalized).toMatchObject({
      recordType: "request",
      transactionType: "buy",
      city: "الرياض",
      districts: ["العارض", "النرجس"],
      area: 450.5,
      bedrooms: 4,
      confidence: 1,
    });
  });

  it("uses null scalars and empty arrays for unknown values", () => {
    const normalized = normalizePropertyData({
      recordType: "offer",
      city: "",
      districts: "not an array",
      area: "not a number",
      missingFields: null,
    });

    expect(normalized.city).toBeNull();
    expect(normalized.districts).toEqual([]);
    expect(normalized.area).toBeNull();
    expect(normalized.missingFields).toEqual([]);
  });
});
