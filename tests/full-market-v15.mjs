import assert from 'node:assert/strict';

const base=String(process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com').replace(/\/$/,'');
const expectedCommit=String(process.env.EXPECTED_GIT_COMMIT||'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BAD=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|طبلون|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|مراي[هة]|مرآة|للايجار|للإيجار|تاجير|تأجير|نقل\s*سيارات|فحص\s*سيارات|ورشة|صيانة|تشليح|للتشليح)/i;

async function json(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(40_000),headers:{...(options.headers||{}),'cache-control':'no-cache'}});
  const text=await r.text();let d={};try{d=JSON.parse(text)}catch{d={error:text.slice(0,400)}}
  assert.ok(r.ok,`${url} HTTP ${r.status}: ${JSON.stringify(d)}`);return d;
}
async function runCase(c){
  const first=await json(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:c.query,condition:c.condition,filters:c.filters||{}})});
  let latest=first;
  for(let i=0;i<18&&first.searchId;i++){
    const done=(c.condition==='new'?latest.salehNativeComplete===true:(latest.harajNativeComplete===true&&latest.syarahNativeComplete===true));
    if(done&&i>1)break;
    await sleep(i===0?700:1200);
    latest=await json(`${base}/api/search/progress/${encodeURIComponent(first.searchId)}`);
  }
  const listings=Array.isArray(latest.listings)?latest.listings:[];
  const matching=listings.filter(x=>!c.source||x.source===c.source);
  const wrongYear=c.year?matching.filter(x=>Number(x.year)!==c.year):[];
  const junk=matching.filter(x=>BAD.test(String(x.title||'')));
  const wrongModel=c.titleRe?matching.filter(x=>!c.titleRe.test(String(x.title||''))):[];
  const wrongCondition=matching.filter(x=>x.condition&&x.condition!==c.condition);
  const diag={query:c.query,condition:c.condition,year:c.year||null,source:c.source||null,total:listings.length,matching:matching.length,counts:latest.counts||{},wrongYear:wrongYear.length,junk:junk.length,wrongModel:wrongModel.length,wrongCondition:wrongCondition.length,qualityRejected:latest.qualityRejected||0,haraj:latest.harajNativeListings??null,syarah:latest.syarahNativeListings??null,saleh:latest.salehNativeListings??null,salehMeta:latest.salehDiscoveryMeta??null,motoryError:latest.motoryNativeError??null,indexedErrors:latest.indexedFallbackDiagnostics??null,sample:matching.slice(0,3).map(x=>({source:x.source,title:x.title,year:x.year,price:x.price,city:x.city,url:x.url}))};
  console.log('FULL_CASE '+JSON.stringify(diag));
  assert.equal(wrongYear.length,0,`${c.query}: wrong-year results ${JSON.stringify(diag)}`);
  assert.equal(junk.length,0,`${c.query}: junk listings leaked ${JSON.stringify(diag)}`);
  assert.equal(wrongModel.length,0,`${c.query}: wrong model leaked ${JSON.stringify(diag)}`);
  assert.equal(wrongCondition.length,0,`${c.query}: wrong condition leaked ${JSON.stringify(diag)}`);
  if(c.requireResults!==false)assert.ok(matching.length>0,`${c.query}: expected live inventory but got zero ${JSON.stringify(diag)}`);
  if(c.source==='Saleh Cars'){
    for(const x of matching)assert.match(String(x.url||''),/^https?:\/\/(?:www\.)?salehcars\.com\/(?:en\/)?cars\/[a-f0-9]{24}(?:\/|$)/i,`${c.query}: non-direct Saleh URL`);
  }
  if(c.filters?.city){const known=matching.filter(x=>x.city);assert.ok(known.every(x=>String(x.city).toLowerCase()===String(c.filters.city).toLowerCase()),`${c.query}: city filter leak ${JSON.stringify(diag)}`)}
  if(c.filters?.maxPrice){const priced=matching.filter(x=>Number.isFinite(Number(x.price)));assert.ok(priced.every(x=>Number(x.price)<=Number(c.filters.maxPrice)),`${c.query}: price filter leak ${JSON.stringify(diag)}`)}
  if(c.filters?.maxMileage){const km=matching.filter(x=>Number.isFinite(Number(x.mileage)));assert.ok(km.every(x=>Number(x.mileage)<=Number(c.filters.maxMileage)),`${c.query}: mileage filter leak ${JSON.stringify(diag)}`)}
  return diag;
}

