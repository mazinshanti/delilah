const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const j=async(url,opts={},ms=20000)=>{const r=await fetch(url,{...opts,signal:AbortSignal.timeout(ms)});if(!r.ok)throw new Error(`${url} HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()};
const p=await j(`${base}/api/source-plugins`,{},30000);
if(!Array.isArray(p.plugins))throw new Error('Missing source plugin registry');
for(const name of ['Saudi Sale','YallaMotor','ArabWheels','Hatla2ee','Genesis Wallan Certified']){const x=p.plugins.find(x=>x.name===name);if(!x||!String(x.status||'').startsWith('active'))throw new Error(`Missing active source plugin ${name}`)}
console.log(`PASS source registry: ${p.active}/${p.total} active plugins`);
let r=await j(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Toyota Camry',condition:'used',filters:{seller:'ArabWheels'},phase:'full'})},20000);
for(let i=0;i<20&&r.searchId&&!r.complete;i++){await sleep(2000);r=await j(`${base}/api/search/progress/${r.searchId}`,{},10000)}
const cars=(r.listings||[]).filter(c=>c.source==='ArabWheels');
if(cars.length<1)throw new Error(`ArabWheels plugin returned no cars; diagnostics=${JSON.stringify(r.diagnostics||[])}`);
for(const c of cars){if(c.condition!=='used'||c.saleVerified!==true)throw new Error(`Invalid ArabWheels sale ${c.url}`);if(!/^https:\/\/(?:www\.)?arabwheels\.sa\/(?:en\/)?used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(c.url||''))throw new Error(`Non-direct ArabWheels URL ${c.url}`);if(c.image&&!c.imageVerified)throw new Error(`Unverified ArabWheels image ${c.url}`);if(c.price!=null&&c.priceSource!=='arabwheels_catalog_current_price')throw new Error(`Unexpected ArabWheels price source ${c.priceSource}`)}
console.log(`PASS ArabWheels deterministic plugin: ${cars.length} real cars`);
