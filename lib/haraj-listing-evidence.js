import {extractMileage} from './vehicle-mileage.js';
import {extractHarajPrice} from './haraj-price.js';
import {resolveCondition} from './vehicle-condition.js';
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
 const priceHit=extractHarajPrice(text,{allowFormatted:false});
 const priceType=priceHit?'cash':/قسط|أقساط|دفعة|installment|monthly/i.test(text)?'installment':/السوم|التواصل|على الخاص|contact|call for price/i.test(text)?'contact':'unknown';
 const sourceCondition=/UsedCondition/.test(listing.itemCondition||'')?'used':/NewCondition/.test(listing.itemCondition||'')?'new':null;
 return{title,description,mileage,priceHit,priceType,condition:resolveCondition({source:'Haraj',title,description,mileage,sourceCondition}),sourceCondition};
}
