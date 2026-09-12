import assert from 'node:assert/strict';
import {fetchSalehFast} from '../lib/saleh-fast-source.js';

const result=await fetchSalehFast({query:'Toyota Yaris 2026',filters:{},timeout:8000});
const rows=(result.listings||[]).map(x=>({title:x.title,price:x.price,vatPrice:x.salehVatPrice,verified:x.priceVerified,source:x.priceSource,evidence:x.priceEvidence,url:x.url}));
console.log('SALEH_PRICE_LIVE '+JSON.stringify({indexSize:result.indexSize,candidateCount:result.candidateCount,error:result.error,rows}));
assert.equal(result.liveInventory,true,'Saleh live inventory unavailable');
const plus=rows.find(x=>/yaris y-?plus/i.test(x.title));
const limited=rows.find(x=>/yaris y limited/i.test(x.title));
assert.ok(plus,'Yaris Y-Plus missing');
assert.ok(limited,'Yaris Y Limited missing');
assert.equal(plus.price,60900,'Y-Plus primary price incorrect');
assert.equal(plus.vatPrice,70035,'Y-Plus VAT price incorrect');
assert.equal(plus.verified,true,'Y-Plus price not verified');
assert.equal(limited.price,57900,'Y Limited primary price incorrect');
assert.equal(limited.vatPrice,66585,'Y Limited VAT price incorrect');
assert.equal(limited.verified,true,'Y Limited price not verified');
