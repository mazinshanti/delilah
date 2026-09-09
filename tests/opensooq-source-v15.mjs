import assert from 'node:assert/strict';
import {fetchOpenSooqUsed,verifyOpenSooqDirect} from '../lib/opensooq-source.js';
const broad=await fetchOpenSooqUsed({pages:3});
console.log('OPENSOOQ_BROAD '+JSON.stringify({total:broad.listings.length,errors:broad.errors,counts:broad.listings.reduce((a,x)=>(a[x.condition]=(a[x.condition]||0)+1,a),{}),sample:broad.listings.slice(0,5)},null,2));
assert.ok(broad.listings.length>=60,`expected >=60 structured OpenSooq used listings, got ${broad.listings.length}`);
assert.equal(new Set(broad.listings.map(x=>x.url)).size,broad.listings.length,'duplicate direct URLs');
for(const x of broad.listings){assert.match(x.url,/^https:\/\/sa\.opensooq\.com\/en\/search\/\d{6,}\/?$/);assert.equal(x.condition,'used');assert.ok(x.title)}
const sample=broad.listings.slice(0,3);for(const x of sample){const v=await verifyOpenSooqDirect(x.url);console.log('OPENSOOQ_DIRECT '+JSON.stringify(v));assert.equal(v.ok,true,`direct ad failed ${x.url}`);assert.ok(v.bytes>50000,`direct page suspiciously small ${x.url}`)}
const camry=await fetchOpenSooqUsed({pages:10,query:'Toyota Camry 2020'});
console.log('OPENSOOQ_CAMRY '+JSON.stringify({total:camry.listings.length,errors:camry.errors,sample:camry.listings.slice(0,5)},null,2));
for(const x of camry.listings){assert.equal(x.year,2020);assert.match(x.title,/camry|كامري|كامرى/i)}
console.log(JSON.stringify({ok:true,broad:broad.listings.length,camry2020:camry.listings.length},null,2));
