import test from 'node:test';
import assert from 'node:assert/strict';
import {SAUDI_SOURCES,sourceCoverageReport} from '../lib/saudi-source-registry.js';

test('source inventory never implies permission',()=>{
 assert.ok(SAUDI_SOURCES.length>=10);
 assert.ok(SAUDI_SOURCES.every(s=>s.permission==='unverified'));
});

test('unqueried sources are not reported as successfully searched',()=>{
 const rows=sourceCoverageReport([{name:'Haraj',count:12,pagesAttempted:1,pagesSucceeded:1}],SAUDI_SOURCES);
 assert.equal(rows.find(s=>s.id==='haraj').state,'reported-success');
 assert.equal(rows.find(s=>s.id==='syarah').state,'not-checked');
 assert.equal(rows.find(s=>s.id==='syarah').listingsReported,0);
});

test('source failures and partially completed pages are visible',()=>{
 const rows=sourceCoverageReport([{name:'OpenSooq Saudi',count:4,pagesAttempted:3,pagesSucceeded:1,error:'timeout'}]);
 const row=rows.find(s=>s.id==='opensooq');
 assert.equal(row.state,'partial-or-failed');
 assert.equal(row.pagesSucceeded,1);
 assert.equal(row.error,'timeout');
});
