const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const cases=[
  {q:'ابي رانجلر 2022 وفوق بالرياض تحت 130000',condition:'used',min:1},
  {q:'ابي باترول 2022 وفوق بالرياض تحت 170000',condition:'used',min:1},
  {q:'Toyota Camry Riyadh under 120000',condition:'used',min:1},
  {q:'Land Cruiser 2022 Riyadh',condition:'used'},
  {q:'BMW X5 Riyadh',condition:'used'},
  {q:'Mercedes C200 Riyadh',condition:'used'},
  {q:'Toyota Land Cruiser 2026 Riyadh',condition:'new'},
  {q:'Nissan Patrol 2026 Riyadh',condition:'new'},
  {q:'Ford Territory 2026 Saudi',condition:'new'},
  {q:'Kia Sportage 2026 Jeddah',condition:'new'}
];
const timeout=ms=>AbortSignal.timeout(ms);
let pass=0,fail=0,totalCars=0,totalImages=0,relayChecks=0,relayPass=0;
const health=await fetch(`${base}/api/health`,{signal:timeout(10000)});if(!health.ok)throw new Error(`health ${health.status}`);const h=await health.json();if(!h.ok||h.edge!=='inventory-v22'||h.progressiveSearch!==true||h.indexedExactFallback!==true||!Array.isArray(h.sourceNativeAdapters))throw new Error(`health config invalid: ${JSON.stringify(h)}`);console.log(`health ok; ${h.edge}; ${h.logic}`);
for(const t of cases){try{const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:t.q,condition:t.condition,filters:{},phase:'fast'}),signal:timeout(12000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);const d=await r.json();if(!Array.isArray(d.listings))throw new Error('listings not array');if(t.min&&d.listings.length<t.min)throw new Error(`expected at least ${t.min}, got ${d.listings.length}`);const urls=new Set();let images=0;for(const c of d.listings){if(!c.url||urls.has(c.url))throw new Error(`missing/duplicate url ${c.url}`);urls.add(c.url);if(c.saleVerified!==true)throw new Error(`unverified sale ${c.url}`);if(c.condition!==t.condition)throw new Error(`condition leak ${c.url}`);if(/\/(news|blog|article|reviews?|brochure|specifications?|press-release)(\/|$)/i.test(c.url))throw new Error(`informational page leaked ${c.url}`);if(c.image){if(c.imageVerified!==true)throw new Error(`unverified image ${c.url}`);images++;if(!relayChecks&&c.displayImage&&c.displayImage.startsWith('/api/image/')){relayChecks++;const ir=await fetch(`${base}${c.displayImage}`,{signal:timeout(20000)});if(!ir.ok)throw new Error(`image relay HTTP ${ir.status}`);const ct=(ir.headers.get('content-type')||'').toLowerCase();if(!ct.startsWith('image/'))throw new Error(`image relay non-image ${ct}`);relayPass++}}if(c.price!=null&&(!Number.isFinite(Number(c.price))||Number(c.price)<=0))throw new Error('invalid price');if(c.mileage!=null&&(!Number.isFinite(Number(c.mileage))||Number(c.mileage)<0))throw new Error('invalid mileage')}
 totalCars+=d.listings.length;totalImages+=images;console.log(`PASS ${t.condition.padEnd(4)} | ${String(d.listings.length).padStart(3)} cars | ${String(images).padStart(3)} images | ${t.q}`);pass++}catch(e){console.error(`FAIL ${t.condition} | ${t.q} | ${e.message}`);fail++}}
console.log(`live smoke: ${pass} passed, ${fail} failed; ${totalCars} cars; ${totalImages} verified images; relay ${relayPass}/${relayChecks}`);if(relayChecks===0){console.error('FAIL no embedded image relay was exercised');fail++}if(fail>0)process.exit(1);
