import { describe, expect, it } from 'vitest';
import { parsedListingFromServerAI, type ServerPropertyData } from './server-ai';

const saudiRequest: ServerPropertyData = {
  recordType: 'request',
  transactionType: 'buy',
  propertyType: 'residential_land',
  customPropertyType: null,
  category: 'residential',
  city: 'الرياض',
  districts: ['الخليج', 'الياسمين'],
  area: null,
  minimumArea: 400,
  maximumArea: 500,
  streetWidth: 20,
  facade: null,
  facades: ['شمالية', 'شرقية'],
  price: null,
  priceBid: null,
  maximumBudget: 1_500_000,
  pricePerMeter: null,
  targetPricePerMeter: 3_000,
  priceType: 'unknown',
  bedrooms: null,
  minimumBedrooms: 4,
  bathrooms: null,
  propertyAge: null,
  maximumPropertyAge: 10,
  licenseNumber: null,
  falLicenseNumber: '1200005678',
  advertisementNumber: null,
  contactNumber: '0500000000',
  description: 'عميل يبي أرض سكنية في الخليج أو الياسمين.',
  clientName: 'أبو محمد',
  technicalRequirements: 'شارع لا يقل عن 20 متر',
  builtUpArea: null,
  floors: null,
  basementFloors: null,
  parkingPerBasement: null,
  parkingTotal: null,
  rentalOfferAmount: null,
  occupancyStatus: null,
  finishing: null,
  conversionPotential: null,
  transferTaxNote: null,
  missingFields: ['رقم الإعلان العقاري'],
  confidence: 0.94,
};

const officeBuildingOffer: ServerPropertyData = {
  recordType: 'offer',
  transactionType: 'sale',
  propertyType: 'office',
  customPropertyType: 'مبنى مكتبي',
  category: 'commercial',
  city: 'الرياض',
  districts: [],
  area: 4_125,
  minimumArea: null,
  maximumArea: null,
  streetWidth: null,
  facade: null,
  facades: [],
  price: 300_000_000,
  priceBid: null,
  maximumBudget: null,
  pricePerMeter: null,
  targetPricePerMeter: null,
  priceType: 'net',
  bedrooms: null,
  minimumBedrooms: null,
  bathrooms: null,
  propertyAge: null,
  maximumPropertyAge: null,
  licenseNumber: null,
  falLicenseNumber: null,
  advertisementNumber: null,
  contactNumber: null,
  description: 'مبنى مكتبي فاخر في قلب الرياض.',
  technicalRequirements: 'رأس بلك على 4 شوارع',
  builtUpArea: 11_000,
  floors: 9,
  basementFloors: 4,
  parkingPerBasement: 88,
  parkingTotal: 352,
  rentalOfferAmount: 22_000_000,
  occupancyStatus: 'غير مؤجر حالياً',
  finishing: 'تشطيب فاخر وجاهز للاستخدام',
  conversionPotential: 'يصلح للتحويل إلى فندق فاخر أو مقر رئيسي للشركات',
  transferTaxNote: 'الإفراغ لا يشترط التصرفات العقارية',
  missingFields: [],
  confidence: 0.96,
};

describe('Saudi AI field mapping', () => {
  it('places request intent, ranges, preferred facades, budget, and contacts in their matching fields', () => {
    const listing = parsedListingFromServerAI(saudiRequest, 'offer');

    expect(listing.kind).toBe('request');
    expect(listing.status).toBe('buy');
    expect(listing.propertyType).toBe('land');
    expect(listing.category).toBe('residential');
    expect(listing.city).toBe('الرياض');
    expect(listing.district).toBe('الخليج');
    expect(listing.priceAsk).toBe(1_500_000);
    expect(listing.fields).toMatchObject({
      areaMin: 400,
      areaMax: 500,
      minimumBedrooms: 4,
      maxAge: 10,
      targetMeterPrice: 3_000,
      streetWidth: 20,
      preferredDistricts: 'الخليج، الياسمين',
      preferredFrontages: 'شمالية، شرقية',
      technicalRequirements: 'شارع لا يقل عن 20 متر',
    });
    expect(listing.contactName).toBe('أبو محمد');
    expect(listing.contactNumber).toBe('0500000000');
    expect(listing.falLicense).toBe('1200005678');
  });

  it('maps office-building investment details into editable review fields', () => {
    const listing = parsedListingFromServerAI(officeBuildingOffer, 'request');

    expect(listing.kind).toBe('offer');
    expect(listing.status).toBe('for_sale');
    expect(listing.propertyType).toBe('office');
    expect(listing.category).toBe('commercial');
    expect(listing.priceAsk).toBe(300_000_000);
    expect(listing.fields).toMatchObject({
      area: 4_125,
      customPropertyType: 'مبنى مكتبي',
      technicalRequirements: 'رأس بلك على 4 شوارع',
      builtUpArea: 11_000,
      floors: 9,
      basementFloors: 4,
      parkingPerBasement: 88,
      parkingTotal: 352,
      rentalOfferAmount: 22_000_000,
      occupancyStatus: 'غير مؤجر حالياً',
      finishing: 'تشطيب فاخر وجاهز للاستخدام',
      conversionPotential: 'يصلح للتحويل إلى فندق فاخر أو مقر رئيسي للشركات',
      transferTaxNote: 'الإفراغ لا يشترط التصرفات العقارية',
    });
  });
});
