import {isInactiveListing,listingFreshness} from './listing-lifecycle.js';
import {catalogIntent,catalogText} from '../public/catalog.js';
import {normalizeInventoryListing} from './inventory-normalizer.js';
import {filterVehicleSaleListings,isVehicleSaleListing} from './listing-quality.js';
import {classificationMetrics} from './vehicle-classification.js';
import {createGunzip} from 'node:zlib';
import {createReadStream} from 'node:fs';
import {strictDirectListings,mergeDirectListings} from './direct-search.js';
import {normalizeSearchText,detectRequestedBrand} from './search-relevance.js';
import {detectRequestedModel} from './search-model-relevance.js';
import {resolveBodyType,normalizeBodyType} from './vehicle-body-type.js';

/**
 * Parse gzipped JSON listings incrementally so a 10k+ vehicle snapshot never
 * holds the inflated JSON, its decoded string, and all parsed objects at once.
 * Accept the existing {generatedAt,listings,diagnostics} snapshot shape.
 */
export async function scanCompressedInventory(path,onListing){
  const source=createReadStream(path).pipe(createGunzip());
  source.setEncoding('utf8');
  let pending='',started=false,finished=false,record='',depth=0,quoted=false,escaped=false;
  let generatedAt=null,count=0;
  for await(const chunk of source){
    let data=chunk;
    if(!started){
      pending+=data;
      const match=/"listings"\s*:\s*\[/.exec(pending);
      if(!match){
        if(pending.length>65536)throw new Error('snapshot-listings-not-found');
        continue;
      }
      const before=pending.slice(0,match.index);
      generatedAt=/"generatedAt"\s*:\s*"([^"]+)"/.exec(before)?.[1]||null;
      data=pending.slice(match.index+match[0].length);
      pending='';started=true;
    }
    for(let i=0;i<data.length;i++){
      const ch=data[i];
      if(depth===0){
        if(ch===']'){finished=true;break;}
        if(ch==='{'){depth=1;record='{';quoted=false;escaped=false;}
        else if(ch!==','&&!/\s/.test(ch))throw new Error('invalid-snapshot-listing');
        continue;
      }
      record+=ch;
      if(quoted){
        if(escaped)escaped=false;
        else if(ch==='\\')escaped=true;
        else if(ch==='"')quoted=false;
      }else if(ch==='"')quoted=true;
      else if(ch==='{'||ch==='[')depth++;
      else if(ch==='}'||ch===']'){
        if(--depth===0){
          await onListing(JSON.parse(record));
          count++;record='';
        }
      }
    }
    if(finished)break;
  }
  if(!started||!finished||depth!==0)throw new Error('incomplete-snapshot');
  return {generatedAt,count};
}

