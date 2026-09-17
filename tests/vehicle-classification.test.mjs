import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyVehicle,vehicleIdentity} from '../lib/vehicle-classification.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {catalogIntent} from '../public/catalog.js';
const car=(overrides={})=>({title:'Toyota Camry 2022',make:'Toyota',model:'Camry',year:2022,price:70000,mileage:80000,url:'https://example.com/listing/1',source:'test',...overrides});
const negatives=[['PUBG account with Bugatti skin','NON_AUTOMOTIVE'],['gaming account Lamborghini','NON_AUTOMOTIVE'],['دجاج لامبورغيني','NON_AUTOMOTIVE'],['سيارات ريموت اطفال','NON_AUTOMOTIVE'],['toy model car','NON_AUTOMOTIVE'],['clothing Mercedes','NON_AUTOMOTIVE'],['engine for sale','VEHICLE_PART'],['gearbox for sale','VEHICLE_PART'],['rim for sale','VEHICLE_PART'],['tyre for sale','VEHICLE_PART'],['مكينة للبيع','VEHICLE_PART'],['spare parts','VEHICLE_PART'],['accessory','VEHICLE_ACCESSORY'],['wanted Toyota Camry','WANTED_VEHICLE'],['for rent Toyota Camry','NON_AUTOMOTIVE'],['repair service','NON_AUTOMOTIVE']];
for(const [subject,expected] of negatives)test(`reject sale-subject ${subject}`,()=>{
 const title=classifyVehicle(car({title:subject}));assert.equal(title.classification,expected);
 const description=classifyVehicle(car({description:subject}));assert.notEqual(description.classification,'VEHICLE_FOR_SALE');
});
test('a keyword, year or image alone is not vehicle evidence',()=>{
 for(const title of ['Bugatti','Lamborghini','Toyota Camry 2022'])assert.equal(classifyVehicle({title,url:'https://example.com/1',image:'https://example.com/image.jpg'}).classification,'UNKNOWN');
});
test('complete-car evidence survives mechanical descriptions',()=>{
 for(const description of ['Engine 2.0, automatic transmission, new tyres','محرك 2000 سي سي قير اوتوماتيك','تم تغيير الكفرات والصدام'])assert.equal(classifyVehicle(car({description})).classification,'VEHICLE_FOR_SALE');
});
test('explicit structured identity cannot be replaced by title or description',()=>{
 assert.equal(classifyVehicle(car({title:'BMW X5 2022'})).classification,'UNKNOWN');
 assert.deepEqual(strictDirectListings([car({description:'Bugatti Lamborghini Urus'})],{query:'Bugatti'}),[]);
 assert.deepEqual(strictDirectListings([car()],{query:'Toyota Corolla 2022'}),[]);
 assert.equal(strictDirectListings([car()],{query:'Toyota Camry 2022'}).length,1);
 assert.equal(strictDirectListings([car()],{query:'Toyota Camry 2023'}).length,0);
});
test('brand/model regression matrix uses canonical identity',()=>{
 const pairs=[['Lamborghini','Urus'],['Bugatti','Chiron'],['Ferrari','Roma'],['Bentley','Bentayga'],['Rolls-Royce','Ghost'],['Porsche','Cayenne'],['Mercedes-Benz','G-Class'],['BMW','X5'],['Audi','Q7'],['Toyota','Camry'],['Nissan','Patrol'],['Ford','F-150'],['Hyundai','Elantra'],['Kia','Sportage'],['Lexus','RX'],['Jeep','Wrangler']];
 for(const [make,model] of pairs){const row=car({title:`${make} ${model} 2022`,make,model});assert.equal(classifyVehicle(row).classification,'VEHICLE_FOR_SALE',`${make} ${model}`);assert.equal(strictDirectListings([row],{query:`${make} ${model}`}).length,1,`${make} ${model}`);}
});
test('Arabic/English aliases share a canonical vehicle identity',()=>{
 for(const names of [['Bugatti','بوغاتي','بوقاتي'],['Lamborghini','لامبورغيني'],['Mercedes','Mercedes-Benz','مرسيدس'],['Land Cruiser','لاندكروزر','لاند كروزر'],['Patrol','باترول'],['Camry','كامري']]){
 const expected=catalogIntent(names[0]);for(const name of names)assert.equal(catalogIntent(name).make,expected.make,name);
 }
 for(const model of ['Urus','Huracan','Chiron','Veyron','G63','G-Class','X5','Land Cruiser','Patrol','Camry','Corolla','F-150','Wrangler'])assert.ok(catalogIntent(model).model,model);
});

