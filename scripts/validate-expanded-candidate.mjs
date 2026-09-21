import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {InventoryIndex} from '../lib/inventory-index.js';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
const dir='experiments/inventory-expansion-20260921';
const snapshot=JSON.parse(gunzipSync(await readFile(dir+'/candidate-inventory.json.gz')));
const index=new InventoryIndex();index.replace(snapshot);
const fresh=index.fresh();assert.ok(fresh.length>0);
for(const r of fresh){const source=SOURCE_REGISTRY.find(s=>s.name===r.source);assert.ok(source);assert.equal(new URL(r.url).hostname,new URL(source.url).hostname);assert.match(new URL(r.url).pathname,source.detailPattern);assert.ok(['new','used'].includes(r.condition));assert.ok(r.make&&r.model&&r.year);if(r.detailChecked){assert.ok(Date.parse(r.lastDetailAt));assert.equal(r.mediaValidation,'source-url-only');assert.equal(r.imageVerified,false);}}
const rows=index.search({condition:'all',filters:{maxPrice:50000}});assert.ok(rows.length);assert.ok(rows.every(r=>r.priceVerified&&r.price>0&&r.price<=50000));
const en=index.search({query:'Toyota Corolla',condition:'used'}),ar=index.search({query:'تويوتا كورولا',condition:'used'});
assert.deepEqual(new Set(en.map(r=>r.url)),new Set(ar.map(r=>r.url)));assert.ok(en.length>0);
const used=index.search({condition:'used'}),newCars=index.search({condition:'new'});assert.ok(used.every(r=>r.condition==='used'));assert.ok(newCars.every(r=>r.condition==='new'));
const report={checkedAt:new Date().toISOString(),fresh:index.fresh().length,displayableUsed:used.length,displayableNew:newCars.length,priceFiltered:rows.length,arabicEnglishCorollaMatches:en.length,detailChecked:fresh.filter(r=>r.detailChecked).length,sourceCardEvidence:fresh.filter(r=>!r.detailChecked).length,physicalVehicleUniquenessGuaranteed:false};
await writeFile(dir+'/validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
