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
  const originalUrl = cleanUrl(input.originalUrl || input.url || input.listingUrl);
  const make = nullableText(input.make || input.brand);
  const model = nullableText(input.model);
  const year = numberOrNull(input.year);
  const mileageKm = numberOrNull(input.mileageKm ?? input.mileage);
  const priceSar = numberOrNull(input.priceSar ?? input.price);
  const conditionRaw = text(input.condition || context.condition).toLowerCase();
  const condition = conditionRaw === 'new' ? 'new' : conditionRaw === 'used' ? 'used' : nullableText(conditionRaw);

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
  const sourceListingId = nullableText(input.sourceListingId || input.listingId || input.id);
  const inventoryId = nullableText(input.inventoryId)
    || [slug(source), slug(sourceListingId || originalUrl || `${make || 'car'}-${model || ''}-${year || ''}-${city || ''}`)].filter(Boolean).join(':');

  const images = unique([
    ...(Array.isArray(input.images) ? input.images : []),
    input.image,
    input.displayImage,
    input.primaryImage
  ]).map(cleanUrl).filter(Boolean);

  const title = nullableText(input.title) || [year, make, model, input.trim].filter(Boolean).join(' ') || 'Vehicle';
  const now = new Date().toISOString();

  return {
    id: inventoryId,
    inventoryId,
    source,
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
    vehicle: {
      vin: nullableText(input.vin),
      make,
      model,
      trim: nullableText(input.trim || input.variant),
      year,
      condition,
      bodyType: nullableText(input.bodyType),
      transmission: nullableText(input.transmission),
      fuelType: nullableText(input.fuelType || input.fuel),
      drivetrain: nullableText(input.drivetrain),
      engine: nullableText(input.engine),
      exteriorColor: nullableText(input.exteriorColor || input.color),
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
