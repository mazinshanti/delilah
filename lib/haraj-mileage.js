const WESTERN_ARABIC='٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC='۰۱۲۳۴۵۶۷۸۹';

export function normalizeHarajMileageDigits(value=''){
  return String(value??'')
    .replace(/[٠-٩]/g,d=>String(WESTERN_ARABIC.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String(EASTERN_ARABIC.indexOf(d)))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');
}

function validMileage(n){
  return Number.isFinite(n)&&n>=1&&n<=2_000_000;
}

function amountFromToken(token='',unit=''){
  let raw=normalizeHarajMileageDigits(token).trim();
  if(!raw)return null;
  const thousand=/^(?:الف|ألف|الاف|آلاف|k)$/i.test(String(unit||'').trim());
  if(thousand){
    raw=raw.replace(/,/g,'.').replace(/٬/g,'.').replace(/\s+/g,'');
    const n=Number(raw);
    const mileage=Math.round(n*1000);
    return validMileage(mileage)?mileage:null;
  }
  raw=raw.replace(/[,.٬،\s]/g,'');
  const n=Number(raw);
  return validMileage(n)?Math.round(n):null;
}

function hit(mileage,source,evidence){
  return mileage?{mileage,source,confidence:'high',evidence:String(evidence||'').trim().slice(0,120)}:null;
}

export function extractHarajMileage(text='',opts={}){
  const input=normalizeHarajMileageDigits(text)
    .replace(/&rlm;|&lrm;|&nbsp;|&#160;/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
  if(!input)return null;

  // Most reliable seller phrasing: a mileage/odometer label followed by a number.
  const labelled=/(?:الممشى|ممشى|ممشاها|ممشاه|العداد|عداد|ماشيه|ماشية|ماشي)\s*(?:هو\s*)?(?:[:：=\-–—\/]\s*)?([0-9][0-9\s,.٬،]*?(?:\.[0-9]+)?)\s*(ألف|الف|آلاف|الاف|k)?\s*(?:كم|كيلو(?:متر)?|km)?(?=\s|$|[،,.\-–—])/ig;
  for(const m of input.matchAll(labelled)){
    const mileage=amountFromToken(m[1],m[2]);
    if(mileage&&mileage!==Number(opts.year))return hit(mileage,'haraj_text_mileage_label',m[0]);
  }

  // Explicit distance unit after the number is also strong evidence even without a label.
  const unitDistance=/(?:^|\s)([0-9][0-9\s,.٬،]*?(?:\.[0-9]+)?)\s*(ألف|الف|آلاف|الاف|k)?\s*(?:كم|كيلو(?:متر)?|km)(?=\s|$|[،,.\-–—])/ig;
  for(const m of input.matchAll(unitDistance)){
    const mileage=amountFromToken(m[1],m[2]);
    if(mileage&&mileage!==Number(opts.year))return hit(mileage,'haraj_text_distance_unit',m[0]);
  }

  return null;
}
