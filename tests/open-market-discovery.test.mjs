import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverMarketWithAI,marketToolUrls,externalMarketCandidate,runAdaptiveMarketDiscovery} from '../lib/ai-market-discovery-trial.js';
const url='https://dealer-sa.com/stock/toyota-corolla';
test('open market omits domain filters while keeping grounded extraction',async()=>{
 let payload;
 const result=await discoverMarketWithAI('كورولا',[],{scope:'open-market',env:{OPENAI_API_KEY:'test'},fetchImpl:async(u,o)=>{payload=JSON.parse(o.body);return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url}]}}]});}});
 assert.equal('filters' in payload.tools[0],false);
 assert.equal(result.externalCandidates[0].url,url);
 assert.equal(result.externalCandidates[0].vehicleVerified,false);
 assert.deepEqual(result.urls,[]);
});
test('only grounded public external leads survive, without duplication',()=>{
 const bad=['https://localhost/a','https://127.0.0.1/a','https://[::1]/a','https://a.internal/a','http://dealer-sa.com/a','https://user@dealer-sa.com/a','https://dealer-sa.com:8080/a'];
 for(const u of bad)assert.equal(externalMarketCandidate(u),null);
 const r=marketToolUrls({output:[{type:'web_search_call',status:'completed',action:{sources:[url,url,...bad].map(url=>({url}))}},{type:'message',content:[{text:'https://invented-dealer.com/car'}]}]});
 assert.equal(r.externalCandidates.length,1);
 assert.equal(marketToolUrls({output:[{type:'message',content:[{annotations:[{type:'url_citation',url}]}]}]}).externalCandidates.length,0);
});
test('external discovery continues rounds without fetching or admitting new sources',async()=>{
 const feedback=[];
 const r=await runAdaptiveMarketDiscovery({query:'كورولا',filters:{}},{excludedMakes:[]},{maxRounds:3,discover:async(q,f)=>{feedback.push(f);return {status:'completed',webSearchCalls:1,urls:[],externalCandidates:[{url:url+feedback.length}]};},readDetail:async()=>{throw Error('external lead must not be fetched');}});
 assert.equal(r.externalDiscovered,3);assert.equal(r.accepted,0);assert.equal(r.checked,0);assert.equal(r.rounds,3);
 assert.deepEqual(feedback[1][0].externalHosts,['dealer-sa.com']);assert.equal(r.coverageComplete,false);
});
