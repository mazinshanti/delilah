import {robotsPolicy} from './robots-policy.js';
import {isInactiveListing} from './listing-lifecycle.js';
const DAY=24*3600000;
const key=raw=>{try{const u=new URL(raw);u.hash='';return u.href.replace(/\/$/,'');}catch{return null;}};
// Only a status bound to this exact vehicle is evidence, never related ads or page-wide words.
export function exactAvailability(html,url){
 let status=null;
 const walk=node=>{
  if(!node||typeof node!=='object')return;
  const types=[node['@type']].flat();
  if(types.some(t=>['Car','Vehicle'].includes(t))&&key(node.url)===key(url)){
   for(const offer of [node.offers].flat().filter(Boolean))if(isInactiveListing({availability:offer.availability}))status=offer.availability;
  }
  if(types.includes('Offer')&&key(node.url)===key(url)&&['Car','Vehicle'].includes(node.itemOffered?.['@type'])&&isInactiveListing({availability:node.availability}))status=node.availability;
  for(const child of Object.values(node))if(child&&typeof child==='object')Array.isArray(child)?child.forEach(walk):walk(child);
 };
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 return status;
}
export async function refreshRetainedListings({records,sources,parsers,get,state={},now=Date.now,maxDetails=100,maxDurationMs=120000,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const updates=[],removedUrls=[],checks={...state},diagnostics=[];
 for(const source of sources){
  const started=now();
  const due=records.filter(c=>c.source===source.name&&!isInactiveListing(c)&&!(Number.isFinite(Date.parse(c.lastSeenAt))&&now()-Date.parse(c.lastSeenAt)<DAY)&&Number(checks[c.url]?.nextCheckAt||0)<=now()).sort((a,b)=>(checks[a.url]?.lastAttemptAt||0)-(checks[b.url]?.lastAttemptAt||0));
  if(!due.length)continue;
  const d={source:source.name,attempts:0,updated:0,removed:0,errors:[]};diagnostics.push(d);let robots;
  try{robots=await get(new URL('/robots.txt',source.url).href);}catch(e){d.errors.push('robots-unavailable');continue;}
  for(const row of due.slice(0,maxDetails)){
   if(now()-started>=maxDurationMs)break;
   const policy=robotsPolicy(robots,row.url);if(!policy.allowed||policy.delayMs>30000){checks[row.url]={lastAttemptAt:now(),nextCheckAt:now()+DAY,outcome:'source-policy'};continue;}
   await wait(policy.delayMs);d.attempts++;
   try{
    const html=await get(row.url),status=exactAvailability(html,row.url);
    if(status){removedUrls.push(row.url);d.removed++;checks[row.url]={lastAttemptAt:now(),nextCheckAt:now()+DAY,outcome:'unavailable'};continue;}
    const match=parsers[source.adapter]?.(html,source).find(c=>key(c.url)===key(row.url));
    if(match){updates.push({...row,...match,lastDetailAt:new Date(now()).toISOString(),detailChecked:true});d.updated++;}
    checks[row.url]={lastAttemptAt:now(),nextCheckAt:now()+DAY,outcome:match?'accepted':'unresolved-detail'};
   }catch(e){
    const message=String(e.message||e),removed=/^HTTP (404|410)$/.test(message);
    if(removed){removedUrls.push(row.url);d.removed++;}
    checks[row.url]={lastAttemptAt:now(),nextCheckAt:now()+(removed?DAY:3600000),outcome:message};d.errors.push(message);
    if(/HTTP (401|403|429)/.test(message))break;
   }
  }
 }
 return {updates,removedUrls,state:checks,diagnostics};
}
