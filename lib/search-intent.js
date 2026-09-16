const normalizeDigits = (value = '') => String(value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

const RANGE_HINTS = /(?:\bfrom\b|\bsince\b|\bafter\b|\bnewer\b|\bor\s+newer\b|\bbefore\b|\bolder\b|\bbetween\b|\bthrough\b|\bto\b|\b(?:19|20)\d{2}\s*(?:plus\b|\+)|من|بعد|احدث|أحدث|فوق|قبل|بين|الى|إلى)/i;

/**
 * A single bare model year means an exact model year.
 * Range language ("from 2013", "2013+", "2013 to 2015", etc.) is not exact.
 */
export function exactYearIntent(query = '') {
  // Peugeot 2008 is a model name, not a year constraint.
  const q = normalizeDigits(query).replace(/(?:peugeot|بيجو)\s+2008\b/ig,'Peugeot');
  const years = [...q.matchAll(/\b((?:19|20)\d{2})\b/g)]
    .map(match => Number(match[1]))
    .filter(year => year >= 1980 && year <= 2035);

  if (years.length !== 1) return null;
  if (RANGE_HINTS.test(q)) return null;
  return years[0];
}

export function hasYearEvidence(car = {}, year = null) {
  if (!year) return true;
  if (car?.harajExactVerified === true || car?.yearVerified === true) return Number(car?.year) === Number(year);
  const text = normalizeDigits(`${car?.title || ''} ${car?.snippet || ''} ${car?.url || ''}`);
  return new RegExp(`(^|\\D)${Number(year)}(\\D|$)`).test(text);
}

export function enforceExactYear(listings = [], year = null, options = {}) {
  if (!year) return Array.isArray(listings) ? listings : [];
  const requireEvidence = options.requireEvidence === true;
  return (Array.isArray(listings) ? listings : []).filter(car => {
    if (Number(car?.year) !== Number(year)) return false;
    return !requireEvidence || hasYearEvidence(car, year);
  });
}
