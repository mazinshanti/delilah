// Read-only benchmark. Does not write to production inventory or enable sources.
import {createMarketSessionCache} from '../lib/market-session-cache.js';
import {readFile,writeFile} from 'node:fs/promises';
import {runAdaptiveMarketDiscovery,discoverMarketWithAI,createMarketDetailReader,marketListingKey,AI_MARKET_SOURCES} from '../lib/ai-market-discovery-trial.js';
import {createIntentEngine,intentSearchBody} from '../lib/ai-search-intent.js';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
const cases=[
 ['كورولا','economy sedan'],['Toyota Corolla','economy sedan'],
 ['Hyundai Elantra','sedan'],['Nissan Patrol','family SUV'],
 ['BMW X5','luxury SUV'],['Mercedes C-Class','luxury sedan'],
 ['Ford F-150','pickup'],['Porsche 911','sports car'],['MG ZS','compact SUV'],
 ['New Toyota Corolla','new sedan'],['Used Toyota Corolla','used sedan'],['تويوتا لاندكروزر 2023','exact model/year SUV']
];
if(!process.env.OPENAI_API_KEY){console.error('OPENAI_API_KEY is unavailable. Run this benchmark in the configured Render Shell; do not paste the key.');process.exit(1);}
const output=process.argv[2]||'/tmp/dalelah-ai-market-session.json';
const validated=createMarketSessionCache(),cachePath=output+'.validated-cache.json';
try{validated.restore(JSON.parse(await readFile(cachePath,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
const engine=createIntentEngine(),read=createMarketDetailReader(),cache=new Map();let cacheHits=0,cacheBytes=0;
const readDetail=async c=>{const cacheKey=marketListingKey(c.url)||c.url;if(cache.has(cacheKey)){cacheHits++;return cache.get(cacheKey);}const html=await read(c),bytes=Buffer.byteLength(html);while(cache.size&&cacheBytes+bytes>20_000_000){const key=cache.keys().next().value;cacheBytes-=Buffer.byteLength(cache.get(key));cache.delete(key);}if(bytes<=20_000_000){cache.set(cacheKey,html);cacheBytes+=bytes;}return html;};
const started=Date.now(),report={mode:'live-ai-multi-brand-session',startedAt:new Date().toISOString(),limits:{cases:cases.length,maxRoundsPerCase:2,maxDetailsPerCase:24,maxProviderToolCalls:48},coverageComplete:false,cases:[],sourcesOutsideTrial:SOURCE_REGISTRY.filter(s=>!AI_MARKET_SOURCES.some(a=>a.id===s.id)).map(({name,status,reason})=>({name,status,reason,tested:false}))};
const unique=new Map(),checked=new Set(),discovered=new Set();
for(const [query,segment]of cases){
 const start=Date.now(),understanding=await engine.understand(query);
 if(understanding.fallbackReason&&!understanding.safeFallback){report.cases.push({query,segment,status:'unsafe-intent-fallback',accepted:0});await writeFile(output,JSON.stringify(report,null,2));continue;}
 const body=intentSearchBody({query,condition:'all',filters:{}},understanding);body.discoveryQuery=query;
 let discoveryRound=0;
 const discover=(q,feedback)=>discoverMarketWithAI(q,feedback,{sourceIds:discoveryRound++===0?['haraj','syarah']:['carswitch','saudisale',...(understanding.intent.make==='Mercedes'?['mercedes']:[])]});
 const r=await runAdaptiveMarketDiscovery(body,understanding.intent,{discover,readDetail,cachedListings:validated.get(body,understanding.intent),maxRounds:2,maxDetails:24,onProgress:e=>{
  if(e.listing)console.log(JSON.stringify({stage:'accepted',query,origin:e.origin||'source-fetch',source:e.source,url:e.url,title:e.listing.title,price:e.listing.price,mileage:e.listing.mileage}));
  else if(e.stage==='discovery-diagnostics')console.log(JSON.stringify({query,...e}));
 }});
 const freshKeys=new Set(r.results.filter(r=>r.status==='accepted').map(r=>marketListingKey(r.url)));
 validated.put(r.listings.filter(c=>freshKeys.has(marketListingKey(c.url))));
 await writeFile(cachePath,JSON.stringify(validated.snapshot()));
 for(const row of r.results){const key=marketListingKey(row.url);checked.add(key);discovered.add(key);}for(const url of r.pendingUrls)discovered.add(marketListingKey(url));
 for(const car of r.listings)unique.set(marketListingKey(car.url),car);
 const {listings,...summary}=r;report.cases.push({query,segment,totalMs:Date.now()-start,...summary});
 report.uniqueDiscovered=discovered.size;report.uniqueChecked=checked.size;report.uniqueAccepted=unique.size;report.cacheHits=cacheHits;report.totalMs=Date.now()-started;
 report.listings=[...unique.values()].map(c=>({source:c.source,url:c.url,title:c.title,make:c.make,model:c.model,year:c.year,condition:c.condition,price:c.price,mileage:c.mileage,image:c.image}));
 report.sourceTotals=AI_MARKET_SOURCES.map(s=>{const rows=report.cases.flatMap(c=>c.results||[]).filter(r=>r.source===s.name);const cars=report.listings.filter(c=>c.source===s.name);return {source:s.name,uniqueChecked:new Set(rows.map(r=>marketListingKey(r.url))).size,uniqueAccepted:cars.length,withImageUrl:cars.filter(c=>c.image).length,withPrice:cars.filter(c=>c.price!=null).length,withMileage:cars.filter(c=>c.mileage!=null).length,withKnownCondition:cars.filter(c=>['new','used'].includes(c.condition)).length,imageHttpSuccess:null};});
 await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({stage:'case-complete',query,firstResultMs:r.firstResultMs,cachedAccepted:r.cachedAccepted,discovered:r.discovered,checked:r.checked,accepted:r.accepted,uniqueSessionAccepted:unique.size,totalMs:Date.now()-start}));
 if(/provider-http-(401|403|429)|not-configured/.test(r.stopReason)){report.stopReason=r.stopReason;break;}
}
report.finishedAt=new Date().toISOString();await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({stage:'session-complete',uniqueDiscovered:report.uniqueDiscovered,uniqueChecked:report.uniqueChecked,uniqueAccepted:report.uniqueAccepted,sourceTotals:report.sourceTotals,totalMs:report.totalMs,reportPath:output,coverageComplete:false},null,2));
