import {normalizeInventoryListing} from './inventory-normalizer.js';
import {filterVehicleSaleListings} from './listing-quality.js';
import {classificationMetrics} from './vehicle-classification.js';
import {gunzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {strictDirectListings,mergeDirectListings} from './direct-search.js';
import {normalizeSearchText,detectRequestedBrand} from './search-relevance.js';
import {detectRequestedModel} from './search-model-relevance.js';
const DAY=36*60*60_000;
export function deduplicateVehicles(records=[]){
 const out=new Map(),identities=new Map();
 for(const car of mergeDirectListings(records)){
  const vin=/^[A-HJ-NPR-Z0-9]{17}$/i.test(car.vin||'')?car.vin.toUpperCase():null;
  // Cross-source image equality plus matching vehicle fields is conservative;
  // make/model/year alone must never collapse different vehicles.
  const imageKey=car.image&&!/logo|placeholder/i.test(car.image)&&car.mileage>0&&car.trim&&car.price?[car.brand,car.model,car.trim,car.year,car.mileage,car.price,car.image].join('|'):null;
  const identity=vin?`vin:${vin}`:imageKey?`image:${imageKey}`:null;
  const oldKey=identity&&identities.get(identity);
  if(oldKey){const old=out.get(oldKey);old.alternateSources=[...(old.alternateSources||[]),{source:car.source,url:car.url}];continue;}
  out.set(car.url,{...car});if(identity)identities.set(identity,car.url);
 }
 return [...out.values()];
}
export class InventoryIndex{
 constructor({maxAgeMs=DAY}={}){this.records=[];this.generatedAt=null;this.diagnostics=[];this.maxAgeMs=maxAgeMs;}
 async load(path=new URL('../data/market-inventory.json.gz',import.meta.url)){
  try{const data=JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));this.replace(data);return true;}catch{return false;}
 }
 replace(data){this.records=deduplicateVehicles(filterVehicleSaleListings((data.listings||[]).map(c=>normalizeInventoryListing(c,{recordMetrics:true})))).sort((a,b)=>Number(b.dataComplete)-Number(a.dataComplete)||Number(Boolean(b.image))-Number(Boolean(a.image)));console.info(JSON.stringify({event:'inventory_classification',sources:classificationMetrics()}));this.generatedAt=data.generatedAt||new Date().toISOString();this.diagnostics=data.diagnostics||[];}
 fresh(){return this.records.filter(c=>Date.now()-Date.parse(c.lastSeenAt||this.generatedAt)<this.maxAgeMs);}
 search(body={}){
  const query=String(body.query||''),broad=!query||query==='__all_cars__';
  let rows=strictDirectListings(this.fresh(),{...body,query:broad?'':query});
  if(!broad&&!detectRequestedBrand(query)&&!detectRequestedModel(query)){
   const tokens=normalizeSearchText(query).split(' ').filter(t=>t.length>1&&!/^(?:cars?|used|new|saudi|under|above|in|ريال|سيارات|مستعمل|جديد|\d+)$/.test(t));
   rows=rows.filter(c=>tokens.every(t=>normalizeSearchText(`${c.title} ${c.make} ${c.model}`).includes(t)));
  }
  return rows;
 }
 stats(){
  const records=this.fresh(),bySource={},byBrand={},byCity={},byCondition={},missing={};
  for(const c of records){const s=bySource[c.source]||={count:0,complete:0,lastSeenAt:c.lastSeenAt};s.count++;if(Date.parse(c.lastSeenAt)>Date.parse(s.lastSeenAt))s.lastSeenAt=c.lastSeenAt;if(c.dataComplete)s.complete++;byBrand[c.brand]=(byBrand[c.brand]||0)+1;byCity[c.city||'Unknown']=(byCity[c.city||'Unknown']||0)+1;byCondition[c.condition]=(byCondition[c.condition]||0)+1;for(const f of c.missingFields||[])missing[f]=(missing[f]||0)+1;}
  return{generatedAt:this.generatedAt,totalUnique:records.length,completeRecords:records.filter(c=>c.dataComplete).length,expiredRecords:this.records.length-records.length,bySource,byBrand,byCity,byCondition,missingFields:missing,storage:'versioned-snapshot-and-memory',maxAgeHours:this.maxAgeMs/3600000,diagnostics:this.diagnostics};
 }
}
export function paginateInventory(rows,{page=1,pageSize=24,sort='relevance'}={}){
 page=Math.max(1,Math.min(10000,Math.floor(Number(page)||1)));pageSize=Math.max(1,Math.min(100,Math.floor(Number(pageSize)||24)));
 const sorted=[...rows];
 if(sort==='price-asc')sorted.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
 if(sort==='price-desc')sorted.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity));
 if(sort==='year-desc')sorted.sort((a,b)=>(b.year||0)-(a.year||0));
 const total=sorted.length;return{listings:sorted.slice((page-1)*pageSize,page*pageSize),pagination:{page,pageSize,total,pages:Math.ceil(total/pageSize),hasMore:page*pageSize<total}};
}
