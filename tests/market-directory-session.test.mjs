import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryToolUrls,discoverDirectoryTask,runDirectoryMarketSession} from '../lib/market-directory-session.js';
import {saudiMarketSearchPlan} from '../lib/saudi-market-search-plan.js';
const body={query:'Toyota Corolla',condition:'all',filters:{}},intent={excludedMakes:[]};
const url='https://ksa.carswitch.com/riyadh/used-car/toyota/corolla/2020/123456';
const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'https://schema.org/UsedCondition',offers:{price:60000}})}</script>`;
test('discovery retains unknown hosts and unsupported known routes, never generated answer URLs',()=>{
 const urls=['https://salehcars.com/en/cars/123/car','https://haraj.com.sa/search/Corolla/','https://khaledcars.com/ar/car/corolla/401','https://127.0.0.1/car','https://secret.internal/car'];
 const r=directoryToolUrls({output:[{type:'web_search_call',status:'completed',action:{sources:urls.map(url=>({url}))}},{type:'message',content:[{text:'https://invented.sa/car',annotations:[{type:'url_citation',url:'https://newdealer.sa/car/2'}]}]}]});
 assert.equal(r.leads.length,4);assert.ok(r.leads.every(l=>l.vehicleVerified===false));assert.ok(!r.leads.some(l=>l.url.includes('invented')));
 assert.equal(directoryToolUrls({output:[{type:'message',content:[{annotations:[{type:'url_citation',url}]}]}]}).leads.length,0);
});
test('all directory tasks and both open searches run even with zero accepted results',async()=>{
 const visited=[];let active=0,peak=0;
 const r=await runDirectoryMarketSession(body,intent,{detailBudget:0,discover:async task=>{visited.push(task.id);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,1));active--;return {status:'completed',leads:[]};}});
 assert.deepEqual(new Set(visited),new Set(saudiMarketSearchPlan(body.query).map(t=>t.id)));assert.equal(peak,2);assert.equal(r.planComplete,true);assert.equal(r.coverageComplete,false);assert.equal(r.accepted,0);
});
test('directory task domain filters and open web tasks differ at provider boundary',async()=>{
 const payloads=[];const options={env:{OPENAI_API_KEY:'test'},fetchImpl:async(_,o)=>{payloads.push(JSON.parse(o.body));return new Response(JSON.stringify({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[]}}]}));}};
 for(const task of saudiMarketSearchPlan('كورولا').filter(t=>['saleh','open-ar','open-en'].includes(t.id)))await discoverDirectoryTask(task,options);
 assert.equal(payloads.length,3);assert.deepEqual(payloads[0].tools[0].filters.allowed_domains,['www.salehcars.com']);assert.equal(payloads[1].tools[0].filters,undefined);assert.equal(payloads[2].tools[0].filters,undefined);
});
test('unsupported sources retained; only supported ads read, checkpoint restores and avoids duplicates',async()=>{
 const read=[],external='https://khaledcars.com/ar/car/corolla/401';let saved;
 const r=await runDirectoryMarketSession(body,intent,{taskBudget:2,detailBudget:1,discover:async task=>({status:task.id==='otm'?'timeout':'completed',leads:[{url},{url:external}]}),readDetail:async c=>(read.push(c.url),html),save:r=>{saved=r;}});
 assert.equal(r.accepted,1);assert.deepEqual(read,[url]);assert.equal(r.leads.length,2);assert.equal(r.completedTasks.length,1);assert.equal(saved.accepted,1);
 const visited=[];const resumed=await runDirectoryMarketSession(body,intent,{previous:r,taskBudget:2,discover:async task=>(visited.push(task.id),{status:'completed',leads:[{url}]}),readDetail:async()=>{throw Error('should not reread');}});
 assert.equal(visited[0],'otm');assert.ok(!visited.includes('fourcars'));assert.equal(resumed.checked,1);assert.equal(resumed.accepted,1);
});
test('hard filters and query identity remain mandatory across full-directory work',async()=>{
 const r=await runDirectoryMarketSession({...body,filters:{maxPrice:50000}},intent,{taskBudget:1,discover:async()=>({status:'completed',leads:[{url}]}),readDetail:async()=>html});
 assert.equal(r.accepted,0);assert.equal(r.results[0].status,'query-filter-rejected');
 await assert.rejects(runDirectoryMarketSession(body,intent,{previous:r,taskBudget:0}),/checkpoint-plan-mismatch/);
});
test('checkpoint precedes source reading and unused detail work survives exhausted budget',async()=>{
 let saves=0;const r=await runDirectoryMarketSession(body,intent,{taskBudget:1,detailBudget:0,discover:async()=>({status:'completed',leads:[{url}]}),save:()=>{saves++;},readDetail:async()=>{throw Error('budget exceeded');}});
 assert.equal(r.checked,0);assert.deepEqual(r.pendingUrls,[url]);assert.ok(saves>=2);
 const resumed=await runDirectoryMarketSession(body,intent,{previous:r,taskBudget:0,detailBudget:1,discover:async()=>{throw Error('no discovery on resume');},readDetail:async()=>html});
 assert.equal(resumed.accepted,1);assert.equal(resumed.pendingUrls.length,0);
});
test('seed results arrive while AI discovery is still waiting',async()=>{
 let release;const blocked=new Promise(r=>release=r);let acceptedBeforeDiscovery=false,finished=false;
 const page='https://ksa.carswitch.com/en/saudi/used-cars/toyota/corolla';
 const r=await runDirectoryMarketSession(body,intent,{taskBudget:1,detailBudget:1,seedPages:[page],discover:async()=>{await blocked;finished=true;return {status:'completed',leads:[]};},readDetail:async c=>c.discoveryPage?`<a href="${url}">car</a>`:html,onProgress:e=>{if(e.listing){acceptedBeforeDiscovery=!finished;release();}}});
 assert.equal(acceptedBeforeDiscovery,true);assert.equal(r.accepted,1);
});
test('temporary source failure retries on resume but a rejected ad or access denial does not',async()=>{
 for(const status of ['HTTP 503','HTTP 403','query-filter-rejected']){
  let reads=0;const request=status==='query-filter-rejected'?{...body,filters:{maxPrice:50000}}:body;
  const r=await runDirectoryMarketSession(request,intent,{taskBudget:1,detailBudget:1,discover:async()=>({status:'completed',leads:[{url}]}),readDetail:async()=>{reads++;if(status==='query-filter-rejected')return html;throw Error(status);}});
  const resumed=await runDirectoryMarketSession(request,intent,{previous:r,taskBudget:0,detailBudget:1,readDetail:async()=>{reads++;return html;}});
  assert.equal(reads,status==='HTTP 503'?2:1);assert.equal(resumed.accepted,status==='HTTP 503'?1:0);
 }
});
test('temporary failures have a bounded cross-session retry count',async()=>{
 let previous=null,reads=0;
 for(let n=0;n<5;n++)previous=await runDirectoryMarketSession(body,intent,{previous,taskBudget:n?0:1,detailBudget:1,discover:async()=>({status:'completed',leads:[{url}]}),readDetail:async()=>{reads++;throw Error('HTTP 502');}});
 assert.equal(reads,3);assert.equal(previous.accepted,0);
});
test('validated warm results are emitted and returned without renewing source checks',async()=>{
 const first=await runDirectoryMarketSession(body,intent,{taskBudget:1,detailBudget:1,discover:async()=>({status:'completed',leads:[{url}]}),readDetail:async()=>html});
 const events=[];const warm=await runDirectoryMarketSession(body,intent,{taskBudget:0,detailBudget:0,cachedListings:first.listings,onProgress:e=>events.push(e)});
 assert.equal(warm.accepted,1);assert.equal(warm.cachedAccepted,1);assert.equal(warm.results.length,0);assert.equal(events[0].origin,'validated-cache');
 const filtered=await runDirectoryMarketSession({...body,filters:{maxPrice:50000}},intent,{taskBudget:0,detailBudget:0,cachedListings:first.listings});assert.equal(filtered.accepted,0);
});
