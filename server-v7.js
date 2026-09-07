import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.DELILAH_INTERNAL_PORT || 3101);
const SYARAH_PRICE_TTL = 5 * 60_000;
const syarahPriceCache = new Map();

process.env.PORT = String(internalPort);
await import("./server-v6.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const arabicDigits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

function normalizeHumanNumbers(query = "") {
  let q = arabicDigits(query);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}

function numberValue(v) {
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}

function cleanText(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSyarahCashPricing(text = "") {
  const t = String(text).replace(/\s+/g, " ");
  const cash = t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i)
    || t.match(/السعر\s*النقدي[^0-9]{0,30}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  const current = cash ? numberValue(cash[1]) : null;
  let previous = null;
  if (cash && current) {
    const tail = t.slice((cash.index || 0) + cash[0].length);
    const old = tail.match(/^\s*([0-9][\d,]*)\s*SAR/i);
    const oldValue = old ? numberValue(old[1]) : null;
    if (oldValue && oldValue > current) previous = oldValue;
  }
  const discountMatch = t.match(/(?:discount|save)\s*([0-9][\d,]*)\s*SAR/i);
  const statedDiscount = discountMatch ? numberValue(discountMatch[1]) : null;
  return { current, previous, discount: previous && current ? previous - current : statedDiscount };
}

function applySyarahPricing(car, pricing) {
  if (!car || car.source !== "Syarah") return car;
  if (pricing?.current) {
    car.price = pricing.current;
    car.priceVerified = true;
    car.priceSource = "syarah_cash_price";
    if (pricing.previous) car.previousPrice = pricing.previous;
    else delete car.previousPrice;
    if (pricing.discount) car.discount = pricing.discount;
    else delete car.discount;
  }
  return car;
}

function syarahPricingFromCard(car) {
  if (!car || car.source !== "Syarah") return car;
  return applySyarahPricing(car, parseSyarahCashPricing(`${car.title || ""} ${car.snippet || ""}`));
}

async function fetchSyarahCashPricing(car) {
  const u = (() => { try { return new URL(car?.url || ""); } catch { return null; } })();
  if (!u || !(u.hostname === "syarah.com" || u.hostname.endsWith(".syarah.com")) || !/\/cardetail\//i.test(u.pathname)) return null;
  const key = u.href;
  const hit = syarahPriceCache.get(key);
  if (hit && Date.now() - hit.at < SYARAH_PRICE_TTL) return hit.value;

  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(key, {
      signal: c.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DelilahPriceVerifier/1.0)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (!r.ok) return null;
    const text = cleanText((await r.text()).slice(0, 3_000_000));
    const pricing = parseSyarahCashPricing(text);
    syarahPriceCache.set(key, { at: Date.now(), value: pricing });
    return pricing;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      try { out[k] = await fn(items[k], k); } catch { out[k] = items[k]; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function verifySyarahPrices(listings) {
  return mapLimit(listings, 12, async car => {
    if (!car || car.source !== "Syarah") return car;
    syarahPricingFromCard(car);
    if (car.priceSource === "syarah_cash_price") return car;

    const pricing = await fetchSyarahCashPricing(car);
    if (pricing?.current) return applySyarahPricing(car, pricing);

    // Never display an unverified Syarah number: it may be a discount or installment.
    car.price = null;
    car.priceVerified = false;
    car.priceSource = null;
    delete car.previousPrice;
    return car;
  });
}

function requestedMaxPrice(body) {
  const filter = numberValue(body?.filters?.maxPrice);
  if (filter) return filter;
  const q = normalizeHumanNumbers(body?.query || "");
  const m = q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{4,7})/i);
  return m ? numberValue(m[1]) : null;
}

async function fixSearchResponse(data, originalBody) {
  if (!data || !Array.isArray(data.listings)) return data;
  const maxPrice = requestedMaxPrice(originalBody);
  data.listings = await verifySyarahPrices(data.listings);
  data.listings = data.listings.filter(c => {
    if (!maxPrice) return true;
    if (c.source === "Syarah" && !c.priceVerified) return false;
    return !(c.price && c.price > maxPrice);
  });
  data.counts = data.listings.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {});
  if (data.intent && maxPrice) data.intent.maxPrice = maxPrice;
  const images = data.listings.filter(c => c.imageVerified).length;
  const sources = Object.keys(data.counts).length;
  const isArabic = /[\u0600-\u06ff]/.test(String(originalBody?.query || ""));
  data.answer = data.listings.length
    ? (isArabic
      ? `لقيت ${data.listings.length} سيارة حقيقية للبيع من ${sources} مصادر، ${images} منها بصور مرتبطة بالإعلان.`
      : `I found ${data.listings.length} real cars for sale across ${sources} sources; ${images} have verified listing-linked images.`)
    : (isArabic ? "ما لقيت سيارات مؤكدة تطابق طلبك حالياً." : "I couldn't find verified cars matching your request.");
  data.logic = "inventory-v7";
  return data;
}

async function proxy(req, res) {
  const target = `http://127.0.0.1:${internalPort}${req.originalUrl}`;
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!["host", "content-length", "connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v);
  }

  let body;
  const originalBody = req.body;
  if (!["GET", "HEAD"].includes(req.method) && req.is("application/json")) {
    const forwarded = { ...(req.body || {}) };
    if (typeof forwarded.query === "string") forwarded.query = normalizeHumanNumbers(forwarded.query);
    body = JSON.stringify(forwarded);
    headers["content-type"] = "application/json";
  }

  try {
    const r = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
    const ct = r.headers.get("content-type") || "";
    if (req.path === "/api/search" && ct.includes("application/json")) {
      const data = await fixSearchResponse(await r.json(), originalBody);
      return res.status(r.status).json(data);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!["content-length", "transfer-encoding", "connection"].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch (e) {
    console.error("v7 proxy error", e);
    return res.status(502).json({ error: "Delilah upstream unavailable" });
  }
}

app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v7 running at http://localhost:${externalPort}`));
