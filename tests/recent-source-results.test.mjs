import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isRecentlyObservedAtSource,filterRecentlyObservedSourceResults} from '../lib/recent-source-results.js';

const now=Date.parse('2026-11-04T10:00:00Z');
const live=(extra={})=>({source:'Haraj',url:'https://haraj.com.sa/11188360059',
 sourceObservedAt:'2026-11-04T09:58:00Z',
 sourceObservationEvidence:'source-search-result-page',
 lastSeenAt:'2026-11-04T09:58:00Z',...extra});

test('recently observed mode accepts explicit, recent source sightings',()=>{
 assert.equal(isRecentlyObservedAtSource(live(),now),true);
 assert.equal(isRecentlyObservedAtSource(live({source:'OpenSooq'}),now),true);
 assert.equal(filterRecentlyObservedSourceResults([live()],now).length,1);
});
test('old snapshot metadata never becomes live merely because it has a lastSeenAt',()=>{
 const old={...live(),sourceObservedAt:null,lastSeenAt:'2026-11-04T09:59:00Z'};
 assert.equal(isRecentlyObservedAtSource(old,now),false);
 assert.equal(isRecentlyObservedAtSource(live({sourceObservedAt:'2026-09-23T00:00:00Z'}),now),false);
 assert.equal(isRecentlyObservedAtSource(live({sourceObservedAt:'2026-11-04T10:01:00Z'}),now),false);
});
test('untrusted source and fabricated observation evidence cannot pass recent-only gate',()=>{
 assert.equal(isRecentlyObservedAtSource(live({source:'Other dealer'}),now),false);
 assert.equal(isRecentlyObservedAtSource(live({sourceObservationEvidence:null}),now),false);
 assert.equal(isRecentlyObservedAtSource(live({sourceObservedAt:'not-a-date'}),now),false);
});
test('recent-only 10-minute window excludes expired observations',()=>{
 assert.equal(isRecentlyObservedAtSource(live({sourceObservedAt:'2026-11-04T09:50:00Z'}),now),false);
 assert.equal(isRecentlyObservedAtSource(live({sourceObservedAt:'2026-11-04T09:50:01Z'}),now),true);
});
test('API and UI offer fresh-only search without cached historical inventory preload',async()=>{
 const front=await readFile(new URL('../server-core-candidate.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('../public/market-ui.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(front,/body\.freshOnly===true\?\[\]/);
 assert.match(front,/filterRecentlyObservedSourceResults\(listings\)/);
 assert.match(front,/invalid-fresh-only/);
 assert.match(ui,/needsAI\(query\)\|\|\$\('freshOnly'\)\.checked/);
 assert.match(ui,/freshOnly:\$\('freshOnly'\)\.checked/);
 assert.match(html,/id="freshOnly"/);
});
