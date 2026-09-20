import test from 'node:test';import assert from 'node:assert/strict';
import {createMarketSessionCache} from '../lib/market-session-cache.js';
import {marketCandidate,parseMarketDetail,runAdaptiveMarketDiscovery} from '../lib/ai-market-discovery-trial.js';
const url='https://syarah.com/en/cardetail/toyota-corolla-123';
const car=parseMarketDetail(marketCandidate(url),`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'UsedCondition',mileageFromOdometer:{value:80000},offers:{price:60000}})}</script>`).records[0];
const intent={excludedMakes:[]},body={query:'Toyota Corolla',condition:'used',filters:{}};
test('cache retains canonical aliases but never substitutes a different make or condition',()=>{
 const c=createMarketSessionCache();c.put([car]);assert.equal(c.get(body,intent).length,1);
 assert.equal(c.get({...body,query:'BMW X5'},intent).length,0);
 assert.equal(c.get({...body,condition:'new'},intent).length,0);
 assert.equal(c.get({...body,filters:{maxMileage:50000}},intent).length,0);
 assert.equal(c.get({...body,filters:{maxPrice:70000,maxMileage:90000}},intent).length,1);
 assert.equal(c.get({...body,filters:{maxPrice:50000}},intent).length,0);
});
test('cache expires, rejects future timestamps and unconnected URLs, and preserves age on reads',()=>{
 let now=100;const c=createMarketSessionCache({clock:()=>now,ttlMs:50});c.put([car]);const saved=c.snapshot();now=130;assert.equal(c.get(body,intent).length,1);assert.equal(c.snapshot()[0].checkedAt,100);
 now=150;assert.equal(c.get(body,intent).length,0);
 c.restore([...saved,{checkedAt:151,car},{checkedAt:149,car:{...car,url:'https://evil.test/car'}}]);assert.equal(c.snapshot().length,0);
});
test('validated cached result emits before web discovery and is not refetched or counted as a new check',async()=>{
 const events=[];const r=await runAdaptiveMarketDiscovery(body,intent,{cachedListings:[car],maxRounds:1,discover:async()=>{events.push('discovery');return {status:'completed',urls:[url],webSearchCalls:1};},readDetail:async()=>{throw Error('must not refetch fresh validated car');},onProgress:e=>{if(e.status==='accepted')events.push(e.origin);}});
 assert.deepEqual(events,['validated-cache','discovery']);assert.equal(r.accepted,1);assert.equal(r.cachedAccepted,1);assert.equal(r.checked,0);
});
