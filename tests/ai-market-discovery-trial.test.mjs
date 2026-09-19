import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_MARKET_SOURCES,marketCandidate,marketToolUrls,createMarketDetailReader,runAdaptiveMarketDiscovery,discoverMarketWithAI} from '../lib/ai-market-discovery-trial.js';
const url='https://haraj.com.sa/12345678901/';
const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'تويوتا كورولا 2020',description:'سيارة مستعملة للبيع الممشى 50000 كم السعر 60000 ريال'})}</script>`;
test('registry restricts discovery to connected sources and exact trusted detail routes',()=>{
 assert.ok(AI_MARKET_SOURCES.length>=5);assert.ok(marketCandidate(url));
 for(const u of ['https://haraj.com.sa.evil.test/12345678901/','https://user@haraj.com.sa/12345678901/','https://haraj.com.sa/search/Corolla','http://haraj.com.sa/12345678901/','https://www.dubizzle.sa/12345678901/'])assert.equal(marketCandidate(u),null);
 assert.ok(marketCandidate('https://syarah.com/en/cardetail/toyota-corolla-12345'));
 assert.deepEqual(marketToolUrls({output:[{type:'message',content:[{text:url}]}]}).urls,[]);
});
test('provider receives connected domains and validation feedback for adaptive searches',async()=>{
 let payload;await discoverMarketWithAI('كورولا',[{accepted:0,rejected:{unknown_condition:2}}],{env:{OPENAI_API_KEY:'test'},fetchImpl:async(u,o)=>{payload=JSON.parse(o.body);return new Response(JSON.stringify({status:'completed',output:[]}));}});
 assert.ok(payload.tools[0].filters.allowed_domains.includes('syarah.com'));
 assert.equal(JSON.parse(payload.input).feedback[0].accepted,0);
});
test('adaptive rounds receive feedback, deduplicate and preserve budget hard constraints',async()=>{
 const feedback=[];let reads=0;
 const result=await runAdaptiveMarketDiscovery({query:'كورولا',condition:'all',filters:{maxPrice:50000}},{excludedMakes:[]},{maxRounds:3,discover:async(q,f)=>{feedback.push(structuredClone(f));return {status:'completed',webSearchCalls:1,urls:[url]};},readDetail:async()=>{reads++;return html;}});
 assert.equal(result.accepted,0);assert.equal(reads,1);assert.equal(result.stopReason,'no-new-urls');assert.equal(feedback[1][1].rejected['query-filter-rejected'],1);assert.equal(result.coverageComplete,false);
});
test('progress emits an accepted listing before later discovery rounds',async()=>{
 const events=[];let round=0;
 const result=await runAdaptiveMarketDiscovery({query:'كورولا',condition:'all',filters:{}},{excludedMakes:[]},{discover:async()=>{events.push('search');return {status:'completed',webSearchCalls:1,urls:round++?[]:[url]};},readDetail:async()=>html,onProgress:r=>{if(r.status==='accepted')events.push('accepted');}});
 assert.equal(result.accepted,1);assert.deepEqual(events.slice(0,3),['search','accepted','search']);
});
test('reader caches robots and pauses restricted source without following redirects',async()=>{
 const calls=[];const read=createMarketDetailReader({sleep:async()=>{},fetchImpl:async(u,o)=>{calls.push(u);assert.equal(o.redirect,'manual');return u.endsWith('robots.txt')?new Response('User-agent: *\nAllow: /'):new Response('',{status:403});}});
 await assert.rejects(read(marketCandidate(url)),/HTTP 403/);await assert.rejects(read(marketCandidate(url)),/source-paused/);assert.equal(calls.length,2);
});
test('Saudi multi-source schema keeps only the fetched car and rejects related recommendations',async()=>{
 const direct='https://ksa.carswitch.com/en/riyadh/used-car/toyota/corolla/2020/12345';
 const related='https://ksa.carswitch.com/en/riyadh/used-car/toyota/corolla/2020/67890';
 const schema=u=>({'@type':'Car',url:u,name:'Toyota Corolla 2020',brand:{name:'Toyota'},model:'Corolla',vehicleModelDate:2020,itemCondition:'https://schema.org/UsedCondition',offers:{price:60000},mileageFromOdometer:{value:50000,unitCode:'KMT'}});
 const page=`<script type="application/ld+json">${JSON.stringify([schema(direct),schema(related)])}</script>`;
 const result=await runAdaptiveMarketDiscovery({query:'Toyota Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,discover:async()=>({status:'completed',webSearchCalls:1,urls:[direct]}),readDetail:async()=>page});
 assert.equal(result.accepted,1);assert.equal(result.listings[0].url,direct);assert.equal(result.listings[0].source,'CarSwitch Saudi');
});
