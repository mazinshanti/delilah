import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v15Port = Number(process.env.DELILAH_V15_PORT || 4000);
const MAX_RESULTS = 200;
const SEARCH_TIMEOUT = 9000;
const PAGE_TIMEOUT = 6500;
const SEARCH_CACHE_MS = 10 * 60_000;
const EXACT_CACHE_MS = 10 * 60_000;

process.env.PORT = String(v15Port);
await import("./server-v15.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const searchCache = new Map();
const exactCache = new Map();
let braveTail = Promise.resolve(), braveLastAt = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function canonical(v = "") { const u = safeUrl(v); if (!u) return v; u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k); return u.href; }
function decodeHtml(s = "") { return String(s).replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"); }
function strip(s = "") { return decodeHtml(String(s)).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function absolute(v, base) { try { return new URL(String(v || "").replace(/&amp;/g, "&"), base).href; } catch { return null; } }
function attr(tag, name) { return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] || null; }
function num(v, min = 0, max = Number.MAX_SAFE_INTEGER) { const n = Number(String(v || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n >= min && n <= max ? n : null; }
function titleWords(s = "") { return String(s).split(/[-_\s]+/).filter(Boolean).map(x => x ? x[0].toUpperCase() + x.slice(1) : x).join(" "); }
function imageOkay(url = "") { const u = safeUrl(url); return !!u && !/(logo|favicon|icon|placeholder|sprite|social|share|banner|brandmark|default[-_]?image|discount|coupon|avatar|profile|app-store|google-play)/i.test(u.href); }
function meta(html, key) { return new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i").exec(html)?.[1] || null; }
function bestImage(html, base) {
  const out = [];
  for (const k of ["og:image", "twitter:image"]) { const u = absolute(meta(html, k), base); if (u && imageOkay(u)) out.push(u); }
  for (const m of String(html).matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    for (const k of ["src", "data-src", "data-lazy-src", "data-original", "data-image"]) { const u = absolute(attr(tag, k), base); if (u && imageOkay(u)) out.push(u); }
    const ss = attr(tag, "srcset") || attr(tag, "data-srcset"); if (ss) for (const p of ss.split(",")) { const u = absolute(p.trim().split(/\s+/)[0], base); if (u && imageOkay(u)) out.push(u); }
  }
  return out.find(Boolean) || null;
}
function cityOf(text = "") {
  const t = norm(text);
  if (/riyadh|الرياض/.test(t)) return "Riyadh"; if (/jeddah|جده/.test(t)) return "Jeddah"; if (/dammam|الدمام/.test(t)) return "Dammam";
  if (/khobar|الخبر/.test(t)) return "Khobar"; if (/makkah|mecca|مكه/.test(t)) return "Makkah"; if (/madinah|medina|المدينه/.test(t)) return "Madinah";
  if (/taif|الطائف/.test(t)) return "Taif"; if (/jubail|الجبيل/.test(t)) return "Jubail"; return null;
}
function yearOf(text = "") { const m = digits(text).match(/\b(20\d{2})\b/); const y = m ? Number(m[1]) : null; return y && y >= 2000 && y <= 2035 ? y : null; }
function mileageOf(text = "") { const m = digits(text).match(/([0-9][\d,]{0,8})\s*(?:KM|km|kms|كيلو|كم)/i); return m ? num(m[1], 0, 1_500_000) : null; }
function priceOf(text = "") {
  const t = digits(text);
  const pats = [
    /(?:Current\s+Price\s*)?(?:SAR|ريال(?:\s+سعودي)?)\s*([0-9][\d,]{2,9})/i,
    /(?:Price\s*[:：]?\s*)?([0-9][\d,]{2,9})\s*(?:SAR|ريال(?:\s+سعودي)?)/i,
    /السعر\s*[:：]?\s*([0-9][\d,]{2,9})\s*ريال/i
  ];
  for (const p of pats) { const m = t.match(p); if (m) { const n = num(m[1], 1000, 5_000_000); if (n) return n; } }
  return null;
}
function conditionText(text = "") { const t = norm(text); if (/\bused\b|مستعمل|مستعمله|مستعملة/.test(t)) return "used"; if (/\bnew\b|\bbrand new\b|جديد|جديده|جديدة/.test(t)) return "new"; return null; }
function sellerOf(text = "", fallback = "") {
  const t = strip(text); const m = t.match(/(?:Seller Details\s+(?:Dealer:\s*)?|Dealer:\s*|Seller\s+)(.{2,100}?)(?:\s+Address:|\s+Member Since|\s+Show Phone|\s+Phone|$)/i);
  return (m?.[1] || fallback).trim().slice(0, 120) || fallback;
}

const SOURCES = [
  {
    name: "Saudi Sale", seller: "Saudi Sale", mode: "public-search+exact", conditions: ["new", "used"],
    direct(url) { const u = safeUrl(url); return !!u && (u.hostname === "cars.saudisale.com" || u.hostname.endsWith(".saudisale.com")) && /^\/(?:en\/)?listings\/[A-Za-z0-9_-]{4,20}\/[^/]+\/?$/i.test(u.pathname); },
    condition() { return null; },
    identity(url) { const u = safeUrl(url), slug = u?.pathname.split("/").filter(Boolean).at(-1) || ""; const bits = slug.split("-").filter(Boolean); if (/^20\d{2}$/.test(bits[0])) bits.shift(); return { brand: bits[0] ? titleWords(bits[0]) : null, model: bits.length > 1 ? titleWords(bits.slice(1).join(" ")) : null }; }
  },
  {
    name: "YallaMotor", seller: "YallaMotor", mode: "public-search-only", conditions: ["new", "used"],
    direct(url) { const u = safeUrl(url); return !!u && (u.hostname === "ksa.yallamotor.com" || u.hostname.endsWith(".yallamotor.com")) && /^\/used-cars\/[^/]+\/[^/]+\/20\d{2}\/(?:used|new)-[^/]+-\d+\/?$/i.test(u.pathname); },
    condition(url) { return /\/new-/i.test(safeUrl(url)?.pathname || "") ? "new" : /\/used-/i.test(safeUrl(url)?.pathname || "") ? "used" : null; },
    identity(url) { const p = safeUrl(url)?.pathname.split("/").filter(Boolean) || []; return { brand: p[1] ? titleWords(p[1]) : null, model: p[2] ? titleWords(p[2]) : null }; }
  },
  {
    name: "ArabWheels", seller: "ArabWheels", mode: "public-search+exact", conditions: ["used"],
    direct(url) { const u = safeUrl(url); return !!u && (u.hostname === "www.arabwheels.sa" || u.hostname === "arabwheels.sa") && /^\/en\/used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(u.pathname); },
    condition() { return "used"; },
    identity(url) { const slug = (safeUrl(url)?.pathname.split("/").filter(Boolean).at(-1) || "").replace(/-for-sale-in-.+$/i, ""); const bits = slug.split("-").filter(Boolean); const yi = bits.findIndex(x => /^20\d{2}$|^19\d{2}$/.test(x)); const car = yi >= 0 ? bits.slice(0, yi) : bits; return { brand: car[0] ? titleWords(car[0]) : null, model: car.length > 1 ? titleWords(car.slice(1).join(" ")) : null }; }
  },
  {
    name: "Hatla2ee", seller: "Hatla2ee", mode: "public-search-only", conditions: ["new", "used"],
    direct(url) { const u = safeUrl(url); if (!u || !(u.hostname === "ksa.hatla2ee.com" || u.hostname.endsWith(".hatla2ee.com"))) return false; return /^\/en\/car\/[^/]+\/[^/]+\/\d+\/?$/i.test(u.pathname) || /^\/en\/new-car\/[^/]+\/[^/]+\/unit\/\d+\/?$/i.test(u.pathname); },
    condition(url) { return /^\/en\/new-car\//i.test(safeUrl(url)?.pathname || "") ? "new" : /^\/en\/car\//i.test(safeUrl(url)?.pathname || "") ? "used" : null; },
    identity(url) { const p = safeUrl(url)?.pathname.split("/").filter(Boolean) || []; return { brand: p[2] ? titleWords(p[2]) : null, model: p[3] ? titleWords(p[3]) : null }; }
  }
];

const STOP = new Set(norm("ابي ابغى أبغى اريد أريد سيارة سياره سيارات cars car vehicle vehicles used new مستعمل مستعملة مستعمله جديد جديده جديدة موديل model سنة سنه years year وفوق فوق واكثر وأكثر تحت اقل أقل من الى إلى في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام السعودية السعوديه saudi arabia ksa riyadh jeddah dammam under below less than above over more than around about budget ريال sar km كيلو كم").split(" "));
const AR_EN = new Map([
  ["رانجلر","wrangler"],["باترول","patrol"],["لاندكروزر","land cruiser"],["كامري","camry"],["كورولا","corolla"],["يارس","yaris"],["توسان","tucson"],["سبورتاج","sportage"],["تاهو","tahoe"],["سوناتا","sonata"],["اكسنت","accent"],["النترا","elantra"],["برادو","prado"],["فورتشنر","fortuner"],
  ["تويوتا","toyota"],["نيسان","nissan"],["جيب","jeep"],["هيونداي","hyundai"],["كيا","kia"],["فورد","ford"],["شفروليه","chevrolet"],["مرسيدس","mercedes"],["لكزس","lexus"],["بورش","porsche"],["مازدا","mazda"],["هوندا","honda"]
]);
function queryTerms(q = "") { const out = []; for (const raw of norm(q).split(" ")) { if (raw.length < 2 || STOP.has(raw) || /^\d+$/.test(raw)) continue; out.push(AR_EN.get(raw) || raw); } return [...new Set(out)].slice(0, 8); }
function intent(query = "", filters = {}) {
  const q = humanNumbers(query), nq = norm(q), ys = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1]));
  const p = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{4,7})/i), km = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  return { terms: queryTerms(q), minYear: Number(filters.minYear) || (ys.length ? Math.min(...ys) : null), maxYear: Number(filters.maxYear) || null, maxPrice: Number(filters.maxPrice) || (p ? Number(p[1]) : null), maxMileage: Number(filters.maxMileage) || (km ? Number(km[1]) : null), city: filters.city || cityOf(q) };
}
function sourceEnabled(s, condition, filters = {}) { if (!s.conditions.includes(condition)) return false; if (filters.sourceType && filters.sourceType !== "marketplace") return false; if (filters.seller && filters.seller !== s.name && filters.seller !== s.seller) return false; return true; }
function matchesCandidate(c, i, condition) {
  if (c.condition && c.condition !== condition) return false;
  const b = norm(`${c.title || ""} ${c.description || ""} ${c.brand || ""} ${c.model || ""}`), compact = b.replace(/\s+/g, "");
  if (i.terms.length && !i.terms.every(t => b.includes(t) || compact.includes(t.replace(/\s+/g, "")))) return false;
  if (i.minYear && c.year && c.year < i.minYear) return false; if (i.maxYear && c.year && c.year > i.maxYear) return false;
  if (i.maxPrice && c.price && c.price > i.maxPrice) return false; if (i.maxMileage && c.mileage != null && c.mileage > i.maxMileage) return false;
  if (i.city && c.city && c.city !== i.city) return false; return true;
}

