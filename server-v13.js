import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v11Port = Number(process.env.DELILAH_V11_PORT_V13 || 3700);
const PRICE_TTL = 15 * 60_000;
const priceCache = new Map();

process.env.PORT = String(v11Port);
await import("./server-v11.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function humanNumbers(s = "") {
  let q = digits(s);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}
const NAME_ALIASES = [
  ["لاند كروزر","Land Cruiser"],["لاندكروزر","Land Cruiser"],["رانجلر","Wrangler"],["باترول","Patrol"],["كامري","Camry"],["كورولا","Corolla"],["يارس","Yaris"],["صني","Sunny"],
  ["توسان","Tucson"],["سبورتاج","Sportage"],["تاهو","Tahoe"],["سوناتا","Sonata"],["اكسنت","Accent"],["أكسنت","Accent"],["النترا","Elantra"],["برادو","Prado"],["فورتشنر","Fortuner"],
  ["جراند شيروكي","Grand Cherokee"],["اكسبلورر","Explorer"],["إكسبلورر","Explorer"],["كايين","Cayenne"],["تيجوان","Tiguan"],["بيجاس","Pegas"],["سيراتو","Cerato"],["سورينتو","Sorento"],
  ["جيب","Jeep"],["تويوتا","Toyota"],["نيسان","Nissan"],["هيونداي","Hyundai"],["كيا","Kia"],["فورد","Ford"],["شفروليه","Chevrolet"],["مرسيدس","Mercedes"],["لكزس","Lexus"],["بورش","Porsche"],["فولكس فاجن","Volkswagen"],["فولكس","Volkswagen"],
  ["مازدا","Mazda"],["هوندا","Honda"],["ميتسوبيشي","Mitsubishi"],["جيلي","Geely"],["شانجان","Changan"],["جي ايه سي","GAC"],["ام جي","MG"],["إم جي","MG"],["جينيسيس","Genesis"],["جيتور","Jetour"],["هافال","Haval"],
  ["اودي","Audi"],["أودي","Audi"],["لاند روفر","Land Rover"],["رينج روفر","Range Rover"],["كاديلاك","Cadillac"],["جي ام سي","GMC"],["دودج","Dodge"],["سوزوكي","Suzuki"],["ايسوزو","Isuzu"],["بيجو","Peugeot"],["رينو","Renault"],["شيري","Chery"],["هونشي","Hongqi"],["تسلا","Tesla"],["لوسيد","Lucid"],
  ["بي ام دبليو","BMW"],["بي ام","BMW"]
];
function canonicalCarQuery(query = "") {
  let q = humanNumbers(query);
  for (const [from, to] of NAME_ALIASES.sort((a,b) => b[0].length - a[0].length)) q = q.split(from).join(to);
  return q;
}
function directSyarah(url) {
  try {
    const u = new URL(url);
    return (u.hostname === "syarah.com" || u.hostname.endsWith(".syarah.com")) && /^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-(?:used|new)-\d+\/?$/i.test(u.pathname);
  } catch { return false; }
}
function strip(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}
function cashPrice(text = "") {
  const t = digits(text);
  const m = t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?[^0-9]{0,40}([0-9][\d,]*)\s*SAR/i)
    || t.match(/السعر\s*النقدي[^0-9]{0,50}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null;
}
async function exactCash(url) {
  if (!directSyarah(url)) return null;
  const hit = priceCache.get(url);
  if (hit && Date.now() - hit.at < PRICE_TTL) return hit.price;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahPriceVerifier/2.0)", Accept: "text/html,application/xhtml+xml" }
    });
    if (!r.ok || !directSyarah(r.url || url)) return null;
    const p = cashPrice(strip((await r.text()).slice(0, 3_000_000)));
    priceCache.set(url, { at: Date.now(), price: p });
    return p;
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
function counts(listings = []) { return listings.reduce((a,c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {}); }
async function verifySyarah(listings = [], maxPrice = null) {
  const checked = await mapLimit(listings, 8, async raw => {
    if (raw?.source !== "Syarah" || !directSyarah(raw.url)) return raw;
    const c = { ...raw };
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
  return checked.filter(c => !(maxPrice && c.price && Number(c.price) > maxPrice));
}
async function upstreamSearch(body) {
  const r = await fetch(`http://127.0.0.1:${v11Port}/api/search`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {})
  });
  const d = await r.json().catch(() => ({ error: `Upstream HTTP ${r.status}` }));
  return { r, d };
}
app.post("/api/search", async (req, res) => {
  const original = req.body || {};
  const normalizedQuery = canonicalCarQuery(String(original.query || ""));
  const body = { ...original, query: normalizedQuery };
  try {
    const { r, d } = await upstreamSearch(body);
    if (!r.ok) return res.status(r.status).json(d);
    d.query = original.query;
    d.normalizedQuery = normalizedQuery;
    if (original.phase !== "fast" && Array.isArray(d.listings) && d.listings.length) {
      const maxPrice = Number(d.intent?.maxPrice || original.filters?.maxPrice || 0) || null;
      d.listings = await verifySyarah(d.listings, maxPrice);
      d.counts = counts(d.listings);
    }
    return res.json(d);
  } catch (e) { return res.status(502).json({ error: e?.message || "Delilah upstream unavailable" }); }
});
async function proxy(req, res) {
  try {
    const headers = {};
    for (const [k,v] of Object.entries(req.headers)) if (!["host","content-length","connection"].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(",") : String(v);
    let body;
    if (!["GET","HEAD"].includes(req.method) && req.is("application/json")) { body = JSON.stringify(req.body || {}); headers["content-type"] = "application/json"; }
    const r = await fetch(`http://127.0.0.1:${v11Port}${req.originalUrl}`, { method:req.method, headers, body, redirect:"manual" });
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k,v] of r.headers.entries()) if (!["content-length","transfer-encoding","connection"].includes(k.toLowerCase())) res.setHeader(k,v);
    return res.status(r.status).send(buf);
  } catch { return res.status(502).json({ error:"Delilah upstream unavailable" }); }
}
app.get("/api/health", async (req,res) => {
  try {
    const r = await fetch(`http://127.0.0.1:${v11Port}/api/health`), d = await r.json();
    res.json({ ...d, edge:"inventory-v13", arabicCatalogAliases:true, exactSyarahFullPrice:true, blockedSourcesNotBypassed:true });
  } catch { res.status(503).json({ ok:false, edge:"inventory-v13" }); }
});
app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v13 running at http://localhost:${externalPort}`));
