const WESTERN_ARABIC='٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC='۰۱۲۳۴۵۶۷۸۹';
const AMOUNT='(?:[0-9]{1,3}(?:[,٬،.][0-9]{3}){1,2}|[0-9]{4,7})';

export function normalizeSyarahDigits(value=''){
  return String(value??'')
    .replace(/[٠-٩]/g,d=>String(WESTERN_ARABIC.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String(EASTERN_ARABIC.indexOf(d)))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');
}

function validPrice(n){return Number.isFinite(n)&&n>=1_000&&n<=5_000_000;}
function parseAmount(token=''){
  const raw=normalizeSyarahDigits(token).replace(/[,.٬،\s]/g,'');
  const n=Number(raw);
  return validPrice(n)?Math.round(n):null;
}
function result(price,source,evidence){
  return price?{price,source,confidence:'high',evidence:String(evidence||'').trim().slice(0,160)}:null;
}

export function extractSyarahCashPrice(text=''){
  const input=normalizeSyarahDigits(text)
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/\s+/g,' ')
    .trim();
  if(!input)return null;

  const english=new RegExp(`Cash\\s*Price\\s*(?:\\(\\s*Includes\\s*VAT\\s*\\))?\\s*[:：=\\-–—]?\\s*(${AMOUNT})\\s*(?:SAR|Saudi\\s*Riyals?)`,'i');
  const em=input.match(english);
  if(em){const price=parseAmount(em[1]);if(price)return result(price,'syarah_cash_price_text',em[0]);}

  const arabic=new RegExp(`(?:سعر\\s*الكاش|السعر\\s*النقدي|السعر\\s*كاش)\\s*(?:\\(\\s*شامل\\s*(?:الضريبة|الضريبه)\\s*\\))?\\s*[:：=\\-–—]?\\s*(${AMOUNT})\\s*(?:ريال|ر\\.?\\s*س|SAR)`,'i');
  const am=input.match(arabic);
  if(am){const price=parseAmount(am[1]);if(price)return result(price,'syarah_cash_price_text',am[0]);}

  const description=new RegExp(`(?:priced\\s+at|price(?:d)?\\s+at)\\s*(${AMOUNT})\\s*(?:SAR|Saudi\\s*Riyals?)\\s*(?:including\\s*VAT)?`,'i');
  const dm=input.match(description);
  if(dm){const price=parseAmount(dm[1]);if(price)return result(price,'syarah_detail_description_price',dm[0]);}

  return null;
}
