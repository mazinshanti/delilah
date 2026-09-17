import {classifyVehicle,recordClassification} from './vehicle-classification.js';
import {extractMileage} from './vehicle-mileage.js';
import {resolveCondition} from './vehicle-condition.js';
import {vehicleImages} from '../public/vehicle-media.js';
const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const nullableText = (value) => {
  const v = text(value);
  return v || null;
};
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const bool = (value) => value === true;
const cleanUrl = (value) => {
  const raw = nullableText(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href.replace(/\/$/, '');
  } catch {
    return raw;
  }
};
const unique = (values = []) => [...new Set(values.map(nullableText).filter(Boolean))];
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '');
const sourceImage = (value,source) => {
  if(typeof value!=='string'||source!=='Syarah')return value;
  try{const u=new URL(value);if(u.hostname==='cdn.syarah.com'&&/^\/photos-thumbs\/online-v1\/0x(?:99|300|426)\//.test(u.pathname))u.pathname=u.pathname.replace(/^\/photos-thumbs\/online-v1\/0x(?:99|300|426)\//,'/photos-thumbs/online-v1/0x683/');return u.href}catch{return value}
};

export const TRUST_LEVELS = Object.freeze({
  RAW: 'raw',
  VERIFIED: 'verified',
  INSPECTED: 'inspected',
  CERTIFIED: 'certified'
});

export function deriveTrustLevel(trust = {}) {
  const inspectionPassed = trust.inspectionStatus === 'passed';
  const historyVerified = trust.historyStatus === 'verified';
  const sellerVerified = bool(trust.sellerVerified);
  const warrantyMonths = numberOrNull(trust.warrantyMonths) || 0;

  if (inspectionPassed && historyVerified && sellerVerified && warrantyMonths > 0) return TRUST_LEVELS.CERTIFIED;
  if (inspectionPassed) return TRUST_LEVELS.INSPECTED;
  if (historyVerified || sellerVerified) return TRUST_LEVELS.VERIFIED;
  return TRUST_LEVELS.RAW;
}

export function normalizeInventoryListing(input = {}, context = {}) {
  const source = nullableText(input.source || input.marketplace || input.seller || context.source) || 'Unknown';
  const sourceType = nullableText(input.sourceType || context.sourceType) || 'marketplace';
  const originalUrl = cleanUrl(input.source_url || input.originalUrl || input.url || input.listingUrl);
  const verdict=classifyVehicle(input);
  if(context.recordMetrics)recordClassification(source,verdict);
  const make = verdict.classification==='VEHICLE_FOR_SALE'?verdict.identity.make:nullableText(input.make || input.brand);
  const model = verdict.classification==='VEHICLE_FOR_SALE'?(verdict.identity.model||nullableText(input.model)):nullableText(input.model);
  const year = numberOrNull(input.year);
  const mileageKm = numberOrNull(input.mileage_km ?? input.mileageKm ?? input.mileage ?? extractMileage([input.title,input.description,input.snippet].filter(Boolean).join(" ")));
  const priceSar = ['installment','contact'].includes(input.price_type)?null:numberOrNull(Object.hasOwn(input,'price')?input.price:input.price_sar??input.priceSar);
  const condition = resolveCondition({...input,mileage:mileageKm});

  const trustInput = {
    sellerVerified: bool(input.sellerVerified ?? input.trust?.sellerVerified),
    inspectionStatus: nullableText(input.inspectionStatus ?? input.trust?.inspectionStatus),
    inspectionScore: numberOrNull(input.inspectionScore ?? input.trust?.inspectionScore),
    inspectionProvider: nullableText(input.inspectionProvider ?? input.trust?.inspectionProvider),
    inspectionDate: nullableText(input.inspectionDate ?? input.trust?.inspectionDate),
    historyStatus: nullableText(input.historyStatus ?? input.trust?.historyStatus),
    historyProvider: nullableText(input.historyProvider ?? input.trust?.historyProvider),
    warrantyMonths: numberOrNull(input.warrantyMonths ?? input.trust?.warrantyMonths),
    returnDays: numberOrNull(input.returnDays ?? input.trust?.returnDays)
  };
  const trustLevel = deriveTrustLevel(trustInput);

  const sellerName = nullableText(input.sellerName || input.dealer || input.sellerDetails?.name || input.seller);
  const city = nullableText(input.city || input.location?.city);
  const branch = nullableText(input.branch || input.location?.branch);
  const sourceListingId = nullableText(input.source_listing_id || input.sourceListingId || input.listingId || input.id);
  const inventoryId = nullableText(input.inventoryId)
    || [slug(source), slug(sourceListingId || originalUrl || `${make || 'car'}-${model || ''}-${year || ''}-${city || ''}`)].filter(Boolean).join(':');

  const sourceGallery=input.gallery_images||input.images||[];
  const images = vehicleImages({...input,images:(Array.isArray(sourceGallery)?sourceGallery:[sourceGallery]).map(v=>sourceImage(v,source)),image:sourceImage(input.primary_image||input.image,source)});

  const title = nullableText(input.title) || [year, make, model, input.trim].filter(Boolean).join(' ') || 'Vehicle';
  const now = new Date().toISOString();

  return {
    ...input,
    vehicle_classification: verdict.classification,
    normalized_make: verdict.identity.makeKey,
    normalized_model: verdict.identity.modelKey,
    currency: input.currency || "SAR",
    body_type: input.body_type || input.bodyType || null,
    fuel_type: input.fuel_type || input.fuelType || null,
    id: inventoryId,
    source_listing_id: sourceListingId,
    listing_id: sourceListingId,
    source_url: originalUrl,
    mileage_km: mileageKm,
    price_sar: priceSar,
    price_type: input.price_type || (priceSar>0 ? "cash" : "unknown"),
    price_confidence: input.price_confidence || input.priceConfidence || (input.priceVerified ? "high" : "unknown"),
    source_price_raw: input.source_price_raw || input.priceEvidence || null,
    seller_type: input.seller_type || input.sellerType || null,
    primary_image: images[0] || null,
    gallery_images: images,
    description: input.description || input.snippet || null,
    created_at: input.created_at || input.firstSeenAt || now,
    updated_at: input.updated_at || input.updatedAt || now,
    inventoryId,
    source,
    sourceName: source,
    sourceAttribution: source,
    seller: sellerName || source,
    sourceType,
    url: originalUrl,
    originalUrl,
    title,
    make,
    brand: make,
    model,
    trim: nullableText(input.trim || input.variant),
    year,
    condition,
    price: priceSar,
    priceSar,
    mileage: mileageKm,
    mileageKm,
    city,
    image: images[0] || null,
    displayImage: images[0] || null,
    images,
    vehicle: {
      vin: nullableText(input.vin),
      make,
      model,
      trim: nullableText(input.trim || input.variant),
      year,
      condition,
      bodyType: nullableText(input.bodyType || input.body_type),
      transmission: nullableText(input.transmission || input.gearbox),
      fuelType: nullableText(input.fuelType || input.fuel_type || input.fuel),
      drivetrain: nullableText(input.drivetrain || input.driveType || input.drive_type),
      engine: nullableText(input.engine || input.engineSize || input.engine_size),
      exteriorColor: nullableText(input.exteriorColor || input.exterior_color || input.color),
      mileageKm
    },
    sellerDetails: {
      id: nullableText(input.sellerId),
      name: sellerName,
      type: nullableText(input.sellerType) || (sourceType === 'dealer-feed' ? 'dealer' : null),
      verified: trustInput.sellerVerified,
      branch,
      city
    },
    commercial: {
      priceSar,
      vatIncluded: input.vatIncluded === true ? true : input.vatIncluded === false ? false : null,
      negotiable: input.negotiable === true ? true : input.negotiable === false ? false : null,
      financeAvailable: input.financeAvailable === true ? true : input.financeAvailable === false ? false : null,
      monthlyPaymentSar: numberOrNull(input.monthlyPaymentSar)
    },
    trust: {
      level: trustLevel,
      ...trustInput
    },
    location: {
      city,
      branch,
      latitude: numberOrNull(input.latitude ?? input.location?.latitude),
      longitude: numberOrNull(input.longitude ?? input.location?.longitude)
    },
    media: {
      primaryImage: images[0] || null,
      images
    },
    availability: nullableText(input.availability) || 'unknown',
    provenance: {
      source,
      sourceType,
      sourceListingId,
      ingestionMethod: nullableText(input.ingestionMethod || context.ingestionMethod),
      originalUrl,
      evidence: unique(Array.isArray(input.evidence) ? input.evidence : [])
    },
    firstSeenAt: nullableText(input.firstSeenAt) || now,
    lastSeenAt: nullableText(input.lastSeenAt) || now,
    updatedAt: nullableText(input.updatedAt) || now
  };
}

export function normalizeInventoryBatch(listings = [], context = {}) {
  const byId = new Map();
  for (const raw of listings) {
    const listing = normalizeInventoryListing(raw, context);
    const key = listing.vehicle.vin || listing.originalUrl || listing.inventoryId;
    if (!key) continue;
    const old = byId.get(key);
    if (!old) {
      byId.set(key, listing);
      continue;
    }
    byId.set(key, {
      ...old,
      ...listing,
      media: {
        primaryImage: listing.media.primaryImage || old.media.primaryImage,
        images: unique([...(old.media.images || []), ...(listing.media.images || [])])
      },
      trust: old.trust.level === TRUST_LEVELS.CERTIFIED ? old.trust : listing.trust
    });
  }
  return [...byId.values()];
}
