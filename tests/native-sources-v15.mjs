import assert from 'node:assert/strict';

const base=String(process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com').replace(/\/$/,'');
const expected=String(process.env.EXPECTED_GIT_COMMIT||'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(35_000),headers:{...(options.headers||{}),'cache-control':'no-cache'}});const t=await r.text();let d={};try{d=JSON.parse(t)}catch{d={error:t.slice(0,300)}}assert.ok(r.ok,`${url} HTTP ${r.status}: ${JSON.stringify(d)}`);return d}
async function search(query){const first=await json(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition:'used',filters:{}})});let latest=first;for(let i=0;i<14&&first.searchId;i++){if((latest.syarahNativeComplete===true)&&(latest.harajNativeComplete===true))break;await sleep(i?1200:700);latest=await json(`${base}/api/search/progress/${encodeURIComponent(first.searchId)}`)}return{first,latest}}

const health=await json(`${base}/api/health`);assert.equal(health.productVersion,'1.5');assert.equal(health.qualityGate,true);assert.equal(health.syarahNativeInventory,true);if(expected)assert.equal(health.renderGitCommit,expected);

const wrangler=await search('Jeep Wrangler 2021');
assert.equal(wrangler.latest.syarahNativeComplete,true,`Syarah scan did not complete: ${JSON.stringify(wrangler.latest)}`);
assert.ok(!wrangler.latest.syarahNativeError,`Syarah native scan failed: ${wrangler.latest.syarahNativeError}`);
const syarahWrangler=(wrangler.latest.listings||[]).filter(x=>x.source==='Syarah');
assert.ok(syarahWrangler.length>=1,`Expected live Syarah Wrangler 2021 stock, got none. Diagnostics: ${JSON.stringify({url:wrangler.latest.syarahNativeUrl,count:wrangler.latest.syarahNativeListings,error:wrangler.latest.syarahNativeError,sources:wrangler.latest.counts})}`);
assert.ok(syarahWrangler.every(x=>Number(x.year)===2021&&/wrangler|رانجلر/i.test(String(x.title||''))),`Syarah leaked mismatched Wrangler results: ${JSON.stringify(syarahWrangler)}`);

const corolla=await search('Toyota Corolla 2013');
assert.equal(corolla.latest.syarahNativeComplete,true,`Syarah Corolla no-stock scan did not complete`);
assert.ok(!corolla.latest.syarahNativeError,`Syarah Corolla scan failed: ${corolla.latest.syarahNativeError}`);
const syarahCorolla=(corolla.latest.listings||[]).filter(x=>x.source==='Syarah');
assert.equal(syarahCorolla.length,0,`Syarah suggested newer cars leaked into Corolla 2013: ${JSON.stringify(syarahCorolla)}`);

console.log(JSON.stringify({ok:true,wranglerSyarah:syarahWrangler.length,corolla2013Syarah:syarahCorolla.length,wranglerUrl:wrangler.latest.syarahNativeUrl,corollaUrl:corolla.latest.syarahNativeUrl},null,2));
