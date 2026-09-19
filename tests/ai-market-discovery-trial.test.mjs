import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_MARKET_SOURCES,marketCandidate,marketToolUrls,createMarketDetailReader,runAdaptiveMarketDiscovery,discoverMarketWithAI,marketDiscoveryPage,detailLinksFromDiscoveryPage} from '../lib/ai-market-discovery-trial.js';
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

test('grounded citation annotations supplement tool sources but arbitrary answer URLs do not',()=>{
 const output=[{type:'web_search_call',status:'completed',action:{sources:[]}},{type:'message',content:[{text:'https://haraj.com.sa/99999999999/',annotations:[{type:'url_citation',url},{type:'url_citation',url:'https://cars.saudisale.com/en/car-classes/155/corolla/listings'}]}]}];
 const result=marketToolUrls({output});assert.deepEqual(result.urls,[url]);assert.equal(result.diagnostics.citations,2);assert.equal(result.discoveryPages.length,1);assert.equal(result.diagnostics.rejectedRoutes,0);
 assert.equal(marketToolUrls({output:output.slice(1)}).urls.length,0);
});

test('inventory pages expand only to same-source direct ads, never articles or external links',()=>{
 const page=marketDiscoveryPage('https://ksa.carswitch.com/hail/حراج-السيارات/تويوتا/كورولا');assert.ok(page);
 const direct='https://ksa.carswitch.com/en/hail/used-car/toyota/corolla/2020/12345';
 assert.deepEqual(detailLinksFromDiscoveryPage(`<a href="${direct}">car</a><a href="${direct}">duplicate</a><a href="${url}">other source</a><a href="/newsroom/car">article</a>`,page),[direct]);
 for(const raw of ['https://syarah.com/carsguide/corolla/','https://syarah.com/prices/toyota/corolla','https://ksa.carswitch.com/newsroom/car'])assert.equal(marketDiscoveryPage(raw),null);
});
test('discovered inventory page feeds its ads through the unchanged evidence gate',async()=>{
 const page='https://cars.saudisale.com/en/car-classes/155/corolla/listings';
 const direct='https://cars.saudisale.com/en/listings/abc/2020-toyota-corolla';
 const schema={'@type':'Car',url:direct,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'https://schema.org/UsedCondition',offers:{price:60000}};
 const result=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,discover:async()=>({status:'completed',webSearchCalls:1,urls:[],discoveryPages:[page,page]}),readDetail:async c=>c.discoveryPage?`<a href="${direct}">car</a>`:`<script type="application/ld+json">${JSON.stringify(schema)}</script>`});
 assert.equal(result.discoveryPages.length,1);assert.equal(result.checked,1);assert.equal(result.accepted,1);assert.equal(result.coverageComplete,false);
});
test('a large first-source queue cannot consume all rounds and later sources receive checks',async()=>{
 const haraj=Array.from({length:10},(_,i)=>`https://haraj.com.sa/${12345678901+i}/`);
 const carSwitch='https://ksa.carswitch.com/en/riyadh/used-car/toyota/corolla/2020/12345';
 let calls=0;const feedbacks=[],read=[];
 const result=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'all',filters:{}},{excludedMakes:[]},{maxRounds:2,maxDetails:4,discover:async(q,f)=>{feedbacks.push(structuredClone(f));return {status:'completed',webSearchCalls:1,urls:calls++?[carSwitch]:haraj};},readDetail:async c=>{read.push(c.url);return '';}});
 assert.equal(calls,2);assert.equal(read.length,4);assert.equal(read[2],carSwitch);
 assert.equal(result.discovered,11);assert.equal(result.pendingUrls.length,7);assert.equal(result.sourceStats.find(s=>s.source==='CarSwitch Saudi').checked,1);
 assert.ok(feedbacks[1][0].prioritySources.includes('CarSwitch Saudi'));assert.ok(!feedbacks[1][0].prioritySources.includes('Haraj'));
 assert.equal(result.firstResultMs,null);assert.equal(result.stopReason,'detail-budget');
});
test('pending candidates survive repeated AI results and are checked only once',async()=>{
 const urls=Array.from({length:4},(_,i)=>`https://haraj.com.sa/${12345678901+i}/`);const reads=[];
 const r=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'all',filters:{}},{excludedMakes:[]},{maxRounds:2,maxDetails:4,discover:async()=>({status:'completed',webSearchCalls:1,urls}),readDetail:async c=>{reads.push(c.url);return '';}});
 assert.equal(new Set(reads).size,4);assert.equal(r.pendingUrls.length,0);assert.equal(r.discovered,4);
});
test('English CarSwitch request matches Arabic schema only for the same ad ID',async()=>{
 const direct='https://ksa.carswitch.com/en/riyadh/used-car/toyota/corolla/2022/864159';
 const canonical=direct.replace('/en/','/');
 const schema=u=>({'@type':'Car',url:u,name:'Toyota Corolla 2022',brand:'Toyota',model:'Corolla',vehicleModelDate:2022,itemCondition:'https://schema.org/UsedCondition',offers:{price:60000}});
 const page=`<script type="application/ld+json">${JSON.stringify([schema(canonical),schema(canonical.replace('864159','864160'))])}</script>`;
 const r=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,discover:async()=>({status:'completed',webSearchCalls:1,urls:[direct,canonical]}),readDetail:async()=>page});
 assert.equal(r.discovered,1);assert.equal(r.checked,1);assert.equal(r.accepted,1);assert.equal(r.listings[0].url,canonical);
 assert.ok(marketCandidate('https://syarah.com/cardetail/toyota-corolla-new-283851'));
});
test('safe locale redirect obeys robots; cross-host and other-ad redirects never get fetched',async()=>{
 const direct='https://ksa.carswitch.com/en/riyadh/used-car/toyota/corolla/2022/864159';
 for(const target of [direct.replace('/en/','/'),'https://evil.test/car',direct.replace('864159','999999')]){
 const calls=[];const read=createMarketDetailReader({sleep:async()=>{},fetchImpl:async u=>{calls.push(u);if(u.endsWith('robots.txt'))return new Response('User-agent: *\nAllow: /');if(u===direct)return new Response(null,{status:308,headers:{location:target}});return new Response('exact ad');}});
 if(target===direct.replace('/en/','/'))assert.equal(await read(marketCandidate(direct)),'exact ad');else{await assert.rejects(read(marketCandidate(direct)),/unsafe-source-redirect/);assert.equal(calls.length,2);}
 }
 const read=createMarketDetailReader({sleep:async()=>{},fetchImpl:async u=>u.endsWith('robots.txt')?new Response('User-agent: *\nDisallow: /riyadh/'):new Response(null,{status:308,headers:{location:direct.replace('/en/','/')}})});
 await assert.rejects(read(marketCandidate(direct)),/robots-disallowed/);
});

