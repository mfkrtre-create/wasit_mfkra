import { z } from 'zod';

export const recordTypes = ['offer', 'request'] as const;
export const transactionTypes = ['sale', 'rent', 'buy', 'rent_request'] as const;
export const propertyTypes = ['residential_land', 'commercial_land', 'villa', 'apartment', 'building', 'block', 'farm', 'office', 'shop', 'rest_house', 'tower', 'warehouse', 'other'] as const;
export const propertyCategories = ['residential', 'commercial', 'industrial', 'agricultural'] as const;
export const priceTypes = ['net', 'negotiable', 'unknown'] as const;

const optionalText = z.string().trim().min(1).nullable();
const optionalNumber = z.number().finite().nonnegative().nullable();
const optionalPositive = z.number().finite().positive().nullable();
const optionalInteger = z.number().int().positive().nullable();

export const propertySchema = z.object({
  recordType: z.enum(recordTypes), transactionType: z.enum(transactionTypes).nullable(),
  propertyType: z.enum(propertyTypes).nullable(), customPropertyType: optionalText, category: z.enum(propertyCategories).nullable(),
  city: optionalText, districts: z.array(z.string().trim().min(1)),
  area: optionalPositive, minimumArea: optionalPositive, maximumArea: optionalPositive,
  streetWidth: optionalPositive, facade: optionalText, facades: z.array(z.string().trim().min(1)),
  price: optionalNumber, priceBid: optionalNumber, maximumBudget: optionalNumber, pricePerMeter: optionalNumber, targetPricePerMeter: optionalNumber,
  priceType: z.enum(priceTypes).nullable(), bedrooms: optionalInteger, minimumBedrooms: optionalInteger, bathrooms: optionalInteger,
  propertyAge: optionalNumber, maximumPropertyAge: optionalNumber,
  licenseNumber: optionalText, falLicenseNumber: optionalText, advertisementNumber: optionalText,
  contactNumber: optionalText, description: optionalText, lengths: optionalText, planNumber: optionalText, blockNumber: optionalText, plotNumber: optionalText,
  ownerName: optionalText, clientName: optionalText, technicalRequirements: optionalText,
  builtUpArea: optionalPositive, floors: optionalInteger, basementFloors: optionalInteger,
  parkingPerBasement: optionalInteger, parkingTotal: optionalInteger, rentalOfferAmount: optionalNumber,
  occupancyStatus: optionalText, finishing: optionalText, conversionPotential: optionalText, transferTaxNote: optionalText,
  missingFields: z.array(z.string().trim().min(1)), confidence: z.number().finite().min(0).max(1),
});

export type PropertyData = z.infer<typeof propertySchema>;

export const defaultPropertyData: PropertyData = {
  recordType: 'offer', transactionType: null, propertyType: null, customPropertyType: null, category: null,
  city: null, districts: [], area: null, minimumArea: null, maximumArea: null, streetWidth: null, facade: null, facades: [],
  price: null, priceBid: null, maximumBudget: null, pricePerMeter: null, targetPricePerMeter: null, priceType: null,
  bedrooms: null, minimumBedrooms: null, bathrooms: null, propertyAge: null, maximumPropertyAge: null,
  licenseNumber: null, falLicenseNumber: null, advertisementNumber: null, contactNumber: null, description: null,
  lengths: null, planNumber: null, blockNumber: null, plotNumber: null, ownerName: null, clientName: null, technicalRequirements: null,
  builtUpArea: null, floors: null, basementFloors: null, parkingPerBasement: null, parkingTotal: null, rentalOfferAmount: null,
  occupancyStatus: null, finishing: null, conversionPotential: null, transferTaxNote: null,
  missingFields: [], confidence: 0,
};

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };

