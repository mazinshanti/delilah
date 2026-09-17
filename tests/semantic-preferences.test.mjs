import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyIntent,normalizeAIIntent,intentSearchBody,applyIntentConstraints,rulesIntent,createIntentEngine} from '../lib/ai-search-intent.js';
import {strictDirectListings} from '../lib/direct-search.js';
const query='ابي جيب عائلي ياباني تحت 150 ألف وصيانته رخيصة';
const intent={...emptyIntent(),query,bodyType:'SUV',useCase:'family',originPreference:'Japanese',maxPrice:150000,condition:'used',priorities:['affordable-maintenance','family-suitability'],confidence:0.95};
test('generic Arabic Jeep is not a brand in either normalized intent or unavailable-provider fallback',()=>{
 const i=normalizeAIIntent({...intent,make:'Jeep'},query);assert.equal(i.make,null);assert.equal(i.model,null);assert.equal(i.bodyType,'SUV');assert.equal(rulesIntent(query).intent.make,null);
 const explicit=rulesIntent('جيب رانجلر 2022');assert.equal(explicit.intent.make,'Jeep');assert.equal(explicit.intent.model,'Wrangler');
});
test('missing soft preference evidence does not eliminate real candidates; hard constraints persist',()=>{
 const body=intentSearchBody({query},{intent:structuredClone(intent),intentMode:'ai'});assert.equal(body.query,'__all_cars__');assert.equal(body.filters.category,undefined);assert.equal(body.filters.maxPrice,150000);
 const car={make:'Toyota',brand:'Toyota',model:'RAV4',title:'Toyota RAV4 2022',year:2022,yearVerified:true,condition:'used',price:100000,priceVerified:true,saleVerified:true,url:'https://example.com/test-fixture',images:['https://example.com/original.jpg']};
 const rows=[car,{...car,price:200000,url:car.url+'2'},{...car,condition:'new',url:car.url+'3'},{...car,bodyType:'sedan',url:car.url+'4'}];
 const found=applyIntentConstraints(strictDirectListings(rows,body),intent);assert.equal(found.length,1);assert.deepEqual(found[0].images,car.images);assert.deepEqual(found[0].unverifiedAttributes,['bodyType']);assert(!found[0].rankingSignals.includes('affordable-maintenance'));
});
test('explicit UI body filter stays strict and excluded makes stay excluded',()=>{
 const body=intentSearchBody({query,filters:{category:'SUV'}},{intent:structuredClone(intent),intentMode:'ai'});assert.equal(body.filters.category,'SUV');
 assert.deepEqual(applyIntentConstraints([{make:'Toyota'}],{...intent,excludedMakes:['Toyota']}),[]);
});
test('semantic query with missing credentials reports routing requirement rather than fake AI success',async()=>{
 const logs=[];const e=createIntentEngine({env:{},log:x=>logs.push(x),fetchImpl:()=>assert.fail('no credentials')});const out=await e.understand(query);assert.equal(out.intentMode,'rules');assert.equal(out.fallbackReason,'not-configured');assert.equal(out.providerAttempted,false);assert(logs.some(x=>x.required===true&&x.reason==='not-configured'));
});
