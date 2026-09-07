import express from "express";
import crypto from "node:crypto";

const externalPort = Number(process.env.PORT || 3000);
const v10Port = Number(process.env.DELILAH_V10_PORT || 3500);
const MAX_PAGES_PER_LANGUAGE = 30;
const CATALOG_REFRESH_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 7000;
const MAX_FAST_RESULTS = 18;
const MAX_FULL_RESULTS = 200;
const catalog = new Map();
const imageRegistry = new Map();
let refreshRunning = false;
let lastRefreshStarted = null;
let lastRefreshFinished = null;
let lastRefreshError = null;
let pagesFetched = 0;

process.env.PORT = String(v10Port);
await import("./server-v10.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function humanNumbers(s = "") {
  let q = digits(s);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}
function norm(s = "") {
  return humanNumbers(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function absolute(v, base) { try { return new URL(String(v || "").replace(/&amp;/g, "&"), base).href; } catch { return null; } }
function decodeHtml(s = "") {
  return String(s)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function strip(s = "") {
  return decodeHtml(String(s))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function directSyarah(url) {
  try {
    const u = new URL(url);
    if (!(u.hostname === "syarah.com" || u.hostname.endsWith(".syarah.com"))) return null;
    const m = u.pathname.match(/^\/(?:(?:en|ar)\/)?cardetail\/([^/]+)-(used|new)-(\d+)\/?$/i);
    return m ? { slug: m[1], condition: m[2].toLowerCase(), id: m[3] } : null;
  } catch { return null; }
}
function canonicalSyarah(url) {
  const d = directSyarah(url);
  if (!d) return url;
  return `https://syarah.com/en/cardetail/${d.slug}-${d.condition}-${d.id}`;
}
function attr(tag, name) {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return m ? decodeHtml(m[1]) : null;
}
function imageOkay(url = "") {
  const u = safeUrl(url);
  if (!u) return false;
  const s = u.href.toLowerCase();
  return !/(logo|favicon|icon|placeholder|sprite|social|share|banner|brandmark|default[-_]?image)/.test(s);
}
function bestImage(segment, base) {
  const candidates = [];
  for (const m of String(segment).matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    for (const name of ["src", "data-src", "data-lazy-src", "data-original", "data-image"]) {
      const v = attr(tag, name), u = absolute(v, base);
      if (u && imageOkay(u)) candidates.push(u);
    }
    const srcset = attr(tag, "srcset") || attr(tag, "data-srcset");
    if (srcset) {
      for (const part of srcset.split(",")) {
        const v = part.trim().split(/\s+/)[0], u = absolute(v, base);
        if (u && imageOkay(u)) candidates.push(u);
      }
    }
  }
  return candidates.find(Boolean) || null;
}
function cashPrice(text = "") {
  const t = digits(String(text));
  const m = t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?[^0-9]{0,30}([0-9][\d,]*)\s*SAR/i)
    || t.match(/السعر\s*النقدي[^0-9]{0,40}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}
function mileageOf(text = "") {
  const t = digits(text);
  const m = t.match(/([0-9][\d,]{0,8})\s*(?:KM|KiloMeters?|كم|كيلو)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 && n <= 1_500_000 ? n : null;
}
function cityOf(text = "") {
  const t = norm(text);
  if (/\briyadh\b|الرياض/.test(t)) return "Riyadh";
  if (/\bjeddah\b|جده/.test(t)) return "Jeddah";
  if (/\bdammam\b|الدمام/.test(t)) return "Dammam";
  if (/\bkhobar\b|الخبر/.test(t)) return "Khobar";
  if (/\bmakkah\b|\bmecca\b|مكه/.test(t)) return "Makkah";
  if (/\bmadinah\b|\bmedina\b|المدينه/.test(t)) return "Madinah";
  return null;
}
function yearOf(text = "") {
  const m = digits(text).match(/\b(20\d{2})\b/);
  const y = m ? Number(m[1]) : null;
  return y && y >= 2000 && y <= 2035 ? y : null;
}
function slugWords(slug = "") {
  return slug.toLowerCase().split(/[-_]+/).filter(Boolean);
}
const MULTI_BRANDS = ["land-rover", "range-rover", "mercedes-benz", "alfa-romeo", "aston-martin", "great-wall", "rolls-royce"];
function identityFromSlug(slug = "") {
  const low = slug.toLowerCase();
  let brandSlug = MULTI_BRANDS.find(b => low === b || low.startsWith(`${b}-`));
  let words = slugWords(slug);
  let brandWords = brandSlug ? brandSlug.split("-") : words.slice(0, 1);
  let rest = words.slice(brandWords.length).filter(w => !/^20\d{2}$/.test(w));
  const title = x => x.map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
  return { brand: brandWords.length ? title(brandWords) : null, model: rest.length ? title(rest) : null };
}
function imageToken(url) {
  if (!url || !imageOkay(url)) return null;
  const token = crypto.createHash("sha256").update(url).digest("hex").slice(0, 28);
  imageRegistry.set(token, { url, at: Date.now() });
  return `/api/catalog-image/${token}`;
}
function cardCandidates(html, base, lang) {
  const matches = [];
  for (const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(m[1])?.[1];
    const url = absolute(href, base);
    const direct = directSyarah(url);
    if (direct) matches.push({ m, url, direct, index: m.index || 0 });
  }
  const out = [];
  for (let i = 0; i < matches.length; i++) {
    const r = matches[i];
    const next = matches[i + 1]?.index || Math.min(String(html).length, r.index + 7000);
    const segment = String(html).slice(r.index, Math.min(next, r.index + 7000));
    const anchorText = strip(r.m[2]);
    const context = strip(segment).slice(0, 2200);
    const text = `${anchorText} ${context}`.trim();
    const identity = identityFromSlug(r.direct.slug);
    const year = yearOf(`${r.direct.slug} ${text}`);
    const image = bestImage(segment, base);
    const price = cashPrice(text);
    out.push({
      key: `${r.direct.condition}:${r.direct.id}`,
      url: canonicalSyarah(r.url),
      condition: r.direct.condition,
      id: r.direct.id,
      slug: r.direct.slug,
      title: anchorText.length > 4 ? anchorText.slice(0, 500) : `${identity.brand || ""} ${identity.model || ""} ${year || ""}`.trim(),
      text,
      lang,
      brand: identity.brand,
      model: identity.model,
      year,
      mileage: mileageOf(text),
      city: cityOf(text),
      price,
      image
    });
  }
  return out;
}
async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahCatalogIndexer/1.0)", Accept: "text/html,application/xhtml+xml" }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html")) throw new Error(`Unexpected content type ${ct}`);
    return { html: (await r.text()).slice(0, 3_000_000), url: r.url || url };
  } finally { clearTimeout(timer); }
}
function mergeCard(c) {
  const old = catalog.get(c.key);
  const aliases = new Set([...(old?.aliases || []), c.text, c.title, c.slug].filter(Boolean));
  const image = old?.image || c.image || null;
  const price = old?.price || c.price || null;
  catalog.set(c.key, {
    ...old,
    ...c,
    url: old?.url || c.url,
    brand: old?.brand || c.brand,
    model: old?.model || c.model,
    year: old?.year || c.year,
    mileage: old?.mileage ?? c.mileage,
    city: old?.city || c.city,
    price,
    image,
    aliases: [...aliases].slice(-8),
    languages: [...new Set([...(old?.languages || []), c.lang])],
    indexedAt: Date.now()
  });
}
async function crawlPage(lang, page) {
  const u = new URL(`https://syarah.com/${lang}/autos`);
  if (page > 1) u.searchParams.set("page", String(page));
  const d = await fetchText(u.href);
  const cards = cardCandidates(d.html, d.url, lang);
  for (const c of cards) mergeCard(c);
  pagesFetched++;
  return cards.length;
}
async function refreshCatalog() {
  if (refreshRunning) return;
  refreshRunning = true;
  lastRefreshStarted = new Date().toISOString();
  lastRefreshError = null;
  pagesFetched = 0;
  try {
    let emptyStreak = 0;
    for (let page = 1; page <= MAX_PAGES_PER_LANGUAGE; page++) {
      const counts = await Promise.all(["en", "ar"].map(async lang => {
        try { return await crawlPage(lang, page); }
        catch (e) { lastRefreshError = `${lang} page ${page}: ${e?.message || e}`; return 0; }
      }));
      if (counts.every(n => n === 0)) emptyStreak++; else emptyStreak = 0;
      if (page >= 8 && emptyStreak >= 3) break;
      await sleep(180);
    }
    lastRefreshFinished = new Date().toISOString();
  } catch (e) {
    lastRefreshError = e?.message || String(e);
  } finally { refreshRunning = false; }
}

