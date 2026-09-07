import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v8Port = Number(process.env.DELILAH_V8_PORT || 3300);
const v7Port = Number(process.env.DELILAH_V7_PORT_V9 || 3301);
const v6Port = Number(process.env.DELILAH_V6_PORT_V9 || 3302);
const FAST_LIMIT = 12;
const FAST_CACHE_TTL = 5 * 60_000;
const FAST_INDEX_MAX = 5000;
const WARM_TIMEOUT = 12_000;
const WARM_ATTEMPTS = 3;
const FAILED_RETRY_TTL = 5_000;
const fastCache = new Map();
const inventoryIndex = new Map();
const warmState = new Map();
let warmTail = Promise.resolve();

process.env.PORT = String(v8Port);
process.env.DELILAH_V7_PORT = String(v7Port);
process.env.DELILAH_V6_PORT = String(v6Port);
await import("./server-v8.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const norm = s => digits(s).toLowerCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function normalizeHumanNumbers(query = "") {
  let q = digits(query);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}
function counts(listings = []) {
  return listings.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {});
}

const BRAND_ALIASES = [
  ["toyota","Toyota"],["تويوتا","Toyota"],["jeep","Jeep"],["جيب","Jeep"],["nissan","Nissan"],["نيسان","Nissan"],
  ["hyundai","Hyundai"],["هيونداي","Hyundai"],["kia","Kia"],["كيا","Kia"],["ford","Ford"],["فورد","Ford"],
  ["chevrolet","Chevrolet"],["شفروليه","Chevrolet"],["bmw","BMW"],["بي ام","BMW"],["mercedes","Mercedes"],["مرسيدس","Mercedes"],
  ["lexus","Lexus"],["لكزس","Lexus"],["porsche","Porsche"],["بورش","Porsche"],["volkswagen","Volkswagen"],["فولكس","Volkswagen"]
];
const MODEL_ALIASES = [
  ["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"],["wrangler","Wrangler"],["رانجلر","Wrangler"],
  ["patrol","Patrol"],["باترول","Patrol"],["camry","Camry"],["كامري","Camry"],["corolla","Corolla"],["كورولا","Corolla"],
  ["yaris","Yaris"],["يارس","Yaris"],["sunny","Sunny"],["صني","Sunny"],["x5","X5"],["c200","C200"],
  ["tucson","Tucson"],["توسان","Tucson"],["sportage","Sportage"],["سبورتاج","Sportage"],["territory","Territory"],["تيريتوري","Territory"],
  ["tahoe","Tahoe"],["تاهو","Tahoe"],["sonata","Sonata"],["سوناتا","Sonata"],["accent","Accent"],["اكسنت","Accent"],
  ["elantra","Elantra"],["النترا","Elantra"],["prado","Prado"],["برادو","Prado"],["fortuner","Fortuner"],["فورتشنر","Fortuner"],
  ["explorer","Explorer"],["اكسبلورر","Explorer"],["expedition","Expedition"],["grand cherokee","Grand Cherokee"],["جراند شيروكي","Grand Cherokee"],
  ["cayenne","Cayenne"],["كايين","Cayenne"],["tiguan","Tiguan"],["تيجوان","Tiguan"],["pegas","Pegas"],["بيجاس","Pegas"],
  ["cerato","Cerato"],["سيراتو","Cerato"],["sorento","Sorento"],["سورينتو","Sorento"],["k5","K5"]
];
const MODEL_BRAND = {Wrangler:"Jeep",Patrol:"Nissan","Land Cruiser":"Toyota",Camry:"Toyota",Corolla:"Toyota",Yaris:"Toyota",Sunny:"Nissan",X5:"BMW",C200:"Mercedes",Tucson:"Hyundai",Sportage:"Kia",Territory:"Ford",Tahoe:"Chevrolet",Sonata:"Hyundai",Accent:"Hyundai",Elantra:"Hyundai",Prado:"Toyota",Fortuner:"Toyota",Explorer:"Ford",Expedition:"Ford","Grand Cherokee":"Jeep",Cayenne:"Porsche",Tiguan:"Volkswagen",Pegas:"Kia",Cerato:"Kia",Sorento:"Kia",K5:"Kia"};
function firstAlias(text, list) { const t = norm(text); for (const [k,v] of list) if (t.includes(k)) return v; return null; }
function intentFromFast(query, filters = {}) {
  const q = normalizeHumanNumbers(query);
  const model = firstAlias(q, MODEL_ALIASES);
  const brand = firstAlias(q, BRAND_ALIASES) || MODEL_BRAND[model] || null;
  const years = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => +x[1]);
  const p = norm(q).match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{4,7})/i);
  const km = norm(q).match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  let city = filters.city || null;
  if (!city) {
    const nq = norm(q);
    if (/riyadh|الرياض/.test(nq)) city = "Riyadh";
    else if (/jeddah|جدة/.test(nq)) city = "Jeddah";
    else if (/dammam|الدمام/.test(nq)) city = "Dammam";
  }
  return {brand,model,minYear:+filters.minYear||(years.length?Math.min(...years):null),maxYear:+filters.maxYear||null,maxPrice:+filters.maxPrice||(p?+p[1]:null),maxMileage:+filters.maxMileage||(km?+km[1]:null),city};
}
function directSyarah(url, requested) {
  try {
    const u = new URL(url);
    if (!(u.hostname === "syarah.com" || u.hostname.endsWith(".syarah.com"))) return false;
    const m = u.pathname.match(/^\/(?:(?:en|ar)\/)?cardetail\/([^/]+)-(used|new)-(\d+)\/?$/i);
    return Boolean(m && (!requested || m[2].toLowerCase() === requested));
  } catch { return false; }
}
function cashPrice(text = "") {
  const t = digits(String(text));
  const m = t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i)
    || t.match(/السعر\s*النقدي[^0-9]{0,30}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}
