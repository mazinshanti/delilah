import {performance} from 'node:perf_hooks';
import {isRecentlyObservedAtSource} from '../lib/recent-source-results.js';

const base=(process.env.DALELAH_SITE||'https://www.dalelah.co').replace(/\/$/,'');
const expected='938325209dc8851e2b480b9ee766bd0947e7397b';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const metrics={url:base,at:new Date().toISOString(),checks:[]};
const check=(name,pass,details={})=>metrics.checks.push({name,pass:Boolean(pass),...details});
async function req(path,options={},timeout=20000){
 const start=performance.now();
 const res=await fetch(base+path,{...options,signal:AbortSignal.timeout(timeout)});
 const data=await res.json();
 return {ok:res.ok,status:res.status,data,ms:Math.round(performance.now()-start)};
}
let health=null;
for(let attempt=0;attempt<15;attempt++){
 try{
  health=await req('/healthz',{},12000);
  if(health.ok&&health.data?.renderGitCommit===expected)break;
 }catch{}
 await pause(3500);
}
check('production-commit',health?.ok===true&&health.data?.renderGitCommit===expected,
 {observed:health?.data?.renderGitCommit||null,expected});
try{
 const coverage=await req('/api/inventory/coverage');
 check('coverage-honest',coverage.ok&&coverage.data?.marketExhaustive===false&&
  coverage.data?.marketCoveragePct===null&&coverage.data?.indexedUrlCount>1000,
 {urls:coverage.data?.indexedUrlCount,freshUrls:coverage.data?.freshUrlCount});
 for(const freshOnly of [true,false]){
  const query='Toyota Camry';
  const response=await req('/api/search',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({query,condition:'used',filters:{},freshOnly})});
  const rows=Array.isArray(response.data?.listings)?response.data.listings:[];
  let invalid=0;
  if(freshOnly)invalid=rows.filter(c=>!isRecentlyObservedAtSource(c)).length;
  check(freshOnly?'recent-only-provenance':'historical-search-still-works',
   response.ok&&response.data?.freshOnly===freshOnly&&
   (freshOnly?invalid===0:rows.length>0),
   {urls:rows.length,invalid,ms:response.ms,status:response.data?.scanStatus||null,
     sourceErrors:(response.data?.sourceErrors||[]).length});
  if(freshOnly&&response.data?.searchId){
   await pause(1200);
   try{
    const follow=await req('/api/search/progress/'+encodeURIComponent(response.data.searchId),{},12000);
    const followRows=Array.isArray(follow.data?.listings)?follow.data.listings:[];
    const extraInvalid=followRows.filter(c=>!isRecentlyObservedAtSource(c)).length;
    check('progress-stays-provenanced',follow.ok&&extraInvalid===0&&follow.data?.freshOnly===true,
     {urls:followRows.length,invalid:extraInvalid,ms:follow.ms,status:follow.data?.scanStatus});
   }catch(error){check('progress-stays-provenanced',false,{error:String(error.message||error)})}
  }
 }
}catch(error){check('smoke-request',false,{error:String(error.message||error)})}
metrics.pass=metrics.checks.every(item=>item.pass);
console.log('SOURCE_PROVENANCE_LIVE_SMOKE '+JSON.stringify(metrics));
if(!metrics.pass)process.exitCode=1;