async function brave(query) {
  const key = norm(query), hit = searchCache.get(key); if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.rows;
  const token = process.env.BRAVE_SEARCH_API_KEY || ""; if (!token) return [];
  const task = braveTail.then(async () => {
    const wait = Math.max(0, 1200 - (Date.now() - braveLastAt)); if (wait) await sleep(wait); braveLastAt = Date.now();
    const u = new URL("https://api.search.brave.com/res/v1/web/search"); u.searchParams.set("q", query); u.searchParams.set("country", "sa"); u.searchParams.set("count", "20");
    const c = new AbortController(), t = setTimeout(() => c.abort(), SEARCH_TIMEOUT);
    try { const r = await fetch(u.href, { signal: c.signal, headers: { Accept: "application/json", "X-Subscription-Token": token } }); if (!r.ok) return []; const d = await r.json(); return d.web?.results || []; }
    finally { clearTimeout(t); }
  });
  braveTail = task.catch(() => []); const rows = await task.catch(() => []); searchCache.set(key, { at: Date.now(), rows }); return rows;
}
function searchQueries(userQuery, enabled) {
  const q = humanNumbers(userQuery);
  const names = new Set(enabled.map(s => s.name)); const out = [];
  const a = []; if (names.has("Saudi Sale")) a.push("site:cars.saudisale.com/en/listings"); if (names.has("ArabWheels")) a.push("site:arabwheels.sa/en/used-cars");
  const b = []; if (names.has("YallaMotor")) b.push("site:ksa.yallamotor.com/used-cars"); if (names.has("Hatla2ee")) { b.push("site:ksa.hatla2ee.com/en/car"); b.push("site:ksa.hatla2ee.com/en/new-car"); }
  if (a.length) out.push(`${q} (${a.join(" OR ")})`); if (b.length) out.push(`${q} (${b.join(" OR ")})`); return out;
}
async function discover(body, condition, i) {
  const filters = body.filters || {}, enabled = SOURCES.filter(s => sourceEnabled(s, condition, filters)); if (!enabled.length) return [];
  const rows = (await Promise.all(searchQueries(String(body.query || ""), enabled).map(brave))).flat();
  const out = [], seen = new Set();
  for (const r of rows) {
    const url = canonical(r.url || ""); const s = enabled.find(x => x.direct(url)); if (!s || seen.has(url)) continue; seen.add(url);
    const id = s.identity(url), description = strip(`${r.title || ""} ${r.description || ""}`), c = { source: s, url, title: strip(r.title || ""), description, condition: s.condition(url) || conditionText(description), ...id, year: yearOf(`${url} ${description}`), mileage: mileageOf(description), city: cityOf(description), price: priceOf(description) };
    if (matchesCandidate(c, i, condition)) out.push(c);
  }
  return out.slice(0, 50);
}
async function fetchPage(url) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), PAGE_TIMEOUT);
  try { const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahSourceAdapter/1.0)", Accept: "text/html,application/xhtml+xml" } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); const ct = (r.headers.get("content-type") || "").toLowerCase(); if (!ct.includes("text/html")) throw new Error(`Unexpected content type ${ct}`); return { html: (await r.text()).slice(0, 3_000_000), url: r.url || url }; }
  finally { clearTimeout(t); }
}
async function exact(c, requested) {
  const hit = exactCache.get(c.url); if (hit && Date.now() - hit.at < EXACT_CACHE_MS) return hit.value;
  if (c.source.mode === "public-search-only") return null;
  try {
    const d = await fetchPage(c.url); if (!c.source.direct(d.url) && !c.source.direct(c.url)) return null;
    const text = strip(d.html).slice(0, 60000), h1 = strip(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(d.html)?.[1] || c.title), condition = c.source.condition(c.url) || conditionText(`${h1} ${text}`);
    if (!condition || condition !== requested) return null;
    const value = { title: h1 || c.title, text, condition, year: yearOf(`${h1} ${text}`) || c.year, mileage: mileageOf(text) ?? c.mileage, city: cityOf(text) || c.city, price: priceOf(text) ?? c.price, image: bestImage(d.html, d.url), seller: sellerOf(text, c.source.seller) };
    exactCache.set(c.url, { at: Date.now(), value }); return value;
  } catch { return null; }
}
function card(c, e, requested) {
  const condition = e?.condition || c.condition; if (condition !== requested) return null;
  const image = e?.image || null, price = e?.price ?? c.price ?? null, identity = c.source.identity(c.url);
  return { source: c.source.name, sourceType: "marketplace", seller: e?.seller || c.source.seller, sourceStrict: true, title: e?.title || c.title || `${identity.brand || ""} ${identity.model || ""}`.trim(), snippet: (e?.text || c.description || "").slice(0, 700), url: c.url, brand: identity.brand || c.brand || null, model: identity.model || c.model || null, year: e?.year || c.year || null, mileage: e?.mileage ?? c.mileage ?? null, city: e?.city || c.city || null, price, priceVerified: Boolean(e && e.price != null), priceSource: e && e.price != null ? `${c.source.name.toLowerCase().replace(/\s+/g, "_")}_listing_page` : null, condition, saleVerified: true, image, displayImage: image, imageVerified: Boolean(image), imageSource: image ? "listing_page" : null, score: e ? 92 : 84, discovery: "strict_source_search" };
}
async function pluginResults(body, condition, i) {
  if (body.phase === "fast") return [];
  const candidates = await discover(body, condition, i), out = [];
  for (let n = 0; n < candidates.length; n += 6) {
    const batch = candidates.slice(n, n + 6); const rs = await Promise.all(batch.map(async c => ({ c, e: await exact(c, condition) })));
    for (const { c, e } of rs) {
      if (c.source.mode === "public-search+exact" && !e) continue;
      const v = card(c, e, condition); if (v) out.push(v);
    }
  }
  return out;
}
function merge(a = [], b = [], max = MAX_RESULTS) { const out = [], seen = new Set(); for (const c of [...a, ...b]) { if (!c?.url) continue; const k = canonical(c.url).replace(/\/$/, ""); if (seen.has(k)) continue; seen.add(k); out.push(c); if (out.length >= max) break; } return out; }
function counts(xs = []) { return xs.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {}); }
async function upstream(body) { const r = await fetch(`http://127.0.0.1:${v15Port}/api/search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) }); const d = await r.json().catch(() => ({ error: `Upstream HTTP ${r.status}` })); return { r, d }; }

app.post("/api/search", async (req, res) => {
  const body = req.body || {}, condition = body.condition === "new" ? "new" : "used", filters = body.filters && typeof body.filters === "object" ? body.filters : {}, i = intent(String(body.query || ""), filters), fast = body.phase === "fast";
  try {
    if (fast) { const up = await upstream(body); return res.status(up.r.status).json(up.d); }
    const [upR, plugR] = await Promise.allSettled([upstream(body), pluginResults(body, condition, i)]);
    const plugins = plugR.status === "fulfilled" ? plugR.value : [];
    if (upR.status !== "fulfilled" || !upR.value.r.ok) {
      if (plugins.length) return res.json({ query: body.query, condition, intent: i, listings: plugins, counts: counts(plugins), live: true, phase: "full", fallback: "strict_source_search", sourcePluginsV16: true });
      if (upR.status === "fulfilled") return res.status(upR.value.r.status).json(upR.value.d);
      return res.status(502).json({ error: "Delilah upstream unavailable" });
    }
    const base = Array.isArray(upR.value.d.listings) ? upR.value.d.listings : [], listings = merge(base, plugins, MAX_RESULTS);
    return res.json({ ...upR.value.d, listings, counts: counts(listings), sourcePluginsV16: true, strictSearchPluginSources: SOURCES.map(s => s.name) });
  } catch (e) { return res.status(502).json({ error: e?.message || "Delilah source-plugin edge unavailable" }); }
});

app.get("/api/source-plugins", async (req, res) => {
  let v15 = null; try { const r = await fetch(`http://127.0.0.1:${v15Port}/api/seller-plugins`); if (r.ok) v15 = await r.json(); } catch {}
  res.json({ ok: true, version: "source-plugins-v16", strictSearchPlugins: SOURCES.map(s => ({ name: s.name, seller: s.seller, conditions: s.conditions, mode: s.mode })), inheritedSellerPlugins: v15?.plugins || [], boundaries: { exactIndividualUrlsOnly: true, antiBotBypass: false, unknownFieldsMayBeNull: true } });
});
app.get("/api/health", async (req, res) => { try { const r = await fetch(`http://127.0.0.1:${v15Port}/api/health`); const d = await r.json(); return res.json({ ...d, edge: "inventory-v16", strictSearchPlugins: SOURCES.map(s => s.name) }); } catch { return res.status(503).json({ ok: false, edge: "inventory-v16" }); } });
async function proxy(req, res) { try { const headers = {}; for (const [k, v] of Object.entries(req.headers)) if (!["host", "content-length", "connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v); let body; if (!["GET", "HEAD"].includes(req.method) && req.is("application/json")) { body = JSON.stringify(req.body || {}); headers["content-type"] = "application/json"; } const r = await fetch(`http://127.0.0.1:${v15Port}${req.originalUrl}`, { method: req.method, headers, body, redirect: "manual" }); const buf = Buffer.from(await r.arrayBuffer()); for (const [k, v] of r.headers.entries()) if (!["content-length", "transfer-encoding", "connection"].includes(k.toLowerCase())) res.setHeader(k, v); return res.status(r.status).send(buf); } catch { return res.status(502).json({ error: "Delilah upstream unavailable" }); } }
app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v16 strict seller sources running at http://localhost:${externalPort}`));
