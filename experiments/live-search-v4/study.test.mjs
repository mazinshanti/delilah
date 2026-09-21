import test from 'node:test';import assert from 'node:assert/strict';
import {benchmark} from './benchmark.mjs';import {validateIntent} from '../../lib/ai-search-intent.js';
import {provider,leads} from './providers.mjs';import {prioritySources} from './study.mjs';import {createSources} from './sources.mjs';
const url='https://ksa.motory.com/en/cars-for-sale/riyadh-haraj/toyota/corolla/2023/123456/';
test('100 valid benchmark queries are balanced and paired',()=>{assert.equal(benchmark.length,100);assert.equal(benchmark.filter(q=>q.language==='ar').length,50);for(const q of benchmark)assert.ok(validateIntent(q.intent));assert.equal(new Set(benchmark.map(q=>q.query)).size,100);});
test('provider facts never become listing evidence; IDs deduplicate',()=>{const rows=leads([{url,title:'car',price:1,condition:'new'},{url:url+'?x=1'},{url:'https://evil.test/car'}]);assert.equal(rows.length,1);assert.equal(rows[0].price,null);assert.equal(rows[0].condition,null);assert.equal(rows[0].detailChecked,undefined);});
test('missing keys disable providers',()=>{assert.equal(provider('brave',{env:{}}),null);assert.equal(provider('tavily',{env:{}}),null);});
test('Brave and Tavily extract only original URLs and record usage',async()=>{for(const name of ['brave','tavily']){const metrics=[];const fn=provider(name,{env:{BRAVE_API_KEY:'test',TAVILY_API_KEY:'test'},metrics,fetchImpl:async(u,o)=>{assert.ok(o.signal);if(name==='tavily'){const b=JSON.parse(o.body);assert.equal(b.include_raw_content,false);assert.equal(b.search_depth,'fast');}return {ok:true,status:200,json:async()=>({web:{results:[{url}]},results:[{url}],usage:{credits:1}})};}});assert.equal((await fn(benchmark[0].intent)).length,1);assert.equal(metrics[0].status,200);}});
test('source selection prevents requests to omitted hosts',async()=>{const requested=[];const adapters=createSources({get:async url=>{requested.push(url);throw Error('test-stop');}},{selectedSources:['CarSwitch Saudi']});await adapters.discover(benchmark[0].intent,{onBatch:()=>{},diagnostics:[]});assert.ok(requested.length);assert.ok(requested.every(u=>new URL(u).hostname==='ksa.carswitch.com'));});
test('new cars prioritize new-capable sources',()=>{assert.deepEqual(prioritySources({condition:'new'}),['Motory','Syarah','Saleh Cars']);});
test('aborting the scheduled search cancels delayed source discovery',async()=>{
 const {scheduledSources}=await import('./study.mjs');const controller=new AbortController(),hosts=[];
 const sources=scheduledSources({get:async url=>{hosts.push(new URL(url).hostname);throw Error('test-stop');}});
 const timer=setTimeout(()=>controller.abort(),10);
 await sources.discover(benchmark[0].intent,{signal:controller.signal,onBatch:()=>{},diagnostics:[]});clearTimeout(timer);
 assert.ok(hosts.length);assert.ok(hosts.every(h=>['ksa.carswitch.com','syarah.com','ksa.motory.com'].includes(h)));
});
