import {readFile,writeFile} from 'node:fs/promises';
import {createTransport} from './transport.mjs';
import {createSources} from './sources.mjs';
import {scheduledSources} from './study.mjs';
import {runSearch,ResultCache} from './core.mjs';
const prior=JSON.parse(await readFile(new URL('../live-search-v3/results.json',import.meta.url)));
const corolla=JSON.parse(await readFile(new URL('../live-search-v3/corolla-retry.json',import.meta.url))).cases[0];
const cases=[corolla,...prior.cases.filter(c=>['suv-ar','audi-en','elantra-new'].includes(c.id))];
const report={at:new Date().toISOString(),intentSource:'frozen v3 production intents; interpretation excluded',deadlineMs:30000,maxDetails:12,providerLive:false,runs:[]};
for(const [index,c] of cases.entries())for(const mode of index%2?['scheduled','baseline']:['baseline','scheduled']){
 const transport=createTransport(),adapters=mode==='baseline'?createSources(transport):scheduledSources(transport);
 const result=await runSearch(c.intent,{...adapters,cache:new ResultCache(),deadlineMs:30000,maxDetails:12});
 result.matches=result.matches.map(({source,url,title,price,condition,city})=>({source,url,title,price,condition,city}));
 report.runs.push({case:c.id,mode,result,requests:transport.stats});await writeFile(new URL('./pilot-results.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({case:c.id,mode,count:result.matches.length,firstMs:result.firstResultMs}));
}
