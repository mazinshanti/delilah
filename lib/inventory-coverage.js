import {isInactiveListing,listingFreshness} from './listing-lifecycle.js';
import {SOURCE_REGISTRY} from './source-registry.js';

const norm=value=>String(value||'').toLowerCase().replace(/\s+/g,' ').trim();
const hasValidPrice=car=>car?.priceVerified===true&&car?.price!=null&&Number.isFinite(Number(car.price))&&Number(car.price)>0;
const percent=(num,denom)=>denom?Math.round(num*100/denom):null;

/**
 * An evidence-based snapshot quality and source-coverage summary.
 * Never infer percent of all Saudi-market listings from indexed records.
 */
export function inventoryCoverageSummary(records=[],{
 sources=SOURCE_REGISTRY,generatedAt=null,now=Date.now(),maxAgeMs=36*3600000
}={}){
 const counts=new Map();
 for(const car of Array.isArray(records)?records:[]){
  if(!car?.url||isInactiveListing(car))continue;
  const name=String(car.source||'Unknown');
  const key=norm(name);
  const row=counts.get(key)||{name,indexed:0,fresh:0,priceVerified:0,withImage:0,lastSeenAt:null};
  row.indexed++;
  if(!listingFreshness(car,maxAgeMs,now).refreshDue)row.fresh++;
  if(hasValidPrice(car))row.priceVerified++;
  if(car.image||car.displayImage||car.primary_image)row.withImage++;
  const timestamp=Date.parse(car.lastSeenAt||car.lastDetailAt||'');
  if(Number.isFinite(timestamp)&&(!row.lastSeenAt||timestamp>Date.parse(row.lastSeenAt)))row.lastSeenAt=new Date(timestamp).toISOString();
  counts.set(key,row);
 }
 const seen=new Set(),rows=[];
 for(const source of sources){
  const key=norm(source.name);
  if(seen.has(key))continue;
  seen.add(key);
  const observation=counts.get(key)||{indexed:0,fresh:0,priceVerified:0,withImage:0,lastSeenAt:null};
  rows.push({id:source.id||null,name:source.name,connectionStatus:source.status||'unknown',
   indexedUrlCount:observation.indexed,
   freshUrlCount:observation.fresh,
   lastSeenAt:observation.lastSeenAt,
   askingPriceEvidencePct:percent(observation.priceVerified,observation.indexed),
   photoCoveragePct:percent(observation.withImage,observation.indexed)});
 }
 for(const [key,observation]of counts)if(!seen.has(key)){
  rows.push({id:null,name:observation.name,connectionStatus:'unregistered-inventory-source',
   indexedUrlCount:observation.indexed,freshUrlCount:observation.fresh,
   lastSeenAt:observation.lastSeenAt,
   askingPriceEvidencePct:percent(observation.priceVerified,observation.indexed),
   photoCoveragePct:percent(observation.withImage,observation.indexed)});
 }
 rows.sort((a,b)=>b.indexedUrlCount-a.indexedUrlCount||a.name.localeCompare(b.name));
 return {
  generatedAt,
  indexedUrlCount:rows.reduce((sum,row)=>sum+row.indexedUrlCount,0),
  freshUrlCount:rows.reduce((sum,row)=>sum+row.freshUrlCount,0),
  observedSources:rows.filter(row=>row.indexedUrlCount>0).length,
  representedSources:rows,
  marketCoveragePct:null,
  marketExhaustive:false,
  caveat:'Indexed listing URLs are not a census of all Saudi listings or unique physical cars. Freshness is the time since last observation, not proof that a vehicle remains for sale.'
 };
}
