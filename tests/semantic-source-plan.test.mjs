import test from 'node:test';
import assert from 'node:assert/strict';
import {planSemanticSourceQueries} from '../lib/semantic-source-plan.js';

const listing=(make,model,bodyType,price=100000,extra={})=>({
 make,brand:make,model,bodyType,condition:'used',price,priceVerified:true,...extra
});

test('semantic planner prioritizes actual matching SUV models, not default 18-model list',()=>{
 const records=[
  ...Array.from({length:8},()=>listing('Toyota','RAV4','SUV',85000)),
  ...Array.from({length:7},()=>listing('Nissan','X-Trail','SUV',95000)),
  ...Array.from({length:6},()=>listing('Honda','CR-V','SUV',99000)),
  listing('Toyota','Camry','sedan',75000),
  listing('BMW','X5','SUV',110000),
  listing('MG','ZS','SUV',65000),
  listing('Toyota','RAV4','SUV',175000)
 ];
 const queries=planSemanticSourceQueries(records,{
  condition:'used',bodyType:'SUV',originPreference:'Japanese',maxPrice:150000
 },{maxQueries:12});
 assert.deepEqual(queries.sort(),['Honda CR-V','Nissan X-Trail','Toyota RAV4'].sort());
 assert.ok(queries.every(q=>!q.includes('Camry')&&!q.includes('BMW')&&!q.includes('MG')));
});

test('semantic planner diversifies brands and respects exclusion, model and condition',()=>{
 const records=[
  ...Array.from({length:20},()=>listing('Toyota','Camry','sedan')),
  ...Array.from({length:5},()=>listing('Toyota','Corolla','sedan')),
  ...Array.from({length:3},()=>listing('Nissan','Sunny','sedan')),
  listing('MG','5','sedan')
 ];
 const queries=planSemanticSourceQueries(records,{condition:'used',bodyType:'sedan',excludedMakes:['MG']},{maxQueries:2});
 assert.deepEqual(queries,['Toyota Camry','Nissan Sunny']);
 assert.deepEqual(planSemanticSourceQueries(records,{condition:'used',make:'Toyota',model:'Corolla'},{maxQueries:12}),['Toyota Corolla']);
 assert.deepEqual(planSemanticSourceQueries(records,{condition:'new',make:'Toyota'},{maxQueries:12}),[]);
});

test('planner refuses to seed exact budget or vehicle claims from unverified records',()=>{
 const records=[
  listing('Toyota','RAV4','SUV',90000,{priceVerified:false}),
  listing('Toyota','RAV4','SUV',190000),
  listing('Toyota','RAV4','SUV',90000,{condition:'new'}),
  listing('Toyota','RAV4','SUV',80000,{condition:'used'})
 ];
 assert.deepEqual(planSemanticSourceQueries(records,{bodyType:'SUV',condition:'used',maxPrice:100000}),['Toyota RAV4']);
 assert.deepEqual(planSemanticSourceQueries(records.slice(0,3),{bodyType:'SUV',condition:'used',maxPrice:100000}),[]);
});
