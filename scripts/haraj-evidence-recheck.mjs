// Read-only recheck of existing rejected URLs. No AI provider calls or inventory writes.
import fs from 'node:fs/promises';
import {marketCandidate,marketListingKey,createMarketDetailReader,parseMarketDetail} from '../lib/ai-market-discovery-trial.js';
import {createIntentEngine,intentSearchBody,applyIntentConstraints} from '../lib/ai-search-intent.js';
import {strictDirectListings} from '../lib/direct-search.js';
const input=process.argv[2];
if(!input)throw Error('Pass the existing session-report.json path');
const report=JSON.parse(await fs.readFile(input,'utf8'));
const queues=(report.cases||[]).map(c=>({query:c.query,rows:(c.results||[]).filter(r=>r.source==='Haraj'&&['missing_title_year','unknown_condition'].includes(r.status))}));
const selected=[],seen=new Set();
while(selected.length<12&&queues.some(q=>q.rows.length))for(const q of queues){
 const row=q.rows.shift();if(!row||selected.length>=12)continue;
 const candidate=marketCandidate(row.url),key=candidate&&marketListingKey(candidate.url);
 if(!candidate||candidate.source.id!=='haraj'||seen.has(key))continue;
 seen.add(key);selected.push({query:q.query,previous:row.status,candidate});
}
const engine=createIntentEngine({env:{}}),read=createMarketDetailReader(),results=[],started=Date.now();
for(const item of selected){
 const result={query:item.query,url:item.candidate.url,previous:item.previous};
 try{
  const understanding=await engine.understand(item.query);
  if(understanding.fallbackReason&&!understanding.safeFallback)throw Error('unsafe-intent-fallback');
  const body=intentSearchBody({query:item.query,condition:'all',filters:{}},understanding);
  const parsed=parseMarketDetail(item.candidate,await read(item.candidate));
  const car=applyIntentConstraints(strictDirectListings(parsed.records,body),understanding.intent)[0];
  result.status=car?'accepted':parsed.records.length?'query-filter-rejected':parsed.reason||'no-exact-vehicle-evidence';
  if(car)result.listing={title:car.title,make:car.make,model:car.model,year:car.year,condition:car.condition,price:car.price,mileage:car.mileage};
 }catch(e){result.status=/^HTTP \d{3}$|^robots-disallowed$|^source-paused$|^unsafe-intent-fallback$/.test(e.message)?e.message:'source-fetch-failed';}
 results.push(result);console.log(JSON.stringify(result));
}
const summary={stage:'haraj-recheck-complete',checked:results.length,recovered:results.filter(r=>r.status==='accepted').length,aiCalls:0,totalMs:Date.now()-started,results};
await fs.writeFile(input+'.haraj-recheck.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,results:undefined,reportPath:input+'.haraj-recheck.json'}));
