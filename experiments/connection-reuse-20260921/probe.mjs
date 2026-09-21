import {writeFile} from 'node:fs/promises';
import {createTransport} from '../../lib/on-demand/transport.mjs';
import {createSources} from '../../lib/on-demand/sources.mjs';
import {runSearch} from '../../lib/on-demand/core.mjs';
import {emptyIntent} from '../../lib/ai-search-intent.js';
const runs=await Promise.all(['OpenSooq','Kayishha'].map(async source=>{
 const transport=createTransport(),adapters=createSources(transport,{selectedSources:[source]}),runs=[];
 try{for(const phase of ['cold','warm']){
 const result=await runSearch({...emptyIntent(),query:'Toyota Corolla',make:'Toyota',model:'Corolla',condition:'used',confidence:1},{...adapters,deadlineMs:30000,maxDetails:3});
 const out={source,phase,budgetMs:30000,firstResultMs:result.firstResultMs,totalMs:result.totalMs,accepted:result.matches.length,listings:result.matches.map(({url,year,price,mileage,city,condition})=>({url,year,price,mileage,city,condition})),diagnostics:result.diagnostics,transport:transport.stats.splice(0)};runs.push(out);console.log(JSON.stringify(out));
 }}finally{await transport.close();}return runs;
}));
await writeFile(new URL('./live-results.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),mode:'isolated-source-live-search-no-result-cache',runs:runs.flat()},null,2)+'\n');
