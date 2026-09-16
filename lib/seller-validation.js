const text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim():'';
const digits=v=>String(v??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
export function normalizeSellerInput(input={}){
 const out={};for(const key of ['sellerName','sellerPhone','sellerEmail','make','model','trim','city','description','vin','requestId'])out[key]=text(input[key]);
 out.sellerPhone=digits(out.sellerPhone).replace(/[\s-]/g,'').replace(/^05/,'+9665').replace(/^966/,'+966');
 for(const key of ['year','mileageKm','askingPriceSar']){const v=digits(input[key]).replace(/[,٬]/g,'').trim();out[key]=v===''?null:/^\d+(?:\.\d+)?$/.test(v)?Number(v):NaN;}
 out.consent=input.consent===true;out.consentVersion='dalelah-sell-v2';out.photos=input.photos??[];return out;
}
export function validateSellerInput(input={}){
 const v=normalizeSellerInput(input),errors=[];
 for(const [key,max] of Object.entries({sellerName:100,make:80,model:100,city:80}))if(!v[key]||v[key].length>max)errors.push(key);
 if(!/^\+9665\d{8}$/.test(v.sellerPhone))errors.push('sellerPhone');
 if(v.sellerEmail&&(v.sellerEmail.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(v.sellerEmail)))errors.push('sellerEmail');
 if(!Number.isInteger(v.year)||v.year<1900||v.year>new Date().getFullYear()+1)errors.push('year');
 for(const [k,max] of [['mileageKm',3000000],['askingPriceSar',100000000]])if(v[k]!=null&&(!Number.isFinite(v[k])||v[k]<0||v[k]>max))errors.push(k);
 if(v.description.length>4000)errors.push('description');if(v.trim.length>100)errors.push('trim');
 if(v.vin&&!/^[A-HJ-NPR-Z0-9]{17}$/i.test(v.vin))errors.push('vin');
 if(!v.consent)errors.push('consent');
 if(v.requestId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId))errors.push('requestId');
 if(!Array.isArray(v.photos)||v.photos.length>10)errors.push('photos');
 return{ok:!errors.length,errors,value:v};
}
