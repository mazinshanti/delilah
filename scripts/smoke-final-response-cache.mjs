import {performance} from 'node:perf_hooks';
const base='https://www.dalelah.co';
const expected='177035b3cd9af51a569ba1ec401e1c2f4d1b5ad4';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,options={},timeout=22000){
 const start=performance.now();
 const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(timeout)});
 const data=await response.json();
 if(!response.ok)throw Error('HTTP '+response.status+' '+JSON.stringify(data).slice(0,140));
 return {data,ms:Math.round(performance.now()-start)};
}
let observed=null;
for(let i=0;i<20;i++){
 try{
  const r=await api('/healthz',{},7000);
  observed=r.data.renderGitCommit;
  if(r.data.ok&&observed===expected)break;
 }catch{}
 await pause(3000);
}
if(observed!==expected)throw Error('deployment-not-confirmed '+observed);
const cases=[
 {query:'Toyota Camry 2022',filters:{maxPrice:150000},label:'Camry exact + verified budget'},
 {query:'أبي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة',filters:{},label:'Arabic family SUV'}
];
const output=[];
for(const c of cases){
 try{
  const first=await api('/api/search',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({query:c.query,condition:'used',filters:c.filters})});
  const check=(d)=>{
   if(!Array.isArray(d.listings)||d.resultCache?.ttlSeconds!==600||
      d.liveBufferStats?.maxListings!==2500||
      typeof d.liveDiscoveryPending!=='boolean'||
      d.complete&&d.liveDiscoveryPending)throw Error('invalid-live-search-state');
   if(c.filters.maxPrice&&d.listings.some(x=>x.year!==2022||x.priceVerified!==true||
    !(Number(x.price)>0&&Number(x.price)<=150000)))throw Error('wrong-year-or-price-leak');
   if(d.listings.some(x=>x.sourceObservedAt&&!['Haraj','OpenSooq'].includes(x.source)))
    throw Error('unsupported-observation-evidence');
  };
  check(first.data);
  const ms=[first.ms];
  let data=first.data;
  for(let i=0;i<3&&data.searchId&&!data.complete;i++){
   await pause(1100);
   const result=await api('/api/search/progress/'+encodeURIComponent(data.searchId));
   ms.push(result.ms);
   data=result.data;check(data);
  }
  output.push({label:c.label,status:'pass',requestMs:ms,
   firstResults:first.data.listings.length,lastResults:data.listings.length,
   observedUrls:data.listings.filter(x=>x.sourceObservedAt).length,
   reusedUrls:data.recentLiveBufferReused||0,complete:data.complete,sourcePending:data.liveDiscoveryPending});
 }catch(error){output.push({label:c.label,status:'error',error:String(error?.message||error)})}
}
console.log('FINAL_RESPONSE_CACHE_SMOKE '+JSON.stringify({observed,expected,output}));
if(output.some(x=>x.status!=='pass'))process.exitCode=1;
