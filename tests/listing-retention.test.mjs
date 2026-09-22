import test from 'node:test';import assert from 'node:assert/strict';
import {InventoryIndex} from '../lib/inventory-index.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {classifyVehicle} from '../lib/vehicle-classification.js';
import {refreshRetainedListings,exactAvailability} from '../lib/retained-listing-refresh.js';
import {inventoryRefreshReport} from '../lib/inventory-refresh-report.js';
const car={title:'Toyota Corolla 2023',make:'Toyota',model:'Corolla',year:2023,condition:'used',schemaType:'Car',price:50000,priceVerified:true,mileage:10000,city:'Riyadh',source:'Example',url:'https://example.com/car/1',lastSeenAt:'2020-01-01T00:00:00Z'};
test('old listings survive until explicit sold or removed evidence, with honest freshness',()=>{
 const idx=new InventoryIndex();idx.replace({listings:[car,{...car,url:car.url+'2',availability:'https://schema.org/SoldOut'},{...car,url:car.url+'3',availability:'removed'}]});
 const rows=idx.search({condition:'all'});assert.equal(rows.length,1);assert.equal(rows[0].refreshDue,true);assert.equal(rows[0].lastCheckedAt,car.lastSeenAt);assert.equal(idx.fresh().length,0);assert.equal(idx.stats().refreshDueRecords,1);
 const report=inventoryRefreshReport({listings:[car]});assert.equal(report.searchableListings,1);assert.equal(report.freshRows,0);
});
test('Arabic and English cities match the same records; unrelated cities do not',()=>{
 for(const city of ['الرياض','Riyadh','Al Riyadh'])assert.equal(strictDirectListings([car],{filters:{city}}).length,1);
 assert.equal(strictDirectListings([car],{filters:{city:'Jeddah'}}).length,0);
});
test('a negated outstanding requirement is not a wanted ad; real requests still fail',()=>{
 assert.equal(classifyVehicle({...car,description:'السيارة للبيع لا يوجد مطلوب على السيارة'}).classification,'VEHICLE_FOR_SALE');
 assert.equal(classifyVehicle({...car,description:'لا يوجد مطلوب على السيارة. مطلوب تويوتا كامري للشراء'}).classification,'WANTED_VEHICLE');
 assert.equal(classifyVehicle({...car,title:'مطلوب تويوتا كورولا 2023'}).classification,'WANTED_VEHICLE');
});
const source={name:'Example',url:'https://example.com',adapter:'example'};
const html=(url,status)=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Car',url,offers:{availability:'https://schema.org/'+status}})+'</script>';
test('sold evidence is bound to the original car, not a recommendation',()=>{
 assert.equal(exactAvailability(html(car.url+'other','SoldOut'),car.url),null);
 assert.equal(exactAvailability(html(car.url,'SoldOut'),car.url),'https://schema.org/SoldOut');
});
test('retained detail checks keep errors and ambiguous pages, remove only 404/410 or exact sold',async()=>{
 for(const result of ['HTTP 202','HTTP 403','HTTP 429','HTTP 503','timeout','HTTP 404','HTTP 410','sold','unresolved']){
  const r=await refreshRetainedListings({records:[car],sources:[source],parsers:{example:()=>[]},wait:async()=>{},get:async url=>{if(url.endsWith('robots.txt'))return 'User-agent: *\nAllow: /';if(result==='sold')return html(car.url,'SoldOut');if(result==='unresolved')return '<p>Car unavailable in this response</p>';throw Error(result);}});
  assert.equal(r.removedUrls.length,['HTTP 404','HTTP 410','sold'].includes(result)?1:0,result);assert.equal(r.updates.length,0);assert.equal(car.lastSeenAt,'2020-01-01T00:00:00Z');
 }
});
test('successful detail refresh updates price and evidence and respects retry time',async()=>{
 const r=await refreshRetainedListings({records:[car],sources:[source],parsers:{example:()=>[{...car,price:45000,lastSeenAt:new Date().toISOString()}]},wait:async()=>{},get:async u=>u.endsWith('robots.txt')?'User-agent: *\nAllow: /':html(car.url,'InStock')});
 assert.equal(r.updates[0].price,45000);assert.ok(r.updates[0].lastDetailAt);assert.equal(r.removedUrls.length,0);
 const next=await refreshRetainedListings({records:[car],sources:[source],parsers:{},state:r.state,get:()=>assert.fail('not due')});assert.equal(next.diagnostics.length,0);
});
