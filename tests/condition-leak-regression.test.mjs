import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCondition} from '../lib/vehicle-condition.js';
import {normalizeInventoryListing} from '../lib/inventory-normalizer.js';
import {strictDirectListings} from '../lib/direct-search.js';
const base={source:'Haraj',sourceCategory:'cars for sale',title:'Toyota Camry 2023',year:2023,url:'https://haraj.com.sa/11111111/',saleVerified:true};
for(const source of ['Haraj','Syarah','CarSwitch Saudi','Saudi Sale'])test(`${source}: used evidence wins over new wording`,()=>{
 assert.equal(resolveCondition({...base,source,condition:'used',description:'السيارة جديدة'}),'used');
 assert.equal(resolveCondition({...base,source,condition:'new',vehicle:{condition:'used'},description:'brand new'}),'used');
});
for(const description of ['بطارية غير مستخدمة','كفرات غير مستخدمة','بطارية زيرو'])test(`component condition is not vehicle condition: ${description}`,()=>{
 assert.equal(resolveCondition({...base,description}),'unknown');
 assert.equal(strictDirectListings([{...base,description}],{query:'Toyota Camry',condition:'new'}).length,0);
});
test('stale zero mileage aliases cannot turn a used vehicle into a new one',()=>{
 for(const extra of [{mileage:85000,mileage_km:0},{mileage:0,mileageKm:85000},{mileage:0,vehicle:{mileageKm:85000}}]){
  const input={...base,condition:'new',sourceCondition:'new',...extra};
  assert.equal(resolveCondition(input),'used');
  assert.equal(normalizeInventoryListing(input).condition,'used');
  assert.equal(strictDirectListings([input],{query:'Toyota Camry',condition:'new'}).length,0);
 }
});
test('explicit new vehicle evidence remains accepted',()=>{
 for(const description of ['حالة السيارة: جديدة','السيارة غير مستخدمة','سيارة جديدة زيرو'])assert.equal(resolveCondition({...base,description,mileage:0}),'new');
 assert.equal(resolveCondition({...base,sourceCondition:'new',mileage:0}),'new');
});
