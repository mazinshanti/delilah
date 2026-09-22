import test from 'node:test';
import assert from 'node:assert/strict';
import {collectHarajInventory,harajDetailRecord,harajDiscoveryQueries,fetchHarajInventoryHtml,mergeHarajSnapshot} from '../lib/haraj-inventory-collector.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {parseHarajFastPage} from '../lib/haraj-fast-source.js';
const url='https://haraj.com.sa/11188891344/toyota';
const candidate={url,title:'تويوتا كامري 2020',city:'Riyadh',condition:'used',price:20000};
const html=(description='سيارة مستعملة للبيع الممشى 50000 كم',overrides={})=>`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:'تويوتا كامري 2020',description,...overrides})}</script>`;
const card=(id='11188891344',title=candidate.title)=>`<a href="/${id}/toyota">${title}</a><div>الرياض</div>`;
const structured=(changes={})=>{
 const table=[],encode=value=>{const i=table.length;table.push(null);if(Array.isArray(value)){table[i]=value.map(encode);}else if(value&&typeof value==='object'){const object={};for(const [k,v]of Object.entries(value))object['_'+encode(k)]=encode(v);table[i]=object;}else table[i]=value;return i;};
 encode({URL:'11188891344/toyota',title:'Toyota Corolla',carInfo:{model:2013,condition:'USED',carOrRelated:'CAR',sellOrWaiver:'SELL'},...changes});
 return `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(table))});</script>`;
};
test('exact structured Haraj car fields recover a sparse title without guessing year or condition',()=>{
 const r=harajDetailRecord(candidate,html(' ',{name:'Toyota Corolla'})+structured());
 assert.equal(r.year,2013);assert.equal(r.condition,'used');assert.equal(r.model,'Corolla');assert.equal(r.price,null);assert.equal(r.mileage,null);
 assert.equal(r.yearVerified,true);
 assert.equal(strictDirectListings([r],{query:'Toyota Corolla 2013',condition:'used'}).length,1);
 assert.equal(strictDirectListings([r],{query:'Toyota Corolla 2014',condition:'used'}).length,0);
});
test('foreign ad, different title, non-car and non-sale structured fields cannot rescue sparse metadata',()=>{
 for(const patch of [{URL:'99999999999/other'},{URL:'https://evil.test/11188891344/'},{title:'Toyota Camry'},{carInfo:{model:2013,condition:'USED',carOrRelated:'PART',sellOrWaiver:'SELL'}},{carInfo:{model:2013,condition:'USED',carOrRelated:'CAR',sellOrWaiver:'WANTED'}}])assert.equal(harajDetailRecord(candidate,html(' ',{name:'Toyota Corolla'})+structured(patch)),null);
 assert.equal(harajDetailRecord(candidate,html(' ',{name:'Toyota Corolla'})+structured()+structured()),null);
});
test('structured car metadata cannot override conflicting year or condition or the non-vehicle boundary',()=>{
 assert.equal(harajDetailRecord(candidate,html(' ',{name:'Toyota Corolla 2020'})+structured({title:'Toyota Corolla 2020'})),null);
 assert.equal(harajDetailRecord(candidate,html(' ',{name:'Toyota Corolla',itemCondition:'https://schema.org/NewCondition'})+structured()),null);
 for(const title of ['Toyota Corolla spare parts','مطلوب تويوتا كورولا','حساب ببجي تويوتا كورولا','لعبة تويوتا كورولا'])assert.equal(harajDetailRecord(candidate,html(' ',{name:title})+structured({title})),null,title);
});
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
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع &ndash; موديل 2020',{name:'تويوتا كامري'})).year,2020);
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع — model year: 2020',{name:'Toyota Camry'})).year,2020);
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع &ndash; صيانة 2020',{name:'تويوتا كامري'})),null);
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع &ndash; موديل 2021')),null);
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
test('multi-trim dealer advertisements do not assign one asking price to all trims',()=>{
 for(const name of ['نيسان باترول بفئات متعددة موديل 2026','تويوتا كورولا 2026 جميع الفئات','تويوتا كورولا 2026 جميع الفائات']){
  const r=harajDetailRecord(candidate,html('سيارة جديدة للبيع السعر 249550 ريال',{name}));assert.ok(r);assert.equal(r.price,null);assert.equal(r.priceVerified,false);
 }
 assert.equal(harajDetailRecord(candidate,html('سيارة مستعملة للبيع السعر 60000 ريال')).price,60000);
});
test('exact structured price requires agreeing numeric fields and excludes financing and multi-trim offers',()=>{
 const run=(price,description=' ',name='Toyota Corolla')=>harajDetailRecord(candidate,html(description,{name})+structured({title:name,price}));
 assert.equal(run({inputPrice:'59000',formattedPrice:'59,000'}).price,59000);
 for(const price of [{inputPrice:'59000',formattedPrice:'69,000'},{inputPrice:'900',formattedPrice:'900'},{inputPrice:'59000 monthly',formattedPrice:'59,000'}])assert.equal(run(price).price,null);
 assert.equal(run({inputPrice:'59000',formattedPrice:'59,000'},'تمويل أقساط شهرية').price,null);
 assert.equal(run({inputPrice:'59000',formattedPrice:'59,000'},'السعر 65000 ريال').price,null);
 assert.equal(run({inputPrice:'59000',formattedPrice:'59,000'},' ','Toyota Corolla جميع الفئات').price,null);
});

