const num = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const median = values => {
  const xs = values.map(num).filter(Boolean).sort((a,b)=>a-b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();

export function comparableListings(listings = [], vehicle = {}) {
  const make = norm(vehicle.make || vehicle.brand);
  const model = norm(vehicle.model);
  const year = num(vehicle.year);
  return listings.filter(listing => {
    const text = norm([listing.make, listing.brand, listing.model, listing.title, listing.snippet].filter(Boolean).join(' '));
    const listingYear = num(listing.year);
    const price = num(listing.priceSar ?? listing.price);
    if (!price) return false;
    if (make && !text.includes(make)) return false;
    if (model && !text.includes(model)) return false;
    if (year && listingYear && listingYear !== year) return false;
    if (year && !listingYear && !text.includes(String(year))) return false;
    return true;
  });
}

export function buildMarketValuation(listings = [], vehicle = {}) {
  const comps = comparableListings(listings, vehicle);
  const prices = comps.map(x => num(x.priceSar ?? x.price)).filter(Boolean);
  const marketMedianPriceSar = median(prices);
  if (!marketMedianPriceSar || prices.length < 3) {
    return {
      available: false,
      comparableCount: prices.length,
      marketMedianPriceSar: null,
      suggestedLowSar: null,
      suggestedHighSar: null,
      reason: 'insufficient-comparables'
    };
  }
  const rounded = Math.round(marketMedianPriceSar / 500) * 500;
  return {
    available: true,
    comparableCount: prices.length,
    marketMedianPriceSar: rounded,
    suggestedLowSar: Math.round((rounded * 0.96) / 500) * 500,
    suggestedHighSar: Math.round((rounded * 1.04) / 500) * 500,
    minComparableSar: Math.min(...prices),
    maxComparableSar: Math.max(...prices)
  };
}
