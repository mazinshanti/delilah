import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewKhaledOffer} from '../lib/khaled-offer-review.js';
import {catalogIntent} from '../public/catalog.js';
import {classifyVehicle} from '../lib/vehicle-classification.js';
const url='https://khaledcars.com/ar/car/toyota-corolla/401';
const title='تويوتا كورولا 2026';
const schema={ '@type':'Car',name:title,brand:{name:'تويوتا'},image:'https://khaledcars.com/admin/images/thumbnail1/tiny.webp',offers:{price:'88550',priceCurrency:'SAR',availability:'https://schema.org/InStock'}};
const fixture=()=>`<script type="application/ld+json">${JSON.stringify(schema)}</script><main><div class="swiper mainSwiper"><img src="https://khaledcars.com/admin/images/uploads/photo.webp"></div><h1>${title}</h1><span>السعر يبدأ من</span><span>88,550</span><a href="https://khaledcars.com/ar/request/individual?car=401">شراء</a>${[['سنة الصنع','2026'],['المسافة المقطوعة','جديد'],['ناقل الحركة','CVT'],['نوع المحرك','بنزين']].map(([k,v])=>`<div><span>${k}</span><span>${v}</span></div>`).join('')}<h3>سيارات ذات صلة</h3><h1>Kia K3 2025</h1><span>نوع الجر</span><span>AWD</span><img src="https://khaledcars.com/admin/images/uploads/other.webp"></main>`;
const review=html=>reviewKhaledOffer({url,html});
test('dealer starting price is separate from asking price and stock; gallery excludes thumbnail/recommendations',()=>{
 const r=review(fixture());assert.equal(r.status,'dealer-offer-review');assert.equal(r.acceptedVehicles,0);
 const o=r.offer;assert.equal(o.make,'Toyota');assert.equal(o.model,'Corolla');assert.equal(o.startingPriceSar,88550);assert.equal(o.priceSar,null);assert.equal(o.vatIncluded,null);assert.equal(o.stockVerified,false);assert.equal(o.condition,'new');assert.equal(o.mileage,null);assert.equal(o.drivetrain,null);assert.deepEqual(o.images,['https://khaledcars.com/admin/images/uploads/photo.webp']);assert.equal(o.imageHttpVerified,false);
});
test('title, purchase binding, structured URL, year and source host must agree',()=>{
 for(const html of [fixture().replace('car=401','car=402'),fixture().replace(`<h1>${title}`, '<h1>Toyota Camry 2026'),fixture().replace('<span>2026</span>','<span>2025</span>'),fixture().replace('"@type":"Car"','"@type":"Car","url":"https://khaledcars.com/ar/car/other/402"'),fixture().replace('سيارات ذات صلة','unknown layout')])assert.equal(review(html).offer,null);
 assert.equal(reviewKhaledOffer({url:url.replace('khaledcars.com','evil.test'),html:fixture()}).offer,null);
 assert.equal(reviewKhaledOffer({url,html:fixture(),status:406}).offer,null);
});
test('unknown condition and missing images stay unknown; price requires matching visible SAR evidence',()=>{
 assert.equal(review(fixture().replace('>جديد<','>غير متوفر<')).offer.condition,null);
 assert.equal(review(fixture().replace('>جديد<','>0<')).offer.condition,null);
 assert.equal(review(fixture().replace('88,550','88,551')).offer.startingPriceSar,null);
 assert.equal(review(fixture().replace('"SAR"','"USD"')).offer.startingPriceSar,null);
 assert.equal(review(fixture().replace('السعر يبدأ من','قسط شهري')).offer.startingPriceSar,null);
 assert.deepEqual(review(fixture().replace('/uploads/photo.webp','/thumbnail1/photo.webp')).offer.images,[]);
});
test('vehicle boundary rejects non-car sale subjects even with Car schema',()=>{
 for(const bad of ['Toyota Corolla spare parts 2026','Toyota Corolla toy 2026','مطلوب تويوتا كورولا 2026','محرك تويوتا كورولا 2026'])assert.equal(review(fixture().replaceAll(title,bad)).offer,null);
});
test('English labels work without borrowing Arabic fallback fields',()=>{
 const html=fixture().replaceAll(title,'Toyota Corolla 2026').replace('سنة الصنع','Year').replace('المسافة المقطوعة','Mileage').replace('>جديد<','>New<').replace('السعر يبدأ من','Starting from').replace('ناقل الحركة','Transmission').replace('نوع المحرك','Fuel Type').replace('سيارات ذات صلة','Related Cars');
 const o=review(html).offer;assert.equal(o.condition,'new');assert.equal(o.transmission,'CVT');assert.equal(o.startingPriceSar,88550);
});
test('observed Arabic Kia K3 alias resolves canonically without accepting accessories or another make',()=>{
 assert.equal(catalogIntent('كيا كي 3 جي ال 2025').modelKey,'Kia::K3');
 assert.equal(catalogIntent('Kia K3 GL 2025').modelKey,'Kia::K3');
 assert.equal(catalogIntent('Toyota كي 3').model,null);
 assert.notEqual(classifyVehicle({title:'قطع غيار كيا كي 3 2025',url,year:2025,schemaType:'Car'}).classification,'VEHICLE_FOR_SALE');
});
