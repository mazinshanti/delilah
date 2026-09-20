// Bounded read-only source benchmark; no API key, inventory writes or production changes.
import {writeFile} from 'node:fs/promises';
import {runAdaptiveMarketDiscovery,createMarketDetailReader,marketListingKey} from '../lib/ai-market-discovery-trial.js';
import {marketDiscoverySeeds} from '../lib/market-discovery-seeds.js';
import {createMarketSessionCache} from '../lib/market-session-cache.js';
const output=process.argv[2]||'/tmp/dalelah-direct-benchmark.json';
const transport=process.argv.includes('--curl')?(await import('./support/curl-fetch.mjs')).curlFetch:fetch;
const reader=createMarketDetailReader({fetchImpl:transport}),cache=createMarketSessionCache(),reads=[];
const readDetail=async c=>{const start=performance.now();let outcome='ok';try{return await reader(c);}catch(e){outcome=e.name==='AbortError'?'timeout':/^HTTP \d{3}$/.test(e.message)?e.message:'fetch-failed';throw e;}finally{reads.push({source:c.source.name,kind:c.discoveryPage?'discovery-page':'detail',outcome,durationMs:Math.round(performance.now()-start)});}};
const cases=['Toyota Corolla','كورولا','Hyundai Elantra','Nissan Patrol','BMW X5','Mercedes C-Class','Ford F-150','Porsche 911','MG ZS'];
const report={mode:'direct-source-benchmark',startedAt:new Date().toISOString(),coverageComplete:false,webSearchCalls:0,cases:[],limits:{maxDetailsPerQuery:18,maxPagesPerQuery:4},uniqueAccepted:0};
const unique=new Map();
for(const query of cases){
 const readOffset=reads.length,started=performance.now(),body={query,condition:'all',filters:{}},intent={excludedMakes:[]};
 const r=await runAdaptiveMarketDiscovery(body,intent,{maxRounds:1,maxDetails:18,maxPages:4,readDetail,discover:async()=>({status:'completed',urls:[],discoveryPages:marketDiscoverySeeds(query),webSearchCalls:0}),onProgress:e=>{if(e.stage==='discovery-page'||e.listing)console.log(JSON.stringify({query,...(e.listing?{source:e.source,status:e.status,title:e.listing.title}:{stage:e.stage,source:e.source,status:e.status,detailLinks:e.detailLinks})}));}});
 const coldTotalMs=Math.round(performance.now()-started);cache.put(r.listings);
 const warmStart=performance.now(),warm=cache.get(body,intent);const warmLookupMs=performance.now()-warmStart;
 for(const car of r.listings)unique.set(marketListingKey(car.url),car);
 const {listings,...summary}=r;report.cases.push({query,coldTotalMs,warmLookupMs,warmAccepted:warm.length,reads:reads.slice(readOffset),...summary});report.uniqueAccepted=unique.size;report.listings=[...unique.values()].map(c=>({source:c.source,url:c.url,title:c.title,make:c.make,model:c.model,year:c.year,condition:c.condition,price:c.price,mileage:c.mileage,image:c.image}));
 await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({query,firstResultMs:r.firstResultMs,coldTotalMs,discovered:r.discovered,checked:r.checked,accepted:r.accepted,warmAccepted:warm.length,warmLookupMs}));
}
report.finishedAt=new Date().toISOString();await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({reportPath:output,uniqueAccepted:report.uniqueAccepted,coverageComplete:false}));
