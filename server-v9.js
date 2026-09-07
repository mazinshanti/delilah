import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v8Port = Number(process.env.DELILAH_V8_PORT || 3300);
const v7Port = Number(process.env.DELILAH_V7_PORT_V9 || 3301);
const v6Port = Number(process.env.DELILAH_V6_PORT_V9 || 3302);
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";
const FAST_LIMIT = 12;
const FAST_DEADLINE = 4800;
const FAST_CACHE_TTL = 5 * 60_000;
const fastCache = new Map();
let fastBraveTail = Promise.resolve();
let fastBraveLastAt = 0;

process.env.PORT = String(v8Port);
process.env.DELILAH_V7_PORT = String(v7Port);
process.env.DELILAH_V6_PORT = String(v6Port);
await import("./server-v8.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const norm = s => digits(s).toLowerCase();
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
  ["elantra","Elantra"],["النترا","Elantra"],["prado","Prado"],["برادو","Prado"],["fortuner","Fortuner"],["فورتشنر","Fortuner"]
];
const MODEL_BRAND = {Wrangler:"Jeep",Patrol:"Nissan","Land Cruiser":"Toyota",Camry:"Toyota",Corolla:"Toyota",Yaris:"Toyota",Sunny:"Nissan",X5:"BMW",C200:"Mercedes",Tucson:"Hyundai",Sportage:"Kia",Territory:"Ford",Tahoe:"Chevrolet",Sonata:"Hyundai",Accent:"Hyundai",Elantra:"Hyundai",Prado:"Toyota",Fortuner:"Toyota"};
function firstAlias(text, list) { const t = norm(text); for (const [k,v] of list) if (t.includes(k)) return v; return null; }
function intentFromFast(query, filters = {}) {
  const q = normalizeHumanNumbers(query);
  const model = firstAlias(q, MODEL_ALIASES);
  const brand = firstAlias(q, BRAND_ALIASES) || MODEL_BRAND[model] || null;
  const years = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => +x[1]);
  const p = norm(q).match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{4,7})/i);
  const km = norm(q).match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  return {
    brand,
    model,
    minYear: +filters.minYear || (years.length ? Math.min(...years) : null),
    maxYear: +filters.maxYear || null,
    maxPrice: +filters.maxPrice || (p ? +p[1] : null),
    maxMileage: +filters.maxMileage || (km ? +km[1] : null),
    city: filters.city || null
  };
}
function directSyarah(url, requested) {
  try {
    const u = new URL(url);
    if (!(u.hostname === "syarah.com" || u.hostname.endsWith(".syarah.com"))) return false;
    const m = u.pathname.match(/^\/(?:(?:en|ar)\/)?cardetail\/([^/]+)-(used|new)-(\d+)\/?$/i);
    return m && (!requested || m[2].toLowerCase() === requested);
  } catch { return false; }
}
function conditionFromUrl(url) {
  try { return /-(used|new)-\d+\/?$/i.exec(new URL(url).pathname)?.[1]?.toLowerCase() || null; } catch { return null; }
}
function cashPrice(text = "") {
  const t = digits(String(text));
  const m = t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i)
    || t.match(/السعر\s*النقدي[^0-9]{0,30}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}
