const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const cases=[
  {q:'ابي رانجلر 2022 وفوق بالرياض تحت 130000',condition:'used'},
  {q:'ابي باترول 2022 وفوق بالرياض تحت 170000',condition:'used'},
  {q:'Land Cruiser 2022+ Riyadh under 180000',condition:'used'},
  {q:'Toyota Camry Riyadh under 120000',condition:'used'},
  {q:'BMW X5 Riyadh',condition:'used'},
  {q:'Mercedes C200 Riyadh',condition:'used'},
  {q:'Toyota Land Cruiser 2026 Riyadh',condition:'new'},
  {q:'Nissan Patrol 2026 Riyadh',condition:'new'},
  {q:'Ford Territory 2026 Saudi',condition:'new'},
  {q:'Kia Sportage 2026 Jeddah',condition:'new'},
  {q:'Hyundai Tucson 2025 Jeddah',condition:'new'},
  {q:'Chevrolet Tahoe 2026 Riyadh',condition:'new'},
  {q:'Porsche Cayenne Saudi',condition:'new'},
  {q:'Volkswagen Tiguan Saudi',condition:'used'}
];
const timeout=ms=>AbortSignal.timeout(ms);
let pass=0,fail=0,totalCars=0,totalImages=0;
const health=await fetch(`${base}/api/health`,{signal:timeout(20000)});if(!health.ok)throw new Error(`health ${health.status}`);const h=await health.json();if(!h.ok||!h.search)throw new Error(`health config invalid: ${JSON.stringify(h)}`);console.log(`health ok; ${h.sources} sources; ${h.logic||'unknown logic'}`);
for(const t of cases){
 try{
  const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:t.q,condition:t.condition,filters:{}}),signal:timeout(90000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);const d=await r.json();if(!Array.isArray(d.listings))throw new Error('listings not array');const urls=new Set();let images=0;
  for(const c of d.listings){
   if(!c.url)throw new Error('listing missing url');if(urls.has(c.url))throw new Error('duplicate url');urls.add(c.url);
   if(c.saleVerified!==true)throw new Error(`unverified sale result: ${c.url}`);
   if(c.condition!==t.condition)throw new Error(`condition leak ${c.condition}`);
   if(c.source==='Haraj'&&!/^https:\/\/(?:www\.)?haraj\.com\.sa\/\d{7,}(?:\/|$)/i.test(c.url))throw new Error(`bad Haraj url ${c.url}`);
   if(/\/(news|blog|article|review|brochure|specifications?|press-release)(\/|$)/i.test(c.url))throw new Error(`informational page leaked: ${c.url}`);
   if(c.image){if(c.imageVerified!==true||c.imageSource!=='listing_page')throw new Error(`unverified image: ${c.url}`);if(!/^https?:\/\//i.test(c.image))throw new Error(`bad image url: ${c.image}`);images++;}
   if(c.price!=null&&(!Number.isFinite(Number(c.price))||Number(c.price)<=0))throw new Error('invalid price');if(c.mileage!=null&&(!Number.isFinite(Number(c.mileage))||Number(c.mileage)<0))throw new Error('invalid mileage');
  }
  totalCars+=d.listings.length;totalImages+=images;console.log(`PASS ${t.condition.padEnd(4)} | ${String(d.listings.length).padStart(2)} cars | ${String(images).padStart(2)} images | ${t.q}`);pass++;
 }catch(e){console.error(`FAIL ${t.condition} | ${t.q} | ${e.message}`);fail++}
}
console.log(`live smoke: ${pass} passed, ${fail} failed; ${totalCars} cars; ${totalImages} exact-page images`);if(fail>0)process.exit(1);
