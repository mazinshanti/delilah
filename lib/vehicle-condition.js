// Source evidence only. Request condition, vehicle year and zero mileage are not evidence.
export function resolveCondition(car={}){
 const text=String([car.title,car.description,car.snippet].filter(Boolean).join(' ')).toLowerCase();
 const mileage=car.mileage_km??car.mileageKm??car.mileage;
 const seller=String(car.seller_type||car.sellerType||'').toLowerCase();
 if((mileage!=null&&Number(mileage)>100)||/^(private|owner|individual)$/.test(seller)||/\bused\b|pre[- ]owned|مستعمل[ةه]?/.test(text))return 'used';
 const sourceCondition=String(car.sourceCondition||'').toLowerCase();
 if(['new','used'].includes(sourceCondition))return sourceCondition;
 const cleaned=text.replace(/(?:like|as)\s+new|بحال[ةه]\s*(?:الوكال[ةه]|الجديد)|وكأنها جديد[ةه]?|كالجديد[ةه]?|(?:كفرات|بطارية|بطاريه|اطارات|إطارات|تواير)\s*جديد[ةه]?/g,'');
 const positive=/(?:حالة\s*السيار[ةه]\s*[:：]?\s*وكال[ةه])|\bbrand new\b|\bcondition\s*:?\s*new\b|(?:السيارة|سيارة|السياره)\s*(?:جديد[ةه]|زيرو)|غير\s*مستخدم[ةه]?|(?:^|\s)زيرو(?:\s|$)/.test(cleaned);
 if(positive)return 'new';
 // Old Haraj classifications were sometimes copied from the requested tab.
 if(/^haraj$/i.test(car.source||car.seller||''))return car.condition==='used'?'used':'unknown';
 return ['new','used'].includes(car.condition)?car.condition:'unknown';
}
