import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {once}from'node:events';
import{installValuationRoutes}from'../lib/valuation-routes.js';import{installApiGuard}from'../lib/api-guard.js';

async function withServer({searchMarket},run){
 const app=express();installApiGuard(app);app.use(express.json({limit:'32kb'}));
 installValuationRoutes(app,{inventoryIndex:{fresh:()=>[],generatedAt:new Date().toISOString()},searchMarket});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(r=>server.close(r));}
}

test('valuation API validates, stays separate from search and reports sparse real evidence',async()=>{
 await withServer({searchMarket:async()=>({listings:[]})},async base=>{
  const post=body=>fetch(base+'/api/car-valuation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const bad=await post({make:'Toyota'});assert.equal(bad.status,400);assert((await bad.json()).fields.includes('mileageKm'));
  const good=await post({make:'Toyota',model:'Camry',year:2020,mileageKm:100000,city:'Riyadh'});assert.equal(good.status,200);assert(good.headers.get('server-timing').startsWith('valuation;dur='));
  const d=await good.json();assert.equal(d.available,false);assert.equal(d.estimatedMarketValue,null);assert.equal(d.marketSearch.attempted,true);assert(!JSON.stringify(d).includes('OPENAI_API_KEY'));
 });
});

test('valuation falls back to live Haraj and OpenSooq comparables before giving up',async()=>{
 let calls=0;
 const searchMarket=async body=>{
  calls++;
  const seller=body.filters.seller;
  return {listings:Array.from({length:3},(_,i)=>({source:seller,seller,sourceType:'marketplace',title:`Toyota Camry 2020 ${seller} ${i}`,snippet:'100000 km',url:`https://example.com/${seller.toLowerCase()}-${i}`,year:2020,price:70000+i*1500+(seller==='OpenSooq'?500:0),mileage:90000+i*5000,city:'Riyadh',condition:'used',priceVerified:true,saleVerified:true}))};
 };
 await withServer({searchMarket},async base=>{
  const response=await fetch(base+'/api/car-valuation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({make:'Toyota',model:'Camry',year:2020,mileageKm:100000,city:'Riyadh'})});
  assert.equal(response.status,200);const d=await response.json();assert.equal(d.available,true);assert.equal(d.comparableCount,6);assert.equal(d.marketSearch.mode,'cache+live');assert.equal(d.marketSearch.stages.length,1);assert.equal(calls,2);assert.equal(Object.keys(d.sourcesUsed).length,2);
 });
});
