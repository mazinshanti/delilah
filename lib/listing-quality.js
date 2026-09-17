import {classifyVehicle,recordClassification} from './vehicle-classification.js';
import {normalizeSearchText} from './search-relevance.js';

const STRONG_NON_VEHICLE = /(?:قطع\s*(?:ال)?غيار|اكسسوار(?:ات)?|إكسسوار(?:ات)?|تشليح|للتشليح|مسجل|ستيريو|بودي\s*كت|كت\s*تحويل|شاش[هة]\s*(?:سيار|اندرويد|أندرويد|وكال)|(?:^|\s)(?:عود|عطر|عطور|بخور|فوحان|ساع[هة])(?:\s|$)|spare\s*parts?|accessor(?:y|ies)|stereo|head\s*unit|body\s*kit|conversion\s*kit|perfume|fragrance|watch)/i;
const NON_SALE = /(?:^|\s)(?:مطلوب|ابحث\s*عن|أبحث\s*عن|شراء\s*سيارات?|نشتري\s*سيارات?|للايجار|للإيجار|تاجير|تأجير|نقل\s*سيارات?|سطح[هة]|فحص\s*سيارات?|ورش[هة]|صيان[هة]|تصليح|برمج[هة]|تلميع|wanted|looking\s+for|car\s+wash|repair|workshop|rental|for\s+rent)(?:\s|$)/i;
const PART_LED_TITLE = /^(?:عداد|طبلون|باب|كبوت|رفرف|مكين[هة]|محرك|قير|جير|دركسون|مقعد|مقاعد|زجاج|ديكور|تحكم\s*مكيف|صدام|شبك|شم(?:ع[هة]|عات)|كشاف(?:ات)?|اصطب|اسطب|ايرباق|ارباق|كمبروسر|دينمو|رديتر|راديتر|طرمب[هة]|حساس(?:ات)?|فلتر|مراي[هة]|مرآة|جنط|جنوط|كفرات|مساعد(?:ات)?|مقصات|يايات|body\s*kit|bumper|headlight|taillight|radiator|compressor|alternator|suspension)(?:\s|$)/i;
const ODOMETER_PART = /عداد.{0,80}(?:اصلي|أصلي|وكال[هة]|يركب|تركيب|قطعة|للبيع)/i;
const EXHAUST_PART_TITLE = /^(?:(?:للبيع|بيع)\s+)?(?:وجيه(?:ات)?|جوان(?:ات)?|اقزوز|اكزوز|شكمان(?:ات)?|هدرز|دبات|دب[هة]|exhaust|gaskets?|headers?|manifold)(?:\s|$)/i;
const ACCESSORY_LED_TITLE = /^(?:(?:للبيع|بيع)\s+)?(?:كراسي|كرسي|قواعد|قاعد[هة]|طقم|عمود|عامود|عمدان|عكوس|عكس|دفرنس|طنابير|مضخ[هة]|سويتش|مفتاح|مفاتيح|ازرار|زر|كتاوت|ضفير[هة]|كمبيوتر|شريح[هة]|شاش[هة]|بطاري[هة]|سلف|بواجي|سير|سيور|جلد[هة]?|مروح[هة]|ليات|عادم|ديسك|فحمات|هوبات|غطاء|سبويلر|جناح|تكاي[هة]|تلبيس[هة]|switch|battery|brake\s*pads?)(?:\s|$)/i;

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
  if (EXHAUST_PART_TITLE.test(title)) return false;
  if (ACCESSORY_LED_TITLE.test(title)) return false;

  const url = String(car.url || car.originalUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return false;
  return classifyVehicle(car).classification==='VEHICLE_FOR_SALE';
}

export function filterVehicleSaleListings(listings = []) {
  const rejected={};
  const accepted=(Array.isArray(listings)?listings:[]).filter(car=>{
    const verdict=classifyVehicle(car),keep=isVehicleSaleListing(car);
    if(!keep&&verdict.classification==='VEHICLE_FOR_SALE'){verdict.classification='UNKNOWN';verdict.reason='legacy_sale_boundary';}
    recordClassification(car.source||car.seller,verdict,'validation');
    if(!keep){const key=`${car.source||'Unknown'}:${verdict.classification}:${verdict.reason}`;rejected[key]=(rejected[key]||0)+1;}
    return keep;
  });
  if(Object.keys(rejected).length)console.info(JSON.stringify({event:'vehicle_boundary',evaluated:listings.length,accepted:accepted.length,rejected}));
  return accepted;
}
