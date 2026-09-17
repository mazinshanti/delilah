const WESTERN_ARABIC='٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC='۰۱۲۳۴۵۶۷۸۹';
const AMOUNT='(?:[0-9]{1,3}(?:[,٬،.][0-9]{3}){1,2}|[0-9]{4,7}|[0-9]{1,4}(?:\\.[0-9]+)?)';

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
    raw=raw.replace(/,/g,'.').replace(/٬/g,'.').replace(/،/g,'.').replace(/\s+/g,'');
    const n=Number(raw);
    const price=Math.round(n*1000);
    return validPrice(price)?price:null;
  }
  raw=raw.replace(/[,.٬،\s]/g,'');
  const n=Number(raw);
  return validPrice(n)?Math.round(n):null;
}

function result(price,source,evidence,confidence='high'){
  return price?{price,source,confidence,price_sar:price,price_type:'cash',price_confidence:confidence,source_price_raw:String(evidence||'').trim().slice(0,120),evidence:String(evidence||'').trim().slice(0,120)}:null;
}

function contextLooksLikeMileage(input,start,end){
  const before=input.slice(Math.max(0,start-28),start);
  const after=input.slice(end,Math.min(input.length,end+20));
  return /(?:mileage|odometer|ممشى|الممشى|عداد|العداد|ماشي|كيلو|كم)\s*[:：-]?\s*$/i.test(before)||/^\s*(?:km\b|kilomet(?:er|re)s?\b|كم|كيلو)/i.test(after);
}

function unsafeAmount(input,m){
 const start=m.index||0,end=start+m[0].length;
 const before=input.slice(Math.max(0,start-65),start),after=input.slice(end,end+40);
 const bad=/(?:monthly|installment|down payment|deposit|financing|vat|tax|old price|was|phone|tel|قسط|اقساط|أقساط|شهري|دفعة|دفعه|مقدم|تمويل|ضريب[ةه]|قبل الخصم|السعر السابق|جوال|هاتف|واتساب)/i;
 // Restrict context to the closest label; a separately labelled cash price is valid.
 const explicitCash=/(?:cash|نقد[اي]|كاش)/i.test(m[0]);
 if(!explicitCash&&(bad.test(before.split(/[؛;.!؟]/).pop())||/^\s*(?:شهري|قسط|دفعة|monthly|installment|VAT)/i.test(after)))return true;
 return contextLooksLikeMileage(input,start,end);
}

export function extractHarajPrice(text='',opts={}){
  const input=normalizeHarajDigits(text).replace(/&rlm;|&lrm;|&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
  if(!input)return null;

  const labelled=new RegExp(`(?:cash\\s*price|سعر\\s*الكاش|السعر\\s*نقدا|السعر\\s*النهائي|السعر|سعرها|سعره|المطلوب|الحد|price)\\s*(?:هو\\s*)?(?:[:：=\\-–—]\\s*)?(${AMOUNT})\\s*(ألف|الف|آلاف|الاف|k)?(?=\\s*(?:ريال|ر\\.?\\s*س|sar|﷼|،|,|\\.|-|–|—|$|\\s))`,'ig');
  for(const m of input.matchAll(labelled)){
    const price=amountFromToken(m[1],m[2]);
    if(price&&price!==Number(opts.year)&&!unsafeAmount(input,m))return result(price,'haraj_text_price_label',m[0]);
  }

  const wanted=new RegExp(`(?:ابغى|أبغى|ابي|أبي|طالب|اطلب|أطلب)\\s*(?:في\\s*(?:السياره|السيارة)\\s*)?(${AMOUNT})\\s*(ألف|الف|آلاف|الاف|k)(?=\\s|$)`,'ig');
  for(const m of input.matchAll(wanted)){
    const price=amountFromToken(m[1],m[2]);
    if(price&&price!==Number(opts.year)&&!unsafeAmount(input,m))return result(price,'haraj_text_asking_phrase',m[0]);
  }

  const currency=new RegExp(`(${AMOUNT})\\s*(?:ريال(?:\\s*سعودي)?|ر\\.?\\s*س|sar|﷼)(?=\\s|$|[،,.])`,'ig');
  for(const m of input.matchAll(currency)){
    const price=amountFromToken(m[1]);
    if(price&&price!==Number(opts.year)&&!unsafeAmount(input,m))return result(price,'haraj_text_currency_amount',m[0]);
  }

  const formatted=/(?:^|\s)([1-9][0-9]{0,2}(?:[,٬،.][0-9]{3}){1,2})(?=\s|$)/g;
  for(const m of input.matchAll(formatted)){
    const token=m[1],start=(m.index||0)+m[0].indexOf(token),end=start+token.length;
    if(contextLooksLikeMileage(input,start,end)||unsafeAmount(input,m))continue;
    const price=amountFromToken(token);
    if(price&&price!==Number(opts.year)&&!unsafeAmount(input,m))return result(price,'haraj_search_card_formatted_price',token,'medium-high');
  }

  return null;
}
