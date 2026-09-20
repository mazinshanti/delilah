import test from 'node:test';import assert from 'node:assert/strict';
import {createMarketDetailReader,marketCandidate,marketDiscoveryPage} from '../lib/ai-market-discovery-trial.js';
const c=marketCandidate('https://haraj.com.sa/12345678901/');
test('identical parallel source reads share one request and expire without sliding TTL',async()=>{
 let now=0,reads=0;const reader=createMarketDetailReader({clock:()=>now,sleep:async()=>{},detailTtlMs:100,fetchImpl:async url=>new Response(url.endsWith('robots.txt')?'User-agent: *':String(++reads))});
 assert.deepEqual(await Promise.all([reader(c),reader(c),reader(c)]),['1','1','1']);assert.equal(reads,1);
 now=99;assert.equal(await reader(c),'1');now=100;assert.equal(await reader(c),'2');assert.equal(reads,2);
});
test('failed source requests are never cached',async()=>{
 let calls=0;const reader=createMarketDetailReader({sleep:async()=>{},fetchImpl:async url=>url.endsWith('robots.txt')?new Response('User-agent: *'):++calls===1?new Response('error',{status:500}):new Response('valid')});
 await assert.rejects(reader(c),/HTTP 500/);assert.equal(await reader(c),'valid');assert.equal(calls,2);
});
test('discovery pages have shorter TTL and byte budget evicts old responses',async()=>{
 let now=0,calls=0;const reader=createMarketDetailReader({clock:()=>now,sleep:async()=>{},pageTtlMs:10,detailTtlMs:100,maxCacheBytes:4,fetchImpl:async url=>{if(url.endsWith('robots.txt'))return new Response('User-agent: *');calls++;return new Response('data');}});
 const page=marketDiscoveryPage('https://haraj.com.sa/search/Toyota/');await reader(page);now=10;await reader(page);assert.equal(calls,2);await reader(c);await reader(page);assert.equal(calls,4);
});
test('shared-reader lifetime refreshes robots and pauses rather than permanently disabling a source',async()=>{
 let now=0,robots=0,details=0;const reader=createMarketDetailReader({clock:()=>now,sleep:async()=>{},fetchImpl:async url=>{if(url.endsWith('robots.txt')){robots++;return new Response('User-agent: *');}return ++details===1?new Response('limited',{status:429}):new Response('data');}});
 await assert.rejects(reader(c),/HTTP 429/);await assert.rejects(reader(c),/source-paused/);assert.equal(details,1);
 now=600000;assert.equal(await reader(c),'data');assert.equal(robots,2);assert.equal(details,2);
});