function parseIndexedResult(r, intent, requested) {
  const url = String(r?.url || "");
  if (!directSyarah(url, requested)) return null;
  const text = digits([r.title, r.description, ...(Array.isArray(r.extra_snippets) ? r.extra_snippets : [])].filter(Boolean).join(" "));
  const path = (() => { try { return decodeURIComponent(new URL(url).pathname); } catch { return ""; } })();
  const all = `${text} ${path}`;
  const brand = firstAlias(all, BRAND_ALIASES) || intent.brand;
  const model = firstAlias(all, MODEL_ALIASES) || intent.model;
  const y = all.match(/\b(20\d{2})\b/);
  const km = all.match(/([0-9][\d,]{0,8})\s*(?:KM|KiloMeters?|كم|كيلو)/i);
  const year = y ? +y[1] : null;
  const mileage = km ? +km[1].replace(/,/g, "") : null;
  const price = cashPrice(all);
  if (intent.brand && brand !== intent.brand) return null;
  if (intent.model && model !== intent.model) return null;
  if (intent.minYear && (!year || year < intent.minYear)) return null;
  if (intent.maxYear && (!year || year > intent.maxYear)) return null;
  if (intent.maxPrice && (!price || price > intent.maxPrice)) return null;
  if (intent.maxMileage && (mileage == null || mileage > intent.maxMileage)) return null;
  return {
    source: "Syarah",
    sourceType: "marketplace",
    seller: "Syarah",
    sourceStrict: true,
    title: r.title || [year, brand, model].filter(Boolean).join(" ") || "Syarah car",
    snippet: r.description || "Open the original Syarah listing for full details.",
    url,
    brand,
    model,
    year,
    mileage,
    city: null,
    price,
    priceVerified: Boolean(price),
    priceSource: price ? "syarah_cash_price_index" : null,
    condition: conditionFromUrl(url),
    saleVerified: true,
    image: null,
    displayImage: null,
    imageVerified: false,
    imageSource: null,
    score: 82
  };
}
function fastCompatible(filters = {}) {
  if (filters.seller && filters.seller !== "Syarah") return false;
  if (filters.sourceType && filters.sourceType !== "marketplace") return false;
  return true;
}
async function braveNow(query, signal) {
  if (!braveKey) return [];
  const u = new URL("https://api.search.brave.com/res/v1/web/search");
  u.searchParams.set("q", query);
  u.searchParams.set("country", "SA");
  u.searchParams.set("count", "20");
  u.searchParams.set("text_decorations", "false");
  const r = await fetch(u, { signal, headers: { Accept: "application/json", "X-Subscription-Token": braveKey } });
  if (!r.ok) throw new Error(`Fast index HTTP ${r.status}`);
  const d = await r.json();
  return d.web?.results || [];
}
function braveFast(query, signal) {
  const job = fastBraveTail.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - fastBraveLastAt));
    if (wait) await new Promise(r => setTimeout(r, wait));
    const rows = await braveNow(query, signal);
    fastBraveLastAt = Date.now();
    return rows;
  });
  fastBraveTail = job.catch(() => {});
  return job;
}
async function fastViaIndex(body = {}) {
  const query = String(body.query || "").trim();
  if (!query) throw Object.assign(new Error("Query is required"), { status: 400 });
  const condition = body.condition === "new" ? "new" : "used";
  const filters = body.filters && typeof body.filters === "object" ? { ...body.filters } : {};
  if (!fastCompatible(filters)) return { query, condition, listings: [], counts: {}, live: true, partial: true, phase: "fast", provider: "Delilah v9 fast lane", fastSkipped: true };

  const normalizedQuery = normalizeHumanNumbers(query);
  const intent = intentFromFast(normalizedQuery, filters);
  const key = JSON.stringify({ q: normalizedQuery.toLowerCase(), condition, filters });
  const hit = fastCache.get(key);
  if (hit && Date.now() - hit.at < FAST_CACHE_TTL) return { ...hit.value, cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAST_DEADLINE);
  try {
    const core = [intent.brand, intent.model, intent.minYear].filter(Boolean).join(" ") || normalizedQuery;
    let rows = await braveFast(`${core} ${condition} site:syarah.com/en/cardetail`, controller.signal);
    let listings = rows.map(r => parseIndexedResult(r, intent, condition)).filter(Boolean);
    if (!listings.length && !controller.signal.aborted) {
      rows = await braveFast(`${core} site:syarah.com/en/cardetail`, controller.signal);
      listings = rows.map(r => parseIndexedResult(r, intent, condition)).filter(Boolean);
    }
    const seen = new Set();
    listings = listings.filter(c => { const k = c.url.replace(/\/$/, ""); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, FAST_LIMIT);
    const value = {
      query,
      condition,
      intent,
      listings,
      counts: counts(listings),
      answer: listings.length ? `Found ${listings.length} verified cars quickly. Scanning the rest of the Saudi market…` : "Fast index checked. Scanning the wider Saudi market…",
      live: true,
      cached: false,
      partial: true,
      phase: "fast",
      provider: "Delilah v9 fast lane — indexed strict direct listings"
    };
    fastCache.set(key, { at: Date.now(), value });
    for (const [k, v] of fastCache) if (Date.now() - v.at > FAST_CACHE_TTL) fastCache.delete(k);
    return value;
  } finally { clearTimeout(timer); }
}

async function proxy(req, res) {
  const target = `http://127.0.0.1:${v8Port}${req.originalUrl}`;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!["host", "content-length", "connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v);
  let body;
  if (!["GET", "HEAD"].includes(req.method) && req.is("application/json")) { body = JSON.stringify(req.body || {}); headers["content-type"] = "application/json"; }
  try {
    const r = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!["content-length", "transfer-encoding", "connection"].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch (e) {
    console.error("v9 proxy error", e);
    return res.status(502).json({ error: "Delilah upstream unavailable" });
  }
}

app.post("/api/search", async (req, res, next) => {
  if (req.body?.phase !== "fast") return next();
  const started = Date.now();
  try {
    const data = await fastViaIndex(req.body);
    data.elapsedMs = Date.now() - started;
    return res.json(data);
  } catch (e) {
    const timedOut = e?.name === "AbortError";
    return res.status(timedOut ? 504 : (e.status || 500)).json({ error: timedOut ? "Fast lane deadline reached" : (e.message || "Fast search failed"), partial: true, phase: "fast", elapsedMs: Date.now() - started });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const r = await fetch(`http://127.0.0.1:${v8Port}/api/health`);
    const d = await r.json();
    res.json({ ...d, edge: "inventory-v9", fastLane: "index-first", fastDeadlineMs: FAST_DEADLINE });
  } catch { res.status(503).json({ ok: false, edge: "inventory-v9" }); }
});

app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v9 running at http://localhost:${externalPort}`));
