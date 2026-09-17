import {normalizeInventoryListing} from './inventory-normalizer.js';
import {detectRequestedBrand} from './search-relevance.js';
import {detectRequestedModel} from './search-model-relevance.js';
import {isVehicleSaleListing} from './listing-quality.js';
import {vehicleImages} from '../public/vehicle-media.js';
import {catalogIntent} from '../public/catalog.js';

export const cleanText=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
export const canonicalCity=value=>({'Al Khobar':'Khobar','Jeezan':'Jazan','Qasim Breda':'Buraidah'}[value]||value||null);
const number=v=>{if(v==null||v==='')return null;const text=String(v).replace(/[^0-9.-]/g,'');if(!text)return null;const n=Number(text);return Number.isFinite(n)&&n>=0?n:null;};
export function safePublicUrl(v,base){if(typeof v!=='string'||!v.trim())return null;try{const u=new URL(v,base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;u.hash='';return u.href}catch{return null}}
export function readJsonAssignment(html,marker){
  let start=html.indexOf(marker);if(start<0)return null;start=html.indexOf('{',start+marker.length);
  let depth=0,quoted=false,escaped=false;
  for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1))}catch{return null}}}
  return null;
}
export function inventoryRecord(raw,source){
  const url=safePublicUrl(raw.url,source.url);if(!url||new URL(url).hostname!==new URL(source.url).hostname)return null;
  if(!source.detailPattern.test(new URL(url).pathname))return null;
  const title=cleanText(raw.title);if(!isVehicleSaleListing({title,url}))return null;
  const year=Number(raw.year)||null;if(year&&(year<1980||year>new Date().getFullYear()+1))return null;
  const price=number(raw.price)||null,mileage=number(raw.mileage);
  const make=detectRequestedBrand(raw.make)||raw.make||detectRequestedBrand(title),model=String(raw.model||catalogIntent(title).model||detectRequestedModel(title)||'').split('::').pop();
  if(!make||!model||!year||!['new','used'].includes(raw.condition))return null;
  const image=safePublicUrl(raw.image,source.url);raw.city=canonicalCity(raw.city);
  const vin=/^[A-HJ-NPR-Z0-9]{17}$/i.test(raw.vin||'')?raw.vin.toUpperCase():null;
  const record={source:source.name,sourceType:source.type||'marketplace',seller:raw.seller||source.name,url,originalUrl:url,title,brand:make,make,model,year,yearVerified:true,trim:raw.trim||null,price,mileage,condition:raw.condition,city:raw.city||null,image,displayImage:image,vin,bodyType:raw.bodyType||null,fuelType:raw.fuelType||null,transmission:raw.transmission||null,priceVerified:price>0,imageVerified:Boolean(image),saleVerified:false,listingVerified:true,saleEvidence:['public_source_inventory'],lastSeenAt:new Date().toISOString(),availability:raw.availability||'listed',discovery:'public_inventory_index'};
  record.missingFields=['trim','price','mileage','city','image'].filter(k=>record[k]==null||record[k]==='');
  record.dataComplete=record.missingFields.length===0;
  record.images=vehicleImages(raw);if(!record.images.length&&image)record.images=[image];
  return normalizeInventoryListing(record);
}
export function parseStructuredInventory(html,source){
  const out=[];
  function walk(obj,parent={}){
    if(!obj||typeof obj!=='object')return;
    const types=[obj['@type']].flat();
    if(types.some(t=>['Car','Vehicle'].includes(t))){
      const offers=[obj.offers||parent].flat()[0]||{};
      if(/SoldOut|OutOfStock|Discontinued/i.test(offers.availability||''))return;
      const url=obj.url||parent.url;const path=safePublicUrl(url,source.url);
      const city=offers.availableAtOrFrom?.address?.addressLocality||offers.areaServed?.address?.addressLocality||(source.id==='carswitch'?path?.match(/carswitch\.com\/(?:en\/)?([^/]+)\/used-car\//)?.[1]:null);
      let condition=String(obj.itemCondition||obj.category||'');condition=/used/i.test(condition)?'used':/new/i.test(condition)?'new':null;
      const image=[obj.image].flat()[0];
      const description=cleanText(obj.description);
      const trim=source.id==='carswitch'?description.match(new RegExp('^Buy certified '+String(obj.brand?.name||obj.brand||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' '+String(obj.model||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+(.+?)\\s+(?:19|20)\\d{2}\\s+for just','i'))?.[1]:obj.vehicleConfiguration;
      const r=inventoryRecord({url,title:obj.name,make:obj.brand?.name||obj.brand,model:obj.model?.name||obj.model,year:obj.vehicleModelDate||obj.modelDate||obj.productionDate||obj.name?.match(/\b((?:19|20)\d{2})\b/)?.[1],trim,price:offers.price,mileage:obj.mileageFromOdometer?.value??obj.mileageFromOdometer,condition,city:city?city.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):null,image:image?.url||image,vin:obj.vehicleIdentificationNumber,bodyType:obj.bodyType,fuelType:obj.fuelType,transmission:obj.vehicleTransmission},source);
      if(r){r.images=vehicleImages({images:obj.image});out.push(r);}return;
    }
    for(const value of Object.values(obj))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(v=>walk(v,obj)):walk(value,obj);
  }
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]))}catch{}}
  return [...new Map(out.map(r=>[r.url,r])).values()];
}
export function parseSyarahInventory(html,source){
  const data=readJsonAssignment(html,'window.FULL_PAGE_DATA =');
  return (data?.posts||[]).flatMap(p=>{
    const g=p.g4_data_layer||{};
    const r=inventoryRecord({url:p.product_url,title:p.title,make:g.post_make,model:g.post_model,year:g.post_year,trim:g.post_ext,price:p.sellingprice,mileage:g.post_mileage,condition:String(g.post_condition||'').toLowerCase(),city:g.post_city,image:p.image_url,images:p.images_urls,fuelType:g.post_fuel,transmission:g.post_transmission},source);
    return r&&!p.is_booked?[r]:[];
  });
}
export function parseSaudiSaleInventory(html,source){
  const out=[];const chunks=html.split(/<a\s+class="img-home-card-/).slice(1);
  for(const chunk of chunks){
    const url=chunk.match(/href="([^"]+\/en\/listings\/[^" ]+)"/)?.[1];
    const title=chunk.match(/alt="([^"]+)"/)?.[1];if(!url||!title)continue;
    const price=cleanText(chunk.match(/class="price[^>]*>([\s\S]*?)<\/div>/)?.[1]);
    const text=cleanText(chunk.slice(0,chunk.indexOf('listing-card-chat-btn')));
    const make=detectRequestedBrand(title),model=detectRequestedModel(title);
    const r=inventoryRecord({url,title,make,model,year:title.match(/\b(20\d{2}|19\d{2})\b/)?.[1],price,mileage:text.match(/([\d,]+)\s*km/i)?.[1],condition:/\bUsed\b/.test(text)?'used':/\bNew\b/.test(text)?'new':null,city:text.match(/\b(Riyadh|Jeddah|Dammam|Khobar|Makkah|Madinah|Taif|Abha|Tabuk)\s*,/)?.[1],image:chunk.match(/<img\s+src="([^"]+)"/)?.[1]},source);
    if(r)out.push(r);
  }
  return [...new Map(out.map(r=>[r.url,r])).values()];
}
