import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createIntentEngine, rulesIntent, trustedArabicFamilySuvIntent,
 intentSearchBody, applyIntentConstraints
} from '../lib/ai-search-intent.js';
import {strictDirectListings} from '../lib/direct-search.js';

const query='أبي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة';
const car=(make,model,price,url)=>({
 source:'Haraj',sourceCategory:'cars for sale',url:'https://example.com/'+url,
 title:make+' '+model+' 2022 for sale',make,model,year:2022,
 condition:'used',price,priceVerified:true
});

test('Arabic family SUV request is fully understood without remote AI or timeout',async()=>{
 let remoteCalls=0;
 const engine=createIntentEngine({
  env:{OPENAI_API_KEY:'test-key',DALELAH_AI_SEARCH_ENABLED:'true'},
  fetchImpl:()=>{remoteCalls++;throw Error('AI must not be invoked');},
  log:()=>{}
 });
 const result=await engine.understand(query);
 assert.equal(remoteCalls,0);
 assert.equal(result.intentMode,'rules');
 assert.equal(result.safeFallback,true);
 assert.equal(result.deterministicSemantic,true);
 assert.equal(result.intent.make,null);
 assert.equal(result.intent.model,null);
 assert.equal(result.intent.bodyType,'SUV');
 assert.equal(result.intent.originPreference,'Japanese');
 assert.equal(result.intent.maxPrice,150000);
 assert.deepEqual(result.intent.priorities,['affordable-maintenance']);
 const body=intentSearchBody({query,condition:'used',filters:{}},result);
 assert.equal(body.query,'__all_cars__');
 assert.equal(body.condition,'used');
 assert.equal(body.filters.maxPrice,150000);
});

test('strict Japanese SUV + price restrictions remain enforced throughout retrieval',()=>{
 const result=rulesIntent(query);
 const body=intentSearchBody({query,condition:'used',filters:{}},result);
 const candidates=[
  car('Toyota','Fortuner',120000,'fortuner'),
  car('Nissan','Patrol',140000,'patrol'),
  car('Toyota','Camry',70000,'sedan'),
  car('BMW','X5',110000,'german'),
  car('Toyota','Prado',190000,'over-budget'),
  car('Toyota','Fortuner',null,'missing-price')
 ];
 const out=applyIntentConstraints(strictDirectListings(candidates,body),result.intent);
 assert.deepEqual(out.map(row=>row.url).sort(),['https://example.com/fortuner','https://example.com/patrol']);
 assert(out.every(row=>!row.rankingSignals.includes('affordable-maintenance')));
});

test('user interface can further narrow the price without AI overriding it',()=>{
 const result=rulesIntent(query);
 const body=intentSearchBody({query,condition:'used',filters:{maxPrice:95000}},result);
 assert.equal(body.filters.maxPrice,95000);
});

test('unknown additional hard requirements never become silent safe fallback',()=>{
 const more=query+' بفتحة سقف';
 assert.equal(trustedArabicFamilySuvIntent(more),null);
 assert.equal(rulesIntent(more).safeFallback,false);
});

test('incorrect units and unrealistic budgets are rejected',()=>{
 assert.equal(trustedArabicFamilySuvIntent('أبي جيب عائلي ياباني تحت ١٥٠ وصيانته رخيصة'),null);
 assert.equal(trustedArabicFamilySuvIntent('أبي جيب عائلي ياباني تحت ٠ ألف وصيانته رخيصة'),null);
});
