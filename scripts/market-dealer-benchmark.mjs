// Independent broad source sample. Exact details required, no generated stock IDs.
import {writeFile} from 'node:fs/promises';
import {runAdaptiveMarketDiscovery,createMarketDetailReader} from '../lib/ai-market-discovery-trial.js';
const fetchImpl=process.argv.includes('--curl')?(await import('./support/curl-fetch.mjs')).curlFetch:fetch;
const start=performance.now();
const result=await runAdaptiveMarketDiscovery({query:'__all_cars__',condition:'all',filters:{}},{excludedMakes:[]},{maxRounds:1,maxPages:2,maxDetails:12,readDetail:createMarketDetailReader({fetchImpl}),discover:async()=>({status:'completed',webSearchCalls:0,urls:[],discoveryPages:process.argv.includes('--mercedes-only')?['https://www.mercedes-benz-mena.com/ksa/en/buy-used/']:['https://cars.saudisale.com/en','https://www.mercedes-benz-mena.com/ksa/en/buy-used/']}),onProgress:e=>{if(e.listing||e.stage==='discovery-page')console.log(JSON.stringify(e.listing?{source:e.source,title:e.listing.title,status:e.status}:{stage:e.stage,source:e.source,status:e.status,links:e.detailLinks}));}});
const output=process.argv[2]||'/tmp/dalelah-dealer-benchmark.json';await writeFile(output,JSON.stringify({...result,totalMs:Math.round(performance.now()-start)},null,2));console.log(JSON.stringify({output,accepted:result.accepted,checked:result.checked,discovered:result.discovered,firstResultMs:result.firstResultMs}));
