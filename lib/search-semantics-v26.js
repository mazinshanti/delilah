export const digits = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
export const norm = s => digits(s).toLowerCase().normalize('NFKD')
  .replace(/[\u064b-\u065f\u0670]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();

export function years(q = '') {
  return [...digits(q).matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map(m => Number(m[1])).filter(y => y >= 1980 && y <= 2035);
}
export function rangeDirection(q = '') {
  const x = norm(q);
  if (/(?:and above|or newer|and newer|or later|above|from|since|after|وفوق|واكثر|اكثر|فاحدث|احدث|بعد)/i.test(x)) return 'min';
  if (/(?:and below|or older|and older|or earlier|below|before|وتحت|واقل|اقل|فاقدم|اقدم|قبل)/i.test(x)) return 'max';
  if (/(?:\bto\b|through|until|between|الى|الي|حتى|بين)/i.test(x)) return 'range';
  return null;
}
export function exactYear(q = '') {
  const ys = years(q), dir = rangeDirection(q);
  return ys.length === 1 && !dir ? ys[0] : null;
}
export function yearBounds(q = '') {
  const ys = years(q), dir = rangeDirection(q);
  if (!ys.length) return { minYear: null, maxYear: null, exactYear: null };
  if (ys.length === 1) {
    if (dir === 'min') return { minYear: ys[0], maxYear: null, exactYear: null };
    if (dir === 'max') return { minYear: null, maxYear: ys[0], exactYear: null };
    return { minYear: ys[0], maxYear: ys[0], exactYear: ys[0] };
  }
  return { minYear: Math.min(...ys), maxYear: Math.max(...ys), exactYear: null };
}

const ALIASES = new Map([
  ['تويوتا','toyota'],['نيسان','nissan'],['جيب','jeep'],['هيونداي','hyundai'],['كيا','kia'],['فورد','ford'],['شفروليه','chevrolet'],['شيفروليه','chevrolet'],['مرسيدس','mercedes'],['لكزس','lexus'],['بورش','porsche'],['مازدا','mazda'],['هوندا','honda'],['ميتسوبيشي','mitsubishi'],['جيلي','geely'],['شانجان','changan'],['جيتور','jetour'],['هافال','haval'],['اودي','audi'],['جينيسيس','genesis'],['فولكس','volkswagen'],['بي ام دبليو','bmw'],['بي ام','bmw'],['لاند روفر','land rover'],['رينج روفر','range rover'],['كاديلاك','cadillac'],['جي ام سي','gmc'],['دودج','dodge'],['سوزوكي','suzuki'],['بيجو','peugeot'],['رينو','renault'],['شيري','chery'],['تسلا','tesla'],['لوسيد','lucid'],['بي واي دي','byd'],
  ['رانجلر','wrangler'],['باترول','patrol'],['لاندكروزر','land cruiser'],['لاند كروزر','land cruiser'],['كامري','camry'],['كورولا','corolla'],['يارس','yaris'],['صني','sunny'],['توسان','tucson'],['سبورتاج','sportage'],['تاهو','tahoe'],['سوناتا','sonata'],['اكسنت','accent'],['النترا','elantra'],['برادو','prado'],['فورتشنر','fortuner'],['اكسبلورر','explorer'],['جراند شيروكي','grand cherokee'],['كايين','cayenne'],['تيجوان','tiguan'],['بيجاس','pegas'],['سيراتو','cerato'],['سورينتو','sorento']
]);
const STOP = new Set(norm('ابي ابغى اريد سيارة سياره سيارات car cars vehicle vehicles used new مستعمل مستعمله مستعملة جديد جديده جديدة موديل model سنة سنه year years وفوق واكثر تحت اقل من في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام بالخبر الخبر بمكة بمكه مكة مكه بالمدينة بالمدينه المدينة المدينه السعودية السعوديه saudi arabia ksa in at with near around riyadh jeddah dammam khobar makkah madinah under below less than above over more than around about budget ريال sar km كيلو كم الف ألف للبيع for sale suv sedan pickup coupe hatchback van electric hybrid').split(' '));
export function canonicalText(s = '') {
  let x = ` ${norm(s)} `;
  for (const [a, b] of [...ALIASES.entries()].sort((m, n) => n[0].length - m[0].length)) x = x.replaceAll(` ${norm(a)} `, ` ${b} `);
  return x.replace(/\s+/g, ' ').trim();
}
export function queryTerms(q = '') {
  const x = canonicalText(q);
  return [...new Set(x.split(' ').filter(t => t.length >= 2 && !STOP.has(t) && !/^\d+(?:\.\d+)?k?$/.test(t)))].slice(0, 6);
}
export function identityMatches(c, q) {
  const terms = queryTerms(q); if (!terms.length) return true;
  const text = canonicalText(`${c.brand || ''} ${c.model || ''} ${c.title || ''} ${c.snippet || ''}`);
  return terms.every(t => text.includes(t));
}
