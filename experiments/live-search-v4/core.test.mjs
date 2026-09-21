import test from 'node:test';
import assert from 'node:assert/strict';
import {rulesIntent} from '../../lib/ai-search-intent.js';
import {candidateEligible,accepted,ResultCache,runSearch,sourceBalanced} from './core.mjs';
import {schemaCars} from './sources.mjs';
import {safeRedirect,safeTarget} from './transport.mjs';
import {createWebDiscovery} from './web-discovery.mjs';
const intent={...rulesIntent('Toyota Corolla').intent,city:'Jeddah',maxPrice:45000};
const url='https://ksa.carswitch.com/jeddah/used-car/toyota/corolla/2022/873160';
const source={id:'carswitch',name:'CarSwitch Saudi',url:'https://ksa.carswitch.com',detailPattern:/\/used-car\/.+/};
const car={source:'CarSwitch Saudi',url,title:'Toyota Corolla 2022',schemaType:'Car',make:'Toyota',model:'Corolla',year:2022,condition:'used',price:44000,priceVerified:true,city:'Jeddah',mileage:180000,listingVerified:true,detailChecked:true};
const node={ '@type':['Product','Car'],url,name:'Toyota Corolla 2022',brand:[{'name':'Toyota'}],model:'Corolla',vehicleModelDate:2022,itemCondition:'https://schema.org/UsedCondition',offers:{price:44000,priceCurrency:'SAR',availability:'https://schema.org/InStock'}};
const html=n=>`<script type="application/ld+json">${JSON.stringify(n)}</script>`;
test('missing price/city survives discovery but cannot pass final gate',()=>{const missing={...car,price:null,priceVerified:false,city:null};assert.equal(candidateEligible(missing,intent),true);assert.equal(accepted([missing],intent).length,0);});
test('known over-budget and wrong-city candidates are rejected',()=>{assert.equal(candidateEligible({...car,price:50000},intent),false);assert.equal(candidateEligible({...car,city:'Riyadh'},intent),false);});
test('exact-ad parser supports brand/type arrays without recommendation leakage',()=>{const rows=schemaCars(html([node,{...node,url:url.replace('873160','999999'),offers:{...node.offers,price:10000}}]),source,{detailUrl:url});assert.equal(rows.length,1);assert.equal(rows[0].price,44000);assert.equal(rows[0].make,'Toyota');});
test('sold and foreign-currency stock cannot pass price gate',()=>{assert.equal(schemaCars(html({...node,offers:{...node.offers,availability:'https://schema.org/SoldOut'}}),source,{detailUrl:url}).length,0);assert.equal(accepted(schemaCars(html({...node,offers:{...node.offers,priceCurrency:'AED'}}),source,{detailUrl:url}),intent).length,0);});
test('new tab rejects used evidence even if offered as new',()=>{assert.equal(accepted([car],{...intent,condition:'new'}).length,0);});
test('redirects preserve host and listing ID',()=>{assert.throws(()=>safeTarget('https://127.0.0.1/'));assert.throws(()=>safeRedirect(url,'https://example.com/'));assert.throws(()=>safeRedirect(url,url.replace('873160','999999')));assert.equal(safeRedirect(url,url.replace('.com/','.com/en/')),url.replace('.com/','.com/en/'));});
test('cache has expiry and byte bounds',()=>{let now=0;const c=new ResultCache({ttlMs:10,maxBytes:40,maxEntries:2,clock:()=>now});c.set('a',{x:'a'});assert.deepEqual(c.get('a'),{x:'a'});now=11;assert.equal(c.get('a'),null);c.set('big',{x:'a'.repeat(100)});assert.equal(c.get('big'),null);assert.ok(c.bytes<=40);});
test('verified results emit progressively; repeat avoids discovery and details',async()=>{let fetches=0,emissions=0;const cache=new ResultCache();const opts={cache,discover:async(i,{onBatch})=>{fetches++;onBatch([car]);},verify:async()=>{fetches++;return [car];},onResult:()=>emissions++};const one=await runSearch(intent,opts),two=await runSearch(intent,opts);assert.equal(one.matches.length,1);assert.equal(two.cacheHit,true);assert.equal(fetches,2);assert.equal(emissions,1);});
test('failed verification never becomes an accepted result or cached success',async()=>{const cache=new ResultCache();const result=await runSearch(intent,{cache,discover:async(i,{onBatch})=>onBatch([car]),verify:async()=>{throw Error('http-403');}});assert.equal(result.matches.length,0);assert.equal(cache.entries.size,0);});
test('deadline aborts cooperative source work',async()=>{const result=await runSearch(intent,{deadlineMs:20,discover:async(i,{signal})=>new Promise(resolve=>signal.addEventListener('abort',resolve)),verify:async()=>[]});assert.equal(result.deadlineReached,true);assert.ok(result.totalMs<500);});
test('hosted discovery admits supported listing URLs only, never snippet prices',async()=>{assert.equal(createWebDiscovery({key:''}),null);const provider=createWebDiscovery({key:'test',fetchImpl:async()=>({ok:true,json:async()=>({results:[{url,title:'Toyota Corolla 2022',content:'Only 10 SAR'},{url:'https://example.com/offer',title:'car'}]})})});const rows=await provider(intent,{});assert.equal(rows.length,1);assert.equal(rows[0].price,null);assert.equal(rows[0].detailChecked,undefined);});
test('source interleaving preserves matches without merging distinct same-model cars',()=>{const rows=sourceBalanced([car,{...car,url:url.replace('873160','873180')},{...car,source:'Haraj',url:'https://haraj.com.sa/11189013208/ad'}]);assert.equal(rows.length,3);assert.equal(rows[1].source,'Haraj');});
test('slow source does not occupy every verification worker',async()=>{
 const slow={...car,source:'Haraj',url:'https://haraj.com.sa/11189013208/ad'};let fastVerified=false;
 const result=await runSearch(intent,{deadlineMs:500,discover:async(i,{onBatch})=>{onBatch([slow,{...slow,url:'https://haraj.com.sa/11189013209/ad'},{...slow,url:'https://haraj.com.sa/11189013210/ad'},{...slow,url:'https://haraj.com.sa/11189013211/ad'}]);await new Promise(r=>setTimeout(r,5));onBatch([car]);},verify:async(c)=>{if(c.source==='Haraj'){await new Promise(r=>setTimeout(r,60));assert.equal(fastVerified,true);return [];}fastVerified=true;return [car];}});
 assert.equal(result.matches.length,1);
});
test('conflicting exact-ad prices are withheld',()=>{assert.equal(schemaCars(html([node,{...node,offers:{...node.offers,price:30000}}]),source,{detailUrl:url}).length,0);});
test('existing hosted provider uses grounded sources and ignores generated URLs',async()=>{
 const {configuredWebDiscovery}=await import('./web-discovery.mjs');let calls=0;
 const discover=configuredWebDiscovery({env:{OPENAI_API_KEY:'test'},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url}]}},{type:'message',content:[{type:'output_text',text:'https://example.com/invented-car'}]}]})};}});
 const rows=await discover(intent,{});assert.equal(calls,1);assert.equal(rows.length,1);assert.equal(rows[0].url,url);assert.equal(rows[0].price,null);
});
test('expanded identities preserve source IDs and reject foreign/unsupported routes',async()=>{
 const {identity}=await import('./core.mjs');
 assert.equal(identity('https://cars.saudisale.com/en/listings/8786aC/2026-toyota-corolla'),identity('https://cars.saudisale.com/index.php/en/listings/8786aC/2026-toyota-corolla'));
 assert.ok(identity('https://ksa.motory.com/en/cars-for-sale/toyota/corolla/xli/2026/123456/'));
 assert.ok(identity('https://www.samaco.com.sa/stock/123456-audi-q8/'));
 assert.ok(identity('https://www.arabwheels.sa/used-cars/audi-q8-2023-for-sale-in-riyadh-9623'));
 assert.equal(identity('https://www.dubizzle.sa/123456'),null);
});
test('six-model discovery expansion preserves origin and body constraints',async()=>{
 const {planQueries}=await import('./sources.mjs');const {catalogIntent}=await import('../../public/catalog.js');const {resolveBodyType}=await import('../../lib/vehicle-body-type.js');const {ORIGINS}=await import('../../lib/ai-search-intent.js');
 const queries=planQueries({...intent,make:null,model:null,bodyType:'SUV',originPreference:'Japanese'});
 assert.equal(queries.length,6);for(const query of queries){const c=catalogIntent(query);assert.ok(ORIGINS.Japanese.includes(c.make));assert.equal(resolveBodyType(c),'SUV');}
 assert.deepEqual(planQueries(intent),['Toyota Corolla']);
});


test('Saudi Sale URL identity supplies discovery hints when anchor text is empty',async()=>{
 const {discoveryCandidates,EXPANDED_SOURCES}=await import('./expanded-sources.mjs');
 const source=EXPANDED_SOURCES.find(s=>s.id==='saudisale');
 const rows=discoveryCandidates('<a href="/en/listings/abc123/2025-mercedes-benz-gt-43-amg"></a>',source);
 assert.equal(rows.length,1);
 assert.equal(candidateEligible(rows[0],{make:'Toyota',model:'Corolla',excludedMakes:[]}),false);
});

test('failed robots requests can retry without retaining an aborted search',async()=>{
 const {additionalDiscovery}=await import('./expanded-sources.mjs');
 let calls=0;const transport={get:async()=>{calls++;throw Error('deadline');}};
 const intent={make:'Toyota',model:'Corolla',condition:'new'},options={transport,onBatch:()=>{},diagnostics:[]};
 await additionalDiscovery(intent,options);assert.equal(calls,2);
 await additionalDiscovery(intent,options);assert.equal(calls,4);
});
