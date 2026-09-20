// Public individual-stock adapters. Catalogs and related recommendations are never inventory.
import {inventoryRecord,cleanText} from './public-inventory.js';
import {parseMstamlDetail,mstamlIdentity} from './mstaml-detail-trial.js';
import {catalogIntent} from '../public/catalog.js';
export const ADDITIONAL_MARKET_SOURCES=[
 {id:'mstaml',name:'Mstaml',url:'https://www.mstaml.com/',path:'/market/سيارات?type=4',type:'classifieds',detailPattern:/^\/sa\/product\/[^?#]+$/},
 {id:'motory',name:'Motory',url:'https://ksa.motory.com/',path:'/en/cars-for-sale/',type:'marketplace',detailPattern:/^\/(?:en|ar)\/cars-for-sale\/[^/?]+\/[^/?]+\/[^/?]+\/\d{4}\/\d{5,}\/?$/},
 {id:'arabwheels',name:'ArabWheels Saudi',url:'https://www.arabwheels.sa/',path:'/used-cars/search/-/',type:'marketplace',detailPattern:/^\/used-cars\/[^/]+-for-sale-in-[^/]+-\d+$/},
 {id:'kayishha',name:'Kayishha',url:'https://buy.kayishha.com/',path:'/',type:'marketplace',detailPattern:/^\/(?:ar\/|en\/)?cars\/details\/[^/]+-\d{4,}\/?$/},
 {id:'samaco',name:'SAMACO Automotive',url:'https://www.samaco.com.sa/',path:'/stock/',type:'official_dealer',detailPattern:/^\/(?:en\/)?stock\/(?:vehicle\/)?\d{6,}-[^/]+\/?$/}
];
export function stockIdentity(source,raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.origin!==new URL(source.url).origin||u.username||u.password||!source.detailPattern.test(u.pathname))return null;
 if(source.id==='mstaml')return mstamlIdentity(raw);
 if(['arabwheels','kayishha'].includes(source.id))return u.pathname.match(/-(\d+)\/?$/)?.[1];
 return source.id==='samaco'?u.pathname.match(/\/(\d{6,})-/)?.[1]:u.pathname.match(/\/(\d{5,})\/?$/)?.[1];}catch{return null;}}
export function stockLinks(html,source){
 const found=new Map();const add=raw=>{try{const url=new URL(raw.replace(/&amp;/g,'&'),source.url).href,id=stockIdentity(source,url);if(id&&(source.id!=='mstaml'||new URL(url).searchParams.get('type')==='4.41'))found.set(id,url);}catch{}};
 for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi))add(m[1]);
 // Stock catalogs may expose their actual detail links in JSON-LD, not anchors.
 const walk=o=>{if(!o||typeof o!=='object')return;if(typeof o.url==='string')add(o.url);for(const v of Object.values(o))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);};blocks(html).forEach(walk);
 return [...found.values()];
}

function blocks(html){return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{try{const o=JSON.parse(m[1]);return o['@graph']||[o];}catch{return [];}});}
export function parseAdditionalStock(html,url,source){
 const id=stockIdentity(source,url);if(!id)return {records:[],reason:'unsupported-detail'};
 if(source.id==='mstaml')return parseMstamlDetail(html,{url});
 if(source.id==='arabwheels')return parseArabwheelsStock(html,url,source);
 if(source.id==='kayishha')return parseKayishhaStock(html,url,source);
 const nodes=blocks(html);let car,offer,images=[];
 if(source.id==='motory'){
  const matches=nodes.filter(n=>n['@type']==='Car'&&stockIdentity(source,n.url)===id);
  if(matches.length!==1)return {records:[],reason:'exact-stock-evidence-required'};
  car=matches[0];offer=car.offers;images=Array.isArray(car.image)?car.image:[car.image];
  if(/SoldOut|OutOfStock|Discontinued/.test(offer?.availability||''))return {records:[],reason:'unavailable'};
  if(offer?.priceCurrency!=='SAR'||!/^https?:\/\/schema.org\/InStock$/.test(offer.availability||''))return {records:[],reason:'available-saudi-offer-required'};
 }else{
  const bound=nodes.some(n=>n['@type']==='BreadcrumbList'&&n.itemListElement?.some(i=>stockIdentity(source,i.item?.['@id'])===id));
  const offers=nodes.filter(n=>n['@type']==='Offer'&&n.itemOffered?.['@type']==='Car');
  if(!bound||offers.length!==1||offers[0].priceCurrency!=='SAR')return {records:[],reason:'exact-stock-evidence-required'};
  offer=offers[0];car=offer.itemOffered;
  images=nodes.filter(n=>n['@type']==='ImageObject'&&cleanText(n.name)===cleanText(car.name)).map(n=>n.contentUrl).filter(u=>{try{return new URL(u).pathname.includes('NDB'+id+'_');}catch{return false;}});
 }
 if(/SoldOut|OutOfStock|Discontinued/.test(offer.availability||''))return {records:[],reason:'unavailable'};
 const identity=catalogIntent([car.brand?.name||car.brand,car.model?.name||car.model,car.vehicleConfiguration,car.name].filter(Boolean).join(' '));
 const mileage=car.mileageFromOdometer?.value??car.mileageFromOdometer??null;
 const condition=/used/i.test(car.itemCondition||'')?'used':/new/i.test(car.itemCondition||'')?'new':null;
 if(condition==='new'&&Number(mileage)>100)return {records:[],reason:'condition-conflict'};
 const record=inventoryRecord({url,title:car.name,description:car.description,schemaType:'Car',make:identity.make,model:identity.model,year:car.vehicleModelDate||car.modelDate||car.productionDate,condition,mileage,price:Number(offer.price)>1000?offer.price:null,images:images.filter(Boolean),image:images[0]||null,transmission:car.vehicleTransmission,fuelType:car.fuelType||car.vehicleEngine?.fuelType,bodyType:car.bodyType,trim:car.vehicleConfiguration},source);
 return {records:record?[record]:[],reason:record?null:'vehicle-boundary'};
}

