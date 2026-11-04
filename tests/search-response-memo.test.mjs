import test from 'node:test';
import assert from 'node:assert/strict';
import {memoizedSearchResponse,expirePublicResponseMemo} from '../lib/search-response-memo.js';

const now=Date.now();
const job=()=>({createdAt:now-1000,directDone:false,fullDone:false,
  directData:null,fullData:null,priceEnrichmentComplete:false,
  syarahPriceEnrichmentComplete:false,priceEnriched:0,syarahPriceEnriched:0});
test('identical progress state is assembled once rather than on every poll',()=>{
 const j=job();let calls=0;
 const build=()=>{calls++;return {listings:[{url:'https://example.com/a'}],complete:false}};
 const first=memoizedSearchResponse(j,build,now);
 const second=memoizedSearchResponse(j,build,now+1500);
 assert.equal(first,second);
 assert.equal(calls,1);
 assert.equal(j.publicResponseMemo.at,now);
});
test('new direct and deep data invalidate memo immediately, not after five seconds',()=>{
 const j=job();let calls=0;const build=()=>({listings:[],complete:false,generation:++calls});
 assert.equal(memoizedSearchResponse(j,build,now).generation,1);
 j.directData={listings:[{url:'https://example.com/a'}]};
 j.directDone=true;
 assert.equal(memoizedSearchResponse(j,build,now+100).generation,2);
 j.fullData={listings:[{url:'https://example.com/b'}],complete:false};
 assert.equal(memoizedSearchResponse(j,build,now+200).generation,3);
 j.fullData={...j.fullData,listings:[...j.fullData.listings,{url:'https://example.com/c'}]};
 assert.equal(memoizedSearchResponse(j,build,now+300).generation,4);
});
test('price enrichment state change forces a fresh response',()=>{
 const j=job();let n=0;const build=()=>({listings:[],complete:false,n:++n});
 memoizedSearchResponse(j,build,now);
 j.priceEnrichmentComplete=true;j.priceEnriched=3;
 assert.equal(memoizedSearchResponse(j,build,now+200).n,2);
 j.syarahPriceEnriched=2;
 assert.equal(memoizedSearchResponse(j,build,now+400).n,3);
});
test('TTL and scan deadline invalidate cached in-progress responses',()=>{
 const j=job();let n=0;const build=()=>({listings:[],complete:false,n:++n});
 memoizedSearchResponse(j,build,now);
 assert.equal(memoizedSearchResponse(j,build,now+4000).n,1);
 assert.equal(memoizedSearchResponse(j,build,now+5000).n,2);
 j.createdAt=now-90_000;
 assert.equal(memoizedSearchResponse(j,build,now+5001).n,3);
});
test('oversized results never enter the memo cache and expired data is pruned',()=>{
 const j=job();let n=0;
 const huge=()=>({listings:new Array(751).fill({url:'https://example.com'}),n:++n});
 memoizedSearchResponse(j,huge,now);
 assert.equal(j.publicResponseMemo,undefined);
 memoizedSearchResponse(j,huge,now+500);
 assert.equal(n,2);
 const tiny=()=>({listings:[],complete:true});
 memoizedSearchResponse(j,tiny,now+700);
 assert.ok(j.publicResponseMemo);
 expirePublicResponseMemo(j,now+5700);
 assert.equal(j.publicResponseMemo,undefined);
});
