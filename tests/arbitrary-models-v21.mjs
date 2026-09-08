const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function start(query){const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition:'used',filters:{},phase:'full'}),signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`${query} HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);return r.json()}
async function find(query){let d=await start(query);for(let i=0;i<18;i++){const cars=(d.listings||[]).filter(c=>c.saleVerified===true&&c.condition==='used');if(cars.length)return {cars,d};if(!d.searchId||d.complete)break;await sleep(1200);const r=await fetch(`${base}/api/search/progress/${d.searchId}`,{signal:AbortSignal.timeout(12000)});if(!r.ok){if(r.status===404)break;throw new Error(`progress ${r.status}`)}d=await r.json()}return {cars:(d.listings||[]).filter(c=>c.saleVerified===true&&c.condition==='used'),d}}
const queries=['Honda Accord','Haval H6','Geely Coolray','Changan CS75 Plus','Kia Sorento','Mazda CX-5'];
let found=0;
for(const q of queries){const {cars,d}=await find(q);if(!cars.length){console.error(`MISS ${q}; diagnostics=${JSON.stringify([...(d.diagnostics||[]),...(d.indexedFallbackDiagnostics||[])])}`);continue}found++;const sources=[...new Set(cars.map(c=>c.source))];console.log(`PASS ${q}: ${cars.length} verified exact-model cars from ${sources.join(', ')}`)}
if(found<queries.length)throw new Error(`Arbitrary model coverage incomplete: ${found}/${queries.length} queries returned verified cars`);
console.log(`PASS arbitrary model coverage: ${found}/${queries.length}`);