const STOP = new Set(norm("ابي أبغى ابغى ابي أريد اريد ابيلي ابغالي سيارة سياره سيارات cars car vehicle vehicles used new مستعمل مستعملة مستعمله جديد جديدة جديده موديل model سنة سنه years year وفوق فوق واكثر وأكثر او اكثر أو أكثر تحت اقل أقل من الى إلى في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام السعودية السعوديه saudi arabia ksa riyadh jeddah dammam under below less than above over more than around about budget ريال sar km كيلو كم").split(" "));
function queryTerms(query = "") {
  const q = norm(query);
  const terms = q.split(" ").filter(t => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t));
  return [...new Set(terms)].slice(0, 8);
}
function intent(query = "", filters = {}) {
  const q = humanNumbers(query);
  const years = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1]));
  const p = norm(q).match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{4,7})/i);
  const km = norm(q).match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  let city = filters.city || cityOf(q);
  return {
    terms: queryTerms(q),
    minYear: Number(filters.minYear) || (years.length ? Math.min(...years) : null),
    maxYear: Number(filters.maxYear) || null,
    maxPrice: Number(filters.maxPrice) || (p ? Number(p[1]) : null),
    maxMileage: Number(filters.maxMileage) || (km ? Number(km[1]) : null),
    city
  };
}
function blob(c) {
  return norm([c.slug, c.brand, c.model, c.title, ...(c.aliases || [])].filter(Boolean).join(" "));
}
function termsMatch(c, terms) {
  if (!terms.length) return true;
  const b = blob(c), compact = b.replace(/\s+/g, "");
  return terms.every(t => b.includes(t) || compact.includes(t.replace(/\s+/g, "")));
}
function cardMatches(c, i, condition) {
  if (!c || c.condition !== condition) return false;
  if (!termsMatch(c, i.terms)) return false;
  if (i.minYear && c.year && c.year < i.minYear) return false;
  if (i.maxYear && c.year && c.year > i.maxYear) return false;
  if (i.maxPrice && c.price && c.price > i.maxPrice) return false;
  if (i.maxMileage && c.mileage != null && c.mileage > i.maxMileage) return false;
  if (i.city && c.city && c.city !== i.city) return false;
  return true;
}
function scoreCard(c, i) {
  let s = 68 + Math.min(i.terms.length * 3, 15);
  if (c.price) s += 5;
  if (c.image) s += 5;
  if (c.year) s += 2;
  if (c.mileage != null) s += 2;
  if (c.city) s += 1;
  return Math.min(s, 96);
}
function publicCard(c, i) {
  const img = c.image || null;
  return {
    source: "Syarah",
    sourceType: "marketplace",
    seller: "Syarah",
    sourceStrict: true,
    title: c.title || [c.brand, c.model, c.year].filter(Boolean).join(" ") || "Syarah car",
    snippet: (c.aliases || []).find(x => x && x !== c.title)?.slice(0, 700) || "Open the original Syarah listing for full details.",
    url: c.url,
    brand: c.brand,
    model: c.model,
    year: c.year,
    mileage: c.mileage,
    city: c.city,
    price: c.price,
    priceVerified: Boolean(c.price),
    priceSource: c.price ? "syarah_cash_price_catalog" : null,
    condition: c.condition,
    saleVerified: true,
    image: img,
    displayImage: img ? (imageToken(img) || img) : null,
    imageVerified: Boolean(img),
    imageSource: img ? "source_catalog" : null,
    score: scoreCard(c, i),
    discovery: "broad_catalog_index"
  };
}
function genericResults(body = {}, limit = MAX_FULL_RESULTS) {
  const condition = body.condition === "new" ? "new" : "used";
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  if ((filters.seller && filters.seller !== "Syarah") || (filters.sourceType && filters.sourceType !== "marketplace")) return [];
  const i = intent(String(body.query || ""), filters);
  return [...catalog.values()]
    .filter(c => cardMatches(c, i, condition))
    .sort((a, b) => scoreCard(b, i) - scoreCard(a, i) || (b.indexedAt || 0) - (a.indexedAt || 0))
    .slice(0, limit)
    .map(c => publicCard(c, i));
}
function mergeListings(a = [], b = [], max = MAX_FULL_RESULTS) {
  const out = [], seen = new Set();
  for (const c of [...a, ...b]) {
    if (!c?.url) continue;
    const key = String(c.url).replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
    if (out.length >= max) break;
  }
  return out;
}
function counts(listings = []) { return listings.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {}); }
async function upstreamSearch(body) {
  const r = await fetch(`http://127.0.0.1:${v10Port}/api/search`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {})
  });
  const d = await r.json().catch(() => ({ error: `Upstream HTTP ${r.status}` }));
  return { status: r.status, ok: r.ok, data: d };
}

