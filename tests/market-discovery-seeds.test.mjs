import test from 'node:test';import assert from 'node:assert/strict';
import {marketDiscoverySeeds,createSeededDiscovery} from '../lib/market-discovery-seeds.js';
import {marketCandidate,marketDiscoveryPage} from '../lib/ai-market-discovery-trial.js';
test('Arabic and English catalog aliases share source category coverage',()=>{
 const english=marketDiscoverySeeds('Toyota Corolla'),arabic=marketDiscoverySeeds('كورولا');
 assert.deepEqual(english.slice(1),arabic.slice(1));assert.equal(english.length,3);
 for(const u of [...english,...arabic]){assert.ok(marketDiscoveryPage(u));assert.equal(marketCandidate(u),null);}
});
test('seed planning keeps filters out of listing evidence and handles malformed input',()=>{
 assert.ok(marketDiscoverySeeds('Toyota Corolla 2023 under 50000 SAR')[0].includes('2023'));
 for(const q of ['',null,'a'.repeat(181)])assert.throws(()=>marketDiscoverySeeds(q),/invalid-query/);
 assert.equal(marketDiscoverySeeds('something unknown').length,1);
});
test('official Mercedes seed stays within Saudi used inventory',()=>{
 const seeds=marketDiscoverySeeds('Mercedes C-Class');assert.ok(seeds.includes('https://www.mercedes-benz-mena.com/ksa/en/buy-used/'));
 assert.ok(marketDiscoveryPage(seeds.at(-1)));assert.equal(marketDiscoveryPage('https://www.mercedes-benz-mena.com/qatar/en/buy-used/'),null);
});

test('seed batch returns while provider is pending and prefetch is consumed exactly once',async()=>{
 let release,calls=0;const wait=new Promise(r=>release=r);
 const discover=createSeededDiscovery('Toyota Corolla',async()=>{calls++;await wait;return {status:'completed',urls:['https://haraj.com.sa/12345678901/'],webSearchCalls:1};});
 const seed=await discover('Toyota Corolla',[]);assert.equal(seed.webSearchCalls,0);assert.equal(seed.discoveryPages.length,3);assert.equal(calls,1);
 release();const found=await discover('Toyota Corolla',[]);assert.equal(found.urls.length,1);assert.equal(calls,1);await discover('Toyota Corolla',[]);assert.equal(calls,2);
});
test('provider rejection does not prevent initial source seeds or become unhandled',async()=>{
 const discover=createSeededDiscovery('Toyota Corolla',async()=>{throw Error('failed');});
 assert.equal((await discover('',[])).status,'completed');assert.equal((await discover('',[])).status,'provider-discovery-failed');
});
test('a validated source result is delivered before a pending AI discovery completes',async()=>{
 const {runAdaptiveMarketDiscovery}=await import('../lib/ai-market-discovery-trial.js');
 const url='https://syarah.com/en/cardetail/toyota-corolla-used-12345';
 const events=[];let release;const gate=new Promise(r=>release=r);
 const discover=createSeededDiscovery('Toyota Corolla',async()=>{await gate;events.push('provider-finished');return {status:'completed',urls:[],webSearchCalls:1};});
 const r=await runAdaptiveMarketDiscovery({query:'Toyota Corolla',condition:'used',filters:{}},{excludedMakes:[]},{discover,maxRounds:2,maxDetails:2,maxPages:3,readDetail:async c=>c.discoveryPage?`<a href="${url}">Toyota Corolla</a>`:`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'UsedCondition',offers:{price:60000}})}</script>`,onProgress:e=>{if(e.listing){events.push('verified-source-result');release();}}});
 assert.deepEqual(events,['verified-source-result','provider-finished']);assert.equal(r.accepted,1);
});
