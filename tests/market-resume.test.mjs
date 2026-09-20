import test from 'node:test';
import assert from 'node:assert/strict';
import {runAdaptiveMarketDiscovery} from '../lib/ai-market-discovery-trial.js';
const urls=[1,2,3].map(id=>`https://ksa.carswitch.com/en/riyadh/used-car/toyota/corolla/2020/${id}2345`);
const page='https://ksa.carswitch.com/en/saudi/used-cars/toyota/corolla';
const body={query:'Toyota Corolla',condition:'all',filters:{}},intent={excludedMakes:[]};
const html=url=>`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'https://schema.org/UsedCondition',offers:{price:60000}})}</script>`;
test('continuation spends its budget on pending ads and skips completed locale aliases',async()=>{
 const read=[];const readDetail=async c=>(read.push(c.url),html(c.url));
 const first=await runAdaptiveMarketDiscovery(body,intent,{maxRounds:1,maxDetails:1,discover:async()=>({status:'completed',urls}),readDetail});
 const second=await runAdaptiveMarketDiscovery(body,intent,{maxRounds:1,maxDetails:2,previouslyCheckedUrls:[urls[0].replace('/en/','/')],discover:async()=>({status:'completed',urls:[urls[0],...first.pendingUrls]}),readDetail});
 assert.equal(first.accepted,1);assert.equal(second.accepted,2);assert.equal(new Set(read).size,3);assert.equal(read.length,3);assert.equal(second.pendingUrls.length,0);assert.equal(second.coverageComplete,false);
});
test('previous page history does not consume the next batches page budget',async()=>{
 const next=page+'?page=2',reads=[];
 const r=await runAdaptiveMarketDiscovery(body,intent,{maxRounds:1,maxPages:1,previouslyReadPages:[page],discover:async()=>({status:'completed',urls:[],discoveryPages:[page,next]}),readDetail:async c=>{reads.push(c.url);return c.discoveryPage?`<a href="${urls[1]}">car</a>`:html(c.url);}});
 assert.deepEqual(reads,[next,urls[1]]);assert.equal(r.accepted,1);
});
test('resume history never injects records or bypasses source and hard filter checks',async()=>{
 const r=await runAdaptiveMarketDiscovery({...body,filters:{maxPrice:50000}},intent,{maxRounds:1,previouslyCheckedUrls:['https://evil.test/ad'],discover:async()=>({status:'completed',urls:[urls[0],'https://evil.test/ad']}),readDetail:async c=>html(c.url)});
 assert.equal(r.checked,1);assert.equal(r.accepted,0);assert.equal(r.results[0].status,'query-filter-rejected');
 await assert.rejects(runAdaptiveMarketDiscovery(body,intent,{previouslyReadPages:'bad'}),/invalid-resume-history/);
});
test('queued work can finish without fetching discovery pages, retaining them for later expansion',async()=>{
 const reads=[];const r=await runAdaptiveMarketDiscovery(body,intent,{maxRounds:1,maxDetails:2,maxPages:0,discover:async()=>({status:'completed',urls,discoveryPages:[page]}),readDetail:async c=>{reads.push(c.url);return html(c.url);}});
 assert.equal(r.accepted,2);assert.equal(reads.includes(page),false);assert.deepEqual(r.pendingDiscoveryPages,[page]);assert.equal(r.pendingUrls.length,1);
});
