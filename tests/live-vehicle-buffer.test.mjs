import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveVehicleBuffer} from '../lib/live-vehicle-buffer.js';
import {observeSourceSearchListings} from '../lib/live-source-observation.js';

const stamp=()=>Date.now();
const car=(id,model='Camry',year=2022,extra={})=>({
 source:'Haraj',sourceCategory:'cars for sale',title:'Toyota '+model+' '+year+' for sale',
 url:'https://haraj.com.sa/'+id,make:'Toyota',model,year,condition:'used',
 price:75000,priceVerified:true,city:'Riyadh',...extra
});
const observed=(cars,at)=>observeSourceSearchListings(cars,'Haraj',new Date(at).toISOString());

test('an independent query can reuse only recently observed model listings',()=>{
 let now=stamp();
 const buffer=new LiveVehicleBuffer({ttlMs:600000,maxListings:50,clock:()=>now});
 const matches=observed([car('11188361001'),car('11188361002','Corolla')],now-2000);
 assert.equal(buffer.ingest(matches),2);
 const query=(q)=>buffer.search({query:q,condition:'used',filters:{}});
 assert.deepEqual(query('Toyota Camry').map(x=>x.url),['https://haraj.com.sa/11188361001']);
 assert.deepEqual(query('Toyota Corolla').map(x=>x.url),['https://haraj.com.sa/11188361002']);
 assert.equal(buffer.stats().cachedListingUrls,2);
 now+=600_001;
 assert.deepEqual(query('Toyota Camry'),[]);
 assert.equal(buffer.stats().cachedListingUrls,0);
});
test('cached records always pass same exact-year, city, and verified-price gates',()=>{
 const now=stamp(),buffer=new LiveVehicleBuffer({clock:()=>now});
 buffer.ingest(observed([
  car('11188361003','Camry',2022,{city:'Riyadh',price:70000}),
  car('11188361004','Camry',2023,{city:'Jeddah',price:69000}),
  car('11188361005','Camry',2022,{city:'Riyadh',price:null,priceVerified:false}),
 ],now-100));
 const hits=buffer.search({query:'Toyota Camry 2022',condition:'used',
  filters:{maxPrice:75000,city:'Riyadh'}});
 assert.deepEqual(hits.map(c=>c.url),['https://haraj.com.sa/11188361003']);
});
test('unobserved snapshot records and unsupported source types cannot enter live buffer',()=>{
 const now=stamp(),buffer=new LiveVehicleBuffer({clock:()=>now});
 const old=car('11188361006',{});
 const invalid=[
  old,car('11188361007','Camry',2022,{sourceObservedAt:'2000-01-01T00:00:00Z'}),
  car('11188361008','Camry',2022,{sourceObservedAt:new Date(now).toISOString(),source:'Syarah'}),
  car('11188361009','Camry',2022,{sourceObservedAt:new Date(now).toISOString(),url:'javascript:alert(1)'})
 ];
 assert.equal(buffer.ingest(invalid),0);
 assert.equal(buffer.stats().cachedListingUrls,0);
});
test('buffer enforces strict maximum and replaces duplicate URLs without persisting to disk',()=>{
 const now=stamp(),buffer=new LiveVehicleBuffer({clock:()=>now,maxListings:2});
 const first=observed([car('11188361010'),car('11188361011'),car('11188361012')],now-1000);
 assert.equal(buffer.ingest(first),3);
 assert.equal(buffer.stats().cachedListingUrls,2);
 assert.deepEqual(new Set(buffer.search({query:'Toyota Camry',condition:'used',filters:{}}).map(x=>x.url)),
  new Set(['https://haraj.com.sa/11188361011','https://haraj.com.sa/11188361012']));
 assert.equal(buffer.ingest(observed([car('11188361012','Camry',2022,{price:73000})],now-100)),1);
 assert.equal(buffer.stats().cachedListingUrls,2);
 assert.equal(buffer.search({query:'Toyota Camry',condition:'used',filters:{}}).find(x=>x.url.endsWith('11188361012')).price,73000);
});
