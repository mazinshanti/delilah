import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';

test('production HTTP route invokes AI, preserves constraints through polling and keeps provider private',{timeout:20000},async()=>{
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
 // Fixtures and mock provider exist ONLY inside this test process, never in the deployed app.
 const code=`
 import {InventoryIndex} from './lib/inventory-index.js';
 import {emptyIntent} from './lib/ai-search-intent.js';
 const car={make:'Toyota',brand:'Toyota',model:'Camry',title:'Toyota Camry 2022',year:2022,yearVerified:true,condition:'used',price:90000,priceVerified:true,city:'Riyadh',source:'Fixture',url:'https://example.com/test-only-car',images:['https://example.com/photo1.jpg','https://example.com/photo2.jpg'],saleVerified:true,lastSeenAt:new Date().toISOString()};
 InventoryIndex.prototype.load=async function(){this.replace({generatedAt:new Date().toISOString(),listings:[car,{...car,year:2015,title:'Toyota Camry 2015',url:'https://example.com/wrong-year'},{...car,model:'Corolla',title:'Toyota Corolla 2022',url:'https://example.com/wrong-model'}]});};
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://api.openai.com/v1/responses'){
   const query=JSON.parse(JSON.parse(options.body).input).query;
   if(query.includes('failure'))return new Response('{}',{status:503});
   return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...emptyIntent(),make:'Toyota',model:'Camry',year:2022,maxPrice:100000,city:'Riyadh',confidence:0.95})}]}]}),{status:200});
  }
  return new Response('{}',{status:404});
 };
 await import('./server-core-candidate.js');`;
 const child=spawn(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'test',OPENAI_API_KEY:'mock-secret-not-real',DALELAH_AI_SEARCH_ENABLED:'true',DALELAH_DIRECT_BUDGET_MS:'50',DALELAH_FULL_HEAD_START_MS:'20'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const base=`http://127.0.0.1:${port}`;
 try{
  let ready=false;for(let k=0;k<80;k++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert(ready,logs);
  const search=async query=>{const r=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query})});assert.equal(r.status,200);return r.json();};
  const ai=await search('show me Toyota Camry 2022 in Riyadh under 100k');assert.equal(ai.intentMode,'ai');assert.equal(ai.listings.length,1);assert.equal(ai.listings[0].model,'Camry');assert.equal(ai.listings[0].year,2022);assert.equal(ai.listings[0].images.length,2);assert(!JSON.stringify(ai).includes('mock-secret'));
  if(ai.searchId){const polled=await (await fetch(base+'/api/search/progress/'+ai.searchId)).json();assert.equal(polled.intentMode,'ai');assert(polled.listings.every(c=>c.model==='Camry'&&c.year===2022));}
  const exact=await search('Pontiac G8 2009');assert.equal(exact.intentMode,'rules');assert.equal(exact.listings.length,0);
  const fallback=await search('family SUV failure');assert.notEqual(fallback.intentMode,'ai');assert.equal(fallback.interpretationUnavailable,true);assert.equal(fallback.listings.length,0);
  const warm=await (await fetch(base+'/api/inventory?q=family%20SUV')).json();assert.equal(warm.intentPending,true);assert.equal(warm.listings.length,0);
  assert.equal((await fetch(base+'/lib/ai-search-intent.js')).status,404);
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
