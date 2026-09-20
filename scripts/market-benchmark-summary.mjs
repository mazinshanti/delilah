// Combine independent read-only samples without double-counting locale URLs.
import {readFile,writeFile} from 'node:fs/promises';
import {marketListingKey} from '../lib/ai-market-discovery-trial.js';
const [output,...inputs]=process.argv.slice(2);if(!output||!inputs.length)throw Error('Usage: node scripts/market-benchmark-summary.mjs OUTPUT INPUT...');
const reports=await Promise.all(inputs.map(p=>readFile(p,'utf8').then(JSON.parse)));
const cars=new Map(),checks=new Map(),attempts=[],validCandidates=new Set(),discovered=new Set(),cases=[];
for(const report of reports){
 for(const car of report.listings||[])cars.set(marketListingKey(car.url),car);
 for(const sample of report.cases||[report]){
  for(const row of sample.results||[]){const key=marketListingKey(row.url);checks.set(key,row);attempts.push(row);if(['accepted','query-filter-rejected'].includes(row.status))validCandidates.add(key);discovered.add(key);}
  for(const url of sample.pendingUrls||[])discovered.add(marketListingKey(url));
  cases.push({query:sample.query||'dealer inventory sample',discovered:sample.discovered,checked:sample.checked,accepted:sample.accepted,firstResultMs:sample.firstResultMs,totalMs:sample.coldTotalMs??sample.totalMs??report.totalMs,warmLookupMs:sample.warmLookupMs});
 }
}
const sources=[...new Set([...checks.values()].map(c=>c.source))];
const summary={coverageComplete:false,uniqueDiscovered:discovered.size,uniqueChecked:checks.size,uniqueAccepted:cars.size,cases,sourceTotals:sources.map(source=>{
 const checked=[...checks.values()].filter(c=>c.source===source),accepted=[...cars.values()].filter(c=>c.source===source);
 return {source,checked:checked.length,checkAttempts:attempts.filter(c=>c.source===source).length,validParsedVehicles:checked.filter(c=>validCandidates.has(marketListingKey(c.url))).length,accepted:accepted.length,withImage:accepted.filter(c=>c.image).length,withPrice:accepted.filter(c=>c.price!=null).length,withMileage:accepted.filter(c=>c.mileage!=null).length,withKnownCondition:accepted.filter(c=>['new','used'].includes(c.condition)).length,attemptOutcomes:attempts.filter(c=>c.source===source).reduce((m,c)=>(m[c.status]=(m[c.status]||0)+1,m),{})};
}),limitations:['Read-only local source sample, not a production UI benchmark.','Warm lookup excludes network, AI intent and UI rendering.','Discovered links and accepted listings are distinct counts.','Sources and requests were bounded; complete Saudi-market coverage is not claimed.'],inputs};
await writeFile(output,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
