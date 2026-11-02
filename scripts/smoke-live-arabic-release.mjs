import {performance} from 'node:perf_hooks';
import {resolveBodyType} from '../lib/vehicle-body-type.js';
import {ORIGINS} from '../lib/ai-search-intent.js';

const base=(process.env.DALELAH_BENCHMARK_URL||'https://www.dalelah.co').replace(/\/$/,'');
const expected=process.env.DALELAH_EXPECTED_GIT_SHA||'';
const query='أبي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function req(path,options={},timeoutMs=12000){
 const before=performance.now();
 const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(timeoutMs)});
 const data=await response.json();
 if(!response.ok)throw Error('HTTP '+response.status+': '+JSON.stringify(data).slice(0,120));
 return {data,ms:Math.round(performance.now()-before)};
}
let observed=null,ready=false;
for(let i=0;i<15;i++){
 try{
  const {data}=await req('/healthz',{},8000);
  observed=data.renderGitCommit||null;
  if(data.ok&&(!expected||observed===expected)){ready=true;break;}
 }catch{}
 await delay(4000);
}
if(!ready) {
 console.log('ARABIC_RELEASE_SMOKE '+JSON.stringify({status:'deployment-not-confirmed',expected,observed}));
 process.exitCode=1;
}else{
 try{
  const {data,ms}=await req('/api/search',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({query,condition:'used',filters:{}})
  },15000);
  const listings=Array.isArray(data.listings)?data.listings:[];
  const japanese=new Set(ORIGINS.Japanese.map(x=>x.toLowerCase()));
  const invalid=listings.filter(car=>
    !japanese.has(String(car.make||car.brand||'').toLowerCase()) ||
    resolveBodyType(car)!=='SUV' ||
    car.priceVerified!==true ||
    !(Number(car.price)>0&&Number(car.price)<=150000)
  );
  const status=(listings.length&&invalid.length===0&&data.aiProviderAttempted===false&&!data.interpretationUnavailable)?'pass':'fail';
  console.log('ARABIC_RELEASE_SMOKE '+JSON.stringify({
    status,observed,firstResponseMs:ms,listingUrls:listings.length,
    invalidHardConstraints:invalid.length,aiProviderAttempted:data.aiProviderAttempted,
    interpretationUnavailable:data.interpretationUnavailable,
    scanStatus:data.scanStatus||null,hasProgressId:Boolean(data.searchId),
    meetsFiveSecondGoal:ms<5000
  }));
  if(status!=='pass'||ms>=5000)process.exitCode=1;
 }catch(error){
  console.log('ARABIC_RELEASE_SMOKE '+JSON.stringify({status:'request-failed',observed,error:String(error?.message||error)}));
  process.exitCode=1;
 }
}
