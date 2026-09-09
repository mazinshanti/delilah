import assert from 'node:assert/strict';

const base=String(process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com').replace(/\/$/,'');
const expected=String(process.env.EXPECTED_GIT_COMMIT||'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(35_000),headers:{...(options.headers||{}),'cache-control':'no-cache'}});const t=await r.text();let d={};try{d=JSON.parse(t)}catch{d={error:t.slice(0,300)}}assert.ok(r.ok,`${url} HTTP ${r.status}: ${JSON.stringify(d)}`);return d}
async function search(query,condition){const first=await json(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:{}})});let latest=first;for(let i=0;i<18&&first.searchId;i++){if(latest.salehNativeComplete===true)break;await sleep(i?1200:700);latest=await json(`${base}/api/search/progress/${encodeURIComponent(first.searchId)}`)}return{first,latest}}

const health=await json(`${base}/api/health`);assert.equal(health.productVersion,'1.5');assert.equal(health.salehNativeInventory,true);assert.equal(health.qualityGate,true);if(expected)assert.equal(health.renderGitCommit,expected);

const r=await search('Toyota Corolla 2026','new');
assert.equal(r.latest.salehNativeComplete,true,`Saleh scan did not complete: ${JSON.stringify({error:r.latest.salehNativeError,url:r.latest.salehNativeUrl})}`);
assert.ok(!r.latest.salehNativeError,`Saleh native scan failed: ${r.latest.salehNativeError}`);
const cars=(r.latest.listings||[]).filter(x=>x.source==='Saleh Cars');
assert.ok(cars.length>=1,`Expected Saleh Cars Corolla 2026 stock, got zero. ${JSON.stringify({native:r.latest.salehNativeListings,url:r.latest.salehNativeUrl,error:r.latest.salehNativeError,counts:r.latest.counts})}`);
for(const c of cars){assert.equal(Number(c.year),2026,`Saleh wrong year: ${JSON.stringify(c)}`);assert.match(String(c.title||''),/corolla|كورولا/i);assert.match(String(c.url||''),/^https?:\/\/(?:www\.)?salehcars\.com\/(?:en\/)?cars\/[a-f0-9]{24}(?:\/|$)/i);assert.equal(c.condition,'new')}

const used=await search('Toyota Corolla 2026','used');
assert.equal((used.latest.listings||[]).filter(x=>x.source==='Saleh Cars').length,0,'Saleh Cars native new inventory leaked into Used tab');
console.log(JSON.stringify({ok:true,salehCorolla2026:cars.length,prices:cars.map(x=>x.price).filter(Boolean).slice(0,5),sample:cars.slice(0,3).map(x=>({title:x.title,price:x.price,url:x.url}))},null,2));
