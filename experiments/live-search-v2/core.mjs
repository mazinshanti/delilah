// Experimental only: no inventory/file imports, no background collection.
import {catalogIntent} from '../../public/catalog.js';
import {resolveBodyType} from '../../lib/vehicle-body-type.js';
import {strictDirectListings,mergeDirectListings} from '../../lib/direct-search.js';
import {applyIntentConstraints,ORIGINS,validateIntent} from '../../lib/ai-search-intent.js';
const compact=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g,'');
export function identity(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 const id=u.hostname==='haraj.com.sa'?u.pathname.match(/^\/(\d{8,})/ )?.[1]:u.hostname==='ksa.carswitch.com'?u.pathname.match(/\/used-car\/[^/]+\/[^/]+\/\d{4}\/(\d+)/)?.[1]:u.hostname==='www.salehcars.com'?u.pathname.match(/\/cars\/([a-f0-9]{24})/)?.[1]:u.hostname==='syarah.com'?u.pathname.match(/\/cardetail\/[^/]+-(\d+)/)?.[1]:null;
 return id?`${u.hostname}:${id}`:null;}catch{return null;}}
export function searchBody(intent){return {query:[intent.make,intent.model,intent.year].filter(Boolean).join(' '),condition:intent.condition||'used',filters:Object.fromEntries(['minPrice','maxPrice','minYear','maxYear','city','fuelType'].filter(k=>intent[k]!=null).map(k=>[k,intent[k]]))};}
// Discovery admits unknowns, but never a known conflict. Final acceptance stays strict.
export function candidateEligible(c,i){
 const cat=catalogIntent([c.make||c.brand,c.model,c.title].filter(Boolean).join(' '));
 if(i.make&&cat.make&&compact(cat.make)!==compact(i.make))return false;
 if(i.model&&cat.model&&compact(cat.model)!==compact(i.model))return false;
 if(i.city&&c.city&&compact(c.city)!==compact(i.city))return false;
 if(c.condition&&c.condition!=='unknown'&&i.condition&&c.condition!==i.condition)return false;
 if(i.bodyType&&resolveBodyType(c)&&resolveBodyType(c)!==i.bodyType)return false;
 if(i.originPreference&&cat.make&&!ORIGINS[i.originPreference]?.includes(cat.make))return false;
 if(i.excludedMakes.includes(cat.make))return false;
 if(i.year&&c.year&&Number(c.year)!==i.year)return false;
 if(i.minYear&&c.year&&Number(c.year)<i.minYear||i.maxYear&&c.year&&Number(c.year)>i.maxYear)return false;
 if(c.priceVerified&&c.price!=null&&(i.maxPrice&&Number(c.price)>i.maxPrice||i.minPrice&&Number(c.price)<i.minPrice))return false;
 return true;
}
export function accepted(rows,i){
 const b=searchBody(i);if(i.year)b.filters.minYear=b.filters.maxYear=i.year;
 return applyIntentConstraints(strictDirectListings(rows.filter(c=>c.detailChecked===true),b),i).filter(c=>!i.originPreference||ORIGINS[i.originPreference]?.includes(catalogIntent(c.make||c.brand||c.title).make));
}
export function sourceBalanced(rows){
 const groups=new Map();for(const r of mergeDirectListings(rows)){const k=identity(r.url)||r.url;if([...groups.values()].some(g=>g.some(c=>(identity(c.url)||c.url)===k)))continue;if(!groups.has(r.source))groups.set(r.source,[]);groups.get(r.source).push(r);}
 const out=[];while([...groups.values()].some(g=>g.length))for(const g of groups.values())if(g.length)out.push(g.shift());return out;
}
export class ResultCache{
 constructor({ttlMs=60000,maxBytes=2_000_000,maxEntries=16,clock=Date.now}={}){Object.assign(this,{ttlMs,maxBytes,maxEntries,clock});this.entries=new Map();this.bytes=0;}
 get(key){const e=this.entries.get(key);if(!e)return null;if(e.until<=this.clock()){this.bytes-=e.bytes;this.entries.delete(key);return null;}return structuredClone(e.value);}
 set(key,value){const bytes=Buffer.byteLength(JSON.stringify(value));if(bytes>this.maxBytes)return;const old=this.entries.get(key);if(old){this.bytes-=old.bytes;this.entries.delete(key);}while(this.entries.size>=this.maxEntries||this.bytes+bytes>this.maxBytes){const k=this.entries.keys().next().value,e=this.entries.get(k);this.bytes-=e.bytes;this.entries.delete(k);}this.entries.set(key,{value:structuredClone(value),bytes,until:this.clock()+this.ttlMs});this.bytes+=bytes;}
}
export async function runSearch(intent,{discover,verify,cache=new ResultCache(),deadlineMs=45000,maxDetails=12,detailConcurrency=4,onResult=()=>{},clock=Date.now}={}){
 if(!validateIntent(intent))throw Error('invalid-intent');
 const key=JSON.stringify(intent),cached=cache.get(key);if(cached)return {...cached,cacheHit:true,networkRequests:0,totalMs:0};
 const started=clock(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),deadlineMs),diagnostics=[],seen=new Set(),verified=[];
 let firstResultMs=null,discovered=0,eligible=0,attempted=0,verificationDone=false;const queue=[],waiters=[];
 const notify=()=>waiters.splice(0).forEach(f=>f());controller.signal.addEventListener('abort',notify);
 const discovery=discover(intent,{signal:controller.signal,onBatch:(rows,source)=>{
  discovered+=rows.length;for(const c of rows){const id=identity(c.url);if(!id||seen.has(id)||!candidateEligible(c,intent))continue;seen.add(id);eligible++;queue.push(c);}notify();
 },diagnostics}).catch(e=>diagnostics.push({stage:'discovery',error:e.message})).finally(()=>{verificationDone=true;notify();});
 const perSource=new Map(),inFlight=new Map();
 async function worker(){while(!controller.signal.aborted){
  if(!queue.length){if(verificationDone)return;await new Promise(resolve=>waiters.push(resolve));continue;}
  if(attempted>=maxDetails)return;
  // Limit domination by one source while preserving order within that source.
  queue.sort((a,b)=>(perSource.get(a.source)||0)-(perSource.get(b.source)||0));
  for(let j=queue.length-1;j>=0;j--)if((perSource.get(queue[j].source)||0)>=6)queue.splice(j,1);
  if(!queue.length){if(verificationDone)return;await new Promise(resolve=>waiters.push(resolve));continue;}
  const index=queue.findIndex(c=>(inFlight.get(c.source)||0)<2);
  if(index<0){await new Promise(resolve=>waiters.push(resolve));continue;}
  const [c]=queue.splice(index,1);inFlight.set(c.source,(inFlight.get(c.source)||0)+1);
  attempted++;perSource.set(c.source,(perSource.get(c.source)||0)+1);
  try{const rows=await verify(c,{signal:controller.signal});const hits=accepted(rows,intent);verified.push(...hits);if(hits.length){if(firstResultMs===null)firstResultMs=clock()-started;onResult(sourceBalanced(verified));}else diagnostics.push({stage:'verify',source:c.source,url:c.url,error:'no-matching-exact-ad-evidence'});}catch(e){diagnostics.push({stage:'verify',source:c.source,url:c.url,error:e.message});}finally{inFlight.set(c.source,inFlight.get(c.source)-1);notify();}
 }}
 try{await Promise.all([discovery,...Array.from({length:detailConcurrency},worker)]);}finally{clearTimeout(timer);}
 const result={matches:sourceBalanced(verified),discovered,eligible,detailsAttempted:attempted,firstResultMs,totalMs:clock()-started,deadlineReached:controller.signal.aborted,partial:true,coverageComplete:false,cacheHit:false,diagnostics};
 // Empty/failing requests never poison the cache; do not keep raw HTML or images.
 if(result.matches.length)cache.set(key,result);return result;
}
