import {SOURCE_REGISTRY} from './source-registry.js';
import {catalogIntent} from '../public/catalog.js';
// These are search/category routes, never fabricated listing URLs.
// Every returned detail link is still read and passed through existing evidence gates.
export function marketDiscoverySeeds(query){
 if(typeof query!=='string'||!query.trim()||query.length>180)throw Error('invalid-query');
 const {make,model}=catalogIntent(query),pages=[`https://haraj.com.sa/search/${encodeURIComponent(query.trim())}/`];
 const slug=s=>String(s).toLowerCase().replace(/\s+/g,'-');
 if(make&&model){
  pages.push(`https://syarah.com/en/autos/${slug(make)}/${slug(model)}`);
  pages.push(`https://ksa.carswitch.com/en/saudi/used-cars/${slug(make)}/${slug(model)}`);
 }
 if(make==='Mercedes')pages.push('https://www.mercedes-benz-mena.com/ksa/en/buy-used/');
 // Append verified dealer traversal pages after the initial useful source batch.
 // They remain subject to source pacing, budgets and individual vehicle checks.
 if(make)for(const source of SOURCE_REGISTRY){
  if(source.status!=='trial-discovery'||source.discoveryAdapter!=='haraj-showroom'||source.parentSource!=='haraj')continue;
  const url=new URL(source.url);
  if(url.protocol==='https:'&&url.hostname==='haraj.com.sa'&&!url.username&&!url.password&&!url.port)pages.push(url.href);
 }
 return [...new Set(pages)];
}

// Start provider discovery alongside the first source-page batch. The first batch
// can produce verified listings without waiting for the provider's response.
export function createSeededDiscovery(query,discover){
 const pages=marketDiscoverySeeds(query);let first=true,prefetched=null;
 return async(q,feedback)=>{
  if(first){first=false;prefetched=Promise.resolve().then(()=>discover(q,feedback)).catch(()=>({status:'provider-discovery-failed',urls:[],webSearchCalls:0}));return {status:'completed',urls:[],discoveryPages:pages,webSearchCalls:0,diagnostics:{origin:'catalog-source-seeds'}};}
  if(prefetched){const pending=prefetched;prefetched=null;return pending;}
  return discover(q,feedback);
 };
}
