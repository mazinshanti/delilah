import {writeFile} from 'node:fs/promises';
import {benchmark} from '../experiments/live-search-v4/benchmark.mjs';
import {createIntentEngine} from '../lib/ai-search-intent.js';
import {needsAI} from '../public/search-route.js';
// Offline interpretation baseline. No retrieval, provider calls, or relevance claims.
const engine=createIntentEngine({env:{},log:()=>{}}),runs=[];
for(const c of benchmark){
 const result=await engine.understand(c.query),blocked=Boolean(result.fallbackReason&&needsAI(c.query));
 const fields=['make','model','condition','city','maxPrice','originPreference','bodyType'];
 const mismatches=fields.filter(k=>(result.intent[k]??null)!==(c.intent[k]??null));
 runs.push({id:c.id,language:c.language,query:c.query,requiresConfiguredAI:blocked,mode:result.intentMode,mismatches});
}
const report={at:new Date().toISOString(),kind:'offline-intent-readiness',liveRetrieval:false,providerCalls:0,total:runs.length,exactMatches:runs.filter(r=>!r.requiresConfiguredAI&&!r.mismatches.length).length,requiresConfiguredAI:runs.filter(r=>r.requiresConfiguredAI).length,unblockedMismatches:runs.filter(r=>!r.requiresConfiguredAI&&r.mismatches.length).length,runs};
await writeFile(new URL('../experiments/live-search-v4/intent-readiness.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,runs:undefined}));