test('exact-ad gallery preserves observed originals and excludes foreign or thumbnail routes',()=>{
 const original='https://img4cdn.haraj.com.sa/userfiles30/2026-05-19/900x900-car.jpg';
 const r=harajDetailRecord(candidate,html(' ',{name:'Toyota Corolla'})+structured({imagesList:[original,'https://evil.test/car.jpg','https://haraj.com.sa/thumb/car.jpg']}));
 assert.equal(r.image,original);assert.ok(r.images.includes(original));assert.ok(!r.images.some(u=>u.includes('evil.test')||u.includes('/thumb/')));
});
test('unfinished Haraj detail work resumes before new discovery; fresh accepted ads are not refetched',async()=>{
 const cards=card('11188891001')+card('11188891002')+card('11188891003'),calls=[];
 const get=async u=>{calls.push(u);return u.endsWith('/robots.txt')?'User-agent: *\nAllow: /':u.includes('/search/')?cards:html(undefined,{url:u});};
 const first=await collectHarajInventory({queries:['Toyota'],maxDetails:1,get,sleep:async()=>{}});assert.equal(first.diagnostics.pendingCandidates.length,2);
 calls.length=0;const second=await collectHarajInventory({queries:['Toyota'],maxDetails:1,get,sleep:async()=>{},previousListings:first.listings,pendingCandidates:first.diagnostics.pendingCandidates});
 assert.equal(second.listings.length,1);assert.equal(second.diagnostics.pages,0);assert.equal(second.diagnostics.pendingCandidates.length,1);assert.ok(!calls.some(u=>u.includes('/search/')));assert.ok(!calls.includes('https://haraj.com.sa/11188891001/'));
});
test('old Haraj records are rechecked even when absent from discovery; only confirmed disappearance removes them',async()=>{
 const previous={...candidate,source:'Haraj',lastSeenAt:'2020-01-01T00:00:00Z'};
 for(const outcome of ['sold','HTTP 404','HTTP 410','HTTP 503']){
  const result=await collectHarajInventory({previousListings:[previous],queries:['Toyota'],maxDetails:1,sleep:async()=>{},get:async u=>{
   if(u.endsWith('robots.txt'))return 'User-agent: *\nAllow: /';if(u.includes('/search/'))return '';
   if(outcome==='sold')return html('سيارة مستعملة للبيع تم البيع');throw Error(outcome);
  }});
  assert.equal(result.diagnostics.detailAttempts,1);assert.equal(result.removedUrls.length,outcome==='HTTP 503'?0:1);
 }
});
test('negative sold statements do not remove an active ad',()=>{
 assert.ok(harajDetailRecord(candidate,html('سيارة مستعملة للبيع الممشى 50000 كم لم يتم البيع')));
 assert.ok(harajDetailRecord(candidate,html('Used car for sale 50000 km, not sold')));
});
