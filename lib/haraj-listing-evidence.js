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
    const price=field(entry,'price'),amount=field(price,'inputPrice'),formatted=field(price,'formattedPrice');
    const askingPrice=typeof amount==='string'&&/^\d{4,7}$/.test(amount)&&Number(amount)>=5000&&Number(amount)<=5000000&&typeof formatted==='string'&&formatted.replace(/[,٬\s]/g,'')===amount?Number(amount):null;
    const refs=field(entry,'imagesList');
    const images=Array.isArray(refs)?refs.map(i=>Number.isInteger(i)&&i>=0?table[i]:null).filter(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^(?:[a-z0-9-]+\.)?haraj\.com\.sa$/.test(u.hostname)&&/^\/userfiles/.test(u.pathname);}catch{return false;}}):[];
    matches.push({askingPrice,images,year:Number.isInteger(year)&&year>=1980&&year<=new Date().getFullYear()+1?year:null,condition:condition==='USED'?'used':condition==='NEW'?'new':null});
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
 const structured=harajStructuredCar(html,url,title);
 const multipleTrims=/(?:بفئات\s*متعددة|بفئات\s*متعدده|جميع\s*الف(?:ئ|ائ|ي|ا)ات|all\s+trims|multiple\s+trims)/i.test(title);
 const textPrice=extractHarajPrice(text,{allowFormatted:false});
 const financeOnly=/(?:قسط|اقساط|أقساط|شهري|دفعة|دفعه|تمويل|installment|monthly|down payment)/i.test(text);
 const conflict=textPrice&&structured?.askingPrice&&textPrice.price!==structured.askingPrice;
 const priceHit=multipleTrims||conflict?null:textPrice||(!financeOnly&&structured?.askingPrice?{price:structured.askingPrice,source:'haraj_exact_ad_price_field',confidence:'high',evidence:String(structured.askingPrice)}:null);
 const priceType=priceHit?'cash':/قسط|أقساط|دفعة|installment|monthly/i.test(text)?'installment':/السوم|التواصل|على الخاص|contact|call for price/i.test(text)?'contact':'unknown';
 const jsonCondition=/UsedCondition/.test(listing.itemCondition||'')?'used':/NewCondition/.test(listing.itemCondition||'')?'new':null;
 const conditionConflict=Boolean(jsonCondition&&structured?.condition&&jsonCondition!==structured.condition);
 const sourceCondition=conditionConflict?null:jsonCondition||structured?.condition||null;
 return{title,description,mileage,priceHit,priceType,images:structured?.images||[],structuredYear:structured?.year||null,sourceCategory:structured?'cars':null,condition:conditionConflict?'unknown':resolveCondition({source:'Haraj',title,description,mileage,sourceCondition}),sourceCondition};
}
