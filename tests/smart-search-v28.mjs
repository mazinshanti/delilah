const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const timeout=ms=>AbortSignal.timeout(ms);
async function json(path,opts={},ms=15000){const r=await fetch(`${base}${path}`,{...opts,signal:timeout(ms)});const text=await r.text();let d;try{d=JSON.parse(text)}catch{throw new Error(`${path} non-JSON ${r.status}: ${text.slice(0,180)}`)}if(!r.ok)throw new Error(`${path} HTTP ${r.status}: ${JSON.stringify(d).slice(0,250)}`);return d}
async function understand(query){return json('/api/understand',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition:'used',filters:{}})},12000)}

const h=await json('/api/health',{},10000);
for(const k of ['smartSearchBar','sourceAwareSearch','sourceBrowse','universalTypoCorrection','numericModelProtection','similarOfferings','vehicleHistoryIntegration'])if(h[k]!==true)throw new Error(`health missing ${k}: ${JSON.stringify(h)}`);
if(h.edge!=='product-v30')throw new Error(`expected product-v30, got ${h.edge}`);
console.log('PASS v30 health flags');

const chrysler=await understand('كلزلر 300');
const cu=chrysler.understanding||{};
if((cu.make||cu.brand)!=='Chrysler'||String(cu.model)!=='300')throw new Error(`Arabic Chrysler typo failed: ${JSON.stringify(cu)}`);
if(!(chrysler.typoCorrections||[]).some(x=>x.to==='Chrysler'))throw new Error(`Chrysler correction not surfaced: ${JSON.stringify(chrysler.typoCorrections)}`);
console.log('PASS كلزلر -> Chrysler 300');

const vxr=await understand('تويوتا لاند كروزر فكسر بالرياض');
const vu=vxr.understanding||{};
if((vu.make||vu.brand)!=='Toyota'||!/Land Cruiser/i.test(String(vu.model||''))||!/VXR/i.test(String(vu.model||''))||vu.city!=='Riyadh')throw new Error(`VXR normalization failed: ${JSON.stringify(vu)}`);
if(!(vxr.typoCorrections||[]).some(x=>x.to==='VXR'))throw new Error(`VXR correction not surfaced: ${JSON.stringify(vxr.typoCorrections)}`);
console.log('PASS فكسر -> VXR + Riyadh');

const numeric=await understand('Changan CS75 Plus');
const nu=numeric.understanding||{};
if((nu.make||nu.brand)!=='Changan'||String(nu.model)!=='CS75 Plus')throw new Error(`Numeric model protection failed: ${JSON.stringify(nu)}`);
if((numeric.typoCorrections||[]).some(x=>x.to==='CS35'))throw new Error(`CS75 incorrectly corrected to CS35: ${JSON.stringify(numeric.typoCorrections)}`);
console.log('PASS numeric model protection CS75 != CS35');

const sourceIntent=await understand('show me all results from haraj');
if(sourceIntent.sourceFilter!=='Haraj'||sourceIntent.understanding?.source!=='Haraj'||sourceIntent.understanding?.sourceOnly!==true)throw new Error(`Haraj source intent failed: ${JSON.stringify(sourceIntent)}`);
console.log('PASS natural source-only intent -> Haraj');

const search=await json('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Toyota Camry from Haraj',condition:'used',filters:{},phase:'fast'})},22000);
if(search.sourceFilter!=='Haraj')throw new Error(`search lost source filter: ${JSON.stringify(search.understanding)}`);
if((search.listings||[]).some(c=>c.source!=='Haraj'))throw new Error(`source leakage: ${JSON.stringify((search.listings||[]).map(c=>c.source))}`);
console.log(`PASS Haraj-only result gate (${(search.listings||[]).length} fast listings)`);

const browse=await json('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'show me all results from Haraj',condition:'used',filters:{},phase:'fast'})},30000);
if(browse.sourceFilter!=='Haraj'||browse.understanding?.sourceOnly!==true)throw new Error(`source browse state invalid: ${JSON.stringify(browse.understanding)}`);
if((browse.listings||[]).some(c=>c.source!=='Haraj'))throw new Error('source browse leaked another source');
console.log(`PASS Haraj source browse (${(browse.listings||[]).length} accessible listings)`);

const providers=await json('/api/history-providers');
if(!Array.isArray(providers.providers)||providers.providers.length<3)throw new Error('history providers missing');
for(const id of ['mojaz','opensooq-reports','ua'])if(!providers.providers.some(p=>p.id===id&&/^https:\/\//.test(p.url)))throw new Error(`history provider missing ${id}`);
console.log('PASS history provider integrations');

const root=await fetch(`${base}/`,{signal:timeout(10000)}).then(r=>r.text());
if(!root.includes('/hotfix-v28.js'))throw new Error('smart frontend injection missing');
const ui=await fetch(`${base}/hotfix-v28.js`,{signal:timeout(10000)}).then(r=>r.text());
for(const needle of ['Browse by brand','Search by source','Similar offerings','Check vehicle history'])if(!ui.includes(needle))throw new Error(`frontend missing ${needle}`);
console.log('PASS brand/source/similar/history UI wiring');

const u=search.understanding||{};
const sim=await json('/api/similar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({understanding:u,condition:'used',source:'Haraj',excludeUrls:(search.listings||[]).map(c=>c.url)})},22000);
if(!Array.isArray(sim.listings)||sim.similar!==true)throw new Error(`similar endpoint invalid: ${JSON.stringify(sim).slice(0,300)}`);
if(sim.listings.some(c=>c.source!=='Haraj'))throw new Error('similar source leakage');
console.log(`PASS similar offerings endpoint (${sim.listings.length})`);
