const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const cases=[
  ['Jeep Compass','Jeep','Compass'],
  ['Toyota Land Cruiser 2023 and above','Toyota','Land Cruiser'],
  ['BMW X5 under 180000','BMW','X5'],
  ['Mercedes-Benz GLE 450 2024','Mercedes Benz','GLE 450'],
  ['MG RX5 used','MG','RX5'],
  ['Changan CS75 Plus','Changan','CS75 Plus'],
  ['BYD Song Plus','BYD','Song Plus'],
  ['Tesla Model 3','Tesla','Model 3'],
  ['Polestar 2','Polestar','2'],
  ['VinFast VF8','VinFast','VF8'],
  ['Zeekr 001','Zeekr','001'],
  ['Alfa Romeo Giulia','Alfa Romeo','Giulia'],
  ['Rolls-Royce Cullinan','Rolls Royce','Cullinan'],
  ['Aston Martin DBX','Aston Martin','DBX'],
  ['Land Rover Defender 110','Land Rover','Defender 110'],
  ['GMC Sierra 1500','GMC','Sierra 1500'],
  ['RAM 1500','RAM','1500'],
  ['Peugeot 5008','Peugeot','5008'],
  ['Ford F-150','Ford','F 150'],
  ['Rimac Nevera','Rimac','Nevera'],
  ['ابي تويوتا كامري 2023 وفوق','Toyota','Camry'],
  ['ابي جيب رانجلر بالرياض','Jeep','Wrangler']
];
async function understand(q){const r=await fetch(`${base}/api/understand`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,condition:'used',filters:{}}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`${q}: HTTP ${r.status}`);return (await r.json()).understanding}
for(const [q,make,model] of cases){const u=await understand(q);if(u.make!==make||u.model!==model)throw new Error(`${q}: expected ${make}/${model}, got ${JSON.stringify(u)}`);if(u.universalIdentity!==true)throw new Error(`${q}: universal identity flag missing`);console.log(`PASS ${q} -> ${u.make} / ${u.model}`)}

async function search(q,seller='Syarah'){const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,condition:'used',filters:{seller},phase:'full'}),signal:AbortSignal.timeout(50000)});if(!r.ok)throw new Error(`${q}: search HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}
function n(s=''){return String(s).toLowerCase().replace(/[-_]+/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
for(const [q,make,model] of [['Jeep Compass','Jeep','Compass'],['MG RX5','MG','RX5'],['Toyota Camry','Toyota','Camry']]){
  const d=await search(q);if(d.understanding?.make!==make||d.understanding?.model!==model)throw new Error(`${q}: wrong live understanding ${JSON.stringify(d.understanding)}`);
  for(const c of d.listings||[]){const e=n(`${c.title||''} ${decodeURIComponent(c.url||'')}`),m=n(make),mo=n(model);if(!e.includes(m)||!e.includes(mo))throw new Error(`${q}: cross-identity result leaked ${c.title} ${c.url}`);if(c.source==='Syarah'&&c.price!=null&&c.priceSource!=='syarah_original_pre_discount_price')throw new Error(`${q}: non-original Syarah price ${c.priceSource}`)}
  console.log(`PASS LIVE ${q}: ${(d.listings||[]).length} exact-identity listings`)
}
console.log(`PASS universal identity matrix: ${cases.length} parser cases + 3 live identity searches`);
