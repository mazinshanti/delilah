import test from 'node:test';
import assert from 'node:assert/strict';
import {marketDiscoveryPlan,runDiscoveryPlan} from '../lib/market-discovery-plan.js';
test('Corolla discovery uses canonical bilingual aliases without inventing a year restriction',()=>{
 const plan=marketDiscoveryPlan('كورولا');
 assert.ok(plan.includes('Toyota Corolla'));assert.ok(plan.some(q=>q.includes('كورولا')&&q.includes('الرياض')));
 assert.equal(new Set(plan).size,plan.length);assert.ok(plan.every(q=>!/(19|20)\d{2}/.test(q)));
});
test('bounded batches resume at the next query and deduplicate URLs',async()=>{
 const discover=async()=>({status:'completed',webSearchCalls:1,urls:['https://haraj.com.sa/123456789/']});
 const first=await runDiscoveryPlan('كورولا',{discover,maxQueries:2});
 assert.equal(first.nextCursor,2);assert.equal(first.urls.length,1);assert.equal(first.webSearchCalls,2);assert.equal(first.coverageComplete,false);
 const second=await runDiscoveryPlan('كورولا',{discover,maxQueries:1,cursor:first.nextCursor});
 assert.equal(second.attempts[0].query,marketDiscoveryPlan('كورولا')[2]);
});
test('provider failure stops calls and keeps successful results and retry cursor',async()=>{
 let calls=0;const result=await runDiscoveryPlan('Corolla',{discover:async()=>++calls===1?{status:'completed',webSearchCalls:1,urls:['one']}:{status:'provider-http-429',urls:[]}});
 assert.equal(calls,2);assert.deepEqual(result.urls,['one']);assert.equal(result.nextCursor,1);assert.equal(result.status,'partial-or-failed');
});
test('finishing a query plan never claims complete market coverage',async()=>{
 const plan=marketDiscoveryPlan('Corolla');const result=await runDiscoveryPlan('Corolla',{cursor:plan.length-1,discover:async()=>({status:'completed',webSearchCalls:1,urls:[]})});
 assert.equal(result.nextCursor,null);assert.equal(result.planComplete,true);assert.equal(result.coverageComplete,false);
});
