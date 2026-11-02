import {detectRequestedModel,listingMatchesModel} from '../lib/search-model-relevance.js';

// Bound the benchmark to avoid heavy source crawling or unbounded AI costs.
// This checks Dalelah's public API, not permission to access any marketplace.
const base=String(process.env.DALELAH_BENCHMARK_URL||'https://www.dalelah.co').replace(/\/$/,'');
const queries=String(process.env.DALELAH_BENCHMARK_QUERIES||'Toyota Corolla;Nissan Patrol')
  .split(';').map(x=>x.trim()).filter(Boolean).slice(0,4);
const requestTimeout=Number(process.env.DALELAH_BENCHMARK_TIMEOUT_MS||25000);
const maxPolls=Math.max(0,Math.min(10,Number(process.env.DALELAH_BENCHMARK_POLLS||2)));

async function read(path,options={}){
 const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(requestTimeout)});
 const text=await response.text();
 let data;try{data=JSON.parse(text)}catch{throw Error(`non-JSON ${response.status}: ${text.slice(0,120)}`)}
 if(!response.ok)throw Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0,180)}`);
 return data;
}

const summary={base,at:new Date().toISOString(),queries:[],status:'unknown'};
try{
 const health=await read('/healthz');
 summary.health={ok:health?.ok===true,service:health?.service||null};
 if(!summary.health.ok)throw Error('unhealthy-response');

 for(const query of queries){
  const started=Date.now(),model=detectRequestedModel(query);
  const byUrl=new Map(),errors=[];
  let data=await read('/api/search',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({query,condition:'used',filters:{}})
  });
  const collect=items=>{
   for(const car of Array.isArray(items)?items:[]){
    const key=String(car?.url||car?.originalUrl||'').trim();
    if(key)byUrl.set(key,car);
   }
  };
  collect(data.listings);
  for(let attempt=0;attempt<maxPolls&&data.searchId&&data.complete!==true;attempt++){
   await new Promise(resolve=>setTimeout(resolve,1200));
   try{data=await read('/api/search/progress/'+encodeURIComponent(data.searchId));collect(data.listings)}
   catch(err){errors.push(err.message);break;}
  }
  const cars=[...byUrl.values()];
  const mismatches=model?cars.filter(car=>!listingMatchesModel(car,model)).length:0;
  const sources=Object.fromEntries([...new Set(cars.map(x=>x.source||x.seller||'Unknown'))]
   .map(source=>[source,cars.filter(x=>(x.source||x.seller||'Unknown')===source).length]));
  summary.queries.push({query,model,uniqueListings:cars.length,modelMismatches:mismatches,
   sources,complete:data.complete===true,progressErrors:errors,durationMs:Date.now()-started});
 }
 summary.status=summary.queries.some(q=>q.modelMismatches>0)?'wrong-model-results':
  summary.queries.every(q=>q.uniqueListings===0)?'no-listings-found':'observed';
}catch(err){summary.status='unavailable';summary.error=err?.message||String(err)}
console.log(JSON.stringify(summary,null,2));
if(summary.status!=='observed')process.exitCode=1;
