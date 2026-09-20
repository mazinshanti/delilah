import test from 'node:test';import assert from 'node:assert/strict';
import {InventoryIndex} from '../lib/inventory-index.js';
import {strictDirectListings} from '../lib/direct-search.js';
const car=(n,extra={})=>({title:'Toyota Corolla 2023',make:'Toyota',model:'Corolla',year:2023,schemaType:'Car',source:'Motory',seller:'Dealer',condition:'used',mileage:40000,price:60000,priceVerified:true,url:'https://ksa.motory.com/en/cars-for-sale/riyadh-haraj/toyota/corolla/2023/'+n,lastSeenAt:new Date().toISOString(),...extra});
test('indexed candidate selection preserves exact strict-filter results in Arabic and English',()=>{
 const idx=new InventoryIndex();idx.replace({listings:[car(123456),car(123457,{condition:'new',mileage:0}),car(123458,{title:'BMW X5 2023',make:'BMW',model:'X5'}),car(123459,{source:'Syarah',seller:'Syarah',price:110000}),car(123460,{title:'Toyota Corolla spare parts 2023'})]});
 for(const body of [{query:'Toyota Corolla',condition:'used'},{query:'تويوتا كورولا',condition:'all'},{query:'BMW X5',condition:'used'},{query:'',condition:'new'},{query:'',condition:'used',filters:{seller:'Dealer'}},{query:'Toyota',condition:'all',filters:{maxPrice:100000,maxMileage:100000}}]){
  const expected=strictDirectListings(idx.fresh(),body).map(c=>c.url);assert.deepEqual(idx.search(body).map(c=>c.url),expected);assert.deepEqual(idx.search(body).map(c=>c.url),expected);
 }
});
test('cached results expire with evidence and are invalidated when the snapshot changes',()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 try{const idx=new InventoryIndex({maxAgeMs:10000});idx.replace({listings:[car(123456,{lastSeenAt:new Date(now-9900).toISOString()})]});const body={query:'Toyota Corolla',condition:'used'};assert.equal(idx.search(body).length,1);now+=200;assert.equal(idx.search(body).length,0);idx.replace({listings:[car(123457,{lastSeenAt:new Date(now).toISOString()})]});assert.equal(idx.search(body)[0].url.endsWith('123457'),true);idx.replace({listings:[]});assert.equal(idx.search(body).length,0);}finally{Date.now=realNow;}
});
