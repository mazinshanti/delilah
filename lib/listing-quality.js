import {normalizeSearchText} from './search-relevance.js';

const STRONG_NON_VEHICLE = /(?:قطع\s*غيار|اكسسوار(?:ات)?|إكسسوار(?:ات)?|تشليح|للتشليح|مسجل|ستيريو|شاش[هة]\s*(?:سيار|اندرويد|أندرويد|وكال)|spare\s*parts?|accessor(?:y|ies)|stereo|head\s*unit)/i;
const NON_SALE = /(?:^|\s)(?:مطلوب|ابحث\s*عن|أبحث\s*عن|شراء\s*سيارات?|نشتري\s*سيارات?|للايجار|للإيجار|تاجير|تأجير|نقل\s*سيارات?|سطح[هة]|فحص\s*سيارات?|ورش[هة]|صيان[هة]|تصليح|برمج[هة]|تلميع|wanted|looking\s+for|car\s+wash|repair|workshop|rental|for\s+rent)(?:\s|$)/i;
const PART_LED_TITLE = /^(?:عداد|طبلون|باب|كبوت|رفرف|مكين[هة]|محرك|قير|جير|دركسون|مقعد|مقاعد|زجاج|ديكور|تحكم\s*مكيف|صدام|شبك|شم(?:ع[هة]|عات)|كشاف(?:ات)?|اصطب|اسطب|ايرباق|ارباق|كمبروسر|دينمو|رديتر|راديتر|طرمب[هة]|حساس(?:ات)?|فلتر|مراي[هة]|مرآة|جنوط|كفرات|bumper|headlight|taillight|radiator|compressor|alternator)(?:\s|$)/i;
const ODOMETER_PART = /عداد.{0,80}(?:اصلي|أصلي|وكال[هة]|يركب|تركيب|قطعة|للبيع)/i;

function titleText(car = {}) {
  return normalizeSearchText(car.title || car.name || '');
}

/**
 * Final source-independent boundary for inventory returned to customers.
 * It intentionally evaluates the title more strongly than snippets because
 * legitimate vehicle descriptions often mention repaired or replaced parts.
 */
export function isVehicleSaleListing(car = {}) {
  const title = titleText(car);
  if (!title) return false;
  if (NON_SALE.test(title)) return false;
  if (STRONG_NON_VEHICLE.test(title)) return false;
  if (ODOMETER_PART.test(title)) return false;
  if (PART_LED_TITLE.test(title)) return false;

  const url = String(car.url || car.originalUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return false;
  return true;
}

export function filterVehicleSaleListings(listings = []) {
  return (Array.isArray(listings) ? listings : []).filter(isVehicleSaleListing);
}
