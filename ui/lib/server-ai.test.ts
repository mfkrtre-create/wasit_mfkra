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
  missingFields: ['رقم الإعلان العقاري'],
  confidence: 0.94,
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
});
