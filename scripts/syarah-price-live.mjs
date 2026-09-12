import assert from 'node:assert/strict';
import {enrichSyarahListingPrices} from '../lib/syarah-price-enrichment.js';

const listing={
  source:'Syarah',
  title:'Kia Pegas LX 2023',
  year:2023,
  condition:'used',
  price:null,
  priceVerified:false,
  url:'https://syarah.com/en/cardetail/kia-pegas-used-294127'
};

const result=await enrichSyarahListingPrices([listing],{max:1,concurrency:1,timeout:5000});
const car=result.listings?.[0];
console.log('SYARAH_LIVE_PRICE',JSON.stringify({attempted:result.attempted,enriched:result.enriched,price:car?.price,priceVerified:car?.priceVerified,priceSource:car?.priceSource,priceDiscovery:car?.priceDiscovery,evidence:car?.priceEvidence}));
assert.equal(result.attempted,1,'Syarah detail page was not attempted');
assert.ok(car?.priceVerified===true,'Syarah detail price was not verified');
assert.ok(Number(car?.price)>=1000,'Syarah detail price missing/invalid');
assert.ok(['syarah_cash_price_text','syarah_detail_description_price'].includes(car?.priceSource),'Unexpected Syarah price source');
