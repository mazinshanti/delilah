import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {prepareAuthorizedDealerFeed} from '../lib/authorized-feed.js';

const manifest={
 source:'Partner Motors',
 authorizedDomains:['inventory.partner.example'],
 authorization:{indexingApproved:true,displayApproved:true,grantedBy:'Partner Motors',
   agreementReference:'PARTNER-APPROVED-FEED-REF',validUntil:'2027-12-31'}
};
const car=(id,extra={})=>({
 title:'Toyota Corolla 2022 for sale',make:'Toyota',model:'Corolla',year:2022,
 condition:'used',currency:'SAR',price:65000,
 url:'https://inventory.partner.example/listings/'+id,
 city:'Riyadh',mileage:80000, ...extra
});
test('accepts individual valid dealer listings and preserves original attribution',()=>{
 const x=prepareAuthorizedDealerFeed({listings:[car('a'),car('b')]},manifest);
 assert.equal(x.records.length,2);
 assert(x.records.every(c=>c.source==='Partner Motors'&&c.sourceType==='dealer-feed'));
 assert(x.records.every(c=>c.priceVerified===true&&c.priceSource==='authorized-dealer-feed'));
 assert.equal(x.report.accepted,2);
 assert.equal(x.report.rightsVerification,'operator-attested-not-independently-verified');
});

test('cannot fabricate marketplace-wide access through a dealer manifest',()=>{
 assert.throws(()=>prepareAuthorizedDealerFeed([car('a')],{...manifest,authorizedDomains:['haraj.com.sa']}),/platform/);
 assert.throws(()=>prepareAuthorizedDealerFeed([car('a')],{...manifest,source:'Haraj dealer'}),/platform-name/);
 assert.throws(()=>prepareAuthorizedDealerFeed([car('a')],{...manifest,authorization:{...manifest.authorization,displayApproved:false}}),/permission/);
 assert.throws(()=>prepareAuthorizedDealerFeed([car('a')],{...manifest,authorization:{...manifest.authorization,validUntil:'2025-01-01'}}),/expired/);
});

test('rejects off-domain URLs, parts, wanted, fake prices and duplicate links',()=>{
 const x=prepareAuthorizedDealerFeed({listings:[
 car('a?utm_source=foo'),car('a?utm_source=bar'),
 car('other',{url:'https://haraj.com.sa/123456789'}),
 car('parts',{title:'Corolla spare parts 2022'}),
 car('wanted',{title:'Wanted Toyota Corolla 2022'}),
 car('free',{price:null}),
 car('invalid-year',{year:2060})
 ]},manifest);
 assert.equal(x.report.accepted,1);
 assert.equal(x.report.duplicateUrls,1);
 assert.equal(x.report.rejected['unapproved-listing-domain'],1);
 assert.equal(x.report.rejected['missing-or-invalid-vehicle-facts'],2);
 assert.equal(x.report.rejected['not-verified-car-sale'],2);
});

test('offline CLI appends an approved partner feed, retains other sources and refuses overwrite',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'dealer-feed-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const base=join(dir,'base.json.gz'),feedPath=join(dir,'feed.json'),permit=join(dir,'permit.json'),out=join(dir,'next.json.gz');
 const old={source:'Syarah',url:'https://syarah.com/en/cardetail/old-car-123',make:'Toyota',model:'Camry',
 title:'Toyota Camry 2022 for sale',year:2022,price:90000,condition:'used'};
 await writeFile(base,gzipSync(JSON.stringify({generatedAt:'2026-09-23T00:00:00Z',listings:[old],
   diagnostics:[{source:'Syarah',completedAt:'2026-09-23'}]})));
 await writeFile(feedPath,JSON.stringify({listings:[car('one'),car('two')]}));
 await writeFile(permit,JSON.stringify(manifest));
 const run=spawnSync(process.execPath,['scripts/import-authorized-dealer-feed.mjs',
  '--feed',feedPath,'--manifest',permit,'--snapshot',base,'--output',out],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(run.stdout.match(/AUTHORIZED_FEED_IMPORT (.*)/)?.[1]||'{}');
 assert.equal(report.added,2);
 const next=JSON.parse(gunzipSync(await readFile(out)).toString('utf8'));
 assert.equal(next.listings.length,3);
 assert.equal(next.listings[0].source,'Syarah');
 assert.equal(next.diagnostics[0].source,'Syarah');
 assert.equal(next.diagnostics.at(-1).source,'Partner Motors');
 const again=spawnSync(process.execPath,['scripts/import-authorized-dealer-feed.mjs',
  '--feed',feedPath,'--manifest',permit,'--snapshot',base,'--output',out],{encoding:'utf8'});
 assert.notEqual(again.status,0);
});
