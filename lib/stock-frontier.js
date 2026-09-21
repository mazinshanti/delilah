import {stockIdentity} from './additional-market-sources.js';
const HOUR=3600000;
export const STOCK_RECHECK_MS=24*HOUR;
const LIMIT=100000;
export function createStockFrontier(source,saved={},previous=[],now=Date.now()){
 const entries=new Map();let overflow=0;
 function add(url,seed={}){const id=stockIdentity(source,url);if(!id||(source.id==='mstaml'&&new URL(url).searchParams.get('type')!=='4.41'))return false;if(entries.has(id))return false;if(entries.size>=LIMIT){overflow++;return false;}entries.set(id,{url,checkedAt:seed.checkedAt||null,nextCheckAt:Number(seed.nextCheckAt)||0,outcome:seed.outcome||null,lastSuccessfulAt:seed.lastSuccessfulAt||(seed.outcome==='accepted'?seed.checkedAt:null)||null,failures:Number(seed.failures)||0});return true;}
 for(const e of saved.entries||[])add(e.url,e);
 for(const c of previous){if(c.source!==source.name)continue;const at=Date.parse(c.lastDetailAt||c.lastSeenAt);add(c.url,{checkedAt:Number.isFinite(at)?new Date(at).toISOString():null,nextCheckAt:Number.isFinite(at)?at+STOCK_RECHECK_MS:0,outcome:'accepted',lastSuccessfulAt:Number.isFinite(at)?new Date(at).toISOString():null});}
 return {
  add,
  due(){const due=[...entries.values()].filter(e=>e.nextCheckAt<=now);const fresh=due.filter(e=>!e.checkedAt),recheck=due.filter(e=>e.checkedAt).sort((a,b)=>a.nextCheckAt-b.nextCheckAt);const out=[];for(let i=0;i<Math.max(fresh.length,recheck.length);i++){if(recheck[i])out.push(recheck[i]);if(fresh[i])out.push(fresh[i]);}return out;},
  finish(url,outcome,at=Date.now(),{changed=false,popular=false}={}){const e=entries.get(stockIdentity(source,url));if(!e)return;
   e.checkedAt=new Date(at).toISOString();e.outcome=outcome;
   const transient=/HTTP|timeout|abort|fetch|network|response-too-large|redirect|collection-budget/i.test(outcome)&&!/^HTTP (404|410)$/.test(outcome);
   if(outcome==='accepted'){e.lastSuccessfulAt=e.checkedAt;e.failures=0;e.nextCheckAt=at+((changed||popular)?4*HOUR:STOCK_RECHECK_MS);}
   else if(transient){e.failures=Math.min(6,e.failures+1);e.nextCheckAt=at+Math.min(24,2**(e.failures-1))*HOUR;}
   else{e.failures=0;e.nextCheckAt=at+(/^HTTP (404|410)$/.test(outcome)?STOCK_RECHECK_MS:72*HOUR);}
  },
  stats(){const es=[...entries.values()];return {knownUrls:es.length,pending:es.filter(e=>!e.checkedAt).length,due:es.filter(e=>e.nextCheckAt<=now).length,frontierOverflow:overflow};},
  save(){return {entries:[...entries.values()]};}
 };
}
export function sitemapLocations(xml){return [...xml.matchAll(/<loc\b[^>]*>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gis)].map(m=>m[1].trim().replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'"));}
export function allowedStockSitemap(source,raw){try{const u=new URL(raw);if(u.origin!==new URL(source.url).origin||u.username||u.password||u.search||!/^https:$/.test(u.protocol))return false;
 if(source.id==='motory')return /^\/sitemap\/(?:en|ar)\/(?:sitemap|vehicle_posts(?:\d+)?)\.xml$/.test(u.pathname);
 if(source.id==='mstaml')return /^\/(?:site-map-index|sitemaps\/ads\d+)\.xml$/.test(u.pathname);
 return /sitemap[^/]*\.xml(?:\.gz)?$/.test(u.pathname);
 }catch{return false;}}

export function mergeAdditionalSnapshot(previous,incoming,removedUrls,sources){
 const key=c=>{const s=sources.find(s=>s.name===c.source);return s&&stockIdentity(s,c.url)?s.id+':'+stockIdentity(s,c.url):c.url;};
 const removed=new Set();for(const url of removedUrls||[])for(const s of sources){const id=stockIdentity(s,url);if(id)removed.add(s.id+':'+id);}
 const map=new Map();for(const c of [...previous,...incoming]){const k=key(c);if(!removed.has(k))map.set(k,c);}return [...map.values()];
}
