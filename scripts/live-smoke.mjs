const targets = {
  production: process.env.DALELAH_PROD_URL || 'https://delilah-pm5f.onrender.com',
  candidate: process.env.DALELAH_CANDIDATE_URL || 'https://dalelah-sell-preview.onrender.com',
  custom: process.env.DALELAH_CUSTOM_URL || 'https://www.dalelah.co',
  mobileStatic: process.env.DALELAH_MOBILE_STATIC_URL || 'https://dalelah-mobile-preview.onrender.com'
};

const results = [];
const now = () => new Date().toISOString();
const timeout = (ms=25000) => AbortSignal.timeout(ms);

function record(name, ok, detail='') {
  results.push({name, ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function getText(url, ms=25000) {
  const r = await fetch(url, {signal: timeout(ms), redirect:'follow'});
  const text = await r.text();
  return {r,text};
}

async function getJson(url, ms=25000) {
  const r = await fetch(url, {signal: timeout(ms), redirect:'follow'});
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return {r,text,data};
}

async function postJson(url, body, ms=60000, headers={}) {
  const r = await fetch(url, {
    method:'POST',
    headers:{'content-type':'application/json', ...headers},
    body:JSON.stringify(body),
    signal:timeout(ms),
    redirect:'follow'
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return {r,text,data};
}

function listingYear(car={}) {
  const direct = Number(car.year);
  if (Number.isInteger(direct) && direct >= 1900 && direct <= 2100) return direct;
  const text = [car.title,car.snippet,car.url].filter(Boolean).join(' ');
  const m = text.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

async function collectSearch(base, query, condition='used') {
  const first = await postJson(`${base}/api/search`, {query,condition,filters:{}}, 65000);
  if (!first.r.ok || !first.data) return {ok:false,status:first.r.status,error:first.data?.error || first.text.slice(0,200),listings:[]};
  let data = first.data;
  const by = new Map();
  const merge = xs => (Array.isArray(xs)?xs:[]).forEach(car => {
    const key = car?.url || car?.originalUrl || car?.id || JSON.stringify([car?.title,car?.price]);
    if (key) by.set(key, car);
  });
  merge(data.listings);
  if (data.searchId) {
    for (let i=0;i<12 && data.complete!==true;i++) {
      await new Promise(r=>setTimeout(r,750));
      const p = await getJson(`${base}/api/search/progress/${encodeURIComponent(data.searchId)}`, 35000).catch(e=>({r:{ok:false,status:0},data:{error:e.message}}));
      if (!p.r?.ok || !p.data) break;
      data = p.data;
      merge(data.listings);
    }
  }
  return {ok:true,status:first.r.status,data,listings:[...by.values()]};
}

async function checkSite(label, base) {
  try {
    const home = await getText(`${base}/`, 30000);
    record(`${label} homepage`, home.r.ok && /Dalelah/i.test(home.text), `HTTP ${home.r.status}; ${home.text.length} bytes`);
  } catch (e) { record(`${label} homepage`, false, e.message); }

  try {
    const health = await getJson(`${base}/api/health`, 30000);
    record(`${label} health`, health.r.ok && health.data?.productVersion === '1.5', `HTTP ${health.r.status}; version=${health.data?.productVersion||'n/a'}; sha=${health.data?.renderGitCommit||'n/a'}`);
  } catch (e) { record(`${label} health`, false, e.message); }
}

async function checkExact(base, query, year, min=1, label='') {
  try {
    const s = await collectSearch(base, query, 'used');
    if (!s.ok) return record(`${label||query} search`, false, `HTTP ${s.status}; ${s.error}`);
    const years = s.listings.map(listingYear).filter(Boolean);
    const wrong = years.filter(y=>y!==year);
    const ok = s.listings.length >= min && wrong.length === 0;
    record(`${label||query} search`, ok, `${s.listings.length} listings; wrongYears=${wrong.slice(0,8).join(',')||'0'}; complete=${s.data?.complete===true}`);
  } catch (e) { record(`${label||query} search`, false, e.message); }
}

console.log(`Dalelah live smoke started ${now()}`);
console.log(JSON.stringify(targets,null,2));

await checkSite('production', targets.production);
await checkSite('candidate', targets.candidate);
await checkSite('custom-domain', targets.custom);
await checkExact(targets.production, 'Corolla 2013', 2013, 1, 'production Corolla 2013');
await checkExact(targets.candidate, 'Corolla 2013', 2013, 1, 'candidate Corolla 2013');
await checkExact(targets.candidate, 'Patrol 2020', 2020, 1, 'candidate Patrol 2020');

try {
  const n = await collectSearch(targets.candidate, 'Toyota Corolla 2026', 'new');
  record('candidate New Corolla 2026', n.ok && n.listings.length >= 1, `${n.listings.length} listings; HTTP ${n.status}; complete=${n.data?.complete===true}`);
} catch (e) { record('candidate New Corolla 2026', false, e.message); }

try {
  const mobile = await getText(`${targets.candidate}/mobile`, 30000);
  record('same-origin mobile preview', mobile.r.ok && /Dalelah Mobile Preview/i.test(mobile.text) && /fetch\('\/api\/search'/.test(mobile.text), `HTTP ${mobile.r.status}; ${mobile.text.length} bytes`);
} catch (e) { record('same-origin mobile preview', false, e.message); }

try {
  const sell = await getText(`${targets.candidate}/sell`, 30000);
  record('Sell page', sell.r.ok && /Dalelah Sell/i.test(sell.text), `HTTP ${sell.r.status}; ${sell.text.length} bytes`);
} catch (e) { record('Sell page', false, e.message); }

try {
  const est = await postJson(`${targets.candidate}/api/sell/estimate`, {make:'Toyota',model:'Camry',year:2022,mileage:54000}, 90000);
  record('Sell valuation API', est.r.ok && est.data?.ok===true && est.data?.valuation, `HTTP ${est.r.status}; comps=${est.data?.valuation?.comparableCount ?? 'n/a'}; available=${est.data?.valuation?.available ?? 'n/a'}`);
} catch (e) { record('Sell valuation API', false, e.message); }

try {
  const origin='https://dalelah-mobile-preview.onrender.com';
  const r=await fetch(`${targets.candidate}/api/marketplace/status`,{headers:{Origin:origin},signal:timeout(25000)});
  record('candidate browser CORS', r.ok && r.headers.get('access-control-allow-origin')===origin, `HTTP ${r.status}; ACAO=${r.headers.get('access-control-allow-origin')||'none'}`);
} catch (e) { record('candidate browser CORS', false, e.message); }

try {
  const staticMobile = await getText(`${targets.mobileStatic}/`, 30000);
  record('Expo web preview shell', staticMobile.r.ok, `HTTP ${staticMobile.r.status}; ${staticMobile.text.length} bytes`);
} catch (e) { record('Expo web preview shell', false, e.message); }

const failed = results.filter(x=>!x.ok);
console.log('\n=== DALELAH LIVE SMOKE SUMMARY ===');
console.log(JSON.stringify({at:now(),total:results.length,passed:results.length-failed.length,failed:failed.length,results},null,2));
if (failed.length) process.exitCode = 1;
