// Run a bounded expansion without refetching existing bulk connectors. --write is for validated release preparation.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {collectAdditionalStock} from '../lib/additional-stock-collector.js';
import {ADDITIONAL_MARKET_SOURCES,stockIdentity} from '../lib/additional-market-sources.js';
import {mergeAdditionalSnapshot} from '../lib/stock-frontier.js';
import {curlFetch} from './support/curl-fetch.mjs';
const snapshot=JSON.parse(gunzipSync(await readFile('data/market-inventory.json.gz')));
let state={};try{state=JSON.parse(gunzipSync(await readFile('data/stock-crawl-state.json.gz')));}catch{}
const selected=process.env.STOCK_SOURCES?.split(','),sources=ADDITIONAL_MARKET_SOURCES.filter(s=>!selected||selected.includes(s.id));
await mkdir('audit',{recursive:true});
const checkpointPath='audit/stock-expansion-checkpoint.json.gz';let checkpoints={};
try{const saved=JSON.parse(gunzipSync(await readFile(checkpointPath)));if(saved.version===1)checkpoints=saved.sources||{};}catch{}
const resumed=Object.values(checkpoints).filter(c=>sources.some(s=>s.id===c.sourceId));
const previousListings=mergeAdditionalSnapshot(snapshot.listings,resumed.flatMap(c=>c.listings||[]),resumed.flatMap(c=>c.removedUrls||[]),sources);
for(const c of resumed)state[c.sourceId]=c.state;
const resumedById=Object.fromEntries(resumed.map(c=>[c.sourceId,c]));
let checkpointQueue=Promise.resolve();
const onCheckpoint=c=>{const source=sources.find(s=>s.id===c.sourceId),base=resumedById[c.sourceId],accepted=new Set(c.listings.map(r=>stockIdentity(source,r.url)));const removedUrls=[...new Set([...(base?.removedUrls||[]).filter(u=>!accepted.has(stockIdentity(source,u))),...c.removedUrls])];checkpoints[c.sourceId]={...c,listings:mergeAdditionalSnapshot(base?.listings||[],c.listings,removedUrls,[source]),removedUrls};checkpointQueue=checkpointQueue.then(async()=>{await writeFile(checkpointPath+'.tmp',gzipSync(JSON.stringify({version:1,updatedAt:new Date().toISOString(),sources:checkpoints})));await rename(checkpointPath+'.tmp',checkpointPath);});return checkpointQueue;};
const started=Date.now();
const result=await collectAdditionalStock({sources,state,previousListings,onCheckpoint,previousDiagnostics:snapshot.diagnostics,fetchImpl:curlFetch,maxDetails:process.env.ADDITIONAL_MARKET_DETAILS,maxPages:process.env.ADDITIONAL_MARKET_PAGES,maxSitemaps:process.env.ADDITIONAL_MARKET_SITEMAPS,maxDurationMs:process.env.ADDITIONAL_MARKET_DURATION_MS,onProgress:d=>{if(d.detailAttempts%20===0)console.log(JSON.stringify({source:d.source,checked:d.detailAttempts,accepted:d.records,known:d.knownUrls,pending:d.pending}));}});
const listings=mergeAdditionalSnapshot(previousListings,result.listings,result.removedUrls,sources);
const report={target:50000,recoveredCheckpointListings:resumed.reduce((n,c)=>n+(c.listings||[]).length,0),newlyValidated:result.listings.length,removed:result.removedUrls.length,stored:listings.length,fresh:listings.filter(c=>Date.now()-Date.parse(c.lastSeenAt)<36*3600000).length,durationMs:Date.now()-started,diagnostics:result.diagnostics};
await mkdir('audit',{recursive:true});await writeFile('audit/stock-expansion.json',JSON.stringify(report,null,2));
await writeFile('audit/stock-expansion-records.json',JSON.stringify(result.listings));
await writeFile('audit/stock-expansion-state.json.gz',gzipSync(JSON.stringify({...state,...result.state})));
if(process.argv.includes('--write')){
 await writeFile('data/market-inventory.json.gz',gzipSync(JSON.stringify({...snapshot,generatedAt:new Date().toISOString(),listings,diagnostics:[...(snapshot.diagnostics||[]).filter(d=>!sources.some(s=>s.name===d.source)),...result.diagnostics]})));
 await writeFile('data/stock-crawl-state.json.gz',gzipSync(JSON.stringify({...state,...result.state})));
}
console.log(JSON.stringify(report,null,2));
