import test from 'node:test';
import assert from 'node:assert/strict';
import {createListingTrial} from '../lib/ai-listing-trial.js';
import {harajDetailRecord} from '../lib/haraj-inventory-collector.js';
const url='https://haraj.com.sa/11188891344/toyota';
const title='تويوتا كامري 2020',description='سيارة مستعملة للبيع الممشى 50000 كم';
const car=harajDetailRecord({url,title},`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:title,description})}</script>`);
const review=()=>({vehicleForSale:true,make:{value:null,quote:null},model:{value:null,quote:null},year:{value:2020,quote:'2020'},condition:{value:'used',quote:'مستعملة'},price:{value:null,quote:null},mileage:{value:50000,quote:'الممشى 50000 كم'}});
const provider=value=>async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
const engine=value=>createListingTrial({env:{OPENAI_API_KEY:'test-only'},fetchImpl:provider(value)});
test('canonical Arabic aliases agree but wrong models and keyword additions do not',async()=>{
 const r=review();r.make={value:'تويوتا',quote:'تويوتا'};r.model={value:'كامري',quote:'كامري'};
 assert.equal((await engine(r).inspect(car)).status,'accepted');
 for(const value of ['Corolla','Camry toy']){r.model.value=value;assert.equal((await engine(r).inspect(car)).status,'evidence-disagreement');}
});
test('provider status is diagnosed without disclosing error bodies or credentials',async()=>{
 const e=createListingTrial({env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>new Response('private error detail',{status:429})});
 assert.equal((await e.inspect(car)).reason,'provider-http-429');
 const r=review();r.year.quote='invented';assert.equal((await engine(r).inspect(car)).reason,'unsupported-evidence');
});
test('AI trial preserves source fields and existing Arabic/English filter behavior',async()=>{
 const e=engine(review());
 for(const query of ['Toyota Camry 2020','تويوتا كامري 2020']){const r=await e.inspect(car,{query});assert.equal(r.status,'accepted');assert.equal(r.listing.url,url);assert.equal(r.listing.price,null);assert.deepEqual(r.listing.images,car.images);}
 assert.equal(e.status().calls,1);
});
test('AI cannot override brand, new/used, year, budget, or mileage filters',async()=>{
 const e=engine(review());
 for(const body of [{query:'BMW X5'},{query:'Toyota Camry 2023'},{condition:'new'},{filters:{maxPrice:100000}},{filters:{maxMileage:10000}}])assert.equal((await e.inspect(car,body)).status,'rejected-by-existing-filters');
 assert.equal(e.status().calls,0);
});
test('fabricated quotes and numeric disagreement cannot introduce invented prices',async()=>{
 let r=review();r.price={value:50000,quote:'السعر 50000'};assert.equal((await engine(r).inspect(car)).status,'ai-unavailable-or-invalid');
 r=review();r.price={value:50000,quote:'الممشى 50000 كم'};assert.equal((await engine(r).inspect(car)).status,'evidence-disagreement');
});
test('junk remains rejected even when AI would call it a vehicle',async()=>{
 const e=engine(review());
 for(const title of ['مكينة تويوتا كامري للبيع','مطلوب تويوتا كامري','حساب ببجي لامبورغيني','جنوط تويوتا للبيع','طيور للبيع','لعبة سيارة تويوتا'])assert.equal((await e.inspect({...car,title,description:title})).status,'rejected-by-existing-filters');
 assert.equal(e.status().calls,0);
});
test('unconfigured or unavailable provider is explicit, not a fake AI success',async()=>{
 assert.equal((await createListingTrial({env:{}}).inspect(car)).status,'not-configured');
 const e=createListingTrial({env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>{throw Error('timeout');}});
 assert.equal((await e.inspect(car)).listing,null);
});
test('AI rejection and unsupported extra fields fail closed',async()=>{
 assert.equal((await engine({...review(),vehicleForSale:false}).inspect(car)).status,'ai-rejected');
 assert.equal((await engine({...review(),url:'https://untrusted.example'}).inspect(car)).status,'ai-unavailable-or-invalid');
});
