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

test('regional, forum, comparison and specifications evidence remain outside listing candidates',()=>{
 for(const [url,expected] of [
 ['https://www.gmcarabia.com/bh-en/certified-pre-owned','outside-saudi'],
 ['https://www.gmcarabia.com/sa-en/shop-online','source-review'],
 ['https://toyota.montada.haraj.com.sa/40124/discussion','non-inventory'],
 ['https://ksa.motory.com/en/new-cars/compare/a-vs-b','non-inventory'],
 ['https://khaledcars.com/ar/car/401/download-specs','document-review'],
 ['https://www.toyota.com.sa/ar/vehicles/corolla/full-specs','catalog-only'],
 ['https://admin.vwcertified.me/cars','internal-route']])assert.equal(prioritizeExternalLead(url).priority,expected);
});
test('observed dealer identities group locales without merging different cars',async()=>{
 const {reviewDiscoveryLeads}=await import('../lib/saudi-market-search-plan.js');
 const r=reviewDiscoveryLeads([
 {url:'https://www.khaledcars.com/ar/car/corolla/401'},
 {url:'https://khaledcars.com/en/car/toyota_corolla/401'},
 {url:'https://khaledcars.com/ar/car/corolla/400'}]);
 assert.equal(r.uniqueLeadGroups,2);assert.equal(r.leads[0].observedUrls.length,2);assert.equal(r.acceptedVehicles,0);
 assert.equal(prioritizeExternalLead('https://haraj.com.sa/11188806723/').priority,'source-review');
});