app.post("/api/search", async (req, res) => {
  const body = req.body || {};
  const fast = body.phase === "fast";
  const generic = genericResults(body, fast ? MAX_FAST_RESULTS : MAX_FULL_RESULTS);
  try {
    const up = await upstreamSearch(body);
    if (!up.ok) {
      if (generic.length) return res.json({ query: body.query, condition: body.condition === "new" ? "new" : "used", listings: generic, counts: counts(generic), live: true, partial: fast, phase: fast ? "fast" : "full", fallback: "broad_catalog_index", catalogIndexed: catalog.size });
      return res.status(up.status).json(up.data);
    }
    const base = Array.isArray(up.data.listings) ? up.data.listings : [];
    const merged = mergeListings(base, generic, fast ? MAX_FAST_RESULTS : MAX_FULL_RESULTS);
    const data = { ...up.data, listings: merged, counts: counts(merged), catalogIndexed: catalog.size, broadCatalog: true };
    if (!base.length && generic.length) data.fallback = data.fallback || "broad_catalog_index";
    return res.json(data);
  } catch (e) {
    if (generic.length) return res.json({ query: body.query, condition: body.condition === "new" ? "new" : "used", listings: generic, counts: counts(generic), live: true, partial: fast, phase: fast ? "fast" : "full", fallback: "broad_catalog_index", catalogIndexed: catalog.size });
    return res.status(502).json({ error: e?.message || "Delilah upstream unavailable" });
  }
});

