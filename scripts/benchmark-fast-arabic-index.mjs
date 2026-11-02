import {performance} from 'node:perf_hooks';
import {InventoryIndex} from '../lib/inventory-index.js';
import {ORIGINS,rulesIntent,intentSearchBody,applyIntentConstraints} from '../lib/ai-search-intent.js';

const index=new InventoryIndex();
if(!await index.load())throw Error('inventory-snapshot-not-loaded');
const query='أبي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة';
const result=rulesIntent(query);
if(!result.deterministicSemantic)throw Error('intent-no-longer-safe');
const body=intentSearchBody({query,condition:'used',filters:{}},result);
const before=performance.now();
const listings=applyIntentConstraints(index.searchTrustedOriginBody(body,{
 makes:ORIGINS.Japanese,bodyType:'SUV'
}),result.intent);
const durationMs=Math.round(performance.now()-before);
console.log('FAST_ARABIC_INDEX '+JSON.stringify({
 durationMs,indexRows:index.records.length,matchingUrls:listings.length,
 priceCeiling:body.filters.maxPrice,firstSources:[...new Set(listings.map(x=>x.source))].slice(0,10)
}));
if(listings.some(car=>car.priceVerified!==true||!(car.price>0&&car.price<=body.filters.maxPrice))) {
 throw Error('unsafe-budget-result');
}