test('session can scope discovery to under-covered connected sources without enabling new hosts',async()=>{
 let payload;await discoverMarketWithAI('Toyota Corolla',[],{sourceIds:['haraj','syarah','dubizzle'],env:{OPENAI_API_KEY:'test'},fetchImpl:async(u,o)=>{payload=JSON.parse(o.body);return new Response(JSON.stringify({status:'completed',output:[]}));}});
 assert.deepEqual(payload.tools[0].filters.allowed_domains,['haraj.com.sa','syarah.com']);
 assert.throws(()=>discoverMarketWithAI('Toyota',[],{sourceIds:['dubizzle']}),/no-supported-discovery-sources/);
});

test('observed Haraj English advertisements resolve to the same existing numeric route',async()=>{
 const {marketListingKey}=await import('../lib/ai-market-discovery-trial.js');
 for(const path of ['/en/11174107507/Toyota_Corolla/','/en/11174107507/','/en/11174107507']){
  assert.equal(marketCandidate('https://haraj.com.sa'+path)?.url,'https://haraj.com.sa/11174107507/');
  assert.equal(marketListingKey('https://haraj.com.sa'+path),marketListingKey('https://haraj.com.sa/11174107507/'));
 }
 for(const path of ['/en/tags/Corolla/','/en/pic/Corolla/','/en/11174107507/slug/extra','/en/not-an-id/'])assert.equal(marketCandidate('https://haraj.com.sa'+path),null);
 const en='https://haraj.com.sa/en/12345678901/Toyota_Corolla/';let reads=0;
 const result=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,discover:async()=>({status:'completed',urls:[en,url]}),readDetail:async()=>{reads++;return html;}});
 assert.equal(reads,1);assert.equal(result.accepted,1);
 // A valid route is only a candidate: unrelated ads must still fail classification.
 const bad=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'all',filters:{}},{excludedMakes:[]},{maxRounds:1,discover:async()=>({status:'completed',urls:[en]}),readDetail:async()=>html.replace('تويوتا كورولا 2020','قطع غيار تويوتا كورولا 2020')});
 assert.equal(bad.accepted,0);
});
test('Saudi Sale locale and index.php routes share exact source ad identity',async()=>{
 const {marketListingKey,parseMarketDetail}=await import('../lib/ai-market-discovery-trial.js');
 const variants=['/index.php/en/listings/8786aC/2026-toyota-corolla','/en/listings/8786aC/2026-toyota-corolla','/index.php/listings/8786aC/كورولا','/listings/8786aC/كورولا'];
 for(const p of variants)assert.equal(marketListingKey('https://cars.saudisale.com'+p),'saudisale:8786aC');
 assert.notEqual(marketListingKey('https://cars.saudisale.com/en/listings/other/2026-toyota-corolla'),'saudisale:8786aC');
 const schema=id=>({'@type':'Car',url:`https://cars.saudisale.com/en/listings/${id}/2026-toyota-corolla`,name:'Toyota Corolla 2026',brand:'Toyota',model:'Corolla',vehicleModelDate:2026,itemCondition:'https://schema.org/NewCondition',offers:{price:80000}});
 const result=parseMarketDetail(marketCandidate('https://cars.saudisale.com'+variants[0]),`<script type="application/ld+json">${JSON.stringify([schema('8786aC'),schema('other')])}</script>`);
 assert.equal(result.records.length,1);assert.match(result.records[0].url,/8786aC/);
});
test('observed model inventory and double-encoded Arabic pages are discovery-only inputs',()=>{
 const arabic='/saudi/حراج-السيارات/تويوتا/كورولا';
 const encoded=arabic.split('/').map(s=>encodeURIComponent(encodeURIComponent(s))).join('/');
 const page=marketDiscoveryPage('https://ksa.carswitch.com'+encoded);
 assert.ok(page);assert.equal(decodeURIComponent(new URL(page.url).pathname),arabic);assert.equal(marketCandidate(page.url),null);
 for(const u of ['https://syarah.com/en/autos/mg/zs','https://syarah.com/autos/toyota/corolla','https://cars.saudisale.com/en/car-models/2377/standard/listings'])assert.ok(marketDiscoveryPage(u));
 for(const u of ['https://syarah.com/en/prices/mg/zs','https://ksa.carswitch.com/en/saudi/new-cars/toyota/corolla','https://haraj.com.sa/pic/Corolla','https://syarah.com/en/autos/%253Fadmin'])assert.equal(marketDiscoveryPage(u),null);
});