function indexSafeListing(car) {
  if (!car || car.saleVerified !== true || car.source !== "Syarah" || !directSyarah(car.url, car.condition)) return null;
  const c = { ...car };
  const exactCash = c.priceVerified === true && c.priceSource === "syarah_cash_price" ? Number(c.price) : cashPrice(`${c.title||""} ${c.snippet||""}`);
  c.price = Number.isFinite(exactCash) && exactCash >= 1000 ? exactCash : null;
  c.priceVerified = Boolean(c.price);
  c.priceSource = c.price ? (car.priceSource === "syarah_cash_price" ? "syarah_cash_price" : "syarah_cash_price_fast") : null;
  delete c.previousPrice;
  delete c.discount;
  if (!c.imageVerified) { c.image = null; c.displayImage = null; c.imageSource = null; }
  return c;
}
function ingest(listings = []) {
  let added = 0;
  for (const raw of listings) {
    const c = indexSafeListing(raw);
    if (!c) continue;
    const key = String(c.url).replace(/\/$/, "");
    const old = inventoryIndex.get(key);
    inventoryIndex.set(key, old ? {...old,...c,_indexedAt:Date.now()} : {...c,_indexedAt:Date.now()});
    added++;
  }
  while (inventoryIndex.size > FAST_INDEX_MAX) inventoryIndex.delete(inventoryIndex.keys().next().value);
  return added;
}
function matchesFast(c, intent, condition) {
  if (!c || c.condition !== condition || c.saleVerified !== true) return false;
  if (intent.brand && c.brand !== intent.brand) return false;
  if (intent.model && c.model !== intent.model) return false;
  if (intent.minYear && (!c.year || c.year < intent.minYear)) return false;
  if (intent.maxYear && (!c.year || c.year > intent.maxYear)) return false;
  if (intent.maxPrice && (!c.price || c.price > intent.maxPrice)) return false;
  if (intent.maxMileage && (c.mileage == null || c.mileage > intent.maxMileage)) return false;
  if (intent.city && c.city && c.city !== intent.city) return false;
  return true;
}
function localResults(intent, condition) {
  if (!intent.brand && !intent.model) return [];
  return [...inventoryIndex.values()]
    .filter(c => matchesFast(c, intent, condition))
    .sort((a,b) => (b.score||0)-(a.score||0) || (b._indexedAt||0)-(a._indexedAt||0))
    .slice(0, FAST_LIMIT)
    .map(({_indexedAt,...c}) => c);
}
function fastCompatible(filters = {}) {
  if (filters.seller && filters.seller !== "Syarah") return false;
  if (filters.sourceType && filters.sourceType !== "marketplace") return false;
  return true;
}
function warmKey(query, condition) { return `${condition}|${normalizeHumanNumbers(query).toLowerCase()}`; }
async function fetchWarmOnce(query, condition) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WARM_TIMEOUT);
  try {
    const r = await fetch(`http://127.0.0.1:${v6Port}/api/search`, {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({query:normalizeHumanNumbers(query),condition,filters:{seller:"Syarah"}}),
      signal: controller.signal
    });
    if (!r.ok) throw new Error(`warm HTTP ${r.status}`);
    const d = await r.json();
    return ingest(d.listings || []);
  } finally { clearTimeout(timer); }
}
async function warmOne(query, condition = "used") {
  const key = warmKey(query, condition);
  const state = warmState.get(key);
  if (state?.running) return state.promise;
  if (state?.at && state.count > 0 && Date.now()-state.at < FAST_CACHE_TTL) return state.count;
  if (state?.at && !state.count && Date.now()-state.at < FAILED_RETRY_TTL) return 0;
  const task = (async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= WARM_ATTEMPTS; attempt++) {
      try {
        const count = await fetchWarmOnce(query, condition);
        if (count > 0) {
          warmState.set(key,{running:false,at:Date.now(),count,attempt});
          console.log(`v9 warm ${condition} ${query}: ${count} indexed, total ${inventoryIndex.size}, attempt ${attempt}`);
          return count;
        }
        lastError = "no matching cars";
      } catch (e) {
        lastError = e?.message || String(e);
        console.warn(`v9 warm attempt ${attempt} failed ${condition} ${query}:`,lastError);
      }
      if (attempt < WARM_ATTEMPTS) await sleep(2000 * attempt);
    }
    warmState.set(key,{running:false,at:Date.now(),count:0,error:lastError,attempt:WARM_ATTEMPTS});
    console.warn(`v9 warm failed ${condition} ${query}:`,lastError);
    return 0;
  })();
  warmState.set(key,{running:true,promise:task,at:state?.at||0,count:state?.count||0});
  return task;
}
function enqueueWarm(query, condition) {
  warmTail = warmTail.then(() => warmOne(query,condition)).catch(() => 0);
  return warmTail;
}
async function warmPopular() {
  await warmOne("Toyota Camry","used");
  const rest = [
    ["Nissan Patrol","used"],["Toyota Land Cruiser","used"],["Jeep Wrangler","used"],
    ["Hyundai Tucson","used"],["Kia Sportage","used"],["Mercedes C200","used"],["BMW X5","used"],
    ["Toyota Land Cruiser 2026","new"],["Nissan Patrol 2026","new"],["Ford Territory 2026","new"],
    ["Kia Sportage 2026","new"],["Hyundai Tucson 2025","new"],["Chevrolet Tahoe 2026","new"]
  ];
  for (const [q,c] of rest) await warmOne(q,c);
}
async function fastFromLocal(body = {}) {
  const query = String(body.query||"").trim();
  if (!query) throw Object.assign(new Error("Query is required"),{status:400});
  const condition = body.condition === "new" ? "new" : "used";
  const filters = body.filters && typeof body.filters === "object" ? {...body.filters} : {};
  const normalizedQuery = normalizeHumanNumbers(query);
  const intent = intentFromFast(normalizedQuery,filters);
  if (!fastCompatible(filters)) return {query,condition,intent,listings:[],counts:{},live:true,partial:true,phase:"fast",provider:"Delilah v9 warm index",fastSkipped:true,indexSize:inventoryIndex.size};
  const key = JSON.stringify({q:normalizedQuery.toLowerCase(),condition,filters});
  const cached = fastCache.get(key);
  if (cached && Date.now()-cached.at < FAST_CACHE_TTL) return {...cached.value,cached:true,indexSize:inventoryIndex.size};
  const listings = localResults(intent,condition);
  enqueueWarm(normalizedQuery,condition);
  const value = {query,condition,intent,listings,counts:counts(listings),answer:listings.length?`Found ${listings.length} verified cars instantly. Scanning the rest of the Saudi market…`:"Building this live inventory while the wider Saudi market search continues…",live:true,cached:false,partial:true,phase:"fast",provider:"Delilah v9 warm local inventory index",indexSize:inventoryIndex.size};
  fastCache.set(key,{at:Date.now(),value});
  return value;
}

