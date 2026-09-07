import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v9Port = Number(process.env.DELILAH_V9_PORT || 3400);
const CASH_TTL = 5 * 60_000;
const cashCache = new Map();

process.env.PORT = String(v9Port);
await import("./server-v9.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function directSyarah(url) {
  try {
    const u = new URL(url);
    return (u.hostname === "syarah.com" || u.hostname.endsWith(".syarah.com")) && /^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-(?:used|new)-\d+\/?$/i.test(u.pathname);
  } catch { return false; }
}
function textOf(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}
function cashPrice(text = "") {
  const t = String(text).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const m = t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i)
    || t.match(/السعر\s*النقدي[^0-9]{0,40}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}
async function exactCash(url) {
  if (!directSyarah(url)) return null;
  const hit = cashCache.get(url);
  if (hit && Date.now() - hit.at < CASH_TTL) return hit.price;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahCashVerifier/1.0)", Accept: "text/html,application/xhtml+xml" }
    });
    if (!r.ok || !directSyarah(r.url || url)) return null;
    const price = cashPrice(textOf((await r.text()).slice(0, 3_000_000)));
    cashCache.set(url, { at: Date.now(), price });
    return price;
  } catch { return null; }
  finally { clearTimeout(timer); }
}
async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try { out[i] = await fn(items[i], i); } catch { out[i] = items[i]; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
async function verifyFallbackPrices(listings = []) {
  return mapLimit(listings, 8, async raw => {
    const c = { ...raw };
    if (c.source !== "Syarah" || !directSyarah(c.url)) return c;
    const p = await exactCash(c.url);
    if (p) {
      c.price = p;
      c.priceVerified = true;
      c.priceSource = "syarah_cash_price";
    } else {
      c.price = null;
      c.priceVerified = false;
      c.priceSource = null;
      delete c.previousPrice;
      delete c.discount;
    }
    return c;
  });
}
function counts(listings = []) {
  return listings.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {});
}
async function fastFallbackOnce(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(`http://127.0.0.1:${v9Port}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(body || {}), phase: "fast" }),
      signal: controller.signal
    });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.listings) ? d.listings : [];
  } catch { return []; }
  finally { clearTimeout(timer); }
}
async function fastFallback(body) {
  // The first miss tells v9 to start warming this exact query. Poll briefly so
  // an upstream zero-result/transient failure can recover from the local index
  // instead of telling the user there are no cars.
  for (let attempt = 0; attempt < 7; attempt++) {
    const listings = await fastFallbackOnce(body);
    if (listings.length) return listings;
    if (attempt < 6) await sleep(1400);
  }
  return [];
}
async function repairEmptySearch(data, body) {
  if (!data || !Array.isArray(data.listings) || data.listings.length) return data;
  const filters = body?.filters && typeof body.filters === "object" ? body.filters : {};
  const canUseSyarah = !filters.seller || filters.seller === "Syarah";
  const marketplaceOk = !filters.sourceType || filters.sourceType === "marketplace";
  if (!canUseSyarah || !marketplaceOk) return data;

  const local = await fastFallback(body);
  if (!local.length) return data;
  const listings = await verifyFallbackPrices(local);
  data.listings = listings;
  data.counts = counts(listings);
  data.rawCandidates = Math.max(Number(data.rawCandidates || 0), listings.length);
  data.fallback = "warm-index-after-empty-full-search";
  const isArabic = /[\u0600-\u06ff]/.test(String(body?.query || ""));
  data.answer = isArabic
    ? `لقيت ${listings.length} سيارة مؤكدة من المخزون المفهرس بينما أواصل تحديث السوق.`
    : `Found ${listings.length} verified cars from Delilah's live inventory index while the wider market refresh continues.`;
  return data;
}

async function proxy(req, res) {
  const target = `http://127.0.0.1:${v9Port}${req.originalUrl}`;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!["host", "content-length", "connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  let body;
  if (!["GET", "HEAD"].includes(req.method) && req.is("application/json")) {
    body = JSON.stringify(req.body || {});
    headers["content-type"] = "application/json";
  }
  try {
    const r = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
    const ct = r.headers.get("content-type") || "";
    if (req.path === "/api/search" && ct.includes("application/json") && req.body?.phase !== "fast") {
      const d = await repairEmptySearch(await r.json(), req.body || {});
      return res.status(r.status).json(d);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!["content-length", "transfer-encoding", "connection"].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch (e) {
    console.error("v10 proxy error", e);
    return res.status(502).json({ error: "Delilah upstream unavailable" });
  }
}

app.get("/api/health", async (req, res) => {
  try {
    const r = await fetch(`http://127.0.0.1:${v9Port}/api/health`);
    const d = await r.json();
    res.json({ ...d, edge: "inventory-v10", emptySearchFallback: true });
  } catch { res.status(503).json({ ok: false, edge: "inventory-v10" }); }
});
app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v10 running at http://localhost:${externalPort}`));
