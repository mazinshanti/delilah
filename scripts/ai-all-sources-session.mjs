// All directory targets plus unrestricted Arabic/English discovery. Read only.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createIntentEngine,intentSearchBody} from '../lib/ai-search-intent.js';
import {runDirectoryMarketSession} from '../lib/market-directory-session.js';
import {saudiMarketSearchPlan} from '../lib/saudi-market-search-plan.js';
const query=process.argv[2]||'Toyota Corolla',output=process.argv[3]||'/tmp/dalelah-all-sources.json';
const taskBudget=Number(process.argv[4]??saudiMarketSearchPlan(query).length),detailBudget=Number(process.argv[5]??60);
if(taskBudget&&!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY unavailable; run in configured Render Shell. Do not share the key.');
let previous=null;try{previous=JSON.parse(await readFile(output,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const understanding=await createIntentEngine().understand(query);
if(understanding.fallbackReason&&!understanding.safeFallback)throw Error('unsafe-intent-fallback');
const body=intentSearchBody({query,condition:'all',filters:{}},understanding);body.discoveryQuery=query;
const report=await runDirectoryMarketSession(body,understanding.intent,{previous,taskBudget,detailBudget,
 save:async data=>{await writeFile(output+'.tmp',JSON.stringify(data,null,2));await rename(output+'.tmp',output);},
 onProgress:e=>console.log(JSON.stringify(e.listing?{stage:'accepted',source:e.source,url:e.url,title:e.listing.title}:e))});
console.log(JSON.stringify({stage:'session-complete',searched:report.completedTasks.length,totalTasks:report.plan.length,leads:report.leads.length,checked:report.checked,accepted:report.accepted,pending:report.pendingUrls.length,pendingPages:report.pendingPages.length,planComplete:report.planComplete,coverageComplete:false,reportPath:output}));
