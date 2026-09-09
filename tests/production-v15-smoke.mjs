import assert from 'node:assert/strict';

const base = String(process.env.DELILAH_URL || 'https://delilah-pm5f.onrender.com').replace(/\/$/, '');
const expectedCommit = String(process.env.EXPECTED_GIT_COMMIT || '').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const BAD_TITLE=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|طبلون|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|كشافات|مراي[هة]|مرآة|للايجار|للإيجار|تاجير|تأجير|سطح[هة]|نقل\s*سيارات|فحص\s*سيارات|ورشة|صيانة|تشليح|للتشليح)/i;

async function json(url, options = {}) {
  const r = await fetch(url, {...options, signal: AbortSignal.timeout(35_000), headers:{...(options.headers||{}),'cache-control':'no-cache'}});
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {error: text.slice(0, 300)}; }
  assert.ok(r.ok, `${url} returned HTTP ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

const health = await json(`${base}/api/health`);
assert.equal(typeof health, 'object');
assert.equal(health.productVersion, '1.5');
assert.equal(health.restartSafeSearchIds, true);
assert.equal(health.motoryNativeCatalog, true);
assert.equal(health.harajNativeSearch, true);
assert.equal(health.qualityGate, true);
assert.equal(health.syarahNativeInventory, true);
assert.equal(health.salehNativeInventory, true);
assert.equal(health.yallamotorNativeInventory, true);
assert.equal(health.edge, 'dalelah-v15-yallamotor');
if (expectedCommit) assert.equal(health.renderGitCommit, expectedCommit);

function diagnostics(query, first, latest, listings) {
  return {query,searchId:first.searchId||null,firstListings:Array.isArray(first.listings)?first.listings.length:null,latestListings:listings.length,counts:latest.counts||{},complete:latest.complete??latest.marketScanComplete??null,exactYearIntent:latest.exactYearIntent??first.exactYearIntent??null,qualityRejected:latest.qualityRejected??first.qualityRejected??null,harajNativeListings:latest.harajNativeListings??first.harajNativeListings??null,syarahNativeListings:latest.syarahNativeListings??first.syarahNativeListings??null,salehNativeListings:latest.salehNativeListings??first.salehNativeListings??null,yallamotorNativeListings:latest.yallamotorNativeListings??first.yallamotorNativeListings??null,yallamotorNativeError:latest.yallamotorNativeError??first.yallamotorNativeError??null,yallamotorNativeUrl:latest.yallamotorNativeUrl??first.yallamotorNativeUrl??null,sample:listings.slice(0,5).map(x=>({source:x.source,title:x.title,year:x.year,city:x.city,price:x.price,url:x.url}))};
}

async function exactYearCase({query, year, requireResults = true, requireYalla=false}) {
  const first = await json(`${base}/api/search`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition:'used',filters:{}})});
  assert.equal(first.exactYearIntent, year, `${query}: exact-year intent missing`);
  if (first.searchId) assert.ok(String(first.searchId).startsWith('d15.'));
  let latest=first;
  if(first.searchId&&first.complete!==true&&first.marketScanComplete!==true){for(let i=0;i<16;i++){await sleep(i===0?800:1500);latest=await json(`${base}/api/search/progress/${encodeURIComponent(first.searchId)}`);if(latest.complete===true||latest.marketScanComplete===true)break;}}
  const listings=Array.isArray(latest.listings)?latest.listings:[];
  const diag=diagnostics(query,first,latest,listings);console.log('CASE_DIAGNOSTIC '+JSON.stringify(diag));
  const wrong=listings.filter(x=>Number(x?.year)!==year);assert.equal(wrong.length,0,`${query}: wrong-year leakage ${JSON.stringify(diag)}`);
  const junk=listings.filter(x=>BAD_TITLE.test(String(x?.title||'')));assert.equal(junk.length,0,`${query}: junk leakage ${JSON.stringify(diag)}`);
  if(requireResults)assert.ok(listings.length>0,`${query}: zero results ${JSON.stringify(diag)}`);
  if(requireYalla)assert.ok(listings.some(x=>x.source==='YallaMotor'),`${query}: YallaMotor native source returned zero verified listings ${JSON.stringify(diag)}`);
  return{query,year,listings:listings.length,sourceCounts:latest.counts||{},yallamotorNativeListings:latest.yallamotorNativeListings??null};
}

const cases=[
  {query:'Toyota Corolla 2013',year:2013,requireResults:true,requireYalla:true},
  {query:'Nissan Patrol 2020',year:2020,requireResults:true},
  {query:'Jeep Wrangler 2021',year:2021,requireResults:true},
  {query:'كورولا ٢٠١٣',year:2013,requireResults:true,requireYalla:true}
];
const results=[];for(const c of cases)results.push(await exactYearCase(c));
console.log(JSON.stringify({ok:true,healthEdge:health.edge,renderGitCommit:health.renderGitCommit,cases:results},null,2));
