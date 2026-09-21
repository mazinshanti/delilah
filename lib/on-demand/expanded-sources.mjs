import {SOURCE_REGISTRY} from '../../lib/source-registry.js';
import {stockLinks,parseAdditionalStock} from '../../lib/additional-market-sources.js';
import {parseSaudiSaleDetail} from '../../lib/saudisale-detail-trial.js';
import {parseSaudiSaleInventory,cleanText} from '../../lib/public-inventory.js';
import {catalogIntent} from '../../public/catalog.js';
import {robotsPolicy} from '../../lib/robots-policy.js';
import {identity} from './core.mjs';
const selected=['saudisale','motory','samaco','arabwheels','kayishha','mstaml'];
export const EXPANDED_SOURCES=SOURCE_REGISTRY.filter(s=>selected.includes(s.id));
export const isAdditionalSource=name=>EXPANDED_SOURCES.some(s=>s.name===name);
const states=new WeakMap();
function state(transport){if(!states.has(transport))states.set(transport,{robots:new Map(),paused:new Map(),queues:new Map()});return states.get(transport);}
async function get(transport,url,signal,priority=0){
 const st=state(transport),origin=new URL(url).origin;
 if((st.paused.get(origin)>Date.now()))throw Error('source-paused');
 if(!st.robots.has(origin))st.robots.set(origin,transport.get(origin+'/robots.txt',{signal,priority:0.5}).then(p=>p.text).catch(e=>{st.robots.delete(origin);throw e;}));
 const robots=await st.robots.get(origin),p=robotsPolicy(robots,url);
 if(!p.allowed)throw Error('robots-disallowed');if(p.delayMs>10000)throw Error('crawl-delay-exceeds-trial-budget');
 const previous=st.queues.get(origin)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{
  if(signal?.aborted)throw Error('deadline');if((st.paused.get(origin)>Date.now()))throw Error('source-paused');
  await new Promise((resolve,reject)=>{const timer=setTimeout(done,p.delayMs);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Error('deadline'));}signal?.addEventListener('abort',abort,{once:true});});
  try{return await transport.get(url,{signal,priority,permit:target=>robotsPolicy(robots,target).allowed});}catch(e){if(/http-(401|403|429)|access-blocked/.test(e.message))st.paused.set(origin,Date.now()+60000);throw e;}
 });st.queues.set(origin,task);return task;
}
function links(html,base){const out=[];for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g)){try{const u=new URL(m[1].replace(/&amp;/g,'&'),base);if(u.origin!==new URL(base).origin)continue;out.push({url:u.href,title:cleanText(m[2])});}catch{}}return out;}
export function discoveryCandidates(html,source){
 if(source.id==='saudisale'){
  const parsed=parseSaudiSaleInventory(html,source),known=new Set(parsed.map(c=>identity(c.url)));
  return [...parsed,...links(html,source.url).filter(l=>identity(l.url)&&!known.has(identity(l.url))).map(l=>({...l,source:source.name,title:[l.title,decodeURIComponent(new URL(l.url).pathname).replace(/[-_/]/g,' ')].join(' '),condition:null,price:null}))];
 }
 return stockLinks(html,source).map(url=>({source:source.name,url,title:decodeURIComponent(new URL(url).pathname).replace(/[-_/]/g,' '),price:null,condition:null}));
}
export async function additionalDiscovery(i,{transport,signal,onBatch,diagnostics,selectedSources=null}){
 const tasks=EXPANDED_SOURCES.filter(s=>!selectedSources||selectedSources.includes(s.name)).filter(s=>s.id!=='samaco'||!i.make||['Audi','Volkswagen','Porsche','Bentley','Lamborghini','Skoda'].includes(i.make)).filter(s=>s.id!=='arabwheels'||i.condition!=='new').map(async source=>{
 let url=new URL(source.path||'/en',source.url).href;
 if(source.id==='motory'&&i.make){url=`https://ksa.motory.com/en/cars-for-sale/${i.make.toLowerCase().replace(/ /g,'-')}/${i.model?i.model.toLowerCase().replace(/ /g,'-')+'/':''}`;}
 try{
  let page=await get(transport,url,signal),rows=discoveryCandidates(page.text,source);onBatch(rows,source.name);diagnostics.push({stage:'discovery',source:source.name,url,candidates:rows.length});
  // Follow a real model navigation link when present; never fabricate ad URLs.
  if(i.model){const target=links(page.text,source.url).find(l=>{if(identity(l.url)||!/(car-models|car-classes|cars-for-sale|used-cars\/search)/.test(l.url))return false;const c=catalogIntent(decodeURIComponent(new URL(l.url).pathname).replace(/[-_/]/g,' ')+' '+l.title);return c.make===i.make&&c.model===i.model&&l.url!==url;});
   if(target){page=await get(transport,target.url,signal);rows=discoveryCandidates(page.text,source);onBatch(rows,source.name);diagnostics.push({stage:'discovery',source:source.name,url:target.url,candidates:rows.length});}
  }
 }catch(e){diagnostics.push({stage:'discovery',source:source.name,url,error:e.message});}
 });await Promise.all(tasks);
}
export async function additionalVerify(c,{transport,signal}){
 const source=EXPANDED_SOURCES.find(s=>s.name===c.source);if(!source||!identity(c.url))return [];
 const page=await get(transport,c.url,signal,1);
 const records=source.id==='saudisale'?parseSaudiSaleDetail(page.text,{source,url:page.url}):parseAdditionalStock(page.text,page.url,source).records;
 return records.filter(r=>identity(r.url)===identity(c.url)).map(r=>({...r,detailChecked:true,evidenceLevel:'exact-ad-source-adapter'}));
}

export {get as sourceGet};
