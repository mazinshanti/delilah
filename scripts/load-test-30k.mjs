#!/usr/bin/env node
// Bounded, isolated HTTP benchmark. Intentionally excludes live-source scans,
// OpenAI calls, payment flows, and seller writes.
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';

const base=process.env.LOAD_TEST_BASE_URL||'http://127.0.0.1:31777';
const total=Number(process.env.LOAD_TEST_REQUESTS||30000);
const concurrency=Number(process.env.LOAD_TEST_CONCURRENCY||20);
const maxDurationMs=Number(process.env.LOAD_TEST_MAX_DURATION_MS||300000);
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Load test target must be loopback only; refusing production or third-party traffic');
if(!Number.isInteger(total)||total<1||total>30000)throw Error('Invalid request count');
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>32)throw Error('Unsafe concurrency');

const cases=[
 {path:'/healthz',weight:70,name:'health'},
 {path:'/api/catalog',weight:15,name:'catalog'},
 {path:'/api/inventory?q=Toyota%20Camry&condition=used&pageSize=12',weight:15,name:'inventory-search'}
];
const stats=Object.fromEntries(cases.map(x=>[x.name,{count:0,errors:0,statuses:{},latencies:[]}]));
let next=0,done=0,failures=0,timeouts=0;
const errors=[];
const started=performance.now();
function which(n){const k=n%100;return k<70?cases[0]:k<85?cases[1]:cases[2]}
async function worker(){
 while(next<total){
  const n=next++;
  const chosen=which(n),s=stats[chosen.name],t0=performance.now();
  try{
   if(performance.now()-started>maxDurationMs)throw Error('benchmark-deadline-exceeded');
   const response=await fetch(base+chosen.path,{signal:AbortSignal.timeout(10000),headers:{'accept':'application/json'}});
   await response.arrayBuffer();
   s.statuses[response.status]=(s.statuses[response.status]||0)+1;
   if(!response.ok)throw Error('HTTP '+response.status);
  }catch(error){
   failures++;s.errors++;
   if(error.name==='TimeoutError')timeouts++;
   if(errors.length<20)errors.push({request:n,endpoint:chosen.name,message:error.message});
  }finally{
   const ms=performance.now()-t0;
   s.latencies.push(ms);s.count++;done++;
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
 test:'dalelah-30k-isolated-http',target:'loopback-isolated-dalelah',
 requestCount:done,concurrency,durationSeconds:Math.round(durationMs/10)/100,
 throughputRps:Math.round(done/durationMs*100000)/100,
 failures,timeouts,errorRatePercent:Math.round(failures/done*10000)/100,
 endpoints,firstErrors:errors,
 excludes:['live source crawling','OpenAI provider calls','production users','concurrent-user session simulation']
};
console.log(JSON.stringify(report,null,2));
await writeFile('load-test-report.json',JSON.stringify(report,null,2)+'\n');
if(done!==total||failures>total*0.01||durationMs>maxDurationMs)process.exitCode=1;
