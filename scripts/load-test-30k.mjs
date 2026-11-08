#!/usr/bin/env node
// Simulated multi-visitor, paced load test against loopback ONLY.
// Requests are 100% local: no OpenAI traffic, no live marketplace fetches,
// no seller writes. Synthetic forwarded IPs are only permitted on loopback.
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';

const base=process.env.LOAD_TEST_BASE_URL||'http://127.0.0.1:31777';
const total=Number(process.env.LOAD_TEST_REQUESTS||30000);
const concurrency=Number(process.env.LOAD_TEST_CONCURRENCY||32);
const clients=Number(process.env.LOAD_TEST_CLIENTS||1500);
const maxDurationMs=Number(process.env.LOAD_TEST_MAX_DURATION_MS||180000);
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Refusing to load test any non-loopback target');
if(!Number.isInteger(total)||total!==30000)throw Error('This scenario requires exactly 30,000 requests');
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>32)throw Error('Unsafe concurrency');
if(!Number.isInteger(clients)||clients<1000||clients>3000)throw Error('Unsafe synthetic client count');

// 10s @ 100/s, 20s @ 250/s, 30s @ 400/s, 20s @ 450/s, 10s @ 300/s
const stages=[
 {count:1000,rate:100},
 {count:5000,rate:250},
 {count:12000,rate:400},
 {count:9000,rate:450},
 {count:3000,rate:300}
];
function schedule(n){
 let at=0;
 for(const stage of stages){
  if(n<stage.count)return at+n*1000/stage.rate;
  at+=stage.count*1000/stage.rate;n-=stage.count;
 }
 return at;
}
const cases=[
 {name:'home',weight:15,paths:['/','/cars/used/toyota/camry','/cars/used/nissan/patrol']},
 {name:'catalog',weight:20,paths:['/api/catalog']},
 {name:'inventory-search',weight:60,paths:[
  '/api/inventory?q=Toyota%20Camry&condition=used&pageSize=12',
  '/api/inventory?q=Nissan%20Patrol&condition=used&pageSize=12',
  '/api/inventory?q=Hyundai%20Elantra&condition=used&pageSize=12',
  '/api/inventory?q=Jeep%20Wrangler&condition=used&pageSize=12'
 ]},
 {name:'health',weight:5,paths:['/healthz']}
];
const stats=Object.fromEntries(cases.map(x=>[x.name,{count:0,errors:0,statuses:{},latencies:[]}]));
const started=performance.now(),errors=[];
let next=0,done=0,failures=0,timeouts=0,peakActive=0,active=0,scheduleLagMs=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function scenario(n){
 const k=n%100;
 return k<15?cases[0]:k<35?cases[1]:k<95?cases[2]:cases[3];
}
function virtualIp(n){
 const v=n%clients;
 return '198.18.'+(Math.floor(v/250)+1)+'.'+(v%250+1);
}
async function worker(){
 while(next<total){
  const n=next++;
  const deadline=started+schedule(n);
  const delay=deadline-performance.now();
  if(delay>0)await sleep(delay);
  scheduleLagMs=Math.max(scheduleLagMs,performance.now()-deadline);
  const chosen=scenario(n),s=stats[chosen.name],t0=performance.now();
  active++;peakActive=Math.max(peakActive,active);
  try{
   if(performance.now()-started>maxDurationMs)throw Error('benchmark-deadline-exceeded');
   const path=chosen.paths[Math.floor(n/100)%chosen.paths.length];
   const response=await fetch(base+path,{signal:AbortSignal.timeout(10000),headers:{
    'accept':'application/json',
    'x-forwarded-for':virtualIp(n),
    'x-load-test-synthetic':'loopback-only'
   }});
   await response.arrayBuffer();
   s.statuses[response.status]=(s.statuses[response.status]||0)+1;
   if(!response.ok)throw Error('HTTP '+response.status);
  }catch(error){
   failures++;s.errors++;if(error.name==='TimeoutError')timeouts++;
   if(errors.length<15)errors.push({request:n,endpoint:chosen.name,message:error.message});
  }finally{
   s.latencies.push(performance.now()-t0);s.count++;done++;active--;
  }
 }
}
await Promise.all(Array.from({length:concurrency},()=>worker()));
const durationMs=performance.now()-started;
function percentile(values,p){if(!values.length)return null;const a=values.slice().sort((x,y)=>x-y);return Math.round(a[Math.min(a.length-1,Math.ceil(a.length*p)-1)]*100)/100}
const endpoints=Object.fromEntries(Object.entries(stats).map(([name,s])=>[name,{
 requests:s.count,errors:s.errors,statuses:s.statuses,
 p50Ms:percentile(s.latencies,.50),p95Ms:percentile(s.latencies,.95),p99Ms:percentile(s.latencies,.99),
 maxMs:Math.round(Math.max(...s.latencies)*100)/100
}]));
const report={
 test:'dalelah-isolated-30k-ramped-virtual-visitors',
 target:'loopback-only, GitHub hosted runner',requestCount:done,
 simulatedUniqueIps:clients,concurrencyLimit:concurrency,peakActive,
 trafficStages:stages.map((x,i)=>({phase:i+1,requests:x.count,targetRps:x.rate})),
 durationSeconds:Math.round(durationMs/10)/100,
 completedRps:Math.round(done/durationMs*100000)/100,
 maxScheduleLagMs:Math.round(scheduleLagMs*100)/100,
 failures,timeouts,errorRatePercent:Math.round(failures/done*10000)/100,
 endpoints,firstErrors:errors,
 limits:['Synthetic forwarded IP identities (not 1,500 actual distributed connections)',
 'GitHub Actions runner hardware differs from production Render',
 'Excludes full POST /api/search, external marketplace crawling and OpenAI calls',
 '30,000 requests are not 30,000 simultaneous visitors']
};
console.log(JSON.stringify(report,null,2));
await writeFile('load-test-report.json',JSON.stringify(report,null,2)+'\n');
if(done!==total||failures>total*0.01||durationMs>maxDurationMs)process.exitCode=1;
