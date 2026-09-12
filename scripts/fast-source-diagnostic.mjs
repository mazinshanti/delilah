import assert from 'node:assert/strict';
import {fetchSalehFast} from '../lib/saleh-fast-source.js';

const result=await fetchSalehFast({query:'Toyota Yaris 2026',filters:{},timeout:7000});
const rows=(result.listings||[]).map(x=>({title:x.title,price:x.price,image:x.image,url:x.url,live:x.salehLiveInventory,discovery:x.discovery}));
console.log('SALEH_LIVE_RESULTS '+JSON.stringify({count:rows.length,indexSize:result.indexSize,candidateCount:result.candidateCount,error:result.error,rows}));
assert.equal(result.liveInventory,true,'Saleh live inventory flag missing');
assert.ok(Number(result.indexSize)>=300,'Saleh live inventory index unexpectedly small');
assert.ok(rows.length>=2,'too few live Saleh Yaris results');
assert.ok(rows.some(x=>/yaris y limited/i.test(x.title)||/yaris-y-limited-2026/i.test(x.url)),'current Yaris Y Limited listing missing');
assert.ok(rows.every(x=>x.url.includes('salehcars.com/en/cars/')),'non-Saleh product URL leaked');
assert.ok(rows.every(x=>x.live===true&&x.discovery==='saleh_live_sitemap'),'result did not come from live Saleh sitemap');