test('direct accepted results are emitted before slower category traversal starts',async()=>{
 const events=[],page='https://syarah.com/en/autos';
 await runAdaptiveMarketDiscovery({query:'Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,discover:async()=>({status:'completed',urls:[url],discoveryPages:[page]}),readDetail:async c=>{events.push(c.discoveryPage?'page':'detail');return c.discoveryPage?'':html;},onProgress:e=>{if(e.status==='accepted')events.push('accepted');}});
 assert.deepEqual(events.slice(0,3),['detail','accepted','page']);
});
test('reader overlaps independent sources but serializes same-origin requests and robots',async()=>{
 const started=[],release=new Map(),robots=[];
 const read=createMarketDetailReader({sleep:async()=>{},fetchImpl:async u=>{if(u.endsWith('/robots.txt')){robots.push(u);return new Response('User-agent: *\nAllow: /');}started.push(u);await new Promise(r=>release.set(u,r));return new Response('body');}});
 const second='https://haraj.com.sa/12345678902/',other='https://syarah.com/en/cardetail/toyota-corolla-12345';
 const jobs=[read(marketCandidate(url)),read(marketCandidate(second)),read(marketCandidate(other))];
 await new Promise(r=>setImmediate(r));assert.deepEqual(new Set(started),new Set([url,other]));assert.equal(robots.length,2);
 release.get(url)();release.get(other)();await new Promise(r=>setImmediate(r));assert.ok(started.includes(second));release.get(second)();await Promise.all(jobs);assert.equal(robots.length,2);
});
test('bounded source pagination follows only observed next-page links and keeps detail validation',async()=>{
 const {nextMarketDiscoveryPage}=await import('../lib/ai-market-discovery-trial.js');
 const page='https://syarah.com/en/autos/toyota/corolla',next=page+'?page=2',ad1='https://syarah.com/en/cardetail/toyota-corolla-111',ad2='https://syarah.com/en/cardetail/toyota-corolla-222';
 assert.equal(nextMarketDiscoveryPage('<a href="?page=2">next</a>',marketDiscoveryPage(page))?.url,next);
 for(const href of ['https://evil.test/en/autos/toyota/corolla?page=2','?page=99','?page=2&redirect=https://evil.test','/en/autos/bmw/x5?page=2'])assert.equal(nextMarketDiscoveryPage(`<a href="${href}">next</a>`,marketDiscoveryPage(page)),null);
 const schema=u=>`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url:u,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'UsedCondition',offers:{price:60000}})}</script>`;
 const r=await runAdaptiveMarketDiscovery({query:'Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,maxPages:2,maxDetails:4,discover:async()=>({status:'completed',urls:[],discoveryPages:[page]}),readDetail:async c=>c.url===page?`<a href="${ad1}">car</a><a href="?page=2">next</a>`:c.url===next?`<a href="${ad2}">car</a><a href="?page=3">next</a>`:schema(c.url)});
 assert.equal(r.accepted,2);assert.equal(r.discoveryPages.length,2);assert.deepEqual(r.pendingDiscoveryPages,[page+'?page=3']);assert.equal(r.coverageComplete,false);
});
