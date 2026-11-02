import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {listingObservation} from '../public/listing-observation.js';
import {listingFreshness,isInactiveListing} from '../lib/listing-lifecycle.js';

const now=Date.parse('2026-11-02T12:00:00Z');
test('September snapshot is stale even when website was deployed in November',()=>{
 const car={lastSeenAt:'2026-09-23T17:07:49.763Z',url:'https://example.com/car'};
 const observed=listingObservation(car,now);
 assert.equal(observed.status,'stale');
 assert.equal(observed.observedAt,'2026-09-23T17:07:49.763Z');
 assert.equal(listingFreshness(car,36*3600000,now).refreshDue,true);
 assert.equal(isInactiveListing(car),false); // Stale is not sold.
});

test('recent observation is not mislabeled stale',()=>{
 const car={lastSeenAt:'2026-11-02T10:00:00Z'};
 const observed=listingObservation(car,now);
 assert.equal(observed.status,'recent');
 assert.equal(listingFreshness(car,36*3600000,now).refreshDue,false);
});

test('missing or future timestamps never count as recently observed',()=>{
 assert.deepEqual(listingObservation({},now),{status:'unknown',observedAt:null,ageMs:null});
 assert.equal(listingObservation({lastSeenAt:'2026-11-03T00:00:00Z'},now).status,'unknown');
 assert.equal(listingFreshness({lastSeenAt:'n/a'},36*3600000,now).observationStatus,'unknown');
});

test('latest genuine source observation wins over an older one',()=>{
 const car={lastDetailAt:'2026-09-25T00:00:00Z',lastSeenAt:'2026-11-02T10:00:00Z'};
 assert.equal(listingObservation(car,now).status,'recent');
});

test('customer-facing copy avoids unsupported refreshed-daily and available-now promises',async()=>{
 const ui=await readFile(new URL('../public/market-ui.js',import.meta.url),'utf8');
 const copy=await readFile(new URL('../public/experience-model.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const front=await readFile(new URL('../server-core-candidate.js',import.meta.url),'utf8');
 assert.match(ui,/Last observed:/);
 assert.match(ui,/Not recently checked; price and availability may have changed/);
 assert.match(ui,/Listing observation date unknown/);
 assert.match(copy,/Listing dates shown/);
 assert.doesNotMatch(copy,/Updated daily|Featured cars available now/);
 assert.doesNotMatch(html,/>تحديث يومي<|>أحدث الإعلانات أولًا</);
 assert.match(front,/freshnessSummary/);
});
