import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isRecentlyObservedAtSource,filterRecentlyObservedSourceResults,filterObservedDuringSearch} from '../lib/recent-source-results.js';

const now=Date.parse('2026-11-04T10:00:00Z');
const live=(extra={})=>({source:'Haraj',url:'https://haraj.com.sa/11188360059',
 sourceObservedAt:'2026-11-04T09:58:00Z',
 sourceObservationEvidence:'source-search-result-page',
 lastSeenAt:'2026-11-04T09:58:00Z',...extra});

test('recently observed mode accepts explicit, recent source sightings',()=>{
 assert.equal(isRecentlyObservedAtSource(live(),now),true);
 assert.equal(isRecentlyObservedAtSource(live({source:'OpenSooq',url:'https://sa.opensooq.com/en/search/123456789'}),now),true);
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
 assert.match(front,/filterObservedDuringSearch\(listings,job\.createdAt\)/);
 assert.match(front,/body\.freshOnly=incoming\.freshOnly!==false/);
 assert.match(front,/if\(body\.freshOnly!==true&&existing/);
 assert.match(front,/invalid-fresh-only/);
 assert.match(ui,/needsAI\(query\)\|\|\$\('freshOnly'\)\.checked/);
 assert.match(ui,/freshOnly:\$\('freshOnly'\)\.checked/);
 assert.match(html,/id="freshOnly" autocomplete="off"/);
 assert.doesNotMatch(html,/id="freshOnly" checked/);
 assert.match(ui,/\$\('freshOnly'\)\.checked=false/);
});

test('each new search requires a source observation since that request started',()=>{
 const started=Date.parse('2026-11-04T09:59:00Z');
 const current=live({sourceObservedAt:'2026-11-04T09:59:30Z'});
 assert.deepEqual(filterObservedDuringSearch([live(),current],started,now),[current]);
 assert.deepEqual(filterObservedDuringSearch([live({sourceObservedAt:'2026-11-04T09:59:30Z',sourceObservationEvidence:null})],started,now),[]);
 assert.deepEqual(filterObservedDuringSearch([current],Date.parse('2026-11-04T09:59:45Z'),now),[]);
});
