const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function search(body,ms=30000){const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(ms)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}
async function finish(d){for(let i=0;i<35&&d.searchId&&!d.complete;i++){await sleep(1500);const r=await fetch(`${base}/api/search/progress/${d.searchId}`,{signal:AbortSignal.timeout(20000)});if(!r.ok)break;d=await r.json()}return d}

const arabic=await search({query:'ابي رانجلر 2022 وفوق بالرياض تحت 130 ألف',condition:'used',filters:{},phase:'fast'});
const understood=arabic.understanding||arabic.intent||{};
if(Number(understood.maxPrice)!==130000)throw new Error(`Arabic ألف normalization failed: maxPrice=${understood.maxPrice}`);
if(understood.model!=='Wrangler'||understood.brand!=='Jeep'||understood.minYear!==2022||understood.city!=='Riyadh')throw new Error(`Arabic intent understanding failed: ${JSON.stringify(understood)}`);
if(!Array.isArray(arabic.listings))throw new Error('Arabic listings missing');
if(arabic.listings.some(c=>c.price&&Number(c.price)>130000))throw new Error('Arabic max-price leak');
if(arabic.listings.some(c=>!/wrangler|رانجلر/i.test(`${c.title||''} ${decodeURIComponent(c.url||'')}`)))throw new Error('Arabic Wrangler cross-model leak');
console.log(`PASS Arabic intent: Jeep Wrangler 2022+ Riyadh <=130k understood; ${arabic.listings.length} exact live matches currently available`);

let wrangler=await search({query:'Jeep Wrangler',condition:'used',filters:{seller:'Syarah'},phase:'full'},45000);wrangler=await finish(wrangler);
const wranglers=(wrangler.listings||[]).filter(c=>c.source==='Syarah');
if(!wranglers.length)throw new Error('Broad exact Wrangler query returned no Syarah inventory');
if(wranglers.some(c=>!/wrangler/i.test(`${c.title||''} ${decodeURIComponent(c.url||'')}`)))throw new Error('Broad Wrangler cross-model leak');

let syarah=await search({query:'Toyota Camry Saudi',condition:'used',filters:{seller:'Syarah'},phase:'full'},45000);syarah=await finish(syarah);
const cars=(syarah.listings||[]).filter(c=>c.source==='Syarah');
if(cars.length<1)throw new Error(`Syarah returned no Camry cars; diagnostics=${JSON.stringify([...(syarah.diagnostics||[]),...(syarah.indexedFallbackDiagnostics||[])])}`);
let verified=0,discounted=0;
for(const c of cars){
 if(c.price!=null){
   if(c.priceSource!=='syarah_original_pre_discount_price'||c.priceVerified!==true||c.syarahExactVerified!==true)throw new Error(`Non-authoritative Syarah price displayed: ${c.priceSource}, ${c.url}`);
   if(!Number.isFinite(Number(c.price))||Number(c.price)<20000)throw new Error(`Suspicious Syarah original price: ${c.price}, ${c.url}`);
   if(Number(c.price)!==Number(c.originalPrice))throw new Error(`Primary price is not original Syarah price: ${c.price} vs ${c.originalPrice}`);
   if(c.discountedPrice){if(Number(c.discountedPrice)>Number(c.originalPrice))throw new Error(`Discounted price above original: ${c.url}`);if(Number(c.discountedPrice)<Number(c.originalPrice))discounted++}
   verified++;
 }
}
if(verified<1)throw new Error(`No exact Syarah original prices verified across ${cars.length} cars`);
console.log(`PASS Syarah original prices: ${verified}/${cars.length} exact; ${discounted} include a lower discounted offer`);
