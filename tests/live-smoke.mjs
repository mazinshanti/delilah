const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const cases=[
  {q:'ابي رانجلر 2022 وفوق بالرياض تحت 130000',condition:'used',min:1},
  {q:'ابي باترول 2022 وفوق بالرياض تحت 170000',condition:'used',min:1},
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
  {q:'Kia Pegas 2023 Saudi',condition:'used',filters:{seller:'Syarah'},min:1},
  {q:'Jetour X70 2026 Riyadh',condition:'new',filters:{seller:'Motory'},min:1},
  {q:'Hyundai Sonata 2026 Saudi',condition:'new',filters:{seller:'Saleh Cars'},min:1}
];
const timeout=ms=>AbortSignal.timeout(ms);
let pass=0,fail=0,totalCars=0,totalImages=0,relayChecks=0,relayPass=0;
const health=await fetch(`${base}/api/health`,{signal:timeout(20000)});
if(!health.ok)throw new Error(`health ${health.status}`);
const h=await health.json();
if(!h.ok||!h.search)throw new Error(`health config invalid: ${JSON.stringify(h)}`);
if(!String(h.logic||'').startsWith('inventory-v5'))throw new Error(`expected inventory-v5, got ${h.logic}`);
console.log(`health ok; ${h.sources} sources; ${h.logic}; max ${h.maxResults}; ${h.images}`);

for(const t of cases){
 try{
  const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:t.q,condition:t.condition,filters:t.filters||{}}),signal:timeout(140000)});
  if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);
  const d=await r.json();
  if(!Array.isArray(d.listings))throw new Error('listings not array');
  if(t.min&&d.listings.length<t.min)throw new Error(`expected at least ${t.min} listings, got ${d.listings.length}; raw=${d.rawCandidates||0}`);
  const urls=new Set();let images=0;let checkedRelay=false;
  for(const c of d.listings){
   if(!c.url)throw new Error('listing missing url');
   if(urls.has(c.url))throw new Error('duplicate url');urls.add(c.url);
   if(c.saleVerified!==true)throw new Error(`unverified sale result: ${c.url}`);
   if(c.condition!==t.condition)throw new Error(`condition leak ${c.condition}`);
   if(/\/(news|blog|article|reviews?|brochure|specifications?|press-release)(\/|$)/i.test(c.url))throw new Error(`informational page leaked: ${c.url}`);
   if(c.source==='Haraj'&&!/^https:\/\/(?:www\.)?haraj\.com\.sa\/\d{7,}(?:\/|$)/i.test(c.url))throw new Error(`bad Haraj url ${c.url}`);
   if(c.source==='Syarah'&&!/^https:\/\/(?:www\.)?syarah\.com\/(?:en\/|ar\/)?cardetail\/[^/]+-\d+\/?$/i.test(c.url))throw new Error(`bad Syarah listing url ${c.url}`);
   if(c.source==='Motory'&&!/^https:\/\/ksa\.motory\.com\/en\/cars-for-sale\/(?:[^/]+-haraj\/)?[^/]+\/[^/]+\/20\d{2}\/\d+\/?$/i.test(c.url))throw new Error(`bad Motory listing url ${c.url}`);
   if(c.source==='Saleh Cars'&&!/^https:\/\/(?:www\.)?salehcars\.com\/(?:en\/)?cars\/[a-f0-9]{20,32}\/[^/]+\/?$/i.test(c.url))throw new Error(`bad Saleh listing url ${c.url}`);
   if(c.image){
    if(c.imageVerified!==true||!['listing_page','source_catalog'].includes(c.imageSource))throw new Error(`unverified image: ${c.url}`);
    if(!/^https?:\/\//i.test(c.image))throw new Error(`bad source image url: ${c.image}`);
    if(/logo|favicon|placeholder|sprite|brandmark|social[-_]?share/i.test(c.image))throw new Error(`generic image leaked: ${c.image}`);
    images++;
    if(!checkedRelay&&c.displayImage&&c.displayImage.startsWith('/api/image/')){
      checkedRelay=true;relayChecks++;
      const ir=await fetch(`${base}${c.displayImage}`,{signal:timeout(25000)});
      if(!ir.ok)throw new Error(`image relay HTTP ${ir.status} for ${c.source}`);
      const ct=(ir.headers.get('content-type')||'').toLowerCase();
      if(!ct.startsWith('image/'))throw new Error(`image relay non-image ${ct}`);
      const buf=await ir.arrayBuffer();if(buf.byteLength<500)throw new Error('image relay returned tiny payload');relayPass++;
    }
   }
   if(c.price!=null&&(!Number.isFinite(Number(c.price))||Number(c.price)<=0))throw new Error('invalid price');
   if(c.mileage!=null&&(!Number.isFinite(Number(c.mileage))||Number(c.mileage)<0))throw new Error('invalid mileage');
  }
  totalCars+=d.listings.length;totalImages+=images;
  console.log(`PASS ${t.condition.padEnd(4)} | ${String(d.listings.length).padStart(2)} cars | ${String(images).padStart(2)} images | raw ${String(d.rawCandidates||0).padStart(3)} | ${t.filters?.seller||'all'} | ${t.q}`);pass++;
 }catch(e){console.error(`FAIL ${t.condition} | ${t.q} | ${e.message}`);fail++}
}
console.log(`live smoke: ${pass} passed, ${fail} failed; ${totalCars} cars; ${totalImages} verified images; relay ${relayPass}/${relayChecks}`);
if(relayChecks===0){console.error('FAIL no embedded image relay was exercised');fail++;}
if(fail>0)process.exit(1);
