import {writeFile} from 'node:fs/promises';
import {createTransport} from './transport.mjs';
import {createSources} from './sources.mjs';
import {runSearch,ResultCache} from './core.mjs';
import {configuredWebDiscovery} from './web-discovery.mjs';
const cases=[{id:'corolla-en',query:'Toyota Corolla under 45000 in Jeddah',condition:'used'},{id:'suv-ar',query:'ابي جيب عائلي ياباني تحت 150 ألف في الرياض',condition:'used'},{id:'new-ar',query:'تويوتا كورولا جديدة تحت 100 ألف',condition:'new'},{id:'camry-en',query:'Toyota Camry under 80000 in Riyadh',condition:'used'},{id:'audi-en',query:'Audi Q8 under 300000',condition:'used'},{id:'elantra-new',query:'Hyundai Elantra new under 100000',condition:'new'}];
const transport=createTransport(),cache=new ResultCache(),adapters=createSources(transport,{webDiscovery:configuredWebDiscovery()});
const report={at:new Date().toISOString(),productionChanged:false,inventoryLoaded:false,imagesDownloaded:0,retrievalBudgetMs:60000,detailBudget:18,hostedDiscoveryConfigured:Boolean(process.env.OPENAI_API_KEY||process.env.TAVILY_API_KEY),cases:[]};
for(const c of cases.filter(c=>!process.env.TRIAL_CASE||c.id===process.env.TRIAL_CASE)){
 const start=Date.now();let baseline;
 try{baseline=JSON.parse((await transport.get('https://www.dalelah.co/api/search',{body:{query:c.query,condition:c.condition}})).text);}catch(e){report.cases.push({...c,error:'baseline-'+e.message});continue;}
 const baselineMs=Date.now()-start;
 if(baseline.interpretationUnavailable){report.cases.push({...c,error:'intent-unavailable'});continue;}
 const from=transport.stats.length,events=[];
 const result=await runSearch(baseline.intent,{...adapters,cache,deadlineMs:60000,maxDetails:18,onResult:rows=>{events.push({count:rows.length});console.log(JSON.stringify({case:c.id,event:'verified-results',count:rows.length}));}});
 let warm=null;
 if(result.matches.length){const before=transport.stats.length,t=Date.now();const hit=await runSearch(baseline.intent,{...adapters,cache});warm={count:hit.matches.length,cacheHit:hit.cacheHit,ms:Date.now()-t,requests:transport.stats.length-before};}
 const measurements=transport.stats.slice(from);
 // Persist compact diagnostic records, never the full normalized/gallery payload.
 const fields=['source','url','title','make','model','year','condition','city','cityEvidence','price','priceVerified','priceEvidence','mileage','resolvedBodyType','bodyTypeEvidence','detailChecked','evidenceLevel','rankingSignals','image'];
 result.matches=result.matches.map(row=>Object.fromEntries(fields.filter(k=>k in row).map(k=>[k,row[k]])));
 report.cases.push({...c,intent:baseline.intent,intentMode:baseline.intentMode,intentOrigin:'current production response; returned inventory excluded from experiment',baseline:{firstMs:baselineMs,count:baseline.listings?.length||0,complete:baseline.complete,ai:baseline.ai},result,events,warm,requests:measurements,cacheBytes:cache.bytes});
 await writeFile(new URL('./'+(process.env.TRIAL_REPORT||'results.json'),import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({case:c.id,matches:result.matches.length,firstMs:result.firstResultMs,totalMs:result.totalMs,requests:measurements.length,warm}));
}
await writeFile(new URL('./'+(process.env.TRIAL_REPORT||'results.json'),import.meta.url),JSON.stringify(report,null,2));
