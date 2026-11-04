import {strictDirectListings} from './direct-search.js';

const allowedSources=new Set(['Haraj','OpenSooq']);
/**
 * Short-lived public source metadata only. No user queries, image downloads,
 * files, database writes, or silent creation of permanent inventory.
 *
 * The cache never replaces live source requests. It just makes results that
 * another recent search already observed instantly available to overlapping
 * make/model/year searches while the new source requests continue.
 */
export class LiveVehicleBuffer {
 constructor({ttlMs=10*60_000,maxListings=2500,clock=Date.now}={}){
  this.ttlMs=ttlMs;this.maxListings=maxListings;this.clock=clock;this.entries=new Map();
 }
 prune(now=this.clock()){
  for(const [key,row] of this.entries)if(row.expiresAt<=now)this.entries.delete(key);
  while(this.entries.size>this.maxListings)this.entries.delete(this.entries.keys().next().value);
 }
 ingest(listings=[]){
  const now=this.clock();
  this.prune(now);
  let accepted=0;
  for(const car of Array.isArray(listings)?listings:[]){
   if(!car||!allowedSources.has(car.source)||typeof car.url!=='string')continue;
   let u;
   try{u=new URL(car.url)}catch{continue}
   if(u.protocol!=='https:'||u.username||u.password)continue;
   const observed=Date.parse(car.sourceObservedAt||'');
   if(!Number.isFinite(observed)||observed<=0||observed>now+30_000||now-observed>=this.ttlMs)continue;
   const key=u.href;
   // The observation is explicit, not the ingestion time.
   const expiresAt=observed+this.ttlMs;
   if(this.entries.has(key))this.entries.delete(key);
   this.entries.set(key,{car:{...car},expiresAt});
   accepted++;
   if(this.entries.size>this.maxListings)this.entries.delete(this.entries.keys().next().value);
  }
  return accepted;
 }
 search(body={}){
  this.prune();
  return strictDirectListings([...this.entries.values()].map(x=>x.car),body);
 }
 stats(){
  this.prune();
  return {cachedListingUrls:this.entries.size,ttlSeconds:Math.floor(this.ttlMs/1000),
   maxListings:this.maxListings,storage:'process-memory-only'};
 }
}
