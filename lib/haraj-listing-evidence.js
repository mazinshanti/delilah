import {extractMileage} from './vehicle-mileage.js';
import {extractHarajPrice} from './haraj-price.js';
import {resolveCondition} from './vehicle-condition.js';
// Decode only scalar fields of the exact public ad in React Router's table.
// Never execute page JavaScript or read a recommendation's vehicle attributes.
export function harajStructuredCar(html,url,title){
 const wanted=new URL(url),matches=[];
 if(wanted.origin!=='https://haraj.com.sa')return null;
 for(const m of String(html).matchAll(/window\.__reactRouterContext\.streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g)){
  try{
   const table=JSON.parse(JSON.parse(m[1]));if(!Array.isArray(table)||table.length>100000)continue;
   const field=(obj,name)=>{if(!obj||Array.isArray(obj)||typeof obj!=='object')return undefined;for(const [key,index]of Object.entries(obj)){if(/^_\d+$/.test(key)&&table[Number(key.slice(1))]===name&&Number.isInteger(index)&&index>=0)return table[index];}};
   for(const entry of table){
    const path=field(entry,'URL');if(typeof path!=='string')continue;
    const ad=new URL(path.startsWith('/')||/^https?:/.test(path)?path:'/'+path,wanted.origin);
    if(ad.origin!==wanted.origin||ad.username||ad.password||ad.pathname.split('/')[1]!==wanted.pathname.split('/')[1]||field(entry,'title')!==title)continue;
    const info=field(entry,'carInfo');
    if(field(info,'carOrRelated')!=='CAR'||field(info,'sellOrWaiver')!=='SELL')continue;
    const year=field(info,'model'),condition=field(info,'condition');
    matches.push({year:Number.isInteger(year)&&year>=1980&&year<=new Date().getFullYear()+1?year:null,condition:condition==='USED'?'used':condition==='NEW'?'new':null});
   }
  }catch{}
 }
 return matches.length===1?matches[0]:null;
}
// Read only the JSON-LD node whose URL identifies this exact ad. Page chrome,
// recommendations and comments must never supply its mileage or asking price.
export function harajListingEvidence(html,url){
 const id=new URL(url).pathname.split('/')[1];let listing=null;
 function walk(v){
  if(!v||typeof v!=='object')return;
  if(['Thing','Product','Car','Vehicle'].includes(v['@type'])&&v.url){try{const u=new URL(v.url,url);if(u.hostname==='haraj.com.sa'&&u.pathname.split('/')[1]===id)listing=v;}catch{}}
  if(!listing)for(const child of Object.values(v))if(child&&typeof child==='object')Array.isArray(child)?child.forEach(walk):walk(child);
 }
 for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 if(!listing)return null;
 const title=String(listing.name||''),description=String(listing.description||''),text=title+' '+description;
 const odometer=listing.mileageFromOdometer;
 const structuredKm=odometer&&/^(KMT|km|kilometer)$/i.test(odometer.unitCode||odometer.unitText||'')&&Number.isInteger(Number(odometer.value))&&Number(odometer.value)>=0&&Number(odometer.value)<=2000000?Number(odometer.value):null;
 const mileage=structuredKm??extractMileage(text);
 const multipleTrims=/(?:بفئات\s*متعددة|بفئات\s*متعدده|جميع\s*الف(?:ئ|ائ|ي|ا)ات|all\s+trims|multiple\s+trims)/i.test(title);
 const priceHit=multipleTrims?null:extractHarajPrice(text,{allowFormatted:false});
 const priceType=priceHit?'cash':/قسط|أقساط|دفعة|installment|monthly/i.test(text)?'installment':/السوم|التواصل|على الخاص|contact|call for price/i.test(text)?'contact':'unknown';
 const structured=harajStructuredCar(html,url,title);
 const jsonCondition=/UsedCondition/.test(listing.itemCondition||'')?'used':/NewCondition/.test(listing.itemCondition||'')?'new':null;
 const conditionConflict=Boolean(jsonCondition&&structured?.condition&&jsonCondition!==structured.condition);
 const sourceCondition=conditionConflict?null:jsonCondition||structured?.condition||null;
 return{title,description,mileage,priceHit,priceType,structuredYear:structured?.year||null,sourceCategory:structured?'cars':null,condition:conditionConflict?'unknown':resolveCondition({source:'Haraj',title,description,mileage,sourceCondition}),sourceCondition};
}
