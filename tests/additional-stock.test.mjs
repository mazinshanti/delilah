import test from 'node:test';import assert from 'node:assert/strict';
import {ADDITIONAL_MARKET_SOURCES as sources,parseAdditionalStock,stockIdentity,stockLinks} from '../lib/additional-market-sources.js';
import {collectAdditionalStock} from '../lib/additional-stock-collector.js';
const source=sources.find(s=>s.id==='motory'),url='https://ksa.motory.com/en/cars-for-sale/riyadh-haraj/toyota/corolla/2023/123456/';
const json=o=>`<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const car=(changes={})=>({'@type':'Car',url,name:'Toyota Corolla 2023',brand:{name:'Toyota'},model:'Corolla',vehicleModelDate:2023,itemCondition:'https://schema.org/UsedCondition',mileageFromOdometer:{value:45000,unitCode:'KMT'},offers:{availability:'https://schema.org/InStock',priceCurrency:'SAR',price:60000},...changes});
test('stock adapters bind individual URL and reject related, sold, foreign and false-new stock',()=>{
 assert.equal(parseAdditionalStock(json(car()),url,source).records.length,1);
 for(const c of [car({url:url.replace('123456','654321')}),car({offers:{availability:'https://schema.org/SoldOut',priceCurrency:'SAR'}}),car({offers:{availability:'https://schema.org/InStock',priceCurrency:'AED'}}),car({itemCondition:'NewCondition'}),car({name:'Toyota Corolla engine spare parts 2023'})])assert.equal(parseAdditionalStock(json(c),url,source).records.length,0);
 for(const u of [url.replace('ksa.motory.com','evil.test'),url.replace('https:','http:'),'https://ksa.motory.com/en/cars-for-sale/'])assert.equal(stockIdentity(source,u),null);
});
test('SAMACO requires an exact stock breadcrumb and keeps low-mileage used vehicles used',()=>{
 const s=sources.find(s=>s.id==='samaco'),u='https://www.samaco.com.sa/stock/20610431-toyota-corolla/';
 const nodes=[{'@type':'Offer',priceCurrency:'SAR',price:65000,itemOffered:car({mileageFromOdometer:10})},{'@type':'BreadcrumbList',itemListElement:[{item:{'@id':u}}]}];
 let r=parseAdditionalStock(json({'@graph':nodes}),u,s);assert.equal(r.records[0].condition,'used');assert.equal(r.records[0].mileage,10);
 nodes[1].itemListElement[0].item['@id']=u.replace('20610431','20610432');assert.equal(parseAdditionalStock(json({'@graph':nodes}),u,s).records.length,0);
});
test('ArabWheels reads primary vehicle fields, never recommendation prices or thumbnails',()=>{
 const s=sources.find(s=>s.id==='arabwheels'),u='https://www.arabwheels.sa/used-cars/toyota-corolla-2023-for-sale-in-riyadh-1234';
 const h=`<link rel="canonical" href="${u}">${json({'@type':'WebPage',description:'Toyota Corolla 2023 Used for sale in Riyadh'})}<h1>Toyota Corolla 2023</h1><i class="pw-mileage"></i> 62,000 عدد الكيلومترات <strong class="generic-white fs18">اتصل للسعر</strong>رقم المرجع للإعلان 1234 <li data-thumb="https://cache1.arabwheels.sa/ad_pictures/1/tn_car.webp" data-src="https://cache1.arabwheels.sa/ad_pictures/1/car.webp"></li><div id="reduce-price-modal"></div>${json(car({offers:{price:999999}}))}`;
 const r=parseAdditionalStock(h,u,s).records[0];assert.ok(r);assert.equal(r.price,null);assert.equal(r.mileage,62000);assert.equal(r.image,'https://cache1.arabwheels.sa/ad_pictures/1/car.webp');
 assert.equal(parseAdditionalStock(h.replace('رقم المرجع للإعلان 1234','رقم المرجع للإعلان 9999'),u,s).records.length,0);
});
test('discovery deduplicates source IDs and ignores non-car categories and offsite links',()=>{
 const m=sources.find(s=>s.id==='mstaml');let u='https://www.mstaml.com/sa/product/car?id=1234567&type=4.41';
 assert.equal(stockLinks(`<a href="${u}"></a><a href="${u}&amp;utm_source=test"></a><a href="${u.replace('4.41','4.44')}"></a>`,m).length,1);
});
test('collector is bounded, follows only observed pagination, and fails closed on robots',async()=>{
 const calls=[];const mock=async u=>{calls.push(String(u));if(String(u).endsWith('/robots.txt'))return new Response('User-agent: *\nDisallow: /private');if(String(u)===new URL(source.path,source.url).href)return new Response(`<a href="${url}">Car</a><a href="${url.replace('123456','123457')}">Car</a>`);return new Response(json(car()));};
 const r=await collectAdditionalStock({sources:[source],fetchImpl:mock,wait:async()=>{},maxDetails:1});assert.equal(r.listings.length,1);assert.equal(r.diagnostics[0].pending,1);assert.equal(calls.length,3);
 const blocked=await collectAdditionalStock({sources:[source],fetchImpl:async()=>new Response('',{status:403}),wait:async()=>{}});assert.equal(blocked.listings.length,0);assert.match(blocked.diagnostics[0].errors[0].error,/robots/);
});
test('Motory placeholder one-riyal price stays unavailable',()=>{
 const c=car();c.offers.price=1;assert.equal(parseAdditionalStock(json(c),url,source).records[0].price,null);
 assert.equal(stockIdentity(source,url),stockIdentity(source,url.slice(0,-1)));
});
test('Kayishha needs exact identity, sale evidence and an explicit used odometer',()=>{
 const s=sources.find(s=>s.id==='kayishha'),u='https://buy.kayishha.com/cars/details/hyundai-palisade-2021-87488';
 const c={'@type':'Car',name:'2021 Hyundai Palisade for Sale - White, 250K KM',description:'Buy this white 2021 Hyundai Palisade with 250000 KM on BuyAnyCar.',url:u.replace('/cars/','/ar/cars/'),image:'https://ik.imagekit.io/yk64cmkix/bac-api-v2/carImages/87488-test.jpg'};
 const r=parseAdditionalStock(json(c),u,s).records[0];assert.equal(r.condition,'used');assert.equal(r.mileage,250000);assert.equal(r.price,null);
 for(const change of [{url:u.replace('87488','87489')},{description:'Call for mileage'},{description:'with 0 KM'},{name:'Hyundai Palisade 2021 wanted'}])assert.equal(parseAdditionalStock(json({...c,...change}),u,s).records.length,0);
});
test('ingestion rejects broken or tiny images and caches successful checks',async()=>{
 const {stockMediaValidator}=await import('../lib/additional-stock-media.js');const sharp=(await import('sharp')).default;
 const large=await sharp({create:{width:800,height:600,channels:3,background:'white'}}).jpeg().toBuffer(),tiny=await sharp({create:{width:120,height:80,channels:3,background:'white'}}).jpeg().toBuffer();
 let calls=0;const verify=stockMediaValidator(async u=>{calls++;return new Response(u.includes('tiny')?tiny:large);});
 const r=parseAdditionalStock(json(car()),url,source).records[0];r.image='https://s3.eu-central-1.amazonaws.com/v3-cfs.motory.com/tiny.jpg';r.images=[r.image,'https://s3.eu-central-1.amazonaws.com/v3-cfs.motory.com/large.jpg'];
 let checked=await verify(r);assert.equal(checked.images.length,1);assert.match(checked.image,/large/);await verify(r);assert.equal(calls,2);
 r.image='https://127.0.0.1/private';r.images=[];checked=await verify(r);assert.equal(checked.image,null);assert.equal(checked.media.primaryImage,null);assert.equal(calls,2);
});
test('remaining detail work resumes on the next refresh instead of restarting page one',async()=>{
 const nextUrl=url.replace('123456','123457'),calls=[];
 const r=await collectAdditionalStock({sources:[source],previousDiagnostics:[{source:source.name,pendingUrls:[nextUrl],pendingPages:[]}],maxDetails:1,wait:async()=>{},fetchImpl:async u=>{calls.push(String(u));return String(u).endsWith('/robots.txt')?new Response('User-agent: *\nAllow: /'):new Response(json(car({url:nextUrl})));}});
 assert.equal(r.listings.length,1);assert.equal(calls[1],nextUrl);assert.equal(r.diagnostics[0].pages,0);
});
