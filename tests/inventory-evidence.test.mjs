import test from 'node:test';import assert from 'node:assert/strict';
import {extractMileage} from '../lib/vehicle-mileage.js';
import {extractHarajPrice} from '../lib/haraj-price.js';
import {resolveCondition} from '../lib/vehicle-condition.js';
import {normalizeInventoryListing} from '../lib/inventory-normalizer.js';
import {extractSalehVehicleGallery} from '../lib/saleh-image.js';
import {strictDirectListings} from '../lib/direct-search.js';
for(const [raw,km] of [['ممشى 80 ألف',80000],['الممشى 80,000',80000],['ماشية 120 الف',120000],['120000 كم',120000],['١٢٠ ألف كيلو',120000],['Mileage: 95,000 KM',95000],['الممشى ۸۰ ألف',80000]])test('odometer '+raw,()=>assert.equal(extractMileage(raw),km));
for(const raw of ['1.5L 2023 0501234567 85000 SAR','18.1 km/l','120 hp'])test('not mileage '+raw,()=>assert.equal(extractMileage(raw),null));
for(const raw of ['دفعة أولى 20,000 ريال','قسط شهري 8,000 ريال','ضريبة 15,000 ريال','تمويل 100,000 ريال','down payment 30,000 SAR','monthly installment 5,500 SAR','السعر السابق 90,000 ريال','الممشى 95,000 كم'])test('not cash '+raw,()=>assert.equal(extractHarajPrice(raw),null));
test('cash price remains usable alongside separately labelled financing',()=>assert.equal(extractHarajPrice('دفعة 20,000 ريال. Cash price: 95,000 SAR').price,95000));
test('condition never comes from a requested tab, year, or zero/missing mileage',()=>{
 for(const mileage of [null,0])assert.equal(resolveCondition({source:'Haraj',condition:'new',title:'Camry 2026',mileage}),'unknown');
 assert.equal(resolveCondition({source:'Haraj',title:'كامري بحالة الوكالة بطارية جديدة',condition:'new'}),'unknown');
 assert.equal(resolveCondition({source:'Haraj',title:'سيارة جديدة',mileage:80000}),'used');
 assert.equal(resolveCondition({source:'Haraj',title:'Camry',sourceCondition:'new',mileage:0}),'new');
 assert.equal(resolveCondition({source:'Haraj',title:'كامري سيارة جديدة زيرو'}),'new');
});
test('unknown and used vehicles cannot enter New; new cannot enter Used',()=>{
 const base={source:'Haraj',title:'Toyota Camry 2023',year:2023,saleVerified:true};
 const cars=[{...base,url:'https://haraj.com.sa/11111111',condition:'new'},{...base,url:'https://haraj.com.sa/22222222',condition:'new',mileage:80000},{...base,url:'https://haraj.com.sa/33333333',sourceCondition:'new',mileage:0}];
 assert.deepEqual(strictDirectListings(cars,{query:'Camry 2023',condition:'new'}).map(c=>c.url),[cars[2].url]);
 assert.deepEqual(strictDirectListings(cars,{query:'Camry 2023',condition:'used'}).map(c=>c.url),[cars[1].url]);
});
test('canonical fields preserve existing contracts and source evidence',()=>{
 const c=normalizeInventoryListing({source:'Haraj',url:'https://haraj.com.sa/11111111',title:'Camry 2020',mileage:80000,price:45000,priceVerified:true,condition:'used',images:['https://example.org/car.jpg'],galleryVerified:true});
 assert.equal(c.price_sar,c.price);assert.equal(c.mileage_km,c.mileage);assert.equal(c.primary_image,c.image);assert.deepEqual(c.gallery_images,c.images);assert.equal(c.galleryVerified,true);assert.equal(c.priceVerified,true);
});
test('Saleh gallery uses product scope, relative/lazy/srcset originals, not recommendations',()=>{
 const base='https://www.salehcars.com/en/cars/abc/camry';
 const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url:base,name:'Toyota Camry',image:['/media/camry.jpg','/media/interior.jpg','/logo.png']})}</script><img alt="Toyota Camry" data-src="/media/rear.jpg"><img alt="Toyota Camry" srcset="/media/small.jpg 320w, /media/large.jpg 1500w"><img alt="Nissan Patrol" src="/media/other.jpg"><img alt="Google Play" src="/media/app.jpg">`;
 assert.deepEqual(extractSalehVehicleGallery(html,base,{title:'Toyota Camry'}),['camry.jpg','interior.jpg','rear.jpg','large.jpg'].map(x=>'https://www.salehcars.com/media/'+x));
});
import {harajListingEvidence} from '../lib/haraj-listing-evidence.js';
test('Haraj detail data is bound to exact ad, not comments or recommendations',()=>{
 const url='https://haraj.com.sa/11111111/';
 const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Thing',url,name:'Camry 2023',description:'ماشية 80 ألف. السعر 70 ألف'})}</script><script type="application/ld+json">${JSON.stringify({'@type':'Car',url:'https://haraj.com.sa/22222222/',description:'الممشى 10000 السعر 90000'})}</script><p>السعر 123000 الممشى 900000</p>`;
 const e=harajListingEvidence(html,url);assert.equal(e.mileage,80000);assert.equal(e.priceHit.price,70000);assert.equal(e.condition,'used');
});
test('live Yaris RPM and financing warranty are not selling price or mileage',()=>{
 assert.equal(extractHarajPrice('القوة القصوى: 97 حصان / 6,000 د.د'),null);
 assert.equal(extractMileage('ضمان ممتد إلى 3 سنوات او 100 الف كيلو أيهما اولا'),null);
 assert.equal(resolveCondition({source:'Haraj',description:'حالة السيارة : وكالة'}),'new');
});
test('clearing an invalid price cannot resurrect a stale canonical alias',()=>{
 const car=normalizeInventoryListing({price:90000,priceVerified:true});
 const cleared=normalizeInventoryListing({...car,price:null,priceVerified:false});
 assert.equal(cleared.price,null);assert.equal(cleared.price_sar,null);assert.equal(cleared.priceSar,null);
});
test('All inventory includes unknown without admitting it to either condition tab',()=>{
 const car={source:'Haraj',title:'Toyota Camry 2023',year:2023,url:'https://haraj.com.sa/11111111',condition:'unknown',saleVerified:true};
 assert.equal(strictDirectListings([car],{query:'Camry 2023',condition:'all'}).length,1);
 assert.equal(strictDirectListings([car],{query:'Camry 2023',condition:'new'}).length,0);
 assert.equal(strictDirectListings([car],{query:'Camry 2023',condition:'used'}).length,0);
});
