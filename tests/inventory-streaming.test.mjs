import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {InventoryIndex,scanCompressedInventory} from '../lib/inventory-index.js';

const car=(id,extras={})=>({
 source:'Haraj',sourceCategory:'cars for sale',url:'https://example.com/car/'+id,
 make:'Toyota',model:'Corolla',title:'Toyota Corolla 2022 for sale',
 year:2022,condition:'used',price:85000,priceVerified:true,
 description:'Original \"quoted\" listing with braces { } and [nested] metadata',
 ...extras
});
async function snapshot(t,data){
 const dir=await mkdtemp(join(tmpdir(),'dalelah-stream-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const p=join(dir,'market.json.gz');
 await writeFile(p,gzipSync(JSON.stringify(data)));
 return p;
}
test('streaming parser reads objects with escapes, Unicode and nested arrays',async t=>{
 const rows=[car('one',{title:'تويوتا كورولا ٢٠٢٢',images:['https://img.example/a.jpg']}),
  car('two',{snippet:'escaped character \\ and quote " in text'})];
 const file=await snapshot(t,{generatedAt:'2026-11-02T12:00:00Z',listings:rows,diagnostics:[]});
 const found=[];
 const result=await scanCompressedInventory(file,x=>found.push(x));
 assert.equal(result.count,2);
 assert.equal(result.generatedAt,'2026-11-02T12:00:00Z');
 assert.deepEqual(found,rows);
});

test('streaming index preserves valid cars, duplicate URLs and exact model results',async t=>{
 const file=await snapshot(t,{generatedAt:'2026-11-02T12:00:00Z',listings:[
 car('one'),car('one',{price:85000}),car('two'),
 car('three',{model:'Camry',title:'Toyota Camry 2022 for sale'}),
 car('non-car',{title:'Toyota Corolla spare parts',sourceCategory:'spare parts'})
 ]});
 const index=new InventoryIndex();
 assert.equal(await index.load(file),true);
 assert.equal(index.generatedAt,'2026-11-02T12:00:00Z');
 assert.equal(index.records.length,3);
 const rows=index.search({query:'Toyota Corolla',condition:'used',filters:{}});
 assert.deepEqual(new Set(rows.map(x=>x.url)),new Set([
 'https://example.com/car/one','https://example.com/car/two'
 ]));
});

test('invalid or incomplete compressed snapshots are never reported loaded',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'dalelah-corrupt-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'incomplete.gz');
 await writeFile(file,gzipSync('{"listings":[{"source":"Haraj"}'));
 const index=new InventoryIndex();
 assert.equal(await index.load(file),false);
});
