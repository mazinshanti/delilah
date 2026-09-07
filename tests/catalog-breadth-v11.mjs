const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stats=null;
for(let i=0;i<40;i++){
  const r=await fetch(`${base}/api/catalog/stats`,{signal:AbortSignal.timeout(10000)});
  if(r.ok){stats=await r.json();if(Number(stats.indexed)>=100&&Number(stats.models)>=20)break}
  await sleep(3000);
}
if(!stats)throw new Error('No catalog stats response');
if(Number(stats.indexed)<100)throw new Error(`Catalog too small: ${stats.indexed}`);
if(Number(stats.models)<20)throw new Error(`Catalog not broad enough: ${stats.models} model groups`);
if(!Array.isArray(stats.samples)||!stats.samples.length)throw new Error('No catalog samples');
const warm=/camry|patrol|land-cruiser|wrangler|tucson|sportage|c200|x5|territory|tahoe/i;
const sample=stats.samples.find(s=>!warm.test(s.url||''))||stats.samples[0];
const m=String(sample.url||'').match(/\/cardetail\/([^/]+)-(used|new)-(\d+)/i);
if(!m)throw new Error(`Bad sample URL: ${sample.url}`);
const query=m[1].replace(/-/g,' ');
const condition=m[2].toLowerCase();
const started=Date.now();
const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:{},phase:'fast'}),signal:AbortSignal.timeout(12000)});
if(!r.ok)throw new Error(`Generic search HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
const d=await r.json();
if(!Array.isArray(d.listings)||!d.listings.length)throw new Error(`No result for dynamically discovered catalog car: ${query}`);
if(!d.listings.some(c=>String(c.url||'').includes(m[3])))throw new Error(`Dynamic catalog search did not recover sampled listing ${m[3]}`);
if(!d.listings.every(c=>c.saleVerified===true))throw new Error('Unverified car leaked from broad catalog');
console.log(`PASS broad catalog: ${stats.indexed} cars, ${stats.models} model groups; dynamic '${query}' found in ${Date.now()-started}ms`);