export const propertyJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    recordType: { type: 'string', enum: recordTypes, description: 'offer for property being offered; request for a client need.' },
    transactionType: { type: ['string', 'null'], enum: [...transactionTypes, null], description: 'sale, rent, buy, or rent_request only from explicit intent.' },
    propertyType: { type: ['string', 'null'], enum: [...propertyTypes, null] },
    customPropertyType: { ...nullableString, description: 'Original visible property phrase for compound, dual, plural, or other types, such as مبنى مكتبي, برجين, شقتين, فلتين, عمارتين.' },
    category: { type: ['string', 'null'], enum: [...propertyCategories, null] },
    city: { ...nullableString }, districts: { type: 'array', items: { type: 'string' }, description: 'All explicitly mentioned districts.' },
    area: { ...nullableNumber, description: 'Exact area only.' }, minimumArea: { ...nullableNumber }, maximumArea: { ...nullableNumber },
    streetWidth: { ...nullableNumber }, facade: { ...nullableString }, facades: { type: 'array', items: { type: 'string' } },
    price: { ...nullableNumber, description: 'Total selling/rental limit price, never price per meter.' },
    priceBid: { ...nullableNumber, description: 'Explicit soum/bid price.' }, maximumBudget: { ...nullableNumber, description: 'Maximum request budget.' },
    pricePerMeter: { ...nullableNumber, description: 'Explicit offer price per square meter.' }, targetPricePerMeter: { ...nullableNumber },
    priceType: { type: ['string', 'null'], enum: [...priceTypes, null] }, bedrooms: { ...nullableInteger }, minimumBedrooms: { ...nullableInteger }, bathrooms: { ...nullableInteger },
    propertyAge: { ...nullableNumber, description: 'Exact age in years; 0 when explicitly new.' }, maximumPropertyAge: { ...nullableNumber },
    licenseNumber: { ...nullableString, description: 'Legacy ad license fallback.' }, falLicenseNumber: { ...nullableString }, advertisementNumber: { ...nullableString },
    contactNumber: { ...nullableString }, description: { ...nullableString, description: 'Faithful concise Arabic summary retaining uncategorized facts.' },
    lengths: { ...nullableString }, planNumber: { ...nullableString }, blockNumber: { ...nullableString }, plotNumber: { ...nullableString },
    ownerName: { ...nullableString }, clientName: { ...nullableString }, technicalRequirements: { ...nullableString },
    builtUpArea: { ...nullableNumber, description: 'Total built-up construction area / المسطحات البنائية.' },
    floors: { ...nullableInteger, description: 'Number of above-ground floors.' },
    basementFloors: { ...nullableInteger, description: 'Number of basement parking floors.' },
    parkingPerBasement: { ...nullableInteger, description: 'Parking capacity per basement floor.' },
    parkingTotal: { ...nullableInteger, description: 'Total parking capacity.' },
    rentalOfferAmount: { ...nullableNumber, description: 'Explicit rental offer amount when the property is for sale but there is a rental offer.' },
    occupancyStatus: { ...nullableString, description: 'Occupancy/rental status such as غير مؤجر حالياً.' },
    finishing: { ...nullableString, description: 'Finishing/readiness condition such as تشطيب فاخر وجاهز للاستخدام.' },
    conversionPotential: { ...nullableString, description: 'Explicit alternate use potential such as التحويل إلى فندق فاخر أو مقر رئيسي للشركات.' },
    transferTaxNote: { ...nullableString, description: 'Explicit note about real-estate transaction tax/disposition requirements.' },
    missingFields: { type: 'array', items: { type: 'string' } }, confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['recordType', 'transactionType', 'propertyType', 'customPropertyType', 'category', 'city', 'districts', 'area', 'minimumArea', 'maximumArea', 'streetWidth', 'facade', 'facades', 'price', 'priceBid', 'maximumBudget', 'pricePerMeter', 'targetPricePerMeter', 'priceType', 'bedrooms', 'minimumBedrooms', 'bathrooms', 'propertyAge', 'maximumPropertyAge', 'licenseNumber', 'falLicenseNumber', 'advertisementNumber', 'contactNumber', 'description', 'lengths', 'planNumber', 'blockNumber', 'plotNumber', 'ownerName', 'clientName', 'technicalRequirements', 'builtUpArea', 'floors', 'basementFloors', 'parkingPerBasement', 'parkingTotal', 'rentalOfferAmount', 'occupancyStatus', 'finishing', 'conversionPotential', 'transferTaxNote', 'missingFields', 'confidence'],
} as const;
