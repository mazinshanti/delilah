const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const timeout=ms=>AbortSignal.timeout(ms);
async function search(body){const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:timeout(180000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}

const arabic=await search({query:'ابي رانجلر 2022 وفوق بالرياض تحت 130 ألف',condition:'used',filters:{}});
if(Number(arabic.intent?.maxPrice)!==130000)throw new Error(`Arabic ألف normalization failed: maxPrice=${arabic.intent?.maxPrice}`);
if(!Array.isArray(arabic.listings)||arabic.listings.length<1)throw new Error(`Arabic user path returned no cars; raw=${arabic.rawCandidates||0}`);
if(arabic.listings.some(c=>c.price&&Number(c.price)>130000))throw new Error('Arabic max-price leak');
console.log(`PASS Arabic 130 ألف: ${arabic.listings.length} cars, maxPrice=${arabic.intent.maxPrice}`);

const syarah=await search({query:'Toyota Camry 2025 Saudi',condition:'used',filters:{seller:'Syarah'}});
if(!Array.isArray(syarah.listings)||syarah.listings.length<1)throw new Error(`Syarah returned no Camry cars; raw=${syarah.rawCandidates||0}`);
let checked=0;
for(const c of syarah.listings){
 const text=`${c.title||''} ${c.snippet||''}`.replace(/\s+/g,' ');
 const m=text.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i);
 if(!m)continue;
 const cash=Number(m[1].replace(/,/g,''));
 if(Number(c.price)!==cash)throw new Error(`Wrong Syarah price: displayed ${c.price}, cash price ${cash}, ${c.url}`);
 if(/(?:discount|save)\s*([0-9][\d,]*)\s*SAR/i.test(text)){
   const disc=Number(text.match(/(?:discount|save)\s*([0-9][\d,]*)\s*SAR/i)[1].replace(/,/g,''));
   if(Number(c.price)===disc)throw new Error(`Discount leaked as price: ${disc}, ${c.url}`);
 }
 if(c.priceSource!=='syarah_cash_price')throw new Error(`Syarah price not marked as cash-price verified: ${c.url}`);
 checked++;
}
if(checked<1)throw new Error('No Syarah Cash Price cards were verifiable');
console.log(`PASS Syarah cash prices: ${checked}/${syarah.listings.length} checked`);
