const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const timeout=ms=>AbortSignal.timeout(ms);
async function json(url,opts={}){const r=await fetch(url,{...opts,signal:timeout(opts.timeout||240000)});if(!r.ok)throw new Error(`${url} HTTP ${r.status}: ${(await r.text()).slice(0,400)}`);return r.json()}
const health=await json(`${base}/api/health`,{timeout:15000});
if(health.edge!=='inventory-v18'||health.exhaustiveSearch!==true)throw new Error(`v18 exhaustive edge not live: ${JSON.stringify({edge:health.edge,exhaustiveSearch:health.exhaustiveSearch})}`);
const cases=[
 {query:'ابي باترول 2022 وفوق بالرياض تحت 170 ألف',condition:'used'},
 {query:'Toyota Camry',condition:'used'},
 {query:'Jetour X70 2026 Riyadh',condition:'new'},
 {query:'Hyundai Sonata 2026 Saudi',condition:'new'}
];
let total=0;
for(const t of cases){
 const started=Date.now();
 const d=await json(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...t,filters:{},phase:'full'}),timeout:300000});
 const cars=Array.isArray(d.listings)?d.listings:[];
 if(d.exhaustive!==true)throw new Error(`Not exhaustive for ${t.query}`);
 if(cars.length<1)throw new Error(`No cars for ${t.query}; diagnostics=${JSON.stringify(d.exhaustiveDiagnostics||[])}`);
 if(d.exhaustiveCapHit===true)throw new Error(`Exhaustive scan still capped for ${t.query}; unique=${d.exhaustiveUnique}; diagnostics=${JSON.stringify(d.exhaustiveDiagnostics||[])}`);
 const seen=new Set();
 for(const c of cars){
  if(c.saleVerified!==true)throw new Error(`Unverified listing ${c.url}`);
  if(c.condition!==t.condition)throw new Error(`Condition leak ${c.condition} into ${t.condition}: ${c.url}`);
  const k=String(c.url||'').replace(/\/$/,'');if(!/^https?:\/\//.test(k))throw new Error(`Bad listing URL ${c.url}`);if(seen.has(k))throw new Error(`Duplicate ${c.url}`);seen.add(k);
  if(c.image!=null&&c.imageVerified!==true)throw new Error(`Unverified image ${c.url}`);
  if(c.price!=null&&!Number.isFinite(Number(c.price)))throw new Error(`Non-numeric price ${c.url}`);
 }
 total+=cars.length;
 console.log(`PASS exhaustive ${t.condition}: ${cars.length} cars, ${d.exhaustiveCalls} scan calls, ${Date.now()-started}ms | ${t.query}`);
}
if(total<20)throw new Error(`Exhaustive suite returned too little total inventory: ${total}`);
console.log(`PASS exhaustive v18: ${cases.length} searches, ${total} verified cars, no source cap left unresolved`);
