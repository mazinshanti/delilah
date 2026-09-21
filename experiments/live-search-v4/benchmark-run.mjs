import {writeFile} from 'node:fs/promises';
import {benchmark} from './benchmark.mjs';
import {provider} from './providers.mjs';
import {createSources} from './sources.mjs';
import {scheduledSources} from './study.mjs';
import {createTransport} from './transport.mjs';
import {runSearch,ResultCache} from './core.mjs';
const mode=process.env.STUDY_MODE||'hosted',name=process.env.STUDY_PROVIDER||'tavily';
if(!['baseline','scheduled','hosted','hybrid'].includes(mode))throw Error('invalid-mode');
const usage=[],hosted=provider(name,{metrics:usage});
if(['hosted','hybrid'].includes(mode)&&!hosted)throw Error('missing-provider-key: configure securely in the execution environment');
const report={mode,provider:name,at:new Date().toISOString(),budgetMs:30000,maxDetails:12,runs:[],usage};
for(const c of benchmark){
 const t=createTransport(),base=createSources(t);
 const adapters=mode==='baseline'?base:mode==='scheduled'?scheduledSources(t):mode==='hybrid'?scheduledSources(t,{webDiscovery:hosted}):{verify:base.verify,discover:async(i,o)=>o.onBatch(await hosted(i,{signal:o.signal}),'hosted-index')};
 const result=await runSearch(c.intent,{...adapters,cache:new ResultCache(),deadlineMs:30000,maxDetails:12});
 result.matches=result.matches.map(({url,source,title,price,city,condition})=>({url,source,title,price,city,condition}));
 report.runs.push({id:c.id,query:c.query,result,requests:t.stats});await writeFile(new URL(`./benchmark-${mode}-${name}.json`,import.meta.url),JSON.stringify(report,null,2));
 console.log(c.id,result.matches.length,result.firstResultMs);
}
