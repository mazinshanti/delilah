import {normalizeInventoryListing} from './inventory-normalizer.js';
import {isVehicleSaleListing} from './listing-quality.js';

const keyOf = row => {
  try {
    const url = new URL(row?.source_url || row?.originalUrl || row?.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const param of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(param) || /^(fbclid|gclid)$/i.test(param)) url.searchParams.delete(param);
    }
    return url.href.replace(/\/$/, '');
  } catch { return null; }
};

/**
 * Incrementally add real source observations to a compressed market snapshot.
 * Never delete unseen inventory: a partial scan is not evidence of a delisting.
 * This pure function never contacts a website or changes production files.
 */
export function mergeInventorySnapshot(existing = {}, incoming = {}, options = {}) {
  const source = String(incoming.source || '').trim();
  if (!source) throw new Error('source-required');
  if (!Array.isArray(incoming.listings)) throw new Error('listings-required');
  if (incoming.listings.length > 10000) throw new Error('batch-too-large');

  const at = String(incoming.scannedAt || options.scannedAt || new Date().toISOString());
  if (!Number.isFinite(Date.parse(at))) throw new Error('invalid-scan-date');
  const original = Array.isArray(existing.listings) ? existing.listings : [];
  const rows = new Map();
  let accepted = 0, updated = 0, rejected = 0;

  for (const item of original) {
    const key = keyOf(item);
    if (key) rows.set(key, item);
  }

  for (const raw of incoming.listings) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { rejected++; continue; }
    if (raw.source && String(raw.source).toLowerCase() !== source.toLowerCase()) {
      rejected++; continue;
    }
    const key = keyOf(raw);
    if (!key) { rejected++; continue; }
    const fresh = normalizeInventoryListing({...raw, source, url:key});
    if (!isVehicleSaleListing(fresh)) { rejected++; continue; }

    const previous = rows.get(key);
    const hasVerifiedPrice=fresh.priceVerified===true && Number.isFinite(Number(fresh.price)) && Number(fresh.price)>0;
    const images=fresh.images?.length ? fresh.images : (previous?.images || []);
    const image=fresh.image || previous?.image || images[0] || null;
    const merged = {
      ...(previous || {}),
      ...fresh,
      // A fresh scan with an unknown asking price must not perpetuate a stale price.
      firstSeenAt: previous?.firstSeenAt || previous?.created_at || at,
      lastSeenAt: at,
      updatedAt: at,
      ...(hasVerifiedPrice ? {} : {
        price:null,priceSar:null,price_sar:null,priceVerified:false,
        priceSource:null,priceEvidence:null,price_confidence:'unknown',
        source_price_raw:null
      }),
      // Keep photo and gallery metadata consistent across the saved and reloaded formats.
      image,displayImage:image,primary_image:image,
      images,gallery_images:images,
      media:{primaryImage:image,images}
    };
    rows.set(key, merged);
    if (previous) updated++; else accepted++;
  }

  const diagnostics = Array.isArray(existing.diagnostics) ? existing.diagnostics : [];
  return {
    snapshot: {
      ...existing,
      generatedAt: at,
      listings: [...rows.values()],
      diagnostics: [...diagnostics.slice(-49), {
        source, scannedAt:at, discovered:incoming.listings.length,
        added:accepted, updated, rejected, preservedOriginal:original.length
      }],
    },
    report: {
      source, scannedAt:at, discovered:incoming.listings.length,
      added:accepted, updated, rejected, original:original.length,
      total:rows.size, // Unique source URLs, not unique physical cars
      deletionPolicy:'preserve-unseen'
    }
  };
}
