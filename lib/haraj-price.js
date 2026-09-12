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

function result(price,source,evidence,confidence='high'){
  return price?{price,source,confidence,evidence:String(evidence||'').trim().slice(0,120)}:null;
}

function contextLooksLikeMileage(input,start,end){
  const before=input.slice(Math.max(0,start-28),start);
  const after=input.slice(end,Math.min(input.length,end+20));
  return /(?:ممشى|الممشى|عداد|العداد|ماشي|كيلو|كم)\s*[:：-]?\s*$/i.test(before)||/^\s*(?:كم|كيلو)/i.test(after);
}

export function extractHarajPrice(text='',opts={}){
  const input=normalizeHarajDigits(text).replace(/&rlm;|&lrm;|&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
  if(!input)return null;

  // Highest-confidence Haraj pattern: sellers explicitly write "السعر 29000".
  const labelled=/(?:السعر\s*النهائي|السعر|سعرها|سعره|المطلوب|الحد)\s*(?:هو\s*)?(?:[:：=\-–—]\s*)?([0-9][0-9\s,.٬،]*?(?:\.[0-9]+)?)\s*(ألف|الف|آلاف|الاف|k)?(?=\s*(?:ريال|ر\.?\s*س|sar|﷼|،|,|\.|-|–|—|$|\s))/ig;
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

  // Currency-labelled amounts are safe even when السعر is omitted.
  const currency=/\b([0-9][0-9\s,.٬،]{3,12})\s*(?:ريال(?:\s*سعودي)?|ر\.?\s*س|sar|﷼)\b/ig;
  for(const m of input.matchAll(currency)){
    const price=amountFromToken(m[1]);
    if(price&&price!==Number(opts.year))return result(price,'haraj_text_currency_amount',m[0]);
  }

  // Haraj search cards frequently render only a formatted number (e.g. 24,998).
  // Only accept clearly thousands-formatted values and reject mileage/odometer context.
  const formatted=/(?:^|\s)([1-9][0-9]{0,2}(?:[,٬،.][0-9]{3}){1,2})(?=\s|$)/g;
  for(const m of input.matchAll(formatted)){
    const token=m[1],start=(m.index||0)+m[0].indexOf(token),end=start+token.length;
    if(contextLooksLikeMileage(input,start,end))continue;
    const price=amountFromToken(token);
    if(price&&price!==Number(opts.year))return result(price,'haraj_search_card_formatted_price',token,'medium-high');
  }

  return null;
}
