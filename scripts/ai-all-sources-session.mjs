// All directory targets plus unrestricted Arabic/English discovery. Read only.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createIntentEngine,intentSearchBody} from '../lib/ai-search-intent.js';
import {runDirectoryMarketSession} from '../lib/market-directory-session.js';
import {marketDiscoverySeeds} from '../lib/market-discovery-seeds.js';
import {createMarketSessionCache} from '../lib/market-session-cache.js';
import {marketListingKey} from '../lib/ai-market-discovery-trial.js';
import {saudiMarketSearchPlan} from '../lib/saudi-market-search-plan.js';
const query=process.argv[2]||'Toyota Corolla',output=process.argv[3]||'/tmp/dalelah-all-sources.json';
const taskBudget=Number(process.argv[4]??saudiMarketSearchPlan(query).length),detailBudget=Number(process.argv[5]??60);
if(taskBudget&&!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY unavailable; run in configured Render Shell. Do not share the key.');
let previous=null;try{previous=JSON.parse(await readFile(output,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const understanding=await createIntentEngine().understand(query);
if(understanding.fallbackReason&&!understanding.safeFallback)throw Error('unsafe-intent-fallback');
const body=intentSearchBody({query,condition:'all',filters:{}},understanding);body.discoveryQuery=query;
const cache=createMarketSessionCache(),cachePath=output+'.cache.json';
try{cache.restore(JSON.parse(await readFile(cachePath,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
const priorResults=previous?.results.length||0;
const report=await runDirectoryMarketSession(body,understanding.intent,{previous,taskBudget,detailBudget,seedPages:marketDiscoverySeeds(query),cachedListings:cache.get(body,understanding.intent),
 save:async data=>{await writeFile(output+'.tmp',JSON.stringify(data,null,2));await rename(output+'.tmp',output);},
 onProgress:e=>console.log(JSON.stringify(e.listing?{stage:'accepted',source:e.source,url:e.url,title:e.listing.title}:e))});
const freshKeys=new Set(report.results.slice(priorResults).filter(r=>r.status==='accepted').map(r=>marketListingKey(r.url)));
cache.put(report.listings.filter(c=>freshKeys.has(marketListingKey(c.url))));
await writeFile(cachePath+'.tmp',JSON.stringify(cache.snapshot()));await rename(cachePath+'.tmp',cachePath);
console.log(JSON.stringify({stage:'session-complete',searched:report.completedTasks.length,totalTasks:report.plan.length,leads:report.leads.length,checked:report.checked,accepted:report.accepted,pending:report.pendingUrls.length,pendingPages:report.pendingPages.length,planComplete:report.planComplete,coverageComplete:false,reportPath:output}));