app.get("/api/catalog/stats", (req, res) => {
  const values = [...catalog.values()];
  const used = values.filter(c => c.condition === "used").length;
  const fresh = values.filter(c => c.condition === "new").length;
  const withImages = values.filter(c => c.image).length;
  const withPrices = values.filter(c => c.price).length;
  const brands = new Set(values.map(c => norm(c.brand)).filter(Boolean)).size;
  const models = new Set(values.map(c => `${norm(c.brand)}|${norm(c.model)}`).filter(x => !x.endsWith("|"))).size;
  const samples = values.slice(0, 8).map(c => ({ title: c.title, condition: c.condition, url: c.url }));
  res.json({ ok: true, index: "broad-catalog-v1", indexed: values.length, used, new: fresh, withImages, withPrices, brands, models, pagesFetched, refreshRunning, lastRefreshStarted, lastRefreshFinished, lastRefreshError, samples });
});

app.get("/api/catalog-image/:token", async (req, res) => {
  const e = imageRegistry.get(req.params.token);
  if (!e || Date.now() - e.at > CATALOG_REFRESH_MS * 2) return res.status(404).end();
  const u = safeUrl(e.url);
  if (!u) return res.status(404).end();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(u.href, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahImageRelay/1.0)", Accept: "image/*" } });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const len = Number(r.headers.get("content-length") || 0);
    if (!r.ok || !ct.startsWith("image/") || (len && len > 8 * 1024 * 1024)) return res.status(502).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > 8 * 1024 * 1024) return res.status(413).end();
    res.set({ "Content-Type": ct, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" });
    return res.send(buf);
  } catch { return res.status(502).end(); }
  finally { clearTimeout(timer); }
});

async function proxy(req, res) {
  const target = `http://127.0.0.1:${v10Port}${req.originalUrl}`;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!["host", "content-length", "connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v);
  let body;
  if (!["GET", "HEAD"].includes(req.method) && req.is("application/json")) { body = JSON.stringify(req.body || {}); headers["content-type"] = "application/json"; }
  try {
    const r = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!["content-length", "transfer-encoding", "connection"].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch { return res.status(502).json({ error: "Delilah upstream unavailable" }); }
}

app.get("/api/health", async (req, res) => {
  try {
    const r = await fetch(`http://127.0.0.1:${v10Port}/api/health`);
    const d = await r.json();
    res.json({ ...d, edge: "inventory-v11", broadCatalogIndex: true, catalogIndexed: catalog.size, catalogRefreshing: refreshRunning });
  } catch { res.status(503).json({ ok: false, edge: "inventory-v11", catalogIndexed: catalog.size }); }
});
app.use(proxy);
app.listen(externalPort, () => {
  console.log(`Delilah inventory-v11 running at http://localhost:${externalPort}`);
  refreshCatalog().catch(() => {});
  setInterval(() => refreshCatalog().catch(() => {}), CATALOG_REFRESH_MS).unref();
});
