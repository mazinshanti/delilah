import {readFile} from 'node:fs/promises';
import {createListingTrial} from '../lib/ai-listing-trial.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {createIntentEngine,intentSearchBody,applyIntentConstraints} from '../lib/ai-search-intent.js';
import {collectHarajInventory} from '../lib/haraj-inventory-collector.js';
// Input is an exact-page Haraj audit, not a production snapshot mutation.
const [path,query='Toyota Camry',filtersJson='{}']=process.argv.slice(2);
if(!path)throw Error('Usage: node scripts/ai-listing-trial.mjs audit.json query filters-json');
const engine=createListingTrial();
if(!engine.status().configured){console.log(JSON.stringify({...engine.status(),result:'blocked-missing-api-key'}));process.exitCode=2;}
else{
 const started=performance.now(),filters=JSON.parse(filtersJson),understanding=await createIntentEngine().understand(query);
 if(understanding.fallbackReason&&!understanding.safeFallback)throw Error('Search interpretation unavailable; hard constraints cannot be dropped');
 const body=intentSearchBody({query,condition:'used',filters},understanding);
 const audit=path==='--live'?await collectHarajInventory({queries:[body.query],maxQueries:1,maxDetails:12,maxDurationMs:60000}):JSON.parse(await readFile(path,'utf8'));
 const discoveryMs=Math.round(performance.now()-started);
 const records=applyIntentConstraints(strictDirectListings(audit.listings||[],body),understanding.intent).slice(0,12),results=[];let firstResultMs=null;
 for(let i=0;i<records.length;i+=2)await Promise.all(records.slice(i,i+2).map(async record=>{
  const start=performance.now(),result=await engine.inspect(record,body);
  if(result.listing&&firstResultMs===null)firstResultMs=performance.now()-started;
  const car=result.listing;
  results.push({status:result.status,latencyMs:Math.round(performance.now()-start),source:record.source,url:record.url,conflicts:result.conflicts||[],listing:car?{title:car.title,make:car.make,model:car.model,year:car.year,price:car.price,mileage:car.mileage,condition:car.condition,city:car.city,image:car.image}:null});
 }));
 console.log(JSON.stringify({...engine.status(),query,filters,intentMode:understanding.intentMode,discoveryMs,firstResultMs,totalMs:Math.round(performance.now()-started),sourceDiagnostics:audit.diagnostics,results},null,2));
}
