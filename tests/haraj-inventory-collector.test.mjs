import test from 'node:test';
import assert from 'node:assert/strict';
import {collectHarajInventory,harajDetailRecord,harajDiscoveryQueries,fetchHarajInventoryHtml,mergeHarajSnapshot} from '../lib/haraj-inventory-collector.js';
import {parseHarajFastPage} from '../lib/haraj-fast-source.js';
const url='https://haraj.com.sa/11188891344/toyota';
const candidate={url,title:'تويوتا كامري 2020',city:'Riyadh',condition:'used',price:20000};
const html=(description='سيارة مستعملة للبيع الممشى 50000 كم',overrides={})=>`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'تويوتا كامري 2020',description,...overrides})}</script>`;
const card=(id='11188891344',title=candidate.title)=>`<a href="/${id}/toyota">${title}</a><div>الرياض</div>`;
test('refresh merges Haraj by ad id across changed title slugs and preserves other sources',()=>{
 const old={source:'Haraj',url,price:10000},fresh={...old,url:'https://haraj.com.sa/11188891344/updated-title',price:null};
 const other={source:'Syarah',url:'https://syarah.com/en/cardetail/example'};
 assert.deepEqual(mergeHarajSnapshot([old,other],[fresh]),[other,fresh]);
});
test('transport follows only same-ad redirects with robots checks and a hop bound',async()=>{
 let calls=0;
 const data=await fetchHarajInventoryHtml(url,{sleep:async()=>{},fetchImpl:async()=>++calls===1?new Response(null,{status:302,headers:{location:'/11188891344/'}}):new Response('detail')});
 assert.equal(data,'detail');assert.equal(calls,2);
 for(const location of ['https://example.com/11188891344/','/99999999999/','/login']){
  let n=0;await assert.rejects(fetchHarajInventoryHtml(url,{sleep:async()=>{},fetchImpl:async()=>{n++;return new Response(null,{status:302,headers:{location}});}}),/unsafe-source-redirect/);assert.equal(n,1);
 }
 await assert.rejects(fetchHarajInventoryHtml(url,{rules:'User-agent: *\nDisallow: /11188891344/',sleep:async()=>{},fetchImpl:async()=>new Response(null,{status:302,headers:{location:'/11188891344/'}})}),/robots-disallowed/);
});
test('transport rejects non-Haraj and unrelated paths before making any request',async()=>{
 for(const target of ['https://example.com/11188891344/','https://haraj.com.sa/login','https://user@haraj.com.sa/11188891344/'])await assert.rejects(fetchHarajInventoryHtml(target,{fetchImpl:async()=>{throw Error('unexpected fetch');}}),/unsupported-source-url/);
});
test('catalog-driven discovery includes all manufacturers and round-robin models without aliases duplicating brands',()=>{
 const qs=harajDiscoveryQueries();assert.ok(qs.length>100);assert.equal(qs.length,new Set(qs).size);
 assert.ok(qs.includes('تويوتا كامري'));assert.ok(qs.some(q=>/لامبور|Lamborghini/.test(q)));
});
test('detail evidence rescues a sparse card without copying its assumed used condition or price',()=>{
 const record=harajDetailRecord(candidate,html());assert.ok(record);assert.equal(record.condition,'used');assert.equal(record.mileage,50000);assert.equal(record.price,null);assert.equal(record.saleVerified,false);
 assert.equal(harajDetailRecord(candidate,html('')),null);
 const fresh=harajDetailRecord(candidate,html('سيارة جديدة للبيع'));assert.equal(fresh.condition,'new');
});
test('foreign recommendation metadata cannot supply the ad evidence',()=>{
 assert.equal(harajDetailRecord(candidate,html(undefined,{url:'https://haraj.com.sa/99999999999/other'})),null);
});
test('sold ads cannot enter the expanded snapshot',()=>{
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع تم البيع')),null);
});
test('Arabic year digits remain searchable as the numeric model year',()=>{
 assert.equal(harajDetailRecord(candidate,html(undefined,{name:'تويوتا كامري ٢٠٢٠'})).year,2020);
});
test('explicit model-year detail labels work without guessing from arbitrary description years',()=>{
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع\nالموديل: ٢٠٢٠',{name:'تويوتا كامري'})).year,2020);
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع صيانة 2020',{name:'تويوتا كامري'})),null);
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع\nالموديل: 2021')),null);
});
test('parts, wanted and unrelated detail descriptions remain quarantined',()=>{
 for(const description of ['مكينة للبيع تويوتا كامري 2020','مطلوب تويوتا كامري 2020','حساب ببجي لامبورغيني','لعبة سيارة تويوتا','جنوط للبيع','طيور للبيع'])assert.equal(harajDetailRecord(candidate,html(description)),null,description);
});
test('scheduled collector deduplicates ids, enriches before admission, and paces every request',async()=>{
 const calls=[],delays=[];
 const result=await collectHarajInventory({queries:['Toyota','تويوتا'],maxQueries:2,maxDetails:5,sleep:async ms=>delays.push(ms),get:async u=>{calls.push(u);return u.endsWith('/robots.txt')?'User-agent: *\nAllow: /':u.includes('/search/')?card()+card():html();}});
 assert.equal(result.listings.length,1);assert.equal(result.diagnostics.detailAttempts,1);assert.equal(result.diagnostics.duplicateCards,1);
 assert.equal(calls.length,4);assert.equal(delays.length,3);assert.ok(delays.every(x=>x>=1100));
});
test('collector stops on access restrictions and never retries or bypasses',async()=>{
 let calls=0;
 const result=await collectHarajInventory({queries:['Toyota','BMW'],sleep:async()=>{},get:async u=>{calls++;if(u.endsWith('/robots.txt'))return 'User-agent: *\nAllow: /';throw Error('HTTP 403');}});
 assert.equal(calls,2);assert.equal(result.listings.length,0);assert.match(result.diagnostics.errors[0].error,/403/);
});
test('detail workers are bounded and preserve original source links',async()=>{
 let active=0,maximum=0;const requests=[];
 const r=await collectHarajInventory({queries:['Toyota'],maxDetails:8,concurrency:99,sleep:async()=>{},get:async u=>{
  requests.push(u);if(u.endsWith('/robots.txt'))return 'User-agent: *\nAllow: /';
  if(u.includes('/search/'))return Array.from({length:8},(_,i)=>card(String(11188891000+i))).join('');
  active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,5));active--;return html(undefined,{url:u});
 }});
 assert.equal(r.listings.length,8);assert.equal(maximum,3);
 assert.ok(requests.filter(x=>!/robots|search/.test(x)).every(x=>/^https:\/\/haraj\.com\.sa\/\d+\/$/.test(x)));
 assert.ok(r.listings.every(x=>x.url.endsWith('/toyota')));
});
test('robots-disallowed discovery never fetches the restricted page',async()=>{
 let calls=0;const r=await collectHarajInventory({queries:['Toyota'],sleep:async()=>{},get:async()=>{calls++;return 'User-agent: *\nDisallow: /search/';}});
 assert.equal(calls,1);assert.equal(r.listings.length,0);
});
test('detail budget and cursor bound work; existing fast lane retains its 24-card cap',async()=>{
 const cards=Array.from({length:30},(_,i)=>card(String(11188891000+i))).join('');
 assert.equal(parseHarajFastPage(cards,url).length,24);assert.equal(parseHarajFastPage(cards,url,{limit:120}).length,30);
 const r=await collectHarajInventory({queries:['Toyota','BMW'],maxDetails:1,sleep:async()=>{},get:async u=>u.endsWith('/robots.txt')?'User-agent: *\nAllow: /':u.includes('/search/')?cards:html('',{url:u})});
 assert.equal(r.diagnostics.detailAttempts,1);assert.equal(r.diagnostics.nextCursor,1);assert.equal(r.diagnostics.coverageComplete,false);
});
