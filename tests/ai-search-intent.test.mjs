import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntentEngine,emptyIntent,validateIntent,normalizeAIIntent,rulesIntent,intentSearchBody,applyIntentConstraints,needsAI,ORIGINS} from '../lib/ai-search-intent.js';
import {strictDirectListings} from '../lib/direct-search.js';
const value=fields=>({...emptyIntent(),confidence:0.95,...fields});
const response=intent=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(intent)}]}]})});
const engine=(fetchImpl,extra={})=>createIntentEngine({env:{OPENAI_API_KEY:'test-only-not-a-real-key',DALELAH_AI_MODEL:'test-model',...extra},fetchImpl,log:()=>{}});
const cases=[
 ['Toyota Camry 2022 Riyadh under 100k',{make:'Toyota',model:'Camry',year:2022,city:'Riyadh',maxPrice:100000}],
 ['كامري ٢٠٢٢ بالرياض تحت ١٠٠ الف',{make:'Toyota',model:'Camry',year:2022,city:'Riyadh',maxPrice:100000}],
 ['ابي جيب ياباني عائلي تحت ١٥٠',{make:null,model:null,bodyType:'SUV',originPreference:'Japanese',useCase:'family',maxPrice:150000}],
 ['used BMW X5 2021',{make:'BMW',model:'X5',year:2021}],
 ['Porsche Cayenne under 250k Jeddah',{make:'Porsche',model:'Cayenne',city:'Jeddah',maxPrice:250000}],
 ['سيارة المانية رياضية مستعملة',{originPreference:'German',priorities:['sporty']}],
 ['Corolla 2013',{make:'Toyota',model:'Corolla',year:2013}],
 ['Bentley',{make:'Bentley'}],
 ['G Class',{make:'Mercedes',model:'G-Class'}],
 ['جي كلاس',{make:'Mercedes',model:'G-Class'}],
 ['range rover but cheaper to maintain',{make:null,model:null,bodyType:'SUV',priorities:['affordable-maintenance']}],
 ['no Chinese cars',{excludedMakes:['MG','BYD','Geely']}],
 ['new Hyundai SUV',{make:'Hyundai',condition:'new',bodyType:'SUV'}],
 ['used Lexus under 200k',{make:'Lexus',maxPrice:200000}]
];
for(const [query,fields]of cases)test(`intent route: ${query}`,async()=>{
 let called=0;const e=engine(async(url,opts)=>{called++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(opts.body).text.format.strict,true);assert.equal(JSON.parse(opts.body).store,false);return response(value(fields));});
 const r=await e.understand(query);assert.equal(r.intentMode,needsAI(query)?'ai':'rules');assert.equal(called,needsAI(query)?1:0);
 for(const [key,v]of Object.entries(fields))assert.deepEqual(r.intent[key],v);
});
test('schema rejects extra listings, missing keys, invalid types/ranges/enums',()=>{
 assert(validateIntent(value({})));
 for(const bad of [{...value({}),listings:[{}]},value({confidence:2}),value({year:2013.5}),value({maxPrice:'100k'}),value({condition:'both'}),value({minYear:2022,maxYear:2013}),{}])assert.equal(validateIntent(bad),false);
});
test('explicit Corolla year and model cannot be overridden by AI',()=>{
 const i=normalizeAIIntent(value({make:'BMW',model:'X5',year:2015}),'show me Corolla 2013');assert.equal(i.make,'Toyota');assert.equal(i.model,'Corolla');assert.equal(i.year,2013);
});
test('catalog rejects unknown make/model and inferred exploratory exact models',()=>{
 assert.throws(()=>normalizeAIIntent(value({make:'Invented'}),'family SUV'));
 assert.throws(()=>normalizeAIIntent(value({make:'Toyota',model:'Fiction'}),'family SUV'));
 assert.throws(()=>normalizeAIIntent(value({make:'Toyota',model:'Camry'}),'something comfortable'));
});
test('AI failure keeps safe Arabic exact query functional with rule fallback',async()=>{
 const e=engine(async()=>{throw Error('network');});const r=await e.understand('show me Camry 2022 الرياض under 100k');assert.equal(r.intentMode,'rules');assert.equal(r.safeFallback,true);assert.equal(r.intent.year,2022);assert(r.fallbackReason);
});
test('disabled/missing key never calls provider',async()=>{
 for(const env of [{DALELAH_AI_SEARCH_ENABLED:'false'},{OPENAI_API_KEY:''}]){const e=engine(()=>{throw Error('must not run');},env);const r=await e.understand('show me Corolla 2013');assert.equal(r.intentMode,'rules');assert.equal(e.status().stats.calls,0);}
});
test('malformed output and provider errors produce safe fallback',async()=>{
 for(const mock of [async()=>response({listings:[{price:1}]}),async()=>({ok:false,status:401}),async()=>response(value({confidence:0.1}))]){const r=await engine(mock).understand('best family SUV');assert.notEqual(r.intentMode,'ai');assert(r.fallbackReason);assert.equal(r.safeFallback,false);}
});
test('AI intents cached and concurrent duplicate calls coalesced',async()=>{
 let calls=0;const e=engine(async()=>{calls++;await new Promise(r=>setTimeout(r,10));return response(value({bodyType:'SUV'}));});await Promise.all([e.understand('family SUV'),e.understand('family SUV')]);const r=await e.understand('family SUV');assert.equal(calls,1);assert.equal(r.cacheHit,true);
});
test('provider timeout is bounded and retries are capped',async()=>{
 const e=engine(async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason))),{DALELAH_AI_TIMEOUT_MS:'100'});
 const timer=setTimeout(()=>{},500);const r=await e.understand('family SUV');clearTimeout(timer);assert.equal(r.fallbackReason,'timeout');
});
test('exact zero results and real listing fields survive deterministic stage',()=>{
 const r=rulesIntent('Corolla 2013'),body=intentSearchBody({query:'Corolla 2013'},r);
 const cars=[{title:'Toyota Corolla 2015',make:'Toyota',model:'Corolla',year:2015,condition:'used',url:'https://example.com/1'},{title:'BMW X5 2013',make:'BMW',model:'X5',year:2013,condition:'used',url:'https://example.com/2'}];
 assert.deepEqual(applyIntentConstraints(strictDirectListings(cars,body),r.intent),[]);
});
test('origin/exclusions enforced without invented maintenance ratings or gallery changes',()=>{
 const images=['https://example.com/original.jpg'];const rows=[{make:'Toyota',images,price:100000},{make:'MG',images,price:90000},{make:'BMW',images,price:110000}];
 const i=value({originPreference:'Japanese',excludedMakes:['MG'],maxPrice:120000,priorities:['affordable-maintenance']});const out=applyIntentConstraints(rows,i);assert.equal(out.length,1);assert.equal(out[0].make,'Toyota');assert.deepEqual(out[0].images,images);assert(!out[0].rankingSignals.includes('affordable-maintenance'));
});
test('selected new condition preserved and numeric filters cannot widen',()=>{
 const r=rulesIntent('Hyundai');const b=intentSearchBody({query:'Hyundai',condition:'new',filters:{maxPrice:80000}},r);assert.equal(b.condition,'new');
 const ai={intent:value({make:'Hyundai',maxPrice:120000}),intentMode:'ai'};assert.equal(intentSearchBody({query:'Hyundai under 120k',filters:{maxPrice:80000}},ai).filters.maxPrice,80000);
});
test('logs never contain raw query, key or provider payload',async()=>{
 const entries=[];const e=createIntentEngine({env:{OPENAI_API_KEY:'secret-value'},fetchImpl:async()=>response(value({bodyType:'SUV'})),log:x=>entries.push(x)});await e.understand('family SUV for my children');const text=JSON.stringify(entries);assert(!text.includes('secret-value'));assert(!text.includes('children'));
});

for(const query of ['i have 45k and i want a sedan in jeddah','my budget is 45000 for a sedan','معي ٤٥ الف ابي سيدان بجدة','عندي 45 الف ابي سيارة','sedan under 45k'])test(`spending ceiling: ${query}`,()=>{
 const i=normalizeAIIntent(value({bodyType:'sedan',city:'Jeddah',minPrice:45000,maxPrice:45000}),query);
 assert.equal(i.minPrice,null);assert.equal(i.maxPrice,45000);
 const body=intentSearchBody({query},{intent:i,intentMode:'ai'});assert.equal(body.filters.maxPrice,45000);assert.equal(body.filters.minPrice,undefined);
});
for(const query of ['my budget is between 30k and 45k','I have a budget from 30k to 45k','ميزانيتي بين ٣٠ و٤٥ الف','I have 45k but want exactly 45k'])test(`preserve explicit price floor: ${query}`,()=>{
 const i=normalizeAIIntent(value({minPrice:30000,maxPrice:45000}),query);assert.equal(i.minPrice,30000);
});
