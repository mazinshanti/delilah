import assert from 'node:assert/strict';
import {fetchOpenSooqUsed,verifyOpenSooqDirect,openSooqSearchUrl} from '../lib/opensooq-source.js';
const broad=await fetchOpenSooqUsed({pages:3});
console.log('OPENSOOQ_BROAD '+JSON.stringify({total:broad.listings.length,errors:broad.errors,sample:broad.listings.slice(0,5)},null,2));
assert.ok(broad.listings.length>=60,`expected >=60 structured OpenSooq used listings, got ${broad.listings.length}`);
assert.equal(new Set(broad.listings.map(x=>x.url)).size,broad.listings.length,'duplicate direct URLs');
for(const x of broad.listings){assert.match(x.url,/^https:\/\/sa\.opensooq\.com\/en\/search\/\d{6,}\/?$/);assert.equal(x.condition,'used');assert.ok(x.title)}
for(const x of broad.listings.slice(0,3)){const v=await verifyOpenSooqDirect(x.url);console.log('OPENSOOQ_DIRECT '+JSON.stringify(v));assert.equal(v.ok,true,`direct ad failed ${x.url}`);assert.ok(v.bytes>50000,`direct page suspiciously small ${x.url}`)}
const nativeUrl=openSooqSearchUrl({query:'Toyota Camry 2020',filters:{city:'Riyadh'}});
assert.equal(nativeUrl,'https://sa.opensooq.com/en/al-riyadh/cars/cars-for-sale/toyota/camry/2020');
const camry=await fetchOpenSooqUsed({pages:2,query:'Toyota Camry 2020',filters:{city:'Riyadh'},nativeQuery:true});
console.log('OPENSOOQ_NATIVE_CAMRY '+JSON.stringify({root:camry.root,total:camry.listings.length,errors:camry.errors,sample:camry.listings.slice(0,5)},null,2));
assert.ok(camry.listings.length>0,'native Riyadh Camry 2020 path returned zero');
for(const x of camry.listings){assert.equal(x.year,2020);assert.match(x.title,/camry|كامري|كامرى/i);assert.equal(x.city,'Riyadh')}
console.log(JSON.stringify({ok:true,broad:broad.listings.length,nativeCamry2020:camry.listings.length,nativeUrl},null,2));