test('legacy inventory is gated again when loaded and queried',async()=>{
 const {InventoryIndex}=await import('../lib/inventory-index.js');
 const index=new InventoryIndex();
 index.replace({generatedAt:new Date().toISOString(),listings:[car(),car({url:'https://example.com/2',title:'PUBG Toyota Camry account'})]});
 assert.equal(index.records.length,1);
 assert.equal(index.search({query:'Toyota Camry',condition:'all'}).length,1);
 assert.equal(index.search({query:'Bugatti',condition:'all'}).length,0);
});
test('explicit model filter rejects text-only mentions',()=>{
 assert.equal(strictDirectListings([car({description:'Corolla'})],{query:'Toyota',filters:{model:'Corolla'}}).length,0);
});

test('animal words in legitimate model/trim names do not become animal sales',()=>{assert.equal(classifyVehicle(car({make:'Ford',model:'Mustang',title:'Ford Mustang Dark Horse 2022'})).classification,'VEHICLE_FOR_SALE');assert.equal(classifyVehicle(car({title:'horse for sale'})).classification,'NON_AUTOMOTIVE');});

test('ingestion metrics count records separately from repeated retrieval validation',async()=>{
 const {recordClassification,classificationMetrics}=await import('../lib/vehicle-classification.js');
 const verdict=classifyVehicle(car());recordClassification('metrics-test',verdict);recordClassification('metrics-test',verdict,'validation');recordClassification('metrics-test',verdict,'validation');
 const m=classificationMetrics()['metrics-test'];assert.equal(m.ingested,1);assert.equal(m.classes.VEHICLE_FOR_SALE,1);assert.equal(m.validation.evaluated,2);
});

test('public Haraj structured metadata restores sparse cars and rejects parts',async()=>{
 const {attachHarajClassificationEvidence}=await import('../lib/haraj-classification-evidence.js');
 const table=[{_1:2,_3:4,_5:6,_7:8,_9:10},'URL','11188763168/car/','title','كامري 2010','tags',[11,12],'bodyTEXT','كامري للبيع','carInfo',{_13:14},'حراج السيارات','تويوتا كامري','carOrRelated','CAR'];
 const html='<script>window.__reactRouterContext.streamController.enqueue('+JSON.stringify(JSON.stringify(table))+')</script>';
 const sparse={title:'كامري 2010',url:'https://haraj.com.sa/11188763168/car/',year:2010,discovery:'haraj_direct_volume_search',brand:'Bugatti',model:'Chiron'};
 const [result]=attachHarajClassificationEvidence([sparse],html);
 assert.equal(classifyVehicle(result).classification,'VEHICLE_FOR_SALE');assert.equal(vehicleIdentity(result).make,'Toyota');
 assert.equal(classifyVehicle({...result,sourceCategory:'حراج السيارات قطع غيار'}).classification,'VEHICLE_PART');
 assert.equal(attachHarajClassificationEvidence([{...sparse,url:'https://haraj.com.sa/11199999999/other/'}],html)[0].sourceCategory,undefined);
 assert.equal(attachHarajClassificationEvidence([sparse],'<script>throw Error("do not execute")</script>')[0].sourceCategory,undefined);
});
test('query-derived Haraj metadata cannot supply vehicle identity',()=>{
 const row=car({title:'Toyota Corolla 2022',make:'Bugatti',model:'Chiron',discovery:'haraj_source_native_search'});
 assert.equal(vehicleIdentity(row).make,'Toyota');assert.equal(vehicleIdentity(row).model,'Corolla');
 assert.equal(strictDirectListings([row],{query:'Bugatti',condition:'all'}).length,0);
});

test('legacy source parsers cannot reuse requested make/model as listing evidence',()=>{
 for(const discovery of ['haraj_source_native_search','haraj_direct_volume_search','syarah_source_native_inventory','yallamotor_source_native_search']){
 const row=car({title:'Toyota Corolla 2022',model:'Camry',discovery});
 assert.equal(vehicleIdentity(row).model,'Corolla');assert.equal(strictDirectListings([row],{query:'Toyota Camry 2022'}).length,0);
 }
});
