import {writeFile} from 'node:fs/promises';
import {createTransport} from '../../lib/on-demand/transport.mjs';
import {scheduledSources} from '../../lib/on-demand/study.mjs';
import {runSearch} from '../../lib/on-demand/core.mjs';
import {emptyIntent} from '../../lib/ai-search-intent.js';
const transport=createTransport(),adapters=scheduledSources(transport),runs=[];
try{for(const phase of ['cold','warm']){
 const out=await runSearch({...emptyIntent(),query:'Toyota Corolla under 50000 SAR',make:'Toyota',model:'Corolla',maxPrice:50000,condition:'used',confidence:1},{...adapters,deadlineMs:30000,maxDetails:12});
 adapters.observe({make:'Toyota',model:'Corolla',condition:'used'},out);
 const result={phase,budgetMs:30000,firstResultMs:out.firstResultMs,totalMs:out.totalMs,accepted:out.matches.length,detailsAttempted:out.detailsAttempted,listings:out.matches.map(({url,source,year,price,mileage,city,condition})=>({url,source,year,price,mileage,city,condition})),diagnostics:out.diagnostics,transport:transport.stats.splice(0)};
 runs.push(result);console.log(JSON.stringify(result));
}}finally{await transport.close();}
await writeFile(new URL('./combined-keepalive-results.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),mode:'scheduled-all-sources-no-result-cache',runs},null,2)+'\n');
