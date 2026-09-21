import {randomUUID} from 'node:crypto';
import {runSearch,ResultCache} from './core.mjs';
import {strictDirectListings} from '../direct-search.js';
import {intentSearchBody,validateIntent} from '../ai-search-intent.js';
import {validateFilters} from '../api-guard.js';
export function createOnDemandService({intentEngine,adapters,clock=Date.now,maxActive=2,maxJobs=32,requestsPerHour=100,ttlMs=120000,deadlineMs=30000}={}){
 const jobs=new Map(),cache=new ResultCache(),stats={started:0,completed:0,failed:0,cancelled:0,rejected:0,acceptedAds:0,sources:{}};let active=0,windowAt=clock(),requests=0;
 const prune=()=>{for(const[id,j]of jobs)if(j.done&&clock()-j.updated>ttlMs)jobs.delete(id);};
 const snapshot=j=>({searchId:j.id,listings:structuredClone(j.rows),complete:j.done,marketScanComplete:false,partial:true,coverageComplete:false,status:j.status,error:j.error||null,intent:j.intent,intentMode:j.intentMode,firstResultMs:j.firstResultMs,elapsedMs:clock()-j.started,searchMode:'on-demand'});
 function validate(body){if(!body||typeof body.query!=='string'||!body.query.trim()||body.query.length>180)return 'invalid-query';if(body.condition!=null&&!['used','new'].includes(body.condition))return 'invalid-condition';const e=validateFilters(body.filters);if(e)return e;const allowed=['minYear','maxYear','minPrice','maxPrice','city','fuelType'];if(Object.keys(body.filters||{}).some(k=>!allowed.includes(k)))return 'unsupported-filter';return null;}
 function start(body){
  const error=validate(body);if(error)return {statusCode:400,error};prune();if(clock()-windowAt>=3600000){windowAt=clock();requests=0;}
  if(active>=maxActive||jobs.size>=maxJobs||requests>=requestsPerHour){stats.rejected++;return {statusCode:429,error:'search-capacity',retryAfter:60};}
  active++;requests++;stats.started++;
  const controller=new AbortController(),j={id:'od.'+randomUUID(),rows:[],done:false,status:'interpreting',started:clock(),updated:clock(),controller,firstResultMs:null};jobs.set(j.id,j);
  const publish=rows=>{if(controller.signal.aborted)return;const filtered=strictDirectListings(rows,j.body).slice(0,24);if(Buffer.byteLength(JSON.stringify(filtered))>128000){j.status='result-size-limit';return;}j.rows=filtered;if(j.rows.length&&j.firstResultMs===null)j.firstResultMs=clock()-j.started;j.updated=clock();};
  j.promise=(async()=>{try{
   const result=await intentEngine.understand(body.query);if(controller.signal.aborted)return;
   if(result.fallbackReason&&result.intentMode!=='ai'&&!result.intent.make&&!result.intent.model){j.error='interpretation-unavailable';j.status='unavailable';return;}
   j.body=intentSearchBody(structuredClone(body),result);if(validateFilters(j.body.filters)){j.error='conflicting-filters';j.status='unavailable';return;}
   j.intent={...result.intent,condition:j.body.condition};for(const k of ['minYear','maxYear','minPrice','maxPrice','city','fuelType'])if(j.body.filters[k]!=null)j.intent[k]=/^(min|max)/.test(k)?Number(j.body.filters[k]):j.body.filters[k];
   if(!validateIntent(j.intent)){j.error='invalid-intent';j.status='unavailable';return;}j.intentMode=result.intentMode;j.status='searching';
   const out=await runSearch(j.intent,{...adapters,cache,signal:controller.signal,deadlineMs,maxDetails:12,onResult:publish});publish(out.matches);
   for(const d of out.diagnostics||[])if(d.source){const s=stats.sources[d.source]??={failures:0,accepted:0};if(d.error)s.failures++;}
   for(const r of j.rows)(stats.sources[r.source]??={failures:0,accepted:0}).accepted++;
   stats.acceptedAds+=j.rows.length;j.status=controller.signal.aborted?'cancelled':j.rows.length?'results':'no-verified-results';
  }catch{stats.failed++;j.error='search-unavailable';j.status='unavailable';}finally{j.done=true;j.updated=clock();active--;stats.completed++;if(controller.signal.aborted)j.status='cancelled';}})();
  return {statusCode:202,...snapshot(j)};
 }
 return {start,get:id=>{prune();const j=jobs.get(id);return j?snapshot(j):null;},cancel:id=>{const j=jobs.get(id);if(!j)return false;if(!j.done&&!j.controller.signal.aborted){stats.cancelled++;j.controller.abort();j.status='cancelled';}return true;},metrics:()=>({...structuredClone(stats),active,jobs:jobs.size,requestsInWindow:requests,cacheBytes:cache.bytes}),close:()=>{for(const j of jobs.values())if(!j.done)j.controller.abort();},settled:id=>jobs.get(id)?.promise};
}
