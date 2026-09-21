// Isolated, resumable stock expansion. Never writes the production snapshot.
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';
import {fetch,EnvHttpProxyAgent} from 'undici';
import {collectAdditionalStock} from '../lib/additional-stock-collector.js';
import {ADDITIONAL_MARKET_SOURCES} from '../lib/additional-market-sources.js';
import {mergeAdditionalSnapshot} from '../lib/stock-frontier.js';
import {inventoryRefreshReport} from '../lib/inventory-refresh-report.js';
const output=resolve(process.env.EXPANSION_OUTPUT||'experiments/inventory-expansion-20260921');
if(!output.startsWith(resolve('experiments')+'/'))throw Error('experiment-output-required');
await mkdir(output,{recursive:true});
const load=async(path,fallback)=>{try{return JSON.parse(gunzipSync(await readFile(path)));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const save=async(name,data)=>{const path=join(output,name),tmp=path+'.tmp';await writeFile(tmp,gzipSync(JSON.stringify(data)));await rename(tmp,path);};
const baseline=await load('data/market-inventory.json.gz',{listings:[]});
let prior=await load(join(output,'candidate-inventory.json.gz'),baseline);
let state=await load(join(output,'crawl-state.json.gz'),{});
const selected=(process.env.EXPANSION_SOURCES||'motory,arabwheels,kayishha,samaco,mstaml').split(',');
if(selected.some(id=>!ADDITIONAL_MARKET_SOURCES.some(s=>s.id===id)))throw Error('unknown-source');
const sources=ADDITIONAL_MARKET_SOURCES.filter(s=>selected.includes(s.id));
// Recover completed source batches after an interrupted pass.
for(const source of sources){
 const checkpoint=await load(join(output,'checkpoint-'+source.id+'.json.gz'),null);
 if(!checkpoint)continue;
 state[source.id]=checkpoint.state;
 prior={...prior,listings:mergeAdditionalSnapshot(prior.listings,checkpoint.listings,checkpoint.removedUrls,[source])};
}

const dispatcher=new EnvHttpProxyAgent({connections:2,pipelining:1,keepAliveTimeout:60000,keepAliveMaxTimeout:60000,connectTimeout:20000});
const fetchImpl=(url,options)=>fetch(url,{...options,dispatcher});
let result;
try{result=await collectAdditionalStock({sources,previousListings:prior.listings,state,fetchImpl,mediaMode:'links-only',expandNavigation:true,maxDurationMs:Number(process.env.EXPANSION_DURATION_MS)||180000,maxDetails:Number(process.env.EXPANSION_DETAILS)||120,maxPages:100,maxSitemaps:10,concurrency:2,
 onProgress:d=>{if(d.detailAttempts%10===0)console.log(JSON.stringify({source:d.source,attempted:d.detailAttempts,accepted:d.records,known:d.knownUrls}));},
 onCheckpoint:async c=>save('checkpoint-'+c.sourceId+'.json.gz',c)
});}finally{await dispatcher.destroy();}
const listings=mergeAdditionalSnapshot(prior.listings,result.listings,result.removedUrls,sources);
const candidate={generatedAt:new Date().toISOString(),listings,diagnostics:[...(prior.diagnostics||[]).filter(d=>!sources.some(s=>s.name===d.source)),...result.diagnostics]};
state={...state,...result.state};
await save('candidate-inventory.json.gz',candidate);await save('crawl-state.json.gz',state);
await save('verified-this-pass.json.gz',{generatedAt:candidate.generatedAt,listings:result.listings,removedUrls:result.removedUrls});
const before=inventoryRefreshReport(baseline,{},Date.now()),after=inventoryRefreshReport(candidate,state,Date.now());
const report={at:candidate.generatedAt,scope:'isolated-candidate-not-production',before,after,netStoredChange:after.rawRows-before.rawRows,netFreshDeduplicatedChange:after.deduplicatedFreshListings-before.deduplicatedFreshListings,verifiedThisPass:result.listings.length,removedThisPass:result.removedUrls.length,bySource:result.diagnostics,mediaMode:'links-only',target:10000,targetReached:after.deduplicatedFreshListings>=10000};
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verifiedThisPass:report.verifiedThisPass,netStoredChange:report.netStoredChange,beforeFresh:before.deduplicatedFreshListings,afterFresh:after.deduplicatedFreshListings,stored:after.rawRows,targetReached:report.targetReached}));
