import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v17Port = Number(process.env.DELILAH_V17_PORT || 4200);
const MAX_ALL_RESULTS = 2000;
const UPSTREAM_CAP = 200;
const MAX_SCAN_CALLS = 8;
const CACHE_MS = 5 * 60_000;

process.env.PORT = String(v17Port);
await import("./server-v17.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));
const exhaustiveCache = new Map();

const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function humanNumbers(s = "") {
  let q = digits(s);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}
function norm(s = "") {
  return humanNumbers(s).toLowerCase().normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
}
const ALIAS = new Map([
  ["رانجلر","wrangler"],["باترول","patrol"],["لاندكروزر","land cruiser"],["كامري","camry"],["كورولا","corolla"],["يارس","yaris"],["صني","sunny"],["توسان","tucson"],["سبورتاج","sportage"],["تاهو","tahoe"],["سوناتا","sonata"],["اكسنت","accent"],["النترا","elantra"],["برادو","prado"],["فورتشنر","fortuner"],["جراند شيروكي","grand cherokee"],["اكسبلورر","explorer"],["كايين","cayenne"],["تيجوان","tiguan"],["بيجاس","pegas"],["سيراتو","cerato"],["سورينتو","sorento"],
  ["تويوتا","toyota"],["نيسان","nissan"],["جيب","jeep"],["هيونداي","hyundai"],["كيا","kia"],["فورد","ford"],["شفروليه","chevrolet"],["مرسيدس","mercedes"],["لكزس","lexus"],["بورش","porsche"],["فولكس","volkswagen"],["مازدا","mazda"],["هوندا","honda"],["ميتسوبيشي","mitsubishi"],["جيلي","geely"],["شانجان","changan"],["جيتور","jetour"],["هافال","haval"],["اودي","audi"],["جينيسيس","genesis"]
]);
const STOP = new Set(norm("ابي ابغى أبغى اريد أريد سيارة سياره سيارات car cars vehicle vehicles مستعمل مستعمله مستعملة used جديد جديده جديدة new موديل model سنة سنه year years وفوق واكثر وأكثر above over more than تحت اقل أقل under below less than من في الى إلى around about budget ريال sar كم كيلو km بالرياض الرياض riyadh بجدة بجده جدة جده jeddah بالدمام الدمام dammam السعودية السعوديه saudi arabia ksa").split(" "));
function coreQuery(query = "") {
  const raw = norm(query).split(" ");
  const out = [];
  for (const t of raw) {
    if (!t || STOP.has(t) || /^\d+(?:\.\d+)?$/.test(t)) continue;
    out.push(ALIAS.get(t) || t);
  }
  return [...new Set(out)].join(" ").trim();
}
function cityOf(s = "") { const t = norm(s); if (/\briyadh\b|الرياض/.test(t)) return "Riyadh"; if (/\bjeddah\b|جده/.test(t)) return "Jeddah"; if (/\bdammam\b|الدمام/.test(t)) return "Dammam"; return null; }
function intentFrom(body = {}) {
  const f = body.filters && typeof body.filters === "object" ? body.filters : {}, q = humanNumbers(String(body.query || "")), nq = norm(q);
  const ys = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1]));
  const km = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  const p = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{4,7})(?!\s*(?:km|كم|كيلو))/i);
  return {
    terms: coreQuery(q).split(" ").filter(Boolean),
    minYear: Number(f.minYear) || (ys.length ? Math.min(...ys) : null),
    maxYear: Number(f.maxYear) || null,
    maxPrice: Number(f.maxPrice) || (p ? Number(p[1]) : null),
    maxMileage: Number(f.maxMileage) || (km ? Number(km[1]) : null),
    city: f.city || cityOf(q), seller: f.seller || null, sourceType: f.sourceType || null
  };
}
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function canonical(v = "") { const u = safeUrl(v); if (!u) return v; u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k); return u.href.replace(/\/$/, ""); }
function listingMatches(c, i, condition) {
  if (!c || c.saleVerified !== true || c.condition !== condition || !safeUrl(c.url)) return false;
  const b = norm(`${c.brand || ""} ${c.model || ""} ${c.title || ""} ${c.trim || ""}`), compact = b.replace(/\s+/g, "");
  if (i.terms.length && !i.terms.every(t => b.includes(t) || compact.includes(t.replace(/\s+/g, "")))) return false;
  if (i.minYear && c.year && Number(c.year) < i.minYear) return false;
  if (i.maxYear && c.year && Number(c.year) > i.maxYear) return false;
  if (i.maxPrice && c.price && Number(c.price) > i.maxPrice) return false;
  if (i.maxMileage && c.mileage != null && Number(c.mileage) > i.maxMileage) return false;
  if (i.city && c.city && c.city !== i.city) return false;
  return true;
}
function mergeInto(map, listings = [], i, condition) {
  for (const c of listings) {
    if (!listingMatches(c, i, condition)) continue;
    const key = canonical(c.url); if (!map.has(key)) map.set(key, c);
    else {
      const old = map.get(key);
      map.set(key, { ...old, ...c, image: old.image || c.image || null, displayImage: old.displayImage || c.displayImage || null, price: old.price || c.price || null, imageVerified: Boolean(old.imageVerified || c.imageVerified), priceVerified: Boolean(old.priceVerified || c.priceVerified) });
    }
  }
}
function counts(xs = []) { return xs.reduce((a, c) => (a[c.source] = (a[c.source] || 0) + 1, a), {}); }
async function upstreamSearch(body, timeout = 90000) {
  const r = await fetch(`http://127.0.0.1:${v17Port}/api/search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(timeout) });
  const d = await r.json().catch(() => ({ error: `Upstream HTTP ${r.status}` }));
  if (!r.ok) throw new Error(d.error || `Upstream HTTP ${r.status}`);
  return d;
}
function discoveryFilters(body = {}, minYear = null, maxYear = null) {
  const f = body.filters && typeof body.filters === "object" ? body.filters : {}, out = {};
  if (f.seller) out.seller = f.seller;
  if (f.sourceType) out.sourceType = f.sourceType;
  if (minYear) out.minYear = minYear;
  if (maxYear) out.maxYear = maxYear;
  return out;
}
async function exhaustive(body) {
  const condition = body.condition === "new" ? "new" : "used", i = intentFrom(body), core = coreQuery(body.query) || String(body.query || "").trim();
  const key = JSON.stringify({ q: norm(body.query), condition, filters: body.filters || {} }), hit = exhaustiveCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.value, cached: true };
  const all = new Map(), diagnostics = [], currentYear = new Date().getFullYear(); let calls = 0, capHit = false;
  const call = async (query, filters, label) => {
    if (calls >= MAX_SCAN_CALLS) return null;
    calls++;
    try {
      const d = await upstreamSearch({ query, condition, filters, phase: "full" });
      const xs = Array.isArray(d.listings) ? d.listings : [];
      mergeInto(all, xs, i, condition);
      diagnostics.push({ label, returned: xs.length, kept: xs.filter(c => listingMatches(c, i, condition)).length });
      return d;
    } catch (e) { diagnostics.push({ label, error: e?.message || String(e) }); return null; }
  };

  await call(String(body.query || ""), body.filters || {}, "original");
  const broad = await call(core, discoveryFilters(body), "core");
  const broadCount = Array.isArray(broad?.listings) ? broad.listings.length : 0;

  if (broadCount >= UPSTREAM_CAP && calls < MAX_SCAN_CALLS) {
    const lo = Math.max(2000, i.minYear || 2000), hi = Math.min(currentYear + 1, i.maxYear || currentYear + 1), queue = [[lo, hi]];
    while (queue.length && calls < MAX_SCAN_CALLS) {
      const [a, b] = queue.shift();
      const d = await call(core, discoveryFilters(body, a, b), `years-${a}-${b}`);
      const n = Array.isArray(d?.listings) ? d.listings.length : 0;
      if (n >= UPSTREAM_CAP && a < b && calls < MAX_SCAN_CALLS) {
        const mid = Math.floor((a + b) / 2); queue.push([mid + 1, b], [a, mid]);
      } else if (n >= UPSTREAM_CAP && a === b) capHit = true;
    }
    if (queue.length) capHit = true;
  }

  const listings = [...all.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, MAX_ALL_RESULTS);
  if (all.size > MAX_ALL_RESULTS) capHit = true;
  const value = {
    query: body.query, condition, listings, counts: counts(listings), live: true, phase: "all", partial: false,
    exhaustive: true, exhaustiveCoreQuery: core, exhaustiveCalls: calls, exhaustiveDiagnostics: diagnostics,
    exhaustiveUnique: all.size, exhaustiveLimit: MAX_ALL_RESULTS, exhaustiveCapHit: capHit,
    answer: `${listings.length} verified ${condition} listings found in the exhaustive Saudi-market scan.`
  };
  exhaustiveCache.set(key, { at: Date.now(), value });
  return value;
}

app.post("/api/search", async (req, res) => {
  const body = req.body || {};
  if (body.phase === "full" || body.phase === "all") {
    try { const d = await exhaustive(body); return res.json({ ...d, phase: body.phase === "all" ? "all" : "full" }); }
    catch (e) { return res.status(502).json({ error: e?.message || "Exhaustive scan failed" }); }
  }
  try {
    const r = await fetch(`http://127.0.0.1:${v17Port}/api/search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(r.status); for (const [k, v] of r.headers.entries()) if (!["content-length","transfer-encoding","connection"].includes(k.toLowerCase())) res.setHeader(k, v); return res.send(buf);
  } catch (e) { return res.status(502).json({ error: e?.message || "Delilah upstream unavailable" }); }
});
app.get("/api/health", async (req, res) => {
  try { const r = await fetch(`http://127.0.0.1:${v17Port}/api/health`), d = await r.json(); res.json({ ...d, edge: "inventory-v18", exhaustiveSearch: true, exhaustiveMaxResults: MAX_ALL_RESULTS, exhaustiveMaxCalls: MAX_SCAN_CALLS }); }
  catch { res.status(503).json({ ok: false, edge: "inventory-v18" }); }
});
async function proxy(req, res) {
  try {
    const headers = {}; for (const [k, v] of Object.entries(req.headers)) if (!["host","content-length","connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v);
    let body; if (!["GET","HEAD"].includes(req.method) && req.is("application/json")) { body = JSON.stringify(req.body || {}); headers["content-type"] = "application/json"; }
    const r = await fetch(`http://127.0.0.1:${v17Port}${req.originalUrl}`, { method: req.method, headers, body, redirect: "manual" }), buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!["content-length","transfer-encoding","connection"].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch { return res.status(502).json({ error: "Delilah upstream unavailable" }); }
}
app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v18 running at http://localhost:${externalPort}`));
