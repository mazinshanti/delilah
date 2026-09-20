import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
import {saudiMarketSearchPlan,prioritizeExternalLead} from '../lib/saudi-market-search-plan.js';
test('every registry target has its own task without enabling ingestion',()=>{
 const p=saudiMarketSearchPlan('كورولا');for(const s of SOURCE_REGISTRY)assert.ok(p.some(t=>t.id===s.id&&t.accessStatus===s.status));
 assert.equal(p.filter(t=>t.scope==='open-market').length,2);assert.ok(p.some(t=>t.id==='khaledcars'));assert.ok(p.every(t=>t.query==='كورولا'));
});
test('tracking duplicates normalized without dropping inventory pagination',()=>assert.equal(prioritizeExternalLead('https://dealer.sa/cars?page=2&utm_source=openai#x').url,'https://dealer.sa/cars?page=2'));
test('editorial and documents stay distinguishable from stock candidates',()=>{
 assert.equal(prioritizeExternalLead('https://www.reddit.com/r/cars/a').priority,'non-inventory');assert.equal(prioritizeExternalLead('https://dealer.sa/car.pdf').priority,'document-review');assert.equal(prioritizeExternalLead('https://dealer.sa/cars/1').vehicleVerified,false);
});
