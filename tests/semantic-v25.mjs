const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function j(url,opts={},ms=25000){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(ms)});if(!r.ok)throw new Error(`${url} HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}
const understood=await j(`${base}/api/understand`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'show me used Jeep Compass 2019 and above under 60000 SAR',condition:'used',filters:{}})});
const u=understood.understanding||{};
if(u.brand!=='Jeep'||u.model!=='Compass'||u.minYear!==2019||u.maxPrice!==60000)throw new Error(`Semantic intent failed: ${JSON.stringify(u)}`);
console.log('PASS semantic intent:',JSON.stringify({brand:u.brand,model:u.model,minYear:u.minYear,maxPrice:u.maxPrice}));
let d=await j(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Jeep Compass',condition:'used',filters:{seller:'Syarah'},phase:'full'})},45000);
for(let i=0;i<30&&d.searchId&&!d.complete;i++){const cars=d.listings||[];if(cars.length&&cars.some(c=>c.syarahExactVerified))break;await sleep(1200);d=await j(`${base}/api/search/progress/${d.searchId}`,{},25000)}
if(d.understanding?.model!=='Compass')throw new Error(`Search understanding lost model: ${JSON.stringify(d.understanding)}`);
const cars=(d.listings||[]).filter(c=>c.source==='Syarah');
if(!cars.length)throw new Error(`No Syarah Compass listings returned; diagnostics=${JSON.stringify(d.diagnostics||[])}`);
for(const c of cars){const evidence=`${c.title||''} ${c.url||''}`.toLowerCase();if(!evidence.includes('compass'))throw new Error(`Cross-model leak: ${c.title} ${c.url}`);if(evidence.includes('wrangler'))throw new Error(`Wrangler leaked into Compass search: ${c.url}`);if(c.priceVerified){if(c.priceSource!=='syarah_original_pre_discount_price')throw new Error(`Wrong Syarah price authority ${c.priceSource}: ${c.url}`);if(Number(c.price)!==Number(c.originalPrice))throw new Error(`Primary Syarah price is not original price: ${c.price} vs ${c.originalPrice}`);if(c.discountedPrice&&Number(c.originalPrice)<Number(c.discountedPrice))throw new Error(`Original price below discounted price: ${c.url}`)}}
if(!cars.some(c=>c.syarahExactVerified&&c.priceVerified))throw new Error('No exact Syarah Compass price was verified');
console.log(`PASS exact Compass identity + Syarah original pricing: ${cars.length} listings`);
