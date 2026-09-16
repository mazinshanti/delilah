import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_REGISTRY,publicSourceRegistry} from '../lib/source-registry.js';
test('registry distinguishes unknown sync reliability from observed failures',()=>{
 const rows=publicSourceRegistry({'Syarah':{count:12,complete:9,lastSeenAt:'2026-09-16T12:00:00Z'}},[{source:'Syarah',pages:4,successfulPages:3,errors:[{page:4,error:'HTTP 503'}],completedAt:'2026-09-16T12:01:00Z'}]);
 const s=rows.find(s=>s.id==='syarah');assert.equal(s.inventoryCount,12);assert.equal(s.reliabilityScore,75);assert.equal(s.health,'degraded');assert.equal(s.lastSync,'2026-09-16T12:01:00Z');assert.equal(s.errors.length,1);
 const d=rows.find(s=>s.id==='dubizzle');assert.equal(d.inventoryCount,0);assert.equal(d.reliabilityScore,null);assert.equal(d.status,'authorization-required');assert.equal(d.adapter,undefined);
 assert.equal(new Set(SOURCE_REGISTRY.map(s=>s.id)).size,SOURCE_REGISTRY.length);
});
test('registry does not count live searches or source advertised totals as indexed cars',()=>{
 const rows=publicSourceRegistry({},[{source:'CarSwitch Saudi',pages:1,records:0,errors:[{error:'HTTP 403'}]}],'2026-09-16T12:00:00Z');
 assert.equal(rows.find(s=>s.id==='carswitch').reliabilityScore,0);
 assert.equal(rows.find(s=>s.id==='haraj').inventoryCount,0);
 assert.ok(rows.every(s=>s.type&&s.connectionMethod&&'lastSync' in s&&Array.isArray(s.errors)));
});
