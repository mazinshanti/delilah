import test from 'node:test';import assert from 'node:assert/strict';
import {marketCandidate,marketListingKey,parseMarketDetail} from '../lib/ai-market-discovery-trial.js';
import {normalizeInventoryListing} from '../lib/inventory-normalizer.js';
import {strictDirectListings} from '../lib/direct-search.js';
const url='https://www.mstaml.com/sa/product/test?id=1234567&type=4.41';
function fixture({title='تويوتا يارس 2015 مستعملة للبيع',description='للبيع سيارة مستعملة',category='سيارات ومركبات/سيارة جديدة أو مستعملة',sku='1234567',offerUrl=url,adType='للبيع',condition='مستعملة',mileage='50000',availability='https://schema.org/InStock'}={}){
 const p={'@type':'Product',name:title,description,sku,category,model:'2015',offers:{url:offerUrl,priceCurrency:'SAR',price:'20000',availability},image:[{contentUrl:'https://img.mstaml.com/i123456789/car.webp'}]};
 const fields={'نوع الإعلان':adType,'حالة السيارة':condition,'ممشى السيارة بالكيلو متر':mileage,'نوع القير':'أوتوماتيك'};
 return `<h1>${title}</h1><table>${Object.entries(fields).map(([k,v])=>`<tr><th>${k}:</th><td>${v}</td></tr>`).join('')}</table><script type="application/ld+json">${JSON.stringify({'@type':'WebPage',mainEntity:p})}</script>`;
}
const parse=options=>parseMarketDetail(marketCandidate(url),fixture(options));
test('Mstaml keeps observed identity parameters and deduplicates tracking and slugs',()=>{
 assert.ok(marketCandidate(url));assert.equal(marketListingKey(url),marketListingKey(url.replace('/test','/different')+'&utm_source=test'));
 for(const bad of [url.replace('/sa/','/ae/'),url.replace('www.mstaml.com','evil.mstaml.com'),url+'&id=7654321',url.replace('1234567','bad'),url.replace('https:','http:')])assert.equal(marketCandidate(bad),null);
});
test('Mstaml admits only a bound available individual car for sale',()=>{
 const r=parse();assert.equal(r.records.length,1);assert.equal(r.records[0].make,'Toyota');assert.equal(r.records[0].model,'Yaris');assert.equal(r.records[0].mileageKm,50000);assert.equal(r.records[0].priceSar,20000);
 for(const options of [{sku:'7654321'},{offerUrl:url.replace('1234567','7654321')},{category:'جوالات'},{adType:'مطلوب'},{availability:'https://schema.org/SoldOut'}])assert.equal(parse(options).records.length,0);
});
test('conflicting odometers stay unknown across repeated normalization and ceiling filters',()=>{
 let r=parse({description:'للبيع يارس 2015 ماشيه 582 ألف كم والبيع على السوم',mileage:'582'}).records[0];assert.ok(r);assert.equal(r.priceSar,null);
 for(let i=0;i<3;i++){r=normalizeInventoryListing(r);assert.equal(r.mileageKm,null);assert.equal(r.mileage_km,null);assert.equal(r.vehicle.mileageKm,null);}
 assert.equal(strictDirectListings([r],{query:'Toyota Yaris',filters:{maxMileage:100000}}).length,0);
});
test('non-car classifieds cannot enter even with a vehicle product category',()=>{
 for(const title of ['مكينة تويوتا يارس 2015 للبيع','كفرات تويوتا يارس 2015 للبيع','حساب ببجي تويوتا يارس 2015 للبيع','لعبة تويوتا يارس 2015 للبيع','مطلوب تويوتا يارس 2015'])assert.equal(parse({title}).records.length,0,title);
});
test('new condition conflicts and related products cannot replace the main ad',()=>{
 assert.equal(parse({condition:'جديدة',mileage:'50000'}).records.length,0);
 const html=fixture({sku:'7654321'})+'إعلانات مشابهة'+fixture();assert.equal(parseMarketDetail(marketCandidate(url),html).records.length,0);
 const r=parse({condition:'غير معروف',mileage:''}).records[0];assert.ok(r);assert.notEqual(r.condition,'new');
});
