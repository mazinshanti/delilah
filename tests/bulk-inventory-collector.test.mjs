import test from 'node:test';import assert from 'node:assert/strict';import {collectBulkInventory} from '../lib/bulk-inventory-collector.js';
const source={id:'syarah',name:'Syarah',url:'https://syarah.com',path:'/en/autos'},wait=async()=>{},parse=h=>JSON.parse(h);
function fake(calls,fail=0){return async url=>{if(url.endsWith('robots.txt'))return 'User-agent: *\nAllow: /';const p=Number(new URL(url).searchParams.get('page')||1);calls.push(p);if(p===fail)throw Error('HTTP 403');return JSON.stringify([{url:'https://syarah.com/en/cardetail/car-'+p}]);};}
test('a capped historical refresh continues beyond page 200 while checking new arrivals first',async()=>{
 const calls=[];const r=await collectBulkInventory({source,get:fake(calls),parse,wait,maxPages:3,previous:{pages:200,successfulPages:200,records:2400,errors:[]}});
 assert.deepEqual(calls,[1,201,202]);assert.equal(r.state.nextPage,203);
 calls.length=0;await collectBulkInventory({source,get:fake(calls),parse,wait,maxPages:2,state:r.state});assert.deepEqual(calls,[1,203]);
});
test('source failures retain the continuation cursor and never bypass access controls',async()=>{
 const calls=[];const r=await collectBulkInventory({source,get:fake(calls,25),parse,wait,maxPages:5,state:{nextPage:25}});assert.deepEqual(calls,[1,25]);assert.equal(r.state.nextPage,25);assert.match(r.diagnostics.errors[0].error,/403/);
});
test('a source ignoring pagination stops at repeated inventory instead of creating fake growth',async()=>{
 let calls=0;const r=await collectBulkInventory({source,parse,wait,maxPages:500,get:async url=>url.endsWith('robots.txt')?'User-agent: *\nAllow: /':(calls++,JSON.stringify([{url:'https://syarah.com/en/cardetail/car-1'}]))});assert.equal(calls,2);assert.equal(r.state.nextPage,1);assert.equal(r.diagnostics.records,1);
});
