const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function search(body,ms=20000){const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(ms)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}
async function finish(d){for(let i=0;i<25&&d.searchId&&!d.complete;i++){await sleep(2000);const r=await fetch(`${base}/api/search/progress/${d.searchId}`,{signal:AbortSignal.timeout(10000)});if(!r.ok)break;d=await r.json()}return d}

const arabic=await search({query:'ابي رانجلر 2022 وفوق بالرياض تحت 130 ألف',condition:'used',filters:{},phase:'fast'});
if(Number(arabic.intent?.maxPrice)!==130000)throw new Error(`Arabic ألف normalization failed: maxPrice=${arabic.intent?.maxPrice}`);
if(!Array.isArray(arabic.listings)||arabic.listings.length<1)throw new Error(`Arabic user path returned no cars; raw=${arabic.rawCandidates||0}`);
if(arabic.listings.some(c=>c.price&&Number(c.price)>130000))throw new Error('Arabic max-price leak');
console.log(`PASS Arabic 130 ألف: ${arabic.listings.length} cars, maxPrice=${arabic.intent.maxPrice}`);

let syarah=await search({query:'Toyota Camry 2025 Saudi',condition:'used',filters:{seller:'Syarah'},phase:'full'});syarah=await finish(syarah);
const cars=(syarah.listings||[]).filter(c=>c.source==='Syarah');
if(cars.length<1)throw new Error(`Syarah returned no Camry cars; diagnostics=${JSON.stringify(syarah.diagnostics||[])}`);
let verified=0;
for(const c of cars){
 if(c.price!=null){
   if(!['syarah_cash_price','syarah_catalog_cash_price'].includes(c.priceSource)||c.priceVerified!==true)throw new Error(`Unverified Syarah number displayed as price: ${c.price}, ${c.url}`);
   if(!Number.isFinite(Number(c.price))||Number(c.price)<20000)throw new Error(`Suspicious Syarah cash price: ${c.price}, ${c.url}`);
   verified++;
 }
 const text=`${c.title||''} ${c.snippet||''}`.replace(/\s+/g,' ');
 const m=text.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?[^0-9]{0,35}([0-9][\d,]*)\s*SAR/i);
 if(m&&c.price!=null){const cash=Number(m[1].replace(/,/g,''));if(Number(c.price)!==cash)throw new Error(`Wrong Syarah price: displayed ${c.price}, cash price ${cash}, ${c.url}`)}
 const dm=text.match(/(?:discount|save)\s*([0-9][\d,]*)\s*SAR/i);if(dm&&c.price!=null&&Number(c.price)===Number(dm[1].replace(/,/g,'')))throw new Error(`Discount leaked as car price: ${c.price}, ${c.url}`);
}
if(verified<1)throw new Error(`No Syarah cash prices verified across ${cars.length} cars`);
console.log(`PASS Syarah cash prices: ${verified}/${cars.length} verified; discount values excluded`);
