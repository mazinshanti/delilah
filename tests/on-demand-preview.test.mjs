import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewApp} from '../lib/on-demand/preview-app.js';
import {createOnDemandService} from '../lib/on-demand/service.js';
import {createIntentEngine,rulesIntent} from '../lib/ai-search-intent.js';
import {createSourceLearning} from '../lib/on-demand/source-learning.mjs';
const car={source:'CarSwitch Saudi',url:'https://ksa.carswitch.com/jeddah/used-car/toyota/corolla/2022/873160',title:'Toyota Corolla 2022',schemaType:'Car',make:'Toyota',model:'Corolla',year:2022,condition:'used',price:44000,priceVerified:true,city:'Jeddah',mileage:180000,listingVerified:true,detailChecked:true};
const intentEngine={understand:async q=>rulesIntent(q)},adapters={discover:async(i,o)=>o.onBatch([car]),verify:async()=>[car]};
test('completed timing freezes; UI mileage/body/source filters remain strict',async()=>{
 let now=100;const s=createOnDemandService({intentEngine,adapters,clock:()=>now});
 for(const filters of [{maxMileage:100000},{category:'SUV'},{seller:'Syarah'},{trim:'unknown'}]){const j=s.start({query:'Toyota Corolla',filters});assert.equal(j.statusCode,202);await s.settled(j.searchId);assert.equal(s.get(j.searchId).listings.length,0);}
 const j=s.start({query:'Toyota Corolla',filters:{category:'Sedan',maxMileage:200000,seller:'CarSwitch Saudi'}});await s.settled(j.searchId);const result=s.get(j.searchId);assert.equal(result.listings.length,1);now+=10000;assert.equal(s.get(j.searchId).elapsedMs,result.elapsedMs);
});
test('missing AI never silently drops preferences even when a make was recognized',async()=>{
 const s=createOnDemandService({intentEngine:createIntentEngine({env:{},log:()=>{}}),adapters:{discover:()=>assert.fail('must not retrieve'),verify:()=>[]}});
 const j=s.start({query:'Toyota family SUV cheap maintenance under 150000'});await s.settled(j.searchId);assert.equal(s.get(j.searchId).interpretationUnavailable,true);
});
test('source feedback requires repeated evidence and preserves every source',()=>{
 const x=createSourceLearning(),i={make:'Toyota',condition:'used'},all=['A','B','C'];
 x.observe(i,{matches:[{source:'C'}]});assert.deepEqual(x.order(i,['A','B'],all),all);
 for(let n=0;n<2;n++)x.observe(i,{matches:[{source:'C'}]});assert.deepEqual(x.order(i,['A','B'],all),['C','A','B']);assert.deepEqual(x.order({make:'Audi'},['A','B'],all),all);
});
test('private browser session serves existing UI and progressive API without exposing token',async()=>{
 const token='t'.repeat(32),service=createOnDemandService({intentEngine,adapters});
 const {app}=createPreviewApp({env:{DALELAH_ON_DEMAND_ENABLED:'true',DALELAH_ON_DEMAND_PROVIDER:'direct',DALELAH_ON_DEMAND_TOKEN:token},service});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
 assert.equal((await fetch(base+'/',{redirect:'manual'})).status,302);
 assert.equal((await fetch(base+'/api/search/progress/fake')).status,401);
 const login=await fetch(base+'/preview/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'token='+token,redirect:'manual'});assert.equal(login.status,303);const set=login.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);const cookie=set.split(';')[0];
 const html=await(await fetch(base+'/',{headers:{cookie}})).text();assert.match(html,/__DALELAH_ON_DEMAND_PREVIEW__/);assert.ok(!html.includes(token));assert.match(html,/market-ui.js/);
 const r=await fetch(base+'/api/search',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({query:'Toyota Corolla',filters:{category:'Sedan',maxMileage:200000,minPrice:'',maxPrice:'',minYear:'',maxYear:'',city:'',fuelType:'',seller:'',trim:''}})});assert.equal(r.status,202);const j=await r.json();await service.settled(j.searchId);
 const result=await(await fetch(base+'/api/search/progress/'+j.searchId,{headers:{cookie}})).json();assert.equal(result.listings.length,1);assert.equal(result.complete,true);
 }finally{service.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('Arabic letter-number model names resolve across brands without altering normal words',async()=>{
 const {catalogIntent,catalogText}=await import('../public/catalog.js');
 for(const [query,model]of [['اودي كيو ٨','Q8'],['بي ام دبليو اكس ٥','X5']])assert.equal(catalogIntent(query).model,model);
 assert.equal(catalogText('سيارة كيو جميلة'),'سياره كيو جميله');
});
