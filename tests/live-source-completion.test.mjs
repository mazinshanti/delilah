import test from 'node:test';
import assert from 'node:assert/strict';
import {searchCompletionState} from '../lib/search-completion-state.js';
import {observeSourceSearchListings,mergeObservationFields,favorNewerVerifiedData} from '../lib/live-source-observation.js';
import {mergeDirectListings} from '../lib/direct-search.js';
import {orderedListings} from '../public/experience-model.js';
import {listingObservation} from '../public/listing-observation.js';
import {normalizeInventoryListing} from '../lib/inventory-normalizer.js';
import {relevanceScore} from '../lib/result-ranking.js';

const now=Date.now();
const seen=new Date(now-120_000).toISOString();
const oldSeen=new Date(now-45*86400_000).toISOString();
const sample=(id,other={})=>({source:'Haraj',url:'https://haraj.com.sa/'+id,title:'تويوتا كامري 2022',make:'Toyota',model:'Camry',year:2022,condition:'used',
  price:90000,priceVerified:true,priceSource:'snapshot',lastSeenAt:oldSeen,...other});

test('completed deep source cannot hide unfinished fast live discovery',()=>{
 const job={createdAt:now-1000,fullData:{complete:true,marketScanComplete:true},fullDone:true,directDone:false};
 const progress=searchCompletionState(job,now);
 assert.equal(progress.complete,false);
 assert.equal(progress.liveDiscoveryPending,true);
 assert.equal(progress.scanTimedOut,false);
 assert.equal(searchCompletionState({...job,directDone:true},now).complete,true);
});
test('new live results delay completion until price enrichment is settled',()=>{
 const job={createdAt:now-1000,fullData:{complete:true},directDone:true,
 priceEnrichmentPromise:Promise.resolve(),priceEnrichmentComplete:false};
 assert.equal(searchCompletionState(job,now).complete,false);
 assert.equal(searchCompletionState({...job,priceEnrichmentComplete:true},now).complete,true);
});
test('deep failure waits for live lane, with bounded deadline',()=>{
 const job={createdAt:now-1000,fullDone:true,error:'source-failed',directDone:false};
 assert.equal(searchCompletionState(job,now).complete,false);
 assert.equal(searchCompletionState({...job,directDone:true},now).complete,true);
 const timeout=searchCompletionState({...job,createdAt:now-91_000},now);
 assert.equal(timeout.complete,true);
 assert.equal(timeout.scanTimedOut,true);
});
test('unfinished deep results do not report full market coverage',()=>{
 const job={createdAt:now-1000,fullData:{complete:false},directDone:true};
 assert.equal(searchCompletionState(job,now).complete,false);
});
test('live observations exist only for genuine returned source listing URLs',()=>{
 const input=[sample('11111111111'),{...sample('11111111112'),source:'Syarah'},sample('11111111113',{url:null})];
 const output=observeSourceSearchListings(input,'Haraj',seen);
 assert.equal(output[0].sourceObservedAt,seen);
 assert.equal(output[0].lastSeenAt,seen);
 assert.equal(output[0].sourceObservationEvidence,'source-search-result-page');
 assert.equal(output[1].sourceObservedAt,undefined);
 assert.equal(output[2].sourceObservedAt,undefined);
 assert.equal(input[0].sourceObservedAt,undefined);
 assert.equal(listingObservation(output[0]).status,'recent');
 assert.equal(listingObservation(input[0]).status,'stale');
});
test('an older deep result cannot overwrite a newer verified listing price or observation',()=>{
 const indexed=sample('11111111111',{price:100000});
 const live=observeSourceSearchListings([sample('11111111111',{
   price:85000,priceSource:'live-page',priceEvidence:'current-page'})],'Haraj',seen);
 const lateDeep=sample('11111111111',{price:105000,priceSource:'old-deep-cache',
   lastSeenAt:oldSeen});
 const rows=mergeDirectListings([indexed],live,[lateDeep]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].price,85000);
 assert.equal(rows[0].priceSource,'live-page');
 assert.equal(rows[0].lastSeenAt,seen);
 assert.equal(rows[0].sourceObservedAt,seen);
 assert.equal(rows[0].sourceObservationEvidence,'source-search-result-page');
});
test('one positive verified price stays authoritative over null and unverified prices',()=>{
 const input=sample('11111111112',{price:62000,priceVerified:true});
 const newer=observeSourceSearchListings([sample('11111111112',{price:null,priceVerified:false})],'Haraj',seen);
 const rows=mergeDirectListings([input],newer);
 assert.equal(rows.length,1);
 assert.equal(rows[0].price,62000);
 assert.equal(rows[0].priceVerified,true);
});
test('recent observations beat unknown timestamps in merge and never invent a future timestamp',()=>{
 const x=mergeObservationFields({lastSeenAt:oldSeen},{lastSeenAt:'2100-01-01T00:00:00Z'},now);
 assert.equal(x.lastSeenAt,oldSeen);
 assert.equal(x.sourceObservedAt,null);
 assert.equal(favorNewerVerifiedData({lastSeenAt:seen},{lastSeenAt:oldSeen},now),'old');
});
test('relevance sorts fresh live pages ahead of cheaper stale snapshot matches',()=>{
 const stale=sample('11111111113',{price:65000,relevanceScore:100});
 const fresh=observeSourceSearchListings([sample('11111111114',{
  price:null,priceVerified:false,relevanceScore:90})],'Haraj',seen)[0];
 assert.deepEqual(orderedListings([stale,fresh],'relevance').map(c=>c.url),[fresh.url,stale.url]);
 assert.deepEqual(orderedListings([stale,fresh],'price-asc').map(c=>c.url),[stale.url,fresh.url]);
});

test('normalization cannot silently turn unknown source observation into a current date',()=>{
 const raw=sample('11111111115',{lastSeenAt:undefined,lastDetailAt:undefined,sourceObservedAt:undefined});
 const normalized=normalizeInventoryListing(raw);
 assert.equal(normalized.lastSeenAt,null);
 assert.equal(listingObservation(normalized).status,'unknown');
 const seenAgain=normalizeInventoryListing({...raw,lastSeenAt:oldSeen});
 assert.equal(seenAgain.lastSeenAt,oldSeen);
 assert.equal(listingObservation(seenAgain).status,'stale');
});
test('listing rank cannot treat a synthetic updatedAt timestamp as source freshness',()=>{
 const a=sample('11111111116',{lastSeenAt:null,updatedAt:new Date().toISOString(),updated_at:new Date().toISOString()});
 const b={...a,updatedAt:'2020-01-01T00:00:00Z',updated_at:'2020-01-01T00:00:00Z'};
 assert.equal(relevanceScore(a,{query:'Toyota Camry',condition:'used'}),
   relevanceScore(b,{query:'Toyota Camry',condition:'used'}));
});
