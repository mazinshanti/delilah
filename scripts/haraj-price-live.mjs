import assert from 'node:assert/strict';
import {fetchHarajFast} from '../lib/haraj-fast-source.js';

const queries=['Toyota Corolla 2013','Toyota Camry 2018','Nissan Patrol 2020','Jeep Wrangler 2021','Chevrolet Tahoe 2021'];
let total=0,priced=0;
const sourceCounts={};
for(const query of queries){
  const r=await fetchHarajFast({query,timeout:6000});
  assert.equal(r.error,null,`${query}: ${r.error}`);
  const listings=Array.isArray(r.listings)?r.listings:[];
  const withPrice=listings.filter(x=>x.priceVerified===true&&Number.isFinite(Number(x.price)));
  for(const car of withPrice){
    assert.ok(car.price>=5000&&car.price<=5_000_000,`${query}: implausible price ${car.price}`);
    assert.ok(car.priceSource,`${query}: verified price missing source`);
    sourceCounts[car.priceSource]=(sourceCounts[car.priceSource]||0)+1;
  }
  total+=listings.length;priced+=withPrice.length;
  console.log('HARAJ_PRICE_CASE '+JSON.stringify({query,total:listings.length,priced:withPrice.length,fill:listings.length?Math.round(withPrice.length/listings.length*100):0,samples:withPrice.slice(0,5).map(x=>({title:x.title,price:x.price,priceSource:x.priceSource,evidence:x.priceEvidence,url:x.url}))}));
}
assert.ok(total>0,'Haraj live diagnostic returned no listings');
assert.ok(priced>0,'Haraj live diagnostic found no importable prices');
console.log('HARAJ_PRICE_SUMMARY '+JSON.stringify({queries:queries.length,total,priced,fill:Math.round(priced/total*100),sourceCounts}));
