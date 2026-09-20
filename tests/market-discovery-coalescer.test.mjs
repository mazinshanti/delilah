import test from 'node:test';import assert from 'node:assert/strict';
import {createCoalescedDiscovery} from '../lib/market-discovery-coalescer.js';
test('identical discovery shares provider work and accounts actual calls once',async()=>{
 let calls=0,now=0;const d=createCoalescedDiscovery(async()=>{calls++;return {status:'completed',webSearchCalls:1,leads:[{url:'https://haraj.com.sa/12345678901/'}]};},{clock:()=>now,ttlMs:100});
 const task={query:'Toyota Corolla',host:'haraj.com.sa'};
 const r=await Promise.all([d(task),d(task)]);assert.equal(calls,1);assert.equal(r.reduce((n,x)=>n+x.webSearchCalls,0),1);r[0].leads.length=0;
 const cached=await d(task);assert.equal(cached.leads.length,1);assert.equal(cached.webSearchCalls,0);now=100;await d(task);assert.equal(calls,2);
 await d({...task,query:'Toyota Corolla under 50000'});await d({...task,host:'syarah.com'});assert.equal(calls,4);
});
test('failed and throwing providers can be retried',async()=>{
 let calls=0;const d=createCoalescedDiscovery(async()=>{calls++;if(calls===1)throw Error('offline');return {status:calls===2?'timeout':'completed',webSearchCalls:0};});
 await assert.rejects(d({query:'x'}),/offline/);assert.equal((await d({query:'x'})).status,'timeout');assert.equal((await d({query:'x'})).status,'completed');assert.equal(calls,3);
});
