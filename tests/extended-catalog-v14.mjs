const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let s=null;
for(let i=0;i<80;i++){
  const r=await fetch(`${base}/api/catalog/stats`,{signal:AbortSignal.timeout(10000)});
  if(r.ok){s=await r.json();if(Number(s.totalBroadIndexed)>=700&&Number(s.extendedIndexed)>=250&&s.extendedSamples?.length)break}
  await sleep(3000);
}
if(!s)throw new Error('No catalog stats');
if(Number(s.totalBroadIndexed)<700)throw new Error(`Broad inventory still too small: ${s.totalBroadIndexed}`);
if(Number(s.extendedIndexed)<250)throw new Error(`Extended catalog too small: ${s.extendedIndexed}; error=${s.extendedLastRefreshError||'none'}`);
const sample=s.extendedSamples.find(x=>Number(x.page)>=31)||s.extendedSamples[0];
const m=String(sample.url||'').match(/\/cardetail\/([^/]+)-(used|new)-(\d+)/i);
if(!m)throw new Error(`Bad extended sample: ${sample.url}`);
const query=m[1].replace(/-/g,' '),condition=m[2].toLowerCase(),id=m[3];
const started=Date.now();
const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:{},phase:'fast'}),signal:AbortSignal.timeout(10000)});
if(!r.ok)throw new Error(`Search HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
const d=await r.json();
if(!Array.isArray(d.listings)||!d.listings.some(c=>String(c.url||'').includes(id)))throw new Error(`Extended listing ${id} not recovered for '${query}'`);
if(Date.now()-started>5000)throw new Error(`Extended fast search too slow: ${Date.now()-started}ms`);
console.log(`PASS extended catalog: ${s.totalBroadIndexed} indexed (${s.extendedIndexed} beyond first 30 pages); '${query}' recovered in ${Date.now()-started}ms`);
