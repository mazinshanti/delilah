import test from 'node:test';
import assert from 'node:assert/strict';
import {isSupportedListingSource,isRecentlyObservedAtSource} from '../lib/recent-source-results.js';
import {observeSourceSearchListings,mergeObservationFields,favorNewerVerifiedData} from '../lib/live-source-observation.js';
import {LiveVehicleBuffer} from '../lib/live-vehicle-buffer.js';

const now=Date.now();
const at=new Date(now-1000).toISOString();
const older=new Date(now-60*24*3600000).toISOString();
const listing=(extra={})=>({
 source:'Haraj',url:'https://haraj.com.sa/11188361001',
 sourceCategory:'cars for sale',sourceObservationEvidence:'source-search-result-page',
 sourceObservedAt:at,lastSeenAt:at,make:'Toyota',model:'Camry',
 title:'Toyota Camry 2022 for sale',year:2022,condition:'used',price:72000,
 priceVerified:true,city:'Riyadh',...extra
});
test('verifies exact domain and listing path for Haraj and OpenSooq',()=>{
 assert.equal(isSupportedListingSource(listing()),true);
 assert.equal(isSupportedListingSource(listing({url:'https://www.haraj.com.sa/11188361001'})),true);
 assert.equal(isSupportedListingSource(listing({source:'OpenSooq',url:'https://sa.opensooq.com/en/search/123456789'})),true);
 assert.equal(isSupportedListingSource(listing({url:'https://haraj.com.sa.evil.example/11188361001'})),false);
 assert.equal(isSupportedListingSource(listing({url:'https://evil.example/11188361001'})),false);
 assert.equal(isSupportedListingSource(listing({url:'https://haraj.com.sa/search/toyota-camry/'})),false);
 assert.equal(isSupportedListingSource(listing({url:'https://haraj.com.sa:444/11188361001'})),false);
 assert.equal(isSupportedListingSource(listing({url:'https://user:pass@haraj.com.sa/11188361001'})),false);
 assert.equal(isSupportedListingSource(listing({source:'OpenSooq',url:'https://haraj.com.sa/11188361001'})),false);
 assert.equal(isSupportedListingSource(listing({source:'OpenSooq',url:'https://sa.opensooq.com/en/cars/cars-for-sale/used'})),false);
});
test('rejects unsupported or spoofed source even when timestamp looks fresh',()=>{
 const invalid=[
  listing({url:'https://haraj.com.sa.evil.example/11188361001'}),
  listing({source:'OpenSooq'}),
  listing({sourceObservationEvidence:'copied-from-old-snapshot'}),
  listing({sourceObservedAt:new Date(now+10000).toISOString()}),
  listing({sourceObservedAt:older})
 ];
 assert.ok(invalid.every(x=>!isRecentlyObservedAtSource(x,now)), 'no bogus timestamp or source can pass the fresh gate');
});
test('only genuinely listed URLs receive source-observation stamps',()=>{
 const valid=listing({sourceObservedAt:null,sourceObservationEvidence:null,lastSeenAt:older});
 const bad=listing({url:'https://haraj.com.sa.evil.example/11188361002',sourceObservedAt:null,sourceObservationEvidence:null});
 const rows=observeSourceSearchListings([valid,bad], 'Haraj',at);
 assert.equal(rows[0].sourceObservedAt,at);
 assert.equal(rows[0].lastSeenAt,at);
 assert.equal(rows[1].sourceObservedAt,null);
 assert.equal(rows[1].lastSeenAt,older===rows[1].lastSeenAt?older:rows[1].lastSeenAt);
});
test('temporary buffer cannot cache or expose fake source observations',()=>{
 const buffer=new LiveVehicleBuffer({clock:()=>now,ttlMs:600000,maxListings:2});
 const invalid=listing({url:'https://haraj.com.sa.evil.example/11188361001'});
 const noEvidence=listing({sourceObservationEvidence:null});
 assert.equal(buffer.ingest([invalid,noEvidence]),0);
 assert.equal(buffer.stats().cachedListingUrls,0);
 assert.equal(buffer.ingest([listing()]),1);
 const hits=buffer.search({query:'Toyota Camry 2022',condition:'used',filters:{maxPrice:80000}});
 assert.equal(hits.length,1);
 assert.equal(hits[0].url,'https://haraj.com.sa/11188361001');
});
test('spoofed observation cannot override older snapshot provenance or price',()=>{
 const old=listing({sourceObservedAt:null,sourceObservationEvidence:null,lastSeenAt:older});
 const bad=listing({source:'Haraj',url:'https://haraj.com.sa.evil.example/11188361001',price:1});
 const merged=mergeObservationFields(old,bad,now);
 assert.equal(merged.sourceObservedAt,null);
 assert.equal(merged.lastSeenAt,at);
 assert.equal(favorNewerVerifiedData(old,bad,now),'next');
});
