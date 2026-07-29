import { z } from "zod";

export const recordTypes = ["offer", "request"] as const;
export const transactionTypes = ["sale", "rent", "buy", "rent_request"] as const;
export const propertyTypes = [
  "residential_land",
  "commercial_land",
  "villa",
  "apartment",
  "building",
  "farm",
  "office",
  "warehouse",
  "other",
] as const;
export const priceTypes = ["net", "negotiable", "unknown"] as const;

export const propertySchema = z.object({
  recordType: z.enum(recordTypes),
  transactionType: z.enum(transactionTypes).nullable(),
  propertyType: z.enum(propertyTypes).nullable(),
  city: z.string().trim().min(1).nullable(),
  districts: z.array(z.string().trim().min(1)),
  area: z.number().finite().positive().nullable(),
  streetWidth: z.number().finite().positive().nullable(),
  facade: z.string().trim().min(1).nullable(),
  price: z.number().finite().nonnegative().nullable(),
  maximumBudget: z.number().finite().nonnegative().nullable(),
  priceType: z.enum(priceTypes).nullable(),
  bedrooms: z.number().int().positive().nullable(),
  minimumBedrooms: z.number().int().positive().nullable(),
  bathrooms: z.number().int().positive().nullable(),
  licenseNumber: z.string().trim().min(1).nullable(),
  contactNumber: z.string().trim().min(1).nullable(),
  description: z.string().trim().min(1).nullable(),
  missingFields: z.array(z.string().trim().min(1)),
  confidence: z.number().finite().min(0).max(1),
});

export type PropertyData = z.infer<typeof propertySchema>;

export const defaultPropertyData: PropertyData = {
  recordType: "offer",
  transactionType: null,
  propertyType: null,
  city: null,
  districts: [],
  area: null,
  streetWidth: null,
  facade: null,
  price: null,
  maximumBudget: null,
  priceType: null,
  bedrooms: null,
  minimumBedrooms: null,
  bathrooms: null,
  licenseNumber: null,
  contactNumber: null,
  description: null,
  missingFields: [],
  confidence: 0,
};

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const nullableInteger = { type: ["integer", "null"] };

export const propertyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recordType: {
      type: "string",
      enum: recordTypes,
      description: "Classify whether the message is an offer or a request.",
    },
    transactionType: {
      type: ["string", "null"],
      enum: [...transactionTypes, null],
      description: "sale, rent, buy, rent_request, or null if not explicit.",
    },
    propertyType: {
      type: ["string", "null"],
      enum: [...propertyTypes, null],
      description: "Real estate type, or null if not explicit.",
    },
    city: { ...nullableString, description: "City name exactly when mentioned." },
    districts: {
      type: "array",
      items: { type: "string" },
      description: "District names only when explicitly mentioned.",
    },
    area: { ...nullableNumber, description: "Area in square meters." },
    streetWidth: { ...nullableNumber, description: "Street width in meters." },
    facade: { ...nullableString, description: "Property facade or direction." },
    price: { ...nullableNumber, description: "Offer price when mentioned." },
    maximumBudget: { ...nullableNumber, description: "Maximum budget for requests." },
    priceType: {
      type: ["string", "null"],
      enum: [...priceTypes, null],
      description: "net for صافي, negotiable for قابل للتفاوض, unknown when price type is unclear.",
    },
    bedrooms: { ...nullableInteger, description: "Exact bedroom count." },
    minimumBedrooms: { ...nullableInteger, description: "Minimum bedroom count." },
    bathrooms: { ...nullableInteger, description: "Bathroom count." },
    licenseNumber: { ...nullableString, description: "Advertisement license number." },
    contactNumber: { ...nullableString, description: "Contact phone number." },
    description: { ...nullableString, description: "Short Arabic summary based only on supplied text." },
    missingFields: {
      type: "array",
      items: { type: "string" },
      description: "Important fields that were not found in the text.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Extraction confidence from 0 to 1.",
    },
  },
  required: [
    "recordType",
    "transactionType",
    "propertyType",
    "city",
    "districts",
    "area",
    "streetWidth",
    "facade",
    "price",
    "maximumBudget",
    "priceType",
    "bedrooms",
    "minimumBedrooms",
    "bathrooms",
    "licenseNumber",
    "contactNumber",
    "description",
    "missingFields",
    "confidence",
  ],
} as const;
