import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v16Port = Number(process.env.DELILAH_V16_PORT || 4100);
const REFRESH_MS = 20 * 60_000;
const FETCH_TIMEOUT = 7000;
const MAX_RESULTS = 200;

process.env.PORT = String(v16Port);
await import("./server-v16.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const genesis = new Map();
let genesisRefreshing = false;
let genesisLastRefreshStarted = null;
let genesisLastRefreshFinished = null;
let genesisLastRefreshError = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function norm(s = "") {
  return digits(s).toLowerCase().normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
}
function decodeHtml(s = "") {
  return String(s).replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function strip(s = "") {
  return decodeHtml(String(s)).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function absolute(v, b) { try { return new URL(String(v || "").replace(/&amp;/g, "&"), b).href; } catch { return null; } }
function directGenesis(url = "") {
  const u = safeUrl(url);
  if (!u || !(u.hostname === "genesiswallan.com" || u.hostname.endsWith(".genesiswallan.com"))) return false;
  return /^\/en\/inventory\/20\d{2}-[a-z0-9-]+$/i.test(u.pathname.replace(/\/$/, ""));
}
function canonical(url = "") {
  const u = safeUrl(url); if (!u) return url;
  u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  u.pathname = u.pathname.replace(/\/$/, ""); return u.href;
}
function number(v, min = 0, max = 5_000_000) {
  const n = Number(String(v || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function titleFrom(html = "", url = "") {
  const h = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const t = h ? strip(h) : strip(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").replace(/\s*\|\s*Genesis Certified.*$/i, "");
  if (t) return t.slice(0, 180);
  const slug = safeUrl(url)?.pathname.split("/").filter(Boolean).at(-1) || "Genesis";
  return slug.replace(/^20\d{2}-/, "").replace(/-[a-z]{0,3}\d{5,}$/i, "").split("-").map(x => x ? x[0].toUpperCase() + x.slice(1) : x).join(" ");
}
function yearFrom(text = "", url = "") {
  const m = `${url} ${text}`.match(/\b(20\d{2})\b/); const y = m ? Number(m[1]) : null;
  return y && y >= 2000 && y <= 2035 ? y : null;
}
function priceFrom(text = "") {
  const t = digits(text);
  const m = t.match(/TOTAL\s+PURCHASE\s+PRICE\*?\s*([0-9][\d,]*)\s*(?:VAT\s*incl\.?|SAR|ريال)?/i)
    || t.match(/(?:Now|Price)\s*([0-9][\d,]*)\s*(?:VAT\s*incl\.?|SAR|ريال)/i);
  return m ? number(m[1], 1000, 5_000_000) : null;
}
function mileageFrom(text = "") {
  const t = digits(text); if (/Mileage\s+Not available/i.test(t)) return null;
  const m = t.match(/Mileage\s*([0-9][\d,]*)\s*(?:km|KM)/i) || t.match(/([0-9][\d,]*)\s*(?:km|KM)\b/i);
  return m ? number(m[1], 0, 1_500_000) : null;
}
function modelFrom(title = "") {
  return String(title).replace(/^20\d{2}\s+/, "").replace(/\s+(?:2\.5T|3\.5T|3\.3T|Prestige|Royal|Platinum|Sport|AWD|RWD|FWD).*$/i, "").trim() || null;
}
async function fetchHtml(url) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahInventoryIndexer/3.0)", Accept: "text/html,application/xhtml+xml" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = (r.headers.get("content-type") || "").toLowerCase(); if (!ct.includes("text/html")) throw new Error(`Unexpected content type ${ct}`);
    return { html: (await r.text()).slice(0, 3_000_000), url: r.url || url };
  } finally { clearTimeout(t); }
}
function inventoryLinks(html, base) {
  const out = new Set();
  for (const m of String(html).matchAll(/href=["']([^"']+)["']/gi)) {
    const u = absolute(m[1], base); if (u && directGenesis(u)) out.add(canonical(u));
  }
  return [...out];
}
async function detail(url) {
  const d = await fetchHtml(url), text = strip(d.html), title = titleFrom(d.html, d.url), price = priceFrom(text), mileage = mileageFrom(text), year = yearFrom(text, d.url);
  // Genesis Wallan explicitly warns on vehicle pages that displayed gallery pictures may not show the actual vehicle.
  // Delilah therefore intentionally exposes no listing image for this adapter rather than a potentially wrong photo.
  return {
    url: canonical(d.url), source: "Genesis Wallan Certified", sourceType: "certified_used", seller: "Genesis Wallan Certified",
    sourceStrict: true, title, snippet: text.slice(0, 700), brand: "Genesis", model: modelFrom(title), year, mileage, city: "Riyadh",
    price, priceVerified: Boolean(price), priceSource: price ? "genesis_total_purchase_price" : null,
    condition: "used", saleVerified: true, image: null, displayImage: null, imageVerified: false, imageSource: null,
    score: Math.min(96, 82 + (price ? 5 : 0) + (year ? 3 : 0) + (mileage != null ? 2 : 0)), discovery: "genesis_certified_inventory"
  };
}
async function refreshGenesis() {
  if (genesisRefreshing) return;
  genesisRefreshing = true; genesisLastRefreshStarted = new Date().toISOString(); genesisLastRefreshError = null;
  try {
    const pages = ["https://genesiswallan.com/en/inventory", "https://genesiswallan.com/en"];
    const links = new Set();
    for (const p of pages) {
      try { const d = await fetchHtml(p); for (const u of inventoryLinks(d.html, d.url)) links.add(u); }
      catch (e) { genesisLastRefreshError = `${p}: ${e?.message || e}`; }
    }
    const all = [...links].slice(0, 80); let k = 0;
    async function worker() {
      for (;;) { const i = k++; if (i >= all.length) return; const u = all[i]; try { const c = await detail(u); genesis.set(c.url, { ...c, indexedAt: Date.now() }); } catch (e) { genesisLastRefreshError = `${u}: ${e?.message || e}`; } }
    }
    await Promise.all(Array.from({ length: Math.min(6, all.length || 1) }, worker));
    genesisLastRefreshFinished = new Date().toISOString();
  } finally { genesisRefreshing = false; }
}

const STOP = new Set(norm("ابي ابغى أبغى اريد أريد سيارة سياره سيارات cars car vehicle vehicles used new مستعمل مستعملة مستعمله جديد جديده جديدة موديل model سنة سنه years year وفوق فوق واكثر وأكثر تحت اقل أقل من الى إلى في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام السعودية السعوديه saudi arabia ksa riyadh jeddah dammam under below less than above over more than around about budget ريال sar km كيلو كم").split(" "));
const AR = new Map([["جينيسيس","genesis"],["جينيسس","genesis"]]);
function terms(q = "") { return [...new Set(norm(q).split(" ").filter(x => x.length >= 2 && !STOP.has(x) && !/^\d+$/.test(x)).map(x => AR.get(x) || x))].slice(0, 8); }
function filtersFrom(body = {}) {
  const f = body.filters && typeof body.filters === "object" ? body.filters : {}, q = digits(String(body.query || ""));
  const ys = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1]));
  const p = norm(q).match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{4,7})/i);
  const km = norm(q).match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  return { terms: terms(q), minYear: Number(f.minYear) || (ys.length ? Math.min(...ys) : null), maxYear: Number(f.maxYear) || null, maxPrice: Number(f.maxPrice) || (p ? Number(p[1]) : null), maxMileage: Number(f.maxMileage) || (km ? Number(km[1]) : null), city: f.city || null, seller: f.seller || null, sourceType: f.sourceType || null };
}
function genesisResults(body = {}) {
  if (body.condition === "new") return [];
  const f = filtersFrom(body);
  if (f.seller && f.seller !== "Genesis Wallan Certified") return [];
  if (f.sourceType && f.sourceType !== "certified_used") return [];
  const out = [];
  for (const c of genesis.values()) {
    const b = norm(`${c.brand} ${c.model} ${c.title}`);
    if (f.terms.length && !f.terms.every(t => b.includes(t))) continue;
    if (f.minYear && c.year && c.year < f.minYear) continue; if (f.maxYear && c.year && c.year > f.maxYear) continue;
    if (f.maxPrice && c.price && c.price > f.maxPrice) continue; if (f.maxMileage && c.mileage != null && c.mileage > f.maxMileage) continue;
    if (f.city && f.city !== "Riyadh") continue;
    out.push(c);
  }
  return out.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.indexedAt || 0) - (a.indexedAt || 0)).slice(0, MAX_RESULTS).map(({ indexedAt, ...c }) => c);
}
function merge(a = [], b = [], max = MAX_RESULTS) { const out = [], seen = new Set(); for (const c of [...a, ...b]) { if (!c?.url) continue; const k = canonical(c.url); if (seen.has(k)) continue; seen.add(k); out.push(c); if (out.length >= max) break; } return out; }
function counts(xs = []) { return xs.reduce((a, c) => (a[c.source] = (a[c.source] || 0) + 1, a), {}); }
async function upstream(body) {
  const r = await fetch(`http://127.0.0.1:${v16Port}/api/search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({ error: `Upstream HTTP ${r.status}` })); return { r, d };
}

const PLUGINS = [
  ["Haraj","marketplace","active"],["Syarah","marketplace","active"],["Motory","marketplace","active-search"],["OpenSooq","marketplace","active-search"],["CarSwitch Saudi","marketplace","active"],["Carly","certified_used","active"],["Saleh Cars","independent_dealer","active"],["Key Used Cars","independent_dealer","active"],
  ["Saudi Sale","marketplace","active"],["YallaMotor","marketplace","active"],["ArabWheels","marketplace","active"],["Hatla2ee","marketplace","active"],
  ["Toyota ALJ","official_dealer","active"],["Lexus ALJ","official_dealer","active"],["Nissan Petromin","official_dealer","active"],["Ford Al Jazirah","official_dealer","active"],["Mercedes Juffali","official_dealer","active"],["BMW Naghi","official_dealer","active"],["Kia Aljabr","official_dealer","active"],["Porsche SAMACO","official_dealer","active"],["Volkswagen SAMACO","certified_used","active"],["Chevrolet Saudi Dealers","official_dealer","active"],
  ["Genesis Wallan Certified","certified_used","active-index"],
  ["Audi SAMACO","official_dealer","candidate-stock"],["Geely Wallan","official_dealer","candidate-buy-online"],["Hyundai Wallan","official_dealer","candidate"],["Hyundai Almajdouie","official_dealer","candidate"],["Hyundai Naghi","official_dealer","candidate"],["Honda Abdullah Hashim","official_dealer","candidate"],["Changan Almajdouie","official_dealer","candidate"],["Peugeot Almajdouie","official_dealer","candidate"],["Jetour KSA","official_dealer","candidate"],["Haval ADMC","official_dealer","candidate"],["GAC Aljomaih","official_dealer","candidate"]
].map(([name,type,status]) => ({ name, type, status }));

app.post("/api/search", async (req, res) => {
  const body = req.body || {}, add = genesisResults(body), fast = body.phase === "fast";
  try {
    const { r, d } = await upstream(body);
    if (!r.ok) { if (add.length) return res.json({ query: body.query, condition: body.condition === "new" ? "new" : "used", listings: add.slice(0, fast ? 18 : MAX_RESULTS), counts: counts(add), live: true, partial: fast, phase: fast ? "fast" : "full", fallback: "genesis_certified_inventory" }); return res.status(r.status).json(d); }
    const base = Array.isArray(d.listings) ? d.listings : [], listings = merge(base, add, fast ? 18 : MAX_RESULTS);
    return res.json({ ...d, listings, counts: counts(listings), genesisIndexed: genesis.size, sellerPlugins: PLUGINS.length });
  } catch (e) {
    if (add.length) return res.json({ query: body.query, condition: "used", listings: add.slice(0, fast ? 18 : MAX_RESULTS), counts: counts(add), live: true, partial: fast, phase: fast ? "fast" : "full", fallback: "genesis_certified_inventory" });
    return res.status(502).json({ error: e?.message || "Delilah upstream unavailable" });
  }
});
app.get("/api/source-plugins", (req, res) => res.json({ ok: true, total: PLUGINS.length, active: PLUGINS.filter(x => x.status.startsWith("active")).length, candidates: PLUGINS.filter(x => x.status.startsWith("candidate")).length, plugins: PLUGINS, genesisIndexed: genesis.size, genesisRefreshing, genesisLastRefreshStarted, genesisLastRefreshFinished, genesisLastRefreshError }));
app.get("/api/health", async (req, res) => { try { const r = await fetch(`http://127.0.0.1:${v16Port}/api/health`), d = await r.json(); res.json({ ...d, edge: "inventory-v17", genesisWallan: true, genesisIndexed: genesis.size, sellerPlugins: PLUGINS.length }); } catch { res.status(503).json({ ok: false, edge: "inventory-v17", genesisIndexed: genesis.size }); } });
async function proxy(req, res) {
  try { const headers = {}; for (const [k, v] of Object.entries(req.headers)) if (!["host","content-length","connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v); let body; if (!["GET","HEAD"].includes(req.method) && req.is("application/json")) { body = JSON.stringify(req.body || {}); headers["content-type"] = "application/json"; } const r = await fetch(`http://127.0.0.1:${v16Port}${req.originalUrl}`, { method: req.method, headers, body, redirect: "manual" }), buf = Buffer.from(await r.arrayBuffer()); for (const [k, v] of r.headers.entries()) if (!["content-length","transfer-encoding","connection"].includes(k.toLowerCase())) res.setHeader(k, v); return res.status(r.status).send(buf); }
  catch { return res.status(502).json({ error: "Delilah upstream unavailable" }); }
}
app.use(proxy);
app.listen(externalPort, () => {
  console.log(`Delilah inventory-v17 running at http://localhost:${externalPort}`);
  refreshGenesis().catch(() => {});
  setInterval(() => refreshGenesis().catch(() => {}), REFRESH_MS).unref();
});
