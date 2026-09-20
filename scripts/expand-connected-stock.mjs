// Run a bounded expansion without refetching existing bulk connectors. --write is for validated release preparation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {collectAdditionalStock} from '../lib/additional-stock-collector.js';
import {ADDITIONAL_MARKET_SOURCES} from '../lib/additional-market-sources.js';
import {mergeAdditionalSnapshot} from '../lib/stock-frontier.js';
import {curlFetch} from './support/curl-fetch.mjs';
const snapshot=JSON.parse(gunzipSync(await readFile('data/market-inventory.json.gz')));
let state={};try{state=JSON.parse(gunzipSync(await readFile('data/stock-crawl-state.json.gz')));}catch{}
const selected=process.env.STOCK_SOURCES?.split(','),sources=ADDITIONAL_MARKET_SOURCES.filter(s=>!selected||selected.includes(s.id));
const started=Date.now();
const result=await collectAdditionalStock({sources,state,previousListings:snapshot.listings,previousDiagnostics:snapshot.diagnostics,fetchImpl:curlFetch,maxDetails:process.env.ADDITIONAL_MARKET_DETAILS,maxPages:process.env.ADDITIONAL_MARKET_PAGES,maxSitemaps:process.env.ADDITIONAL_MARKET_SITEMAPS,maxDurationMs:process.env.ADDITIONAL_MARKET_DURATION_MS,onProgress:d=>{if(d.detailAttempts%20===0)console.log(JSON.stringify({source:d.source,checked:d.detailAttempts,accepted:d.records,known:d.knownUrls,pending:d.pending}));}});
const listings=mergeAdditionalSnapshot(snapshot.listings,result.listings,result.removedUrls,sources);
const report={target:50000,newlyValidated:result.listings.length,removed:result.removedUrls.length,stored:listings.length,fresh:listings.filter(c=>Date.now()-Date.parse(c.lastSeenAt)<36*3600000).length,durationMs:Date.now()-started,diagnostics:result.diagnostics};
await mkdir('audit',{recursive:true});await writeFile('audit/stock-expansion.json',JSON.stringify(report,null,2));
await writeFile('audit/stock-expansion-records.json',JSON.stringify(result.listings));
await writeFile('audit/stock-expansion-state.json.gz',gzipSync(JSON.stringify({...state,...result.state})));
if(process.argv.includes('--write')){
 await writeFile('data/market-inventory.json.gz',gzipSync(JSON.stringify({...snapshot,generatedAt:new Date().toISOString(),listings,diagnostics:[...(snapshot.diagnostics||[]).filter(d=>!sources.some(s=>s.name===d.source)),...result.diagnostics]})));
 await writeFile('data/stock-crawl-state.json.gz',gzipSync(JSON.stringify({...state,...result.state})));
}
console.log(JSON.stringify(report,null,2));
