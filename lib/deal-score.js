const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function scoreDeal({ priceSar, marketMedianPriceSar, comparableCount = 0 } = {}) {
  const price = num(priceSar);
  const median = num(marketMedianPriceSar);
  const comps = num(comparableCount) || 0;

  if (!price || !median || median <= 0 || comps < 3) {
    return {
      available: false,
      grade: null,
      score: null,
      priceDeltaPct: null,
      comparableCount: comps,
      reason: comps < 3 ? 'insufficient-comparables' : 'missing-price-data'
    };
  }

  const deltaPct = ((price - median) / median) * 100;
  let grade = 'fair';
  let score = 60;

  if (deltaPct <= -12) {
    grade = 'great';
    score = 95;
  } else if (deltaPct <= -6) {
    grade = 'good';
    score = 82;
  } else if (deltaPct <= 4) {
    grade = 'fair';
    score = 68;
  } else if (deltaPct <= 10) {
    grade = 'above-market';
    score = 45;
  } else {
    grade = 'high';
    score = 25;
  }

  return {
    available: true,
    grade,
    score,
    priceDeltaPct: Math.round(deltaPct * 10) / 10,
    comparableCount: comps,
    marketMedianPriceSar: Math.round(median),
    priceSar: Math.round(price)
  };
}

export function attachDealScore(listing = {}, market = {}) {
  const deal = scoreDeal({
    priceSar: listing.priceSar ?? listing.price,
    marketMedianPriceSar: market.marketMedianPriceSar,
    comparableCount: market.comparableCount
  });
  return { ...listing, deal };
}
