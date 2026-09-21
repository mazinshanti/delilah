import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
test('front API serves indexed pages while deep search is unavailable',async()=>{
 const upstream=http.createServer((req,res)=>{res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"source unavailable"}');});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const port=19000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import',new URL('./support/inventory-snapshot-clock.mjs',import.meta.url).href,'server-core-candidate.js'],{env:{...process.env,PORT:String(port),DALELAH_LEGACY_BASE_URL:`http://127.0.0.1:${upstream.address().port}`},stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',c=>logs+=c);child.stdout.on('data',c=>logs+=c);
 try{
  let ready=false;for(let i=0;i<300;i++){try{if((await fetch(base+'/healthz')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,logs);
  const stats=await (await fetch(base+'/api/inventory/stats')).json();assert.ok(stats.totalUnique>0);
  const a=await (await fetch(base+'/api/inventory?page=1')).json(),b=await (await fetch(base+'/api/inventory?page=2')).json();assert.equal(a.listings.length,24);assert.equal(new Set([...a.listings,...b.listings].map(c=>c.url)).size,48);
  const exact=await (await fetch(base+'/api/inventory?q=Toyota%20Corolla%202013')).json();assert.ok(exact.listings.every(c=>c.year===2013));
  const electric=await (await fetch(base+'/api/inventory?fuelType=Electric')).json();assert.ok(electric.listings.length>0);assert.ok(electric.listings.every(c=>c.fuelType==='Electric'));
  for(const path of ['/api/inventory?maxPrice=bad','/api/inventory?condition=broken'])assert.equal((await fetch(base+path)).status,400);
  assert.equal((await fetch(base+'/api/not-a-public-route')).status,404);
  const bad=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},body:'{broken'});assert.equal(bad.status,400);
  const big=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'x'.repeat(40000)})});assert.equal(big.status,413);
  const started=performance.now(),r=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Toyota',condition:'used'})}),d=await r.json();
  assert.equal(r.status,200);assert.ok(d.listings.length>100);assert.ok(performance.now()-started<2000,'Indexed browse must not wait for failed backend');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  if(d.searchId){let done;for(let i=0;i<30;i++){done=await (await fetch(base+'/api/search/progress/'+d.searchId)).json();if(done.partial)break;await new Promise(r=>setTimeout(r,100));}assert.equal(done.partial,true);assert.ok(done.listings.length>100);}
  const fresh=await (await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'__all_cars__',condition:'new'})})).json();
  assert.ok(fresh.listings.length>0);assert.ok(fresh.listings.every(c=>c.condition==='new'));
  const finished=fresh.searchId?await (await fetch(base+'/api/search/progress/'+fresh.searchId)).json():fresh;
  assert.equal(finished.complete,true);assert.equal(finished.partial,false,'Indexed browse must not require the failed legacy service');
 }finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(()=>{child.kill('SIGKILL');r()},2000).unref();});await new Promise(r=>upstream.close(r));}
});
