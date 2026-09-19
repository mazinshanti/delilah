import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverHarajWithAI,discoveredHarajUrls} from '../lib/ai-web-discovery-trial.js';
const response=urls=>({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:urls.map(url=>({url}))}}]});
test('only tool-returned direct source URLs enter discovery, with stable ID deduplication',()=>{
 const data=response(['https://haraj.com.sa/123456789/car','https://haraj.com.sa/123456789/other','https://haraj.com.sa/search/car/','https://evil.example/123456789/','https://haraj.com.sa.evil.example/123456789/','https://user@haraj.com.sa/123456789/']);
 data.output.push({type:'message',content:[{text:'https://haraj.com.sa/999999999/'}]});
 assert.deepEqual(discoveredHarajUrls(data),{webSearchCalls:1,urls:['https://haraj.com.sa/123456789/']});
});
test('model text alone never counts as executed web search',()=>{assert.equal(discoveredHarajUrls({output:[{type:'message',content:[]}]}).webSearchCalls,0);});
test('trial requires real web-search tool use with allowed domain and bounded calls',async()=>{
 let payload;const result=await discoverHarajWithAI('Toyota Camry',{env:{OPENAI_API_KEY:'test'},fetchImpl:async(_,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify(response(['https://haraj.com.sa/123456789/'])));}});
 assert.equal(result.webSearchCalls,1);assert.equal(payload.tool_choice,'required');assert.equal(payload.max_tool_calls,2);assert.deepEqual(payload.tools[0].filters.allowed_domains,['haraj.com.sa']);assert.deepEqual(payload.include,['web_search_call.action.sources']);
});
test('provider errors and missing configuration cannot look like successful search',async()=>{
 assert.equal((await discoverHarajWithAI('Camry',{env:{}})).status,'not-configured');
 assert.equal((await discoverHarajWithAI('Camry',{env:{OPENAI_API_KEY:'test'},fetchImpl:async()=>new Response('secret',{status:401})})).status,'provider-http-401');
});
