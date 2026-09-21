import {parseHarajFastPage,localizedQuery} from '../../lib/haraj-fast-source.js';
import {harajListingEvidence} from '../../lib/haraj-listing-evidence.js';
import {parseSalehSitemap} from '../../lib/saleh-fast-source.js';
import {extractSalehPrice} from '../../lib/saleh-price.js';
import {extractSalehVehicleGallery} from '../../lib/saleh-image.js';
import {parseSyarahInventory,inventoryRecord,cleanText} from '../../lib/public-inventory.js';
import {catalogIntent} from '../../public/catalog.js';
import {SOURCE_REGISTRY} from '../../lib/source-registry.js';
import {resolveCondition} from '../../lib/vehicle-condition.js';
import {identity,candidateEligible} from './core.mjs';
const sources=Object.fromEntries(SOURCE_REGISTRY.map(s=>[s.id,s]));
const named=(v)=>Array.isArray(v)?named(v[0]):typeof v==='object'?v?.name:v;
export function schemaCars(html,source,{detailUrl=null}={}){
 const out=[];function walk(node){if(!node||typeof node!=='object')return;
 const types=[node['@type']].flat();
 if(types.some(t=>t==='Car'||t==='Vehicle')){
  const url=node.url;let absolute;try{absolute=new URL(url,source.url).href;}catch{return;}
  if(!identity(absolute)||detailUrl&&identity(absolute)!==identity(detailUrl))return;
  const offer=[node.offers].flat()[0]||{};
  if(/SoldOut|OutOfStock|Discontinued/.test(offer.availability||''))return;
  // No price admission from foreign-currency offers or unlabelled numbers.
  const price=offer.priceCurrency==='SAR'?offer.price:null;
  const conditionText=node.itemCondition||offer.itemCondition||'';
  const condition=/UsedCondition/.test(conditionText)?'used':/NewCondition/.test(conditionText)?'new':null;
  const city=offer.availableAtOrFrom?.address?.addressLocality||offer.areaServed?.address?.addressLocality||(source.id==='carswitch'?new URL(absolute).pathname.match(/\/(?:en\/|ar\/)?([^/]+)\/used-car\//)?.[1]:null);
  const raw={schemaType:'Car',url:absolute,title:node.name,description:node.description,make:named(node.brand),model:named(node.model),year:node.vehicleModelDate||node.modelDate||node.productionDate,condition,price,mileage:node.mileageFromOdometer?.value??null,city:city?city.replace(/\b\w/g,c=>c.toUpperCase()):null,bodyType:node.bodyType,transmission:node.vehicleTransmission,fuelType:node.fuelType,images:[node.image].flat().filter(Boolean).map(named),image:named([node.image].flat()[0])};
  raw.condition=resolveCondition(raw);const row=inventoryRecord(raw,source);if(row)out.push({...row,detailChecked:Boolean(detailUrl),evidenceLevel:detailUrl?'exact-ad-schema':'search-card-schema'});return;
 }
 for(const v of Object.values(node))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);
 }
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 const map=new Map(),conflicts=new Set();for(const r of out){const key=identity(r.url),old=map.get(key);if(old&&['price','condition','year','normalized_make','normalized_model'].some(k=>old[k]!=null&&r[k]!=null&&old[k]!==r[k]))conflicts.add(key);else map.set(key,r);}return [...map].filter(([key])=>!conflicts.has(key)).map(([,r])=>r);
}
export function planQueries(i){
 if(i.make||i.model)return [[i.make,i.model,i.year].filter(Boolean).join(' ')];
 if(i.bodyType==='SUV'&&i.originPreference==='Japanese')return ['Toyota Fortuner','Nissan X-Trail','Mazda CX-9'];
 return [];
}
export function createSources(transport,{webDiscovery=null}={}){
 async function discover(i,{signal,onBatch,diagnostics}){
  const queries=planQueries(i),jobs=[];
  const schedule=(source,url,parse)=>jobs.push((async()=>{try{const page=await transport.get(url,{signal});const rows=parse(page.text,page.url);onBatch(rows,source);diagnostics.push({stage:'discovery',source,candidates:rows.length,url});}catch(e){diagnostics.push({stage:'discovery',source,url,error:e.message});}})());
  if(i.condition!=='new')for(const q of queries){
   const cat=catalogIntent(q),city=(i.city||'saudi').toLowerCase(),make=(cat.make||'').toLowerCase(),model=(cat.model||'').toLowerCase().replace(/ /g,'-');
   const cs=`https://ksa.carswitch.com/en/${encodeURIComponent(city)}/used-cars/${make}${model?'/'+model:''}`;
   schedule('CarSwitch Saudi',cs,html=>schemaCars(html,sources.carswitch));
   schedule('Haraj',`https://haraj.com.sa/search/${encodeURIComponent(localizedQuery(q))}/`,(html,url)=>parseHarajFastPage(html,url,{query:q,filters:{},limit:24}));
  }
  if(i.condition==='new'){
   schedule('Saleh Cars','https://www.salehcars.com/sitemap.xml',html=>parseSalehSitemap(html).filter(url=>{const c=catalogIntent(decodeURIComponent(new URL(url).pathname).replace(/[-_/]/g,' '));return (!i.make||c.make===i.make)&&(!i.model||c.model===i.model);}).slice(0,8).map(url=>({source:'Saleh Cars',url,title:decodeURIComponent(new URL(url).pathname.split('/').at(-1)).replace(/-/g,' '),condition:null,price:null})));
  }
  for(const q of queries){const c=catalogIntent(q),path=[c.make,c.model].filter(Boolean).map(s=>s.toLowerCase().replace(/ /g,'-')).join('/');
   jobs.push((async()=>{try{let page=await transport.get(`https://syarah.com/en/autos/${path}`,{signal});
    if(i.condition==='new'){
     // The source's filter UI has no server-rendered stock. Follow only an
     // observed same-category pagination link; never manufacture listing URLs.
     const base=new URL(page.url),links=[];
     for(const m of page.text.matchAll(/href=["']([^"']+)["']/g)){try{const u=new URL(m[1].replace(/&amp;/g,'&'),base),n=Number(u.searchParams.get('page'));if(u.origin===base.origin&&u.pathname===base.pathname&&[...u.searchParams.keys()].every(k=>k==='page')&&Number.isInteger(n)&&n>1&&n<=20)links.push({url:u.href,n});}catch{}}
     links.sort((a,b)=>b.n-a.n);if(links.length)page=await transport.get(links[0].url,{signal});
    }
    const rows=parseSyarahInventory(page.text,sources.syarah);onBatch(rows,'Syarah');diagnostics.push({stage:'discovery',source:'Syarah',candidates:rows.length,url:page.url});
   }catch(e){diagnostics.push({stage:'discovery',source:'Syarah',error:e.message});}})());
  }
  if(webDiscovery)jobs.push(webDiscovery(i,{signal}).then(leads=>onBatch(leads,'hosted-web-search')).catch(e=>diagnostics.push({stage:'web-discovery',error:e.message})));
  else diagnostics.push({stage:'web-discovery',status:'not-configured'});
  await Promise.all(jobs);
 }
 async function verify(c,{signal}){
  const fetchUrl=c.source==='Haraj'?`https://haraj.com.sa/${new URL(c.url).pathname.split('/')[1]}/`:c.url;
  const page=await transport.get(fetchUrl,{signal});
  if(c.source==='CarSwitch Saudi')return schemaCars(page.text,sources.carswitch,{detailUrl:page.url});
  if(c.source==='Syarah')return schemaCars(page.text,sources.syarah,{detailUrl:page.url}).map(row=>({...row,city:row.city||c.city||null,cityEvidence:row.city?'exact-ad-schema':c.city?'same-ad-source-search-card':'unknown'}));
  if(c.source==='Haraj'){
   const h=harajListingEvidence(page.text,page.url);if(!h)return [];
   return [{source:'Haraj',sourceType:'marketplace',url:page.url,title:h.title,description:h.description,year:h.structuredYear||c.year,city:c.city,cityEvidence:'source-search-card',mileage:h.mileage,price:h.priceHit?.price??null,priceVerified:Boolean(h.priceHit),priceEvidence:h.priceHit?.evidence,condition:h.condition,sourceCondition:h.sourceCondition,sourceCategory:h.sourceCategory,saleVerified:true,saleEvidence:['exact-ad-detail'],image:h.images[0]||null,images:h.images,detailChecked:true}];
  }
  if(c.source==='Saleh Cars'){
   const text=cleanText(page.text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
   const title=cleanText(page.text.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
   if(!title||/sold out|out of stock|غير متوفر|نفدت الكمية/i.test(text))return [];
   const hit=extractSalehPrice(text.slice(0,9000),page.text),cat=catalogIntent(title),year=Number(title.match(/\b(20\d{2})\b/)?.[1]);
   const images=extractSalehVehicleGallery(page.text,page.url,{title});
   const condition=resolveCondition({title,description:text.slice(0,6000)});
   return [{source:'Saleh Cars',sourceType:'dealer',url:page.url,title,make:cat.make,model:cat.model,year:year||null,condition,price:hit?.price??null,priceVerified:Boolean(hit),priceEvidence:hit?.evidence,city:null,images,image:images[0]||null,saleVerified:true,saleEvidence:['exact-dealer-product-page'],detailChecked:true}];
  }
  return [];
 }
 return {discover,verify};
}
