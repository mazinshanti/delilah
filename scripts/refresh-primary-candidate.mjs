import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createTransport} from '../lib/on-demand/transport.mjs';
import {collectBulkInventory} from '../lib/bulk-inventory-collector.js';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
import {parseSyarahInventory,parseStructuredInventory} from '../lib/public-inventory.js';
import {inventoryRefreshReport} from '../lib/inventory-refresh-report.js';
const output='experiments/inventory-expansion-20260921';await mkdir(output,{recursive:true});
let savedState={};try{savedState=JSON.parse(await readFile(output+'/primary-state.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const transport=createTransport(),results=[];
try{await Promise.all(SOURCE_REGISTRY.filter(s=>['syarah','carswitch'].includes(s.id)).map(async source=>{
 const state=savedState[source.id]||{};
 const rows=new Map();const result=await collectBulkInventory({source,state,get:async(url,options)=>(await transport.get(url,options)).text,parse:source.id==='syarah'?parseSyarahInventory:parseStructuredInventory,maxPages:300,maxDurationMs:360000,onRecords:records=>records.forEach(r=>rows.set(r.url,r)),onProgress:d=>{if(d.page%20===0)console.log(JSON.stringify(d));}});
 results.push({source:source.name,listings:[...rows.values()],...result});
 await writeFile(output+'/primary-'+source.id+'.json.gz',gzipSync(JSON.stringify(results.at(-1))));
}));}finally{await transport.close();}
for(const result of results){const id=SOURCE_REGISTRY.find(s=>s.name===result.source).id;savedState[id]=result.state;}
await writeFile(output+'/primary-state.json',JSON.stringify(savedState,null,2)+'\n');
// Run after the separate additional-source pass to avoid concurrent snapshot writes.
const path=output+'/candidate-inventory.json.gz';
const candidate=JSON.parse(gunzipSync(await readFile(path))),baseline=JSON.parse(gunzipSync(await readFile('data/market-inventory.json.gz')));
const map=new Map(candidate.listings.map(r=>[r.url,r]));for(const r of results.flatMap(x=>x.listings))map.set(r.url,r);
candidate.listings=[...map.values()];candidate.generatedAt=new Date().toISOString();candidate.diagnostics.push(...results.map(x=>x.diagnostics));
await writeFile(path+'.tmp',gzipSync(JSON.stringify(candidate)));await rename(path+'.tmp',path);
const before=inventoryRefreshReport(baseline),after=inventoryRefreshReport(candidate);
const report={at:candidate.generatedAt,scope:'isolated-candidate-not-production',before,after,netStoredChange:after.rawRows-before.rawRows,netFreshDeduplicatedChange:after.deduplicatedFreshListings-before.deduplicatedFreshListings,primaryEvidence:'source-published inventory cards; not individual detail rechecks',primary:results.map(({source,listings,diagnostics})=>({source,acceptedCards:listings.length,diagnostics})),target:10000,targetReached:after.deduplicatedFreshListings>=10000};
await writeFile(output+'/final-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({stored:after.rawRows,fresh:after.deduplicatedFreshListings,net:report.netStoredChange,bySource:after.bySource}));