const health=await json(`${base}/api/health`);
assert.equal(health.productVersion,'1.5');
assert.equal(health.qualityGate,true);
assert.equal(health.harajNativeSearch,true);
assert.equal(health.syarahNativeInventory,true);
assert.equal(health.salehNativeInventory,true);
if(expectedCommit)assert.equal(health.renderGitCommit,expectedCommit);

const cases=[
  {query:'Toyota Corolla 2013',condition:'used',year:2013,titleRe:/corolla|كورولا|كرولا/i},
  {query:'Toyota Camry 2018',condition:'used',year:2018,titleRe:/camry|كامري/i},
  {query:'Nissan Patrol 2020',condition:'used',year:2020,titleRe:/patrol|باترول/i},
  {query:'Nissan Sunny 2020',condition:'used',year:2020,titleRe:/sunny|صني/i},
  {query:'Jeep Wrangler 2021',condition:'used',year:2021,titleRe:/wrangler|رانجلر/i},
  {query:'Hyundai Sonata 2017',condition:'used',year:2017,titleRe:/sonata|سوناتا/i},
  {query:'Hyundai Tucson 2022',condition:'used',year:2022,titleRe:/tucson|توسان/i},
  {query:'Kia Sportage 2022',condition:'used',year:2022,titleRe:/sportage|سبورتاج/i},
  {query:'Chevrolet Tahoe 2021',condition:'used',year:2021,titleRe:/tahoe|تاهو/i},
  {query:'Toyota Yaris 2019',condition:'used',year:2019,titleRe:/yaris|يارس/i},
  {query:'كورولا ٢٠١٣',condition:'used',year:2013,titleRe:/corolla|كورولا|كرولا/i},
  {query:'باترول ٢٠٢٠',condition:'used',year:2020,titleRe:/patrol|باترول/i},
  {query:'Toyota Corolla 2026',condition:'new',year:2026,source:'Saleh Cars',titleRe:/corolla|كورولا/i},
  {query:'Hyundai Elantra 2026',condition:'new',year:2026,source:'Saleh Cars',titleRe:/elantra|النترا|إلنترا/i},
  {query:'Kia Sportage 2026',condition:'new',year:2026,source:'Saleh Cars',titleRe:/sportage|سبورتاج/i},
  {query:'Geely Preface 2026',condition:'new',year:2026,source:'Saleh Cars',titleRe:/preface|بريفيس|بريفايس/i},
  {query:'Changan Eado 2026',condition:'new',year:2026,source:'Saleh Cars',titleRe:/eado|ايدو|إيدو/i}
];

const results=[];
for(const c of cases)results.push(await runCase(c));

// Filter behavior spot checks; do not require a result if the live market genuinely has none.
for(const c of[
  {query:'Toyota Corolla 2013',condition:'used',year:2013,titleRe:/corolla|كورولا/i,filters:{city:'Riyadh'},requireResults:false},
  {query:'Jeep Wrangler 2021',condition:'used',year:2021,titleRe:/wrangler|رانجلر/i,filters:{maxPrice:200000},requireResults:false},
  {query:'Nissan Patrol 2020',condition:'used',year:2020,titleRe:/patrol|باترول/i,filters:{maxMileage:300000},requireResults:false}
])results.push(await runCase(c));

console.log(JSON.stringify({ok:true,commit:health.renderGitCommit||null,cases:results.length,zeroCases:results.filter(x=>x.matching===0).map(x=>x.query),sourceTotals:results.reduce((a,x)=>{for(const[k,v]of Object.entries(x.counts||{}))a[k]=(a[k]||0)+v;return a},{})},null,2));
