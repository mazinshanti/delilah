const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stats=null;
for(let i=0;i<60;i++){
  try{
    const sr=await fetch(`${base}/api/catalog/stats`,{signal:AbortSignal.timeout(10000)});
    if(sr.ok){stats=await sr.json();const candidates=[...(stats.samples||[]),...(stats.motorySamples||[]),...(stats.extendedSamples||[])];if(Number(stats.indexed||stats.syarahIndexed||stats.totalBroadIndexed)>=50&&candidates.length)break}
  }catch{}
  await sleep(2000);
}
if(!stats)throw new Error('No broad inventory stats for fast-path test');
const candidates=[...(stats.samples||[]),...(stats.motorySamples||[]),...(stats.extendedSamples||[])];
let sample=candidates.find(x=>x.condition==='used')||candidates[0];
if(!sample)throw new Error(`No live catalog sample available after warmup; indexed=${stats.indexed||stats.totalBroadIndexed||0}, refreshing=${stats.refreshRunning||stats.extendedRefreshing||false}, error=${stats.lastRefreshError||stats.extendedLastRefreshError||'none'}`);
let query='',condition=sample.condition||'used',listingId='';
let m=String(sample.url||'').match(/\/cardetail\/([^/]+)-(used|new)-(\d+)/i);
if(m){query=m[1].replace(/-/g,' ');condition=m[2].toLowerCase();listingId=m[3]}
else{
  m=String(sample.url||'').match(/\/cars-for-sale\/(?:[^/]+-haraj\/)?([^/]+)\/([^/]+)\/(20\d{2})\/(\d+)/i);
  if(!m)throw new Error(`Unsupported sample URL: ${sample.url}`);
  query=`${m[1].replace(/-/g,' ')} ${m[2].replace(/-/g,' ')} ${m[3]}`;condition='used';listingId=m[4];
}
const started=Date.now();
const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:{},phase:'fast'}),signal:AbortSignal.timeout(9000)});
const elapsed=Date.now()-started;
if(!r.ok)throw new Error(`Fast path HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
const d=await r.json();
if(d.phase!=='fast'||d.partial!==true)throw new Error(`Not a fast partial response: ${JSON.stringify({phase:d.phase,partial:d.partial})}`);
if(elapsed>5000)throw new Error(`Fast path too slow: ${elapsed}ms`);
if(!Array.isArray(d.listings)||d.listings.length<1)throw new Error(`Fast path returned no cars for '${query}' in ${elapsed}ms`);
const hit=d.listings.find(c=>String(c.url||'').includes(listingId));
if(!hit)throw new Error(`Fast path did not recover live sampled listing ${listingId} for '${query}'`);
if(hit.saleVerified!==true)throw new Error(`Unverified sale result: ${hit.url}`);
if(hit.condition!==condition)throw new Error(`Condition leak: wanted ${condition}, got ${hit.condition}`);
if(hit.price!=null&&hit.priceVerified!==true)throw new Error(`Unverified price exposed: ${hit.price} ${hit.url}`);
if(hit.image!=null&&hit.imageVerified!==true)throw new Error(`Unverified image exposed: ${hit.url}`);
console.log(`PASS fast path: dynamic '${query}' recovered in ${elapsed}ms from ${hit.source}; broad index ${stats.totalBroadIndexed||stats.indexed||'n/a'}`);
