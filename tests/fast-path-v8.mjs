const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const started=Date.now();
const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Toyota Camry',condition:'used',filters:{},phase:'fast'}),signal:AbortSignal.timeout(12000)});
const elapsed=Date.now()-started;
if(!r.ok)throw new Error(`Fast path HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
const d=await r.json();
if(d.phase!=='fast'||d.partial!==true)throw new Error(`Not a fast partial response: ${JSON.stringify({phase:d.phase,partial:d.partial})}`);
if(elapsed>9000)throw new Error(`Fast path too slow: ${elapsed}ms`);
if(!Array.isArray(d.listings)||d.listings.length<1)throw new Error(`Fast path returned no cars in ${elapsed}ms`);
for(const c of d.listings){
  if(c.source!=='Syarah')throw new Error(`Unexpected fast source ${c.source}`);
  if(!/syarah\.com\/(?:en\/)?cardetail\//i.test(c.url||''))throw new Error(`Not a direct Syarah listing: ${c.url}`);
  if(c.condition!=='used')throw new Error(`Condition leak: ${c.condition}`);
  if(c.brand!=='Toyota'||c.model!=='Camry')throw new Error(`Wrong fast car: ${c.brand} ${c.model}`);
  if(c.price!=null&&(!c.priceVerified||c.priceSource!=='syarah_cash_price'))throw new Error(`Unverified fast Syarah price: ${c.price} ${c.url}`);
}
console.log(`PASS fast path: ${d.listings.length} cars in ${elapsed}ms (server ${d.elapsedMs||'n/a'}ms)`);
