const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let s=null;
for(let i=0;i<50;i++){
 const r=await fetch(`${base}/api/catalog/stats`,{signal:AbortSignal.timeout(10000)});
 if(r.ok){s=await r.json();if(Number(s.syarahIndexed)>=100&&Number(s.motoryIndexed)>=50)break}
 await sleep(3000);
}
if(!s)throw new Error('No catalog stats');
if(Number(s.syarahIndexed)<100)throw new Error(`Syarah broad index too small: ${s.syarahIndexed}`);
if(Number(s.motoryIndexed)<50)throw new Error(`Motory broad index too small: ${s.motoryIndexed}; error=${s.motoryLastRefreshError||'none'}`);
if(Number(s.totalIndexed)<=Number(s.syarahIndexed))throw new Error('Second source did not increase broad inventory');
if(!Array.isArray(s.motorySamples)||!s.motorySamples.length)throw new Error('No Motory samples');
const sample=s.motorySamples.find(x=>!/camry|patrol|land-cruiser|wrangler|tucson|sportage|c200|x5|territory|tahoe/i.test(x.url||''))||s.motorySamples[0];
const m=String(sample.url||'').match(/\/cars-for-sale\/(?:[^/]+-haraj\/)?([^/]+)\/([^/]+)\/(20\d{2})\/(\d+)/i);
if(!m)throw new Error(`Bad Motory sample URL: ${sample.url}`);
const query=`${m[1].replace(/-/g,' ')} ${m[2].replace(/-/g,' ')} ${m[3]}`;
const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition:'used',filters:{},phase:'fast'}),signal:AbortSignal.timeout(12000)});
if(!r.ok)throw new Error(`Search HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
const d=await r.json();
if(!Array.isArray(d.listings)||!d.listings.length)throw new Error(`No cars for dynamic Motory query ${query}`);
if(!d.listings.some(c=>c.source==='Motory'&&String(c.url||'').includes(`/${m[4]}`)))throw new Error(`Sampled Motory listing ${m[4]} not recovered for ${query}`);
console.log(`PASS multi-source breadth: Syarah ${s.syarahIndexed} + Motory ${s.motoryIndexed} = ${s.totalIndexed}; dynamic '${query}' recovered`);
