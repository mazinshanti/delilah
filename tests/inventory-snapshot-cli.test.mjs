import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';

const car=(source,id)=>({
 source,sourceCategory:'cars for sale',title:'Toyota Corolla 2021 for sale',
 make:'Toyota',model:'Corolla',year:2021,price:80000,priceVerified:true,
 condition:'used',url:'https://example.com/cars/'+id
});
test('snapshot CLI retains prior source rows and writes a new readable compressed snapshot',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'dalelah-index-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const previous=join(dir,'old.json.gz'),input=join(dir,'feed.json'),out=join(dir,'new.json.gz');
 await writeFile(previous,gzipSync(JSON.stringify({generatedAt:'2026-10-30T00:00:00Z',listings:[car('Syarah','old')]})));
 await writeFile(input,JSON.stringify({source:'Haraj',scannedAt:'2026-11-02T12:00:00Z',listings:[car('Haraj','new')]}));
 const run=spawnSync(process.execPath,['scripts/merge-inventory-snapshot.mjs','--input',input,'--output',out,'--snapshot',previous],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const merged=JSON.parse(gunzipSync(await readFile(out)).toString('utf8'));
 assert.equal(merged.listings.length,2);
 assert.deepEqual(new Set(merged.listings.map(x=>x.source)),new Set(['Syarah','Haraj']));
 assert.equal(JSON.parse(run.stdout).added,1);
 const blocked=spawnSync(process.execPath,['scripts/merge-inventory-snapshot.mjs','--input',input,'--output',previous,'--snapshot',previous],{encoding:'utf8'});
 assert.notEqual(blocked.status,0);
});