async function proxy(req,res) {
  const target = `http://127.0.0.1:${v8Port}${req.originalUrl}`;
  const headers = {};
  for (const [k,v] of Object.entries(req.headers)) if (!["host","content-length","connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v)?v.join(","):String(v);
  let body;
  if (!["GET","HEAD"].includes(req.method) && req.is("application/json")) { body=JSON.stringify(req.body||{}); headers["content-type"]="application/json"; }
  try {
    const r = await fetch(target,{method:req.method,headers,body,redirect:"manual"});
    const ct = r.headers.get("content-type") || "";
    if (req.path === "/api/search" && ct.includes("application/json")) {
      const d = await r.json();
      if (Array.isArray(d.listings)) ingest(d.listings);
      return res.status(r.status).json(d);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k,v] of r.headers.entries()) if (!["content-length","transfer-encoding","connection"].includes(k.toLowerCase())) res.setHeader(k,v);
    return res.status(r.status).send(buf);
  } catch (e) {
    console.error("v9 proxy error",e);
    return res.status(502).json({error:"Delilah upstream unavailable"});
  }
}

app.post("/api/search",async(req,res,next)=>{
  if (req.body?.phase !== "fast") return next();
  const started=Date.now();
  try {
    const data=await fastFromLocal(req.body);
    data.elapsedMs=Date.now()-started;
    return res.json(data);
  } catch(e) {
    return res.status(e.status||500).json({error:e.message||"Fast search failed",partial:true,phase:"fast",elapsedMs:Date.now()-started});
  }
});
app.get("/api/fast-index",(req,res)=>res.json({ok:true,size:inventoryIndex.size,warm:[...warmState.entries()].map(([key,v])=>({key,running:Boolean(v.running),at:v.at||null,count:v.count||0,error:v.error||null,attempt:v.attempt||null}))}));
app.get("/api/health",async(req,res)=>{
  try { const r=await fetch(`http://127.0.0.1:${v8Port}/api/health`); const d=await r.json(); res.json({...d,edge:"inventory-v9",fastLane:"warm-local-index",fastIndex:inventoryIndex.size}); }
  catch { res.status(503).json({ok:false,edge:"inventory-v9",fastIndex:inventoryIndex.size}); }
});
app.use(proxy);
const server=app.listen(externalPort,()=>{
  console.log(`Delilah inventory-v9 running at http://localhost:${externalPort}`);
  setTimeout(()=>warmPopular().catch(e=>console.warn("v9 popular warm failed",e?.message||e)),1200);
  setInterval(()=>warmOne("Toyota Camry","used").catch(()=>{}),60_000).unref();
});
server.keepAliveTimeout=65_000;