function parseArabwheelsStock(html,url,source){
 const id=stockIdentity(source,url),canonical=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
 if(stockIdentity(source,canonical)!==id)return {records:[],reason:'conflicting-stock-identity'};
 const start=html.indexOf('<h1'),end=html.indexOf('id="reduce-price-modal"',start);
 if(start<0||end<0)return {records:[],reason:'primary-panel-required'};
 const primary=html.slice(start,end),title=cleanText(primary.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
 const description=cleanText(primary.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,''));
 if(!new RegExp('رقم المرجع للإعلان\\s*'+id+'(?:\\D|$)').test(description))return {records:[],reason:'ad-id-required'};
 const page=blocks(html).find(n=>n['@type']==='WebPage');
 if(!/Used for sale|Used for sale\s/i.test(page?.description||''))return {records:[],reason:'used-sale-evidence-required'};
 const identity=catalogIntent(title+' '+description),years=[...title.matchAll(/\b((?:19|20)\d{2})\b/g)].map(m=>Number(m[1]));
 if(!identity.make||!identity.model||new Set(years).size!==1)return {records:[],reason:'unresolved-identity'};
 const mileage=primary.match(/pw-mileage["'][^>]*><\/i>\s*([\d,]+)\s*(?:عدد الكيلومترات|km)/i)?.[1]||null;
 const priceText=cleanText(primary.match(/<strong class="generic-white fs18">([\s\S]*?)<\/strong>/)?.[1]);
 const price=/^[\d,]+\s*ريال$/.test(priceText)?Number(priceText.replace(/[^\d]/g,'')):null;
 const images=[...new Set([...primary.matchAll(/data-src=["'](https:\/\/cache[1-4]\.arabwheels\.sa\/ad_pictures\/[^"']+)["']/g)].map(m=>m[1]).filter(u=>!u.includes('/tn_')))];
 const city=cleanText(primary.match(/<p class="detail-sub-heading">([\s\S]*?)<\/p>/)?.[1])||null;
 const record=inventoryRecord({url,title,description,schemaType:'Car',make:identity.make,model:identity.model,year:years[0],condition:'used',price,mileage,city,image:images[0]||null,images},source);
 return {records:record?[record]:[],reason:record?null:'vehicle-boundary'};
}

function parseKayishhaStock(html,url,source){
 const id=stockIdentity(source,url),cars=blocks(html).filter(n=>n['@type']==='Car'&&stockIdentity(source,n.url)===id);
 if(cars.length!==1)return {records:[],reason:'exact-stock-evidence-required'};const car=cars[0];
 if(!/for sale/i.test(car.name||''))return {records:[],reason:'sale-evidence-required'};
 const mileage=Number(car.description?.match(/\bwith\s+(\d{3,7})\s+KM\b/i)?.[1]);
 // An explicit odometer in this exact vehicle's description is used-car evidence.
 if(!Number.isFinite(mileage)||mileage<=100||mileage>2000000)return {records:[],reason:'used-odometer-evidence-required'};
 const identity=catalogIntent(car.name),years=[...String(car.name).matchAll(/\b((?:19|20)\d{2})\b/g)].map(m=>Number(m[1]));
 if(!identity.make||!identity.model||new Set(years).size!==1)return {records:[],reason:'unresolved-identity'};
 let image=null;try{const u=new URL(car.image);if(u.protocol==='https:'&&u.hostname==='ik.imagekit.io'&&u.pathname.startsWith('/yk64cmkix/bac-api-v2/carImages/'+id+'-'))image=u.href;}catch{}
 const record=inventoryRecord({url,title:car.name,description:car.description,schemaType:'Car',make:identity.make,model:identity.model,year:years[0],mileage,condition:'used',price:null,image,images:image?[image]:[]},source);
 return {records:record?[record]:[],reason:record?null:'vehicle-boundary'};
}
