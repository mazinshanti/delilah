import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryRecord,parseStructuredInventory,parseSyarahInventory,safePublicUrl,syarahHighResolutionImage} from '../lib/public-inventory.js';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
import {InventoryIndex,deduplicateVehicles,paginateInventory} from '../lib/inventory-index.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {validateFilters} from '../lib/api-guard.js';
import {robotsPolicy} from '../lib/robots-policy.js';
import {exactYearIntent} from '../lib/search-intent.js';
const source=SOURCE_REGISTRY.find(s=>s.id==='carswitch');
const raw={url:'https://ksa.carswitch.com/riyadh/used-car/toyota/corolla/2013/123',title:'Toyota Corolla 2013',make:'Toyota',model:'Corolla',year:2013,condition:'used',price:35000,mileage:100000,city:'Riyadh',trim:'GLI',image:'https://images.example.test/car.jpg'};
const car=inventoryRecord(raw,source);
test('Plus in a model name does not erase an exact year',()=>{
 assert.equal(exactYearIntent('Changan CS35 Plus 2023'),2023);
 assert.equal(exactYearIntent('Toyota Corolla 1999'),1999);
 assert.equal(exactYearIntent('Toyota Corolla 2013+'),null);
 assert.equal(exactYearIntent('Toyota Corolla 2013 plus'),null);
 assert.equal(exactYearIntent('Peugeot 2008 2023'),2023);
 assert.equal(exactYearIntent('Peugeot 2008'),null);
});
test('records retain evidence and missing fields without manufactured defaults',()=>{
 const r=inventoryRecord({...raw,image:undefined,mileage:undefined,trim:undefined},source);
 assert.equal(r.image,null);assert.equal(r.mileage,null);assert.equal(r.trim,null);assert.equal(r.dataComplete,false);assert.equal(r.saleVerified,false);assert.equal(safePublicUrl(undefined,source.url),null);
 assert.equal(inventoryRecord({...raw,url:'https://attacker.test/car'},source),null);
 assert.equal(inventoryRecord({...raw,url:'javascript:alert(1)'},source),null);
 assert.equal(inventoryRecord({...raw,title:'Toyota Corolla spare parts'},source),null);
 assert.equal(inventoryRecord({...raw,title:'جنط جديد لم يستخدم اصلى كيا سبورتاج'},source),null);
});
test('CarSwitch ItemPage and official OfferCatalog schemas parse safely',()=>{
 const vehicle={'@type':['Product','Car'],url:raw.url,name:raw.title,brand:{name:'Toyota'},model:'Corolla',vehicleModelDate:2013,itemCondition:'https://schema.org/UsedCondition',mileageFromOdometer:{value:100000},offers:{price:35000},image:raw.image,vehicleIdentificationNumber:'BUYWITHCS00123'};
 const parse=v=>parseStructuredInventory(`<script type="application/ld+json">${JSON.stringify(v)}</script>`,source);
 assert.equal(parse({'@type':'ItemPage',mainEntity:vehicle})[0].vin,null);
 assert.equal(parse({...vehicle,offers:{price:35000,availability:'https://schema.org/SoldOut'}}).length,0);
});
test('Syarah preserves zero mileage and excludes booked vehicles',()=>{
 const src=SOURCE_REGISTRY.find(s=>s.id==='syarah');const post={product_url:'/en/cardetail/toyota-corolla-123',title:'Toyota Corolla 2026',sellingprice:90000,image_url:raw.image,g4_data_layer:{post_make:'Toyota',post_model:'Corolla',post_year:2026,post_mileage:0,post_condition:'New',post_ext:'GLI',post_city:'Riyadh'}};
 const parse=p=>parseSyarahInventory('window.FULL_PAGE_DATA = '+JSON.stringify({posts:[p]})+';',src);
 assert.equal(parse(post)[0].mileage,0);assert.equal(parse({...post,is_booked:true}).length,0);
 assert.equal(parse({...post,g4_data_layer:{...post.g4_data_layer,post_mileage:'0'}})[0].mileage,0);
});
test('Syarah upgrades only proven CDN thumbnail sizes to the supported 911x683 variant',()=>{
 const thumb='https://cdn.syarah.com/photos-thumbs/online-v1/0x300/online/posts/314836/orignal-car.jpg?v=3';
 assert.equal(syarahHighResolutionImage(thumb),'https://cdn.syarah.com/photos-thumbs/online-v1/0x683/online/posts/314836/orignal-car.jpg?v=3');
 assert.equal(syarahHighResolutionImage('https://images.example.test/car.jpg'),'https://images.example.test/car.jpg');
});
test('dedup preserves distinct stock and merges evidenced cross-posts',()=>{
 assert.equal(deduplicateVehicles([car,{...car,url:raw.url+'4'}]).length,1);
 assert.equal(deduplicateVehicles([{...car,mileage:0},{...car,mileage:0,url:raw.url+'4'}]).length,2);
 assert.equal(deduplicateVehicles([car,{...car,price:40000,url:raw.url+'4'}]).length,2);
 const vin='1HGCM82633A004352';assert.equal(deduplicateVehicles([{...car,vin},{...car,vin,url:raw.url+'4',image:null}]).length,1);
});
test('exact brand, unknown model, year range and condition fail closed',()=>{
 const rows=[car,{...car,url:raw.url+'1',year:2014,title:'Toyota Corolla 2014'},{...car,url:'https://ksa.carswitch.com/riyadh/used-car/bentley/continental/2013/124',originalUrl:null,make:'Bentley',brand:'Bentley',model:'Continental',title:'Bentley Continental 2013'},{...car,url:raw.url+'3',condition:'new'}];
 assert.equal(strictDirectListings(rows,{query:'Toyota Corolla 2013'}).length,1);
 assert.equal(strictDirectListings(rows,{query:'Toyota nonexistentmodel'}).length,0);
 assert.equal(strictDirectListings(rows,{query:'Bentley'}).length,1);
 assert.equal(strictDirectListings(rows,{query:'Toyota',filters:{minYear:2014,maxYear:2015}}).length,1);
});
test('old records remain searchable and pagination is stable',()=>{
 const index=new InventoryIndex();index.replace({listings:[{...car,price:36000,url:raw.url+'old',originalUrl:raw.url+'old',source_url:raw.url+'old',lastSeenAt:'2000-01-01'},car]});assert.equal(index.search({query:'Toyota'}).length,2);
 const rows=Array.from({length:55},(_,i)=>({...car,url:raw.url+i,price:i+1}));
 const p=paginateInventory(rows,{page:2,pageSize:24,sort:'price-desc'});assert.equal(p.listings.length,24);assert.equal(p.listings[0].price,31);assert.equal(p.pagination.total,55);
});
test('invalid filters and reversed ranges are rejected',()=>{
 for(const f of [{maxPrice:'bad'},{maxMileage:-1},{minYear:2024,maxYear:2013},{minPrice:500,maxPrice:100},{city:{bad:true}}])assert.ok(validateFilters(f));
 assert.equal(validateFilters({maxPrice:100000,minYear:2013}),null);
});
test('robots longest matching allow and agent-specific rules are respected',()=>{
 const text='User-agent: *\nDisallow: /*?*\nAllow: /*?page=*\nDisallow: /api/\nCrawl-delay: 2\nUser-agent: BadBot\nDisallow: /';
 assert.equal(robotsPolicy(text,'https://example.test/en/autos?page=2').allowed,true);
 assert.equal(robotsPolicy(text,'https://example.test/api/stock').allowed,false);
 assert.equal(robotsPolicy(text,'https://example.test/').delayMs,2000);
 assert.equal(robotsPolicy(text,'https://example.test/','badbot').allowed,false);
});
