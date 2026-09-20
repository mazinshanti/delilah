import {collectBulkInventory} from '../lib/bulk-inventory-collector.js';
import {mergeAdditionalSnapshot} from '../lib/stock-frontier.js';
import {ADDITIONAL_MARKET_SOURCES} from '../lib/additional-market-sources.js';
import {collectAdditionalStock} from '../lib/additional-stock-collector.js';
import {curlFetch} from './support/curl-fetch.mjs';
import {filterVehicleSaleListings} from '../lib/listing-quality.js';
import {collectHarajInventory,mergeHarajSnapshot} from '../lib/haraj-inventory-collector.js';
import {normalizeInventoryListing} from '../lib/inventory-normalizer.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
import {parseStructuredInventory,parseSyarahInventory,parseSaudiSaleInventory} from '../lib/public-inventory.js';
const exec=promisify(execFile);
const maxPages=Math.max(1,Math.min(1000,Number(process.env.MARKET_PAGES)||500));
await mkdir('data',{recursive:true});await mkdir('audit',{recursive:true});
const all=new Map(),diagnostics=[];
let harajCursor=0,previousDiagnostics=[],crawlState={};
try{crawlState=JSON.parse(gunzipSync(await readFile('data/stock-crawl-state.json.gz')));}catch{}
try{const old=JSON.parse(gunzipSync(await readFile('data/market-inventory.json.gz')));previousDiagnostics=old.diagnostics||[];harajCursor=old.diagnostics?.find(d=>d.source==='Haraj')?.nextCursor||0;for(const r of old.listings||[])if(Date.now()-Date.parse(r.lastSeenAt)<36*3600000)all.set(r.url,r);}catch{}
async function get(url){const {stdout}=await exec('curl',['-sS','--max-time','30','--max-filesize','12000000','-A','Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','-w','\n%{http_code}',url],{maxBuffer:12_000_000});const i=stdout.lastIndexOf('\n');const status=Number(stdout.slice(i+1));if(status!==200)throw new Error('HTTP '+status);return stdout.slice(0,i);}
const parsers={jsonld:parseStructuredInventory,syarah:parseSyarahInventory,saudisale:parseSaudiSaleInventory};
async function collect(source){
 const r=await collectBulkInventory({source,get,parse:parsers[source.adapter],previous:previousDiagnostics.find(d=>d.source===source.name),state:crawlState['bulk:'+source.id],maxPages,onRecords:records=>{for(const c of records)all.set(c.url,c);},onProgress:d=>console.log(JSON.stringify(d))});
 crawlState['bulk:'+source.id]=r.state;diagnostics.push(r.diagnostics);
}

await Promise.all([
 ...SOURCE_REGISTRY.filter(s=>parsers[s.adapter]).map(collect),
 collectAdditionalStock({previousDiagnostics,previousListings:[...all.values()],state:crawlState,fetchImpl:curlFetch,maxDurationMs:process.env.ADDITIONAL_MARKET_DURATION_MS,maxSitemaps:process.env.ADDITIONAL_MARKET_SITEMAPS,maxPages:process.env.ADDITIONAL_MARKET_PAGES,maxDetails:process.env.ADDITIONAL_MARKET_DETAILS,onProgress:d=>console.log(JSON.stringify({source:d.source,details:d.detailAttempts,accepted:d.records}))}).then(result=>{const merged=mergeAdditionalSnapshot([...all.values()],result.listings,result.removedUrls,ADDITIONAL_MARKET_SOURCES);all.clear();for(const r of merged)all.set(r.url,r);crawlState={...crawlState,...result.state};diagnostics.push(...result.diagnostics);})
]);
const haraj=await collectHarajInventory({cursor:harajCursor,previousListings:[...all.values()],pendingCandidates:previousDiagnostics.find(d=>d.source==='Haraj')?.pendingCandidates,maxDurationMs:process.env.HARAJ_DURATION_MS,maxQueries:process.env.HARAJ_QUERIES,maxDetails:process.env.HARAJ_DETAILS,onProgress:d=>console.log(JSON.stringify({source:'Haraj',queries:d.pages,details:d.detailAttempts,accepted:d.records,errors:d.errors.length}))});
const merged=mergeHarajSnapshot([...all.values()],haraj.listings);
all.clear();for(const record of merged)all.set(record.url,record);
diagnostics.push(haraj.diagnostics);
if(!diagnostics.some(d=>d.records>0))throw new Error('No source successfully refreshed; preserving previous snapshot');
await writeFile('data/market-inventory.json.gz',gzipSync(JSON.stringify({generatedAt:new Date().toISOString(),listings:filterVehicleSaleListings([...all.values()].map(c=>normalizeInventoryListing(c,{recordMetrics:true}))),diagnostics})));
await writeFile('data/stock-crawl-state.json.gz',gzipSync(JSON.stringify(crawlState)));
console.log(JSON.stringify({target:50000,totalUnique:all.size,diagnostics}));
