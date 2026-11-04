import {performance} from 'node:perf_hooks';
import {resolveBodyType} from '../lib/vehicle-body-type.js';
import {ORIGINS} from '../lib/ai-search-intent.js';

const base='https://www.dalelah.co';
const expected='6057af32abfdb6c14a920c8cff81585f8d08eb77';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,opts={},timeout=15000){
 const started=performance.now(),response=await fetch(base+path,{...opts,signal:AbortSignal.timeout(timeout)});
 const value=await response.json();
 if(!response.ok)throw Error('HTTP '+response.status+': '+JSON.stringify(value).slice(0,180));
 return {data:value,ms:Math.round(performance.now()-started)};
}
const outcomes=[],started=Date.now();
let observed=null;
for(let i=0;i<20;i++){
 try{
  const h=await api('/healthz',{},9000);
  observed=h.data.renderGitCommit||null;
  if(h.data.ok&&observed===expected)break;
 }catch{}
 await pause(3000);
}
if(observed!==expected)throw Error('live release not confirmed: '+observed);
const cases=[
 {label:'Toyota Camry',query:'Toyota Camry',condition:'used',filters:{}},
 {label:'Toyota Camry 2022 budget',query:'Toyota Camry 2022',condition:'used',filters:{maxPrice:150000}},
 {label:'Arabic Japanese family SUV',query:'أبي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة',condition:'used',filters:{}},
];
for(const c of cases){
 try{
  const first=await api('/api/search',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({query:c.query,condition:c.condition,filters:c.filters})},20000);
  let d=first.data,progressCalls=0;
  const initialPending=d.liveDiscoveryPending;
  if(typeof initialPending!=='boolean')throw Error('missing liveDiscoveryPending');
  if(d.complete&&initialPending)throw Error('premature complete while live source pending');
  if(!d.complete&&!d.searchId)throw Error('incomplete search missing progress id');
  const firstResults=Array.isArray(d.listings)?d.listings.length:0;
  while(!d.complete&&d.searchId&&progressCalls<5){
   await pause(1300);
   d=(await api('/api/search/progress/'+encodeURIComponent(d.searchId),{},14000)).data;
   progressCalls++;
   if(d.complete&&d.liveDiscoveryPending)throw Error('complete while live source pending');
  }
  const listings=Array.isArray(d.listings)?d.listings:[];
  const fresh=listings.filter(x=>x.sourceObservedAt!=null);
  const invalidFresh=fresh.filter(x=>!['Haraj','OpenSooq'].includes(x.source)||
   !Number.isFinite(Date.parse(x.sourceObservedAt))||Date.parse(x.sourceObservedAt)>Date.now()+30_000);
  const freshness=d.freshnessSummary||{};
  const cache=d.liveBufferStats||{};
  const invalidBudget=c.filters.maxPrice?listings.filter(x=>x.priceVerified!==true||x.price==null||
   !(Number(x.price)>0&&Number(x.price)<=Number(c.filters.maxPrice))||Number(x.year)!==2022):[];
  const japanese=new Set(ORIGINS.Japanese.map(x=>x.toLowerCase()));
  const invalidArabic=c.label.startsWith('Arabic')?listings.filter(x=>
   !japanese.has(String(x.make||x.brand||'').toLowerCase())||
   resolveBodyType(x)!=='SUV'||
   x.priceVerified!==true||!(Number(x.price)>0&&Number(x.price)<=150000)):[];
  const valid=first.ms<10000&&invalidFresh.length===0&&invalidBudget.length===0&&
   invalidArabic.length===0&&d.resultCache?.ttlSeconds===600&&
   d.resultCache?.storesSourceImages===false&&
   Number.isInteger(cache.cachedListingUrls)&&cache.cachedListingUrls<=2500&&
   Number.isInteger(d.recentLiveBufferReused)&&
   freshness.recent+freshness.stale+freshness.unknown===listings.length;
  outcomes.push({label:c.label,status:valid?'pass':'fail',firstResponseMs:first.ms,
   firstResults,finalResults:listings.length,progressCalls,complete:d.complete,
   initialPending,finalPending:d.liveDiscoveryPending,sourceObservedFreshUrls:fresh.length,
   recentCachedReused:d.recentLiveBufferReused,cachedLiveUrls:cache.cachedListingUrls,
   invalidFreshEvidence:invalidFresh.length,invalidBudget:invalidBudget.length,
   invalidArabic:invalidArabic.length,sourceErrors:(d.sourceErrors||[]).slice(0,3)});
 }catch(error){outcomes.push({label:c.label,status:'error',error:String(error?.message||error)})}
}
console.log('LIVE_ENGINE_RELEASE_SMOKE '+JSON.stringify({expected,observed,elapsedMs:Date.now()-started,outcomes}));
if(outcomes.some(x=>x.status!=='pass'))process.exitCode=1;
