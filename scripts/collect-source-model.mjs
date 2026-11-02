import {writeFile} from 'node:fs/promises';
import {fetchHarajFast} from '../lib/haraj-fast-source.js';
import {fetchOpenSooqUsed} from '../lib/opensooq-source.js';
import {fetchSalehFast} from '../lib/saleh-fast-source.js';
import {detectRequestedModel} from '../lib/search-model-relevance.js';

const args=process.argv.slice(2);
const option=name=>{const pos=args.indexOf(name);return pos>=0?args[pos+1]:null;};
const source=option('--source'),query=String(option('--query')||'').trim();
const output=option('--output');
if (!['Haraj','OpenSooq','Saleh Cars'].includes(source) || !query || !output) {
 console.error('Usage: node scripts/collect-source-model.mjs --source "Haraj|OpenSooq|Saleh Cars" --query "Toyota Corolla" --output results.json');
 process.exit(2);
}
if(query.length>140 || !detectRequestedModel(query))throw new Error('named-vehicle-model-required');
const started=Date.now();
let result;
if(source==='Haraj') {
  // One bounded public search request using the existing adapter.
  result=await fetchHarajFast({query,timeout:6500,limit:120});
} else if(source==='OpenSooq') {
  // Native model URL, a bounded three-page scan, existing source policy.
  result=await fetchOpenSooqUsed({query,pages:3,nativeQuery:true});
} else {
  result=await fetchSalehFast({query,timeout:6500});
}
const errors=[
 ...(result.error?[String(result.error)]:[]),
 ...(Array.isArray(result.errors)?result.errors.map(e=>e?.error||String(e)):[])
];
const byUrl=new Map();
for(const car of result.listings||[]) {
 const key=String(car?.url||car?.originalUrl||'').trim();
 if(key && String(car.source||'').toLowerCase()===source.toLowerCase())byUrl.set(key,car);
}
if(!byUrl.size && errors.length)throw new Error('source-unavailable: '+errors.join('; ').slice(0,240));
const data={
 source,scannedAt:new Date().toISOString(),query,
 complete:false, // A bounded source scan cannot prove all the market was covered.
 pagesAttempted:result.pagesAttempted||1,
 errors,listings:[...byUrl.values()]
};
await writeFile(output,JSON.stringify(data,null,2),{flag:'wx'});
console.log(JSON.stringify({event:'source-collection',source,query,count:data.listings.length,
 complete:false,errors,durationMs:Date.now()-started,output}));
