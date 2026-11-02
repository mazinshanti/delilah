import test from 'node:test';
import assert from 'node:assert/strict';
import {InventoryIndex} from '../lib/inventory-index.js';

const car=(make,model,price,id,extras={})=>({
 source:'Haraj',sourceCategory:'cars for sale',condition:'used',
 title:make+' '+model+' 2022 for sale',make,model,year:2022,
 price,priceVerified:true,url:'https://example.com/'+id,...extras
});

test('trusted Japanese SUV search selects only confirmed matching inventory before ranking',()=>{
 const index=new InventoryIndex();
 index.replace({generatedAt:new Date().toISOString(),listings:[
  car('Toyota','Fortuner',125000,'fortuner'),
  car('Nissan','Patrol',138000,'patrol'),
  car('Toyota','Camry',75000,'camry'),
  car('BMW','X5',115000,'bmw'),
  car('Toyota','Prado',220000,'high'),
  car('Toyota','Fortuner',null,'missing'),
  car('Toyota','Fortuner',99000,'unverified',{priceVerified:false})
 ]});
 const body={query:'__all_cars__',condition:'used',filters:{maxPrice:150000}};
 const actual=index.searchTrustedOriginBody(body,{makes:['Toyota','Nissan','Lexus'],bodyType:'SUV'});
 assert.deepEqual(new Set(actual.map(x=>x.url)),new Set([
  'https://example.com/fortuner','https://example.com/patrol'
 ]));
 assert(actual.every(x=>x.priceVerified && Number(x.price)>0));
});

test('trusted retrieval rejects missing ceilings or unsupported body category',()=>{
 const index=new InventoryIndex();
 index.replace({listings:[car('Toyota','Fortuner',120000,'car')]});
 const params={query:'__all_cars__',condition:'used',filters:{}};
 assert.deepEqual(index.searchTrustedOriginBody(params,{makes:['Toyota'],bodyType:'SUV'}),[]);
 assert.deepEqual(index.searchTrustedOriginBody({...params,filters:{maxPrice:150000}},{makes:[],bodyType:'SUV'}),[]);
});

test('city, seller and mileage filters still apply after trusted prefilter',()=>{
 const index=new InventoryIndex();
 index.replace({listings:[
  car('Nissan','Patrol',130000,'riyadh',{city:'Riyadh',mileage:55000}),
  car('Nissan','Patrol',120000,'jeddah',{city:'Jeddah',mileage:45000}),
  car('Nissan','Patrol',100000,'high-mileage',{city:'Riyadh',mileage:155000})
 ]});
 const body={query:'__all_cars__',condition:'used',filters:{maxPrice:150000,city:'Riyadh',maxMileage:80000}};
 const actual=index.searchTrustedOriginBody(body,{makes:['Nissan'],bodyType:'SUV'});
 assert.deepEqual(actual.map(x=>x.url),['https://example.com/riyadh']);
});
