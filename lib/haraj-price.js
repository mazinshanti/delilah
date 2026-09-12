const WESTERN_ARABIC='٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC='۰۱۲۳۴۵۶۷۸۹';

export function normalizeHarajDigits(value=''){
  return String(value??'')
    .replace(/[٠-٩]/g,d=>String(WESTERN_ARABIC.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String(EASTERN_ARABIC.indexOf(d)))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');
}

function validPrice(n){
  return Number.isFinite(n)&&n>=5_000&&n<=5_000_000;
}

function amountFromToken(token='',unit=''){
  let raw=normalizeHarajDigits(token).trim();
  if(!raw)return null;
  const thousand=/^(?:الف|ألف|الاف|آلاف|k)$/i.test(String(unit||'').trim());
  if(thousand){
    raw=raw.replace(/,/g,'.').replace(/٬/g,'.').replace(/\s+/g,'');
    const n=Number(raw);
    const price=Math.round(n*1000);
    return validPrice(price)?price:null;
  }
  raw=raw.replace(/[,.٬،\s]/g,'');
  const n=Number(raw);
  return validPrice(n)?Math.round(n):null;
}

function result(price,source,evidence){
  return price?{price,source,confidence:'high',evidence:String(evidence||'').trim().slice(0,120)}:null;
}

export function extractHarajPrice(text='',opts={}){
  const input=normalizeHarajDigits(text).replace(/&rlm;|&lrm;|&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
  if(!input)return null;

  // Highest-confidence Haraj pattern: sellers explicitly write "السعر 29000".
  const labelled=/(?:السعر|السعر\s*النهائي|سعرها|سعره|المطلوب|الحد)\s*(?:هو\s*)?(?:[:：=\-–—]\s*)?([0-9][0-9\s,.٬،]*?(?:\.[0-9]+)?)\s*(ألف|الف|آلاف|الاف|k)?(?=\s*(?:ريال|ر\.?\s*س|sar|﷼|$|،|,|\.|-|–|—|$|\s))/ig;
  for(const m of input.matchAll(labelled)){
    const price=amountFromToken(m[1],m[2]);
    if(price&&price!==Number(opts.year))return result(price,'haraj_text_price_label',m[0]);
  }

  // Common seller phrasing without the literal word السعر: "ابغى 19 الف" / "ابي 25 ألف".
  const wanted=/(?:ابغى|أبغى|ابي|أبي|طالب|اطلب|أطلب)\s*(?:في\s*(?:السياره|السيارة)\s*)?([0-9][0-9\s,.٬،]*(?:\.[0-9]+)?)\s*(ألف|الف|آلاف|الاف|k)\b/ig;
  for(const m of input.matchAll(wanted)){
    const price=amountFromToken(m[1],m[2]);
    if(price&&price!==Number(opts.year))return result(price,'haraj_text_asking_phrase',m[0]);
  }

  // Currency-labelled amounts are also safe enough to import even when السعر is omitted.
  const currency=/\b([0-9][0-9\s,.٬،]{3,12})\s*(?:ريال(?:\s*سعودي)?|ر\.?\s*س|sar|﷼)\b/ig;
  for(const m of input.matchAll(currency)){
    const price=amountFromToken(m[1]);
    if(price&&price!==Number(opts.year))return result(price,'haraj_text_currency_amount',m[0]);
  }

  return null;
}
