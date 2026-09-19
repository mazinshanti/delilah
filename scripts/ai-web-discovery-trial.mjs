import {discoverHarajWithAI} from '../lib/ai-web-discovery-trial.js';
import {fetchHarajInventoryHtml,harajDetailRecord} from '../lib/haraj-inventory-collector.js';
import {robotsPolicy} from '../lib/robots-policy.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {createIntentEngine,intentSearchBody,applyIntentConstraints} from '../lib/ai-search-intent.js';
const [query='Toyota Camry',rawFilters='{}']=process.argv.slice(2),filters=JSON.parse(rawFilters),start=performance.now();
const discovery=await discoverHarajWithAI(query);
console.log(JSON.stringify({stage:'actual-web-search',...discovery}));
if(discovery.status!=='completed'){process.exitCode=2;}
else if(discovery.urls.length){
 const understanding=await createIntentEngine().understand(query);
 if(understanding.fallbackReason&&!understanding.safeFallback)throw Error('Cannot preserve query constraints');
 const body=intentSearchBody({query,condition:'used',filters},understanding),results=[];
 const rules=await fetchHarajInventoryHtml('https://haraj.com.sa/robots.txt');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 for(const url of discovery.urls){
  const policy=robotsPolicy(rules,url);
  if(!policy.allowed||policy.delayMs>30000){results.push({url,status:'source-policy-disallowed'});break;}
  await sleep(policy.delayMs);
  try{
   const html=await fetchHarajInventoryHtml(url,{rules});let reason=null;
   const record=harajDetailRecord({url},html,new Date().toISOString(),r=>{reason=r;});
   const accepted=record?applyIntentConstraints(strictDirectListings([record],body),understanding.intent):[];
   const car=accepted[0];
   results.push({url,status:car?'accepted':reason||'query-filter-rejected',listing:car?{title:car.title,source:car.source,make:car.make,model:car.model,year:car.year,price:car.price,mileage:car.mileage,condition:car.condition,image:car.image}:null});
  }catch(e){results.push({url,status:'source-fetch-failed'});if(/HTTP (401|403|429)|unsafe-source-redirect|robots-disallowed/.test(e.message))break;}
 }
 console.log(JSON.stringify({mode:'live-ai-web-discovery-trial',query,filters,webSearchCalls:discovery.webSearchCalls,discovered:discovery.urls.length,checked:results.length,accepted:results.filter(x=>x.status==='accepted').length,totalMs:Math.round(performance.now()-start),coverageComplete:false,results},null,2));
}
