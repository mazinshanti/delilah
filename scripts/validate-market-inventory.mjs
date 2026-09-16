import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFile,mkdir} from 'node:fs/promises';
import {InventoryIndex,paginateInventory} from '../lib/inventory-index.js';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
import {detectRequestedBrand,canonicalizeVehicleQuery} from '../lib/search-relevance.js';
import {detectRequestedModel,listingMatchesModel} from '../lib/search-model-relevance.js';
const index=new InventoryIndex({maxAgeMs:7*24*3600000});assert.ok(await index.load(),'Inventory snapshot must load');
assert.ok(index.records.length>0,'No fabricated filler for an empty snapshot');
let recordAssertions=0;
for(const c of index.records){
 const source=SOURCE_REGISTRY.find(s=>s.name===c.source);assert.ok(source?.detailPattern,'Unknown source');
 assert.equal(new URL(c.url).hostname,new URL(source.url).hostname);assert.match(new URL(c.url).pathname,source.detailPattern);
 assert.ok(c.brand&&c.model&&c.year>=1980&&c.year<=new Date().getFullYear()+1);assert.ok(['new','used'].includes(c.condition));
 assert.ok(c.price===null||Number.isFinite(c.price)&&c.price>0);assert.ok(c.mileage===null||Number.isFinite(c.mileage)&&c.mileage>=0);
 assert.ok(c.image===null||/^https?:\/\//.test(c.image)&&!c.image.endsWith('/undefined'));
 assert.equal(c.saleVerified,false,'Public source evidence must not claim independent inspection');
 assert.deepEqual(c.missingFields,['trim','price','mileage','city','image'].filter(k=>c[k]==null||c[k]===''));
 assert.equal(c.dataComplete,c.missingFields.length===0);recordAssertions+=11;
}
const queries=[...new Set(index.records.map(c=>`${c.brand} ${c.model} ${c.year}`))];const times=[],matrix=[];
for(const q of queries){
 const sample=index.records.find(c=>`${c.brand} ${c.model} ${c.year}`===q),brand=detectRequestedBrand(q),model=detectRequestedModel(q);
 const start=performance.now(),rows=index.search({query:q,condition:sample.condition});times.push(performance.now()-start);
 assert.ok(rows.length>0,`Collected vehicle cannot be found: ${q}`);
 for(const c of rows){assert.equal(Number(c.year),sample.year,`Year mismatch: ${q}`);if(brand)assert.equal(detectRequestedBrand(c.brand),brand,`Brand mismatch: ${q}`);if(model)assert.ok(listingMatchesModel(c,model),`Model mismatch: ${q}`);}
 matrix.push({query:q,condition:sample.condition,count:rows.length});
}
for(const q of ['bently','Bentley','بنتلي','Toyota Corolla 2013']){
 const normalized=canonicalizeVehicleQuery(q).query,rows=index.search({query:normalized});
 if(/Bentley/i.test(normalized))assert.ok(rows.every(c=>detectRequestedBrand(c.brand)==='Bentley'));
 matrix.push({query:q,count:rows.length});
}
const range=index.search({query:'',condition:'used',filters:{minYear:2018,maxYear:2021,maxPrice:100000,maxMileage:100000}});
assert.ok(range.every(c=>c.year>=2018&&c.year<=2021&&c.price>0&&c.price<=100000&&c.mileage!=null&&c.mileage<=100000));
const broad=index.search({condition:'used'}),page1=paginateInventory(broad),page2=paginateInventory(broad,{page:2});
assert.equal(new Set([...page1.listings,...page2.listings].map(c=>c.url)).size,page1.listings.length+page2.listings.length);
times.sort((a,b)=>a-b);const report={checkedAt:new Date().toISOString(),recordCount:index.records.length,recordAssertions,queriesTested:matrix.length,queryLatencyMs:{p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)},coverage:index.stats(),matrix};
await mkdir('audit',{recursive:true});await writeFile('audit/inventory-validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,matrix:undefined}));