const DAY=36*60*60_000;
const sourceKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
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
 constructor({maxAgeMs=DAY}={}){this.records=[];this.generatedAt=null;this.diagnostics=[];this.maxAgeMs=maxAgeMs;this.buckets={};this.searchCache=new Map();this.cachedRows=0;}
 async load(path=new URL('../data/market-inventory.json.gz',import.meta.url)){
  const byUrl=new Map(),identities=new Map();
  try {
    const summary=await scanCompressedInventory(path,async raw=>{
      const car=normalizeInventoryListing(raw,{recordMetrics:true});
      if(!isVehicleSaleListing(car)||!car.url)return;
      const prev=byUrl.get(car.url);
      if(prev){
        // Only duplicate URLs pay for the full image/price merge operation.
        byUrl.set(car.url,mergeDirectListings([prev],[car])[0]);
        return;
      }
      const vin=/^[A-HJ-NPR-Z0-9]{17}$/i.test(car.vin||'')?car.vin.toUpperCase():null;
      const imageKey=car.image&&!/logo|placeholder/i.test(car.image)&&car.mileage>0&&car.trim&&car.price?
        [car.brand,car.model,car.trim,car.year,car.mileage,car.price,car.image].join('|'):null;
      const identity=vin?'vin:'+vin:imageKey?'image:'+imageKey:null;
      const oldKey=identity&&identities.get(identity);
      if(oldKey){
        const old=byUrl.get(oldKey);
        old.alternateSources=[...(old.alternateSources||[]),{source:car.source,url:car.url}];
        return;
      }
      byUrl.set(car.url,car);
      if(identity)identities.set(identity,car.url);
    });
    this.setRecords([...byUrl.values()],{generatedAt:summary.generatedAt});
    console.info(JSON.stringify({event:'inventory_stream_loaded',records:this.records.length,parsed:summary.count,heapMb:Math.round(process.memoryUsage().heapUsed/1048576)}));
    return true;
  } catch(error) {
    console.error(JSON.stringify({event:'inventory_stream_load_failed',reason:error?.code||error?.message||'unknown'}));
    return false;
  }
 }
 replace(data){
  this.setRecords(
    deduplicateVehicles(filterVehicleSaleListings((data.listings||[]).map(c=>normalizeInventoryListing(c,{recordMetrics:true})))),
    data
  );
 }
 setRecords(records,{generatedAt,diagnostics}={}){
  this.records=records.sort((a,b)=>Number(b.dataComplete)-Number(a.dataComplete)||Number(Boolean(b.image))-Number(Boolean(a.image)));
  console.info(JSON.stringify({event:'inventory_classification',sources:classificationMetrics()}));
  this.generatedAt=generatedAt||new Date().toISOString();this.diagnostics=diagnostics||[];
  this.buckets={make:new Map(),model:new Map(),condition:new Map(),source:new Map()};this.searchCache.clear();this.cachedRows=0;
  const add=(kind,key,c)=>{if(!key)return;const bucket=this.buckets[kind];if(!bucket.has(key))bucket.set(key,[]);bucket.get(key).push(c);};
  for(const c of this.records){add('make',c.normalized_make,c);add('model',c.normalized_make+'|'+c.normalized_model,c);add('condition',c.condition,c);for(const key of new Set([sourceKey(c.source),sourceKey(c.seller)]))add('source',key,c);}
 }
 active(){return this.records.filter(c=>!isInactiveListing(c));}
 fresh(){return this.active().filter(c=>!listingFreshness(c,this.maxAgeMs).refreshDue);}
 /**
  * Fast, evidence-first retrieval for a *trusted server-generated* structured
  * intent. All fields here must originate from vetted rule/AI interpretation,
  * not unchecked client-provided search params.
  * Preselect in-memory normalized records before expensive classification and
  * ranking; do not broaden an explicit price or body-type restriction.
  */
 searchTrustedOriginBody(body={}, {makes=[],bodyType=null}={}){
  const normalizedBody=normalizeBodyType(bodyType);
  const allowed=new Set((Array.isArray(makes)?makes:[]).map(x=>String(x).toLowerCase()));
  const cap=Number(body.filters?.maxPrice);
  if(!allowed.size||!normalizedBody||!Number.isFinite(cap)||cap<=0)return [];
  const condition=body.condition==='new'?'new':'used';
  const pool=this.buckets.condition?.get(condition)||[];
  const filtered=pool.filter(car=>{
   const price=Number(car.price);
   return allowed.has(String(car.make||car.brand||'').toLowerCase()) &&
     car.priceVerified===true && car.price!=null && Number.isFinite(price) &&
     price>0 && price<=cap && resolveBodyType(car)===normalizedBody &&
     !isInactiveListing(car);
  });
  return strictDirectListings(filtered,{...body,query:''});
 }
 search(body={}){
  const query=String(body.query||''),broad=!query||query==='__all_cars__';
  const cacheKey=JSON.stringify([query,body.condition,Object.entries(body.filters||{}).sort(([a],[b])=>a.localeCompare(b))]),now=Date.now(),cached=this.searchCache.get(cacheKey);
  if(cached&&cached.until>now)return cached.rows.map(c=>({...c,...listingFreshness(c,this.maxAgeMs,now)}));
  if(cached){this.cachedRows-=cached.rows.length;this.searchCache.delete(cacheKey);}
  const intent=catalogIntent(broad?'':query),condition=body.condition==='all'?null:body.condition==='new'?'new':'used',choices=[this.records];
  if(condition)choices.push(this.buckets.condition?.get(condition)||[]);
  if(intent.make)choices.push(this.buckets.make?.get(catalogText(intent.make).toUpperCase())||[]);
  if(intent.make&&intent.model)choices.push(this.buckets.model?.get(catalogText(intent.make).toUpperCase()+'|'+catalogText(intent.model).toUpperCase())||[]);
  if(body.filters?.seller)choices.push(this.buckets.source?.get(sourceKey(body.filters.seller))||[]);
  const candidates=choices.reduce((a,b)=>a.length<b.length?a:b).filter(c=>!isInactiveListing(c));
  let rows=strictDirectListings(candidates,{...body,query:broad?'':query});
  if(!broad&&!detectRequestedBrand(query)&&!detectRequestedModel(query)){
   const tokens=normalizeSearchText(query).split(' ').filter(t=>t.length>1&&!/^(?:cars?|used|new|saudi|under|above|in|ريال|سيارات|مستعمل|جديد|\d+)$/.test(t));
   rows=rows.filter(c=>tokens.every(t=>normalizeSearchText(`${c.title} ${c.make} ${c.model}`).includes(t)));
  }
  // Cache membership briefly; compute freshness labels on every response.
  if(rows.length<=50000){while(this.searchCache.size>=32||this.cachedRows+rows.length>100000){const key=this.searchCache.keys().next().value;if(key===undefined)break;this.cachedRows-=this.searchCache.get(key).rows.length;this.searchCache.delete(key);}
   const until=now+30000;this.searchCache.set(cacheKey,{until,rows});this.cachedRows+=rows.length;
  }
  return rows.map(c=>({...c,...listingFreshness(c,this.maxAgeMs,now)}));
 }
 stats(){
  const records=this.active(),bySource={},byBrand={},byCity={},byCondition={},missing={};
  for(const c of records){const s=bySource[c.source]||={count:0,complete:0,lastSeenAt:c.lastSeenAt};s.count++;if(Date.parse(c.lastSeenAt)>Date.parse(s.lastSeenAt))s.lastSeenAt=c.lastSeenAt;if(c.dataComplete)s.complete++;byBrand[c.brand]=(byBrand[c.brand]||0)+1;byCity[c.city||'Unknown']=(byCity[c.city||'Unknown']||0)+1;byCondition[c.condition]=(byCondition[c.condition]||0)+1;for(const f of c.missingFields||[])missing[f]=(missing[f]||0)+1;}
  return{generatedAt:this.generatedAt,totalUnique:records.length,completeRecords:records.filter(c=>c.dataComplete).length,expiredRecords:0,inactiveRecords:this.records.length-records.length,freshRecords:this.fresh().length,refreshDueRecords:records.length-this.fresh().length,bySource,byBrand,byCity,byCondition,missingFields:missing,storage:'versioned-snapshot-and-memory',maxAgeHours:this.maxAgeMs/3600000,diagnostics:this.diagnostics};
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
