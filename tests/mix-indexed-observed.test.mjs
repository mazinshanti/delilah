import test from 'node:test';
import assert from 'node:assert/strict';
import {mixIndexedAndObserved} from '../lib/mix-indexed-observed.js';
import {observeSourceSearchListings} from '../lib/live-source-observation.js';

const car=(id,extras={})=>({
 source:'Haraj',url:'https://haraj.com.sa/'+id,
 title:'Toyota Fortuner 2022 for sale',make:'Toyota',model:'Fortuner',
 year:2022,condition:'used',price:125000,priceVerified:true,
 lastSeenAt:'2026-09-23T12:00:00Z',...extras
});
test('when live cache is empty existing verified inventory results remain zero-copy',()=>{
 const historical=Array.from({length:850},(_,i)=>car(String(11180000000+i)));
 const result=mixIndexedAndObserved(historical,[]);
 assert.equal(result,historical);
 assert.equal(result[0],historical[0]);
 assert.equal(result.length,850);
});
test('matching recent results merge and newer price observation takes precedence',()=>{
 const historical=[car('11188361010',{price:145000})];
 const live=observeSourceSearchListings([car('11188361010',{price:122000,priceSource:'live'})],
  'Haraj',new Date().toISOString());
 const result=mixIndexedAndObserved(historical,live);
 assert.notEqual(result,historical);
 assert.equal(result.length,1);
 assert.equal(result[0].price,122000);
 assert.equal(result[0].priceSource,'live');
 assert.equal(result[0].sourceObservedAt,live[0].sourceObservedAt);
});
