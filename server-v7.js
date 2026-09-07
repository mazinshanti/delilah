import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.DELILAH_INTERNAL_PORT || 3101);
process.env.PORT = String(internalPort);
await import("./server-v6.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const arabicDigits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

function normalizeHumanNumbers(query = "") {
  let q = arabicDigits(query);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)\b/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK]\b/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}

function numberValue(v) {
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}

function syarahPricing(car) {
  if (!car || car.source !== "Syarah") return car;
  const text = `${car.title || ""} ${car.snippet || ""}`.replace(/\s+/g, " ");

  const cash = text.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i)
    || text.match(/السعر\s*النقدي[^0-9]{0,30}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  const current = cash ? numberValue(cash[1]) : null;

  let previous = null;
  if (cash) {
    const tail = text.slice((cash.index || 0) + cash[0].length);
    const old = tail.match(/^\s*([0-9][\d,]*)\s*SAR/i);
    const oldValue = old ? numberValue(old[1]) : null;
    if (oldValue && current && oldValue > current) previous = oldValue;
  }

  const discountMatch = text.match(/(?:discount|save)\s*([0-9][\d,]*)\s*SAR/i);
  const statedDiscount = discountMatch ? numberValue(discountMatch[1]) : null;

  if (current) {
    car.price = current;
    car.priceVerified = true;
    car.priceSource = "syarah_cash_price";
  }
  if (previous) car.previousPrice = previous;
  if (previous && current) car.discount = previous - current;
  else if (statedDiscount) car.discount = statedDiscount;
  return car;
}

function requestedMaxPrice(body) {
  const filter = numberValue(body?.filters?.maxPrice);
  if (filter) return filter;
  const q = normalizeHumanNumbers(body?.query || "");
  const m = q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{4,7})/i);
  return m ? numberValue(m[1]) : null;
}

function fixSearchResponse(data, originalBody) {
  if (!data || !Array.isArray(data.listings)) return data;
  const maxPrice = requestedMaxPrice(originalBody);
  data.listings = data.listings.map(syarahPricing).filter(c => !(maxPrice && c.price && c.price > maxPrice));
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
      const data = fixSearchResponse(await r.json(), originalBody);
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
