import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v8Port = Number(process.env.DELILAH_V8_PORT || 3300);
const v7Port = Number(process.env.DELILAH_V7_PORT_V9 || 3301);
const v6Port = Number(process.env.DELILAH_V6_PORT_V9 || 3302);
const FAST_LIMIT = 18;
const FAST_DEADLINE = 7200;
const FAST_CACHE_TTL = 5 * 60_000;
const fastCache = new Map();

process.env.PORT = String(v8Port);
process.env.DELILAH_V7_PORT = String(v7Port);
process.env.DELILAH_V6_PORT = String(v6Port);
await import("./server-v8.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function normalizeHumanNumbers(query = "") {
  let q = digits(query);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}
function counts(listings = []) {
  return listings.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {});
}
function safeFastListing(c) {
  if (!c || c.source !== "Syarah") return c;
  // The v7 endpoint already verifies Syarah Cash Price from the exact car page.
  // If that marker is absent, never expose a potentially misleading number in fast results.
  if (c.price && c.priceSource !== "syarah_cash_price") {
    c.price = null;
    c.priceVerified = false;
    c.priceSource = null;
    delete c.previousPrice;
    delete c.discount;
  }
  return c;
}
async function fastViaProvenPath(body = {}) {
  const query = String(body.query || "").trim();
  if (!query) throw Object.assign(new Error("Query is required"), { status: 400 });
  const condition = body.condition === "new" ? "new" : "used";
  const filters = body.filters && typeof body.filters === "object" ? { ...body.filters } : {};

  // If the user explicitly asks for another seller/type, do not show unrelated Syarah results.
  if ((filters.seller && filters.seller !== "Syarah") || (filters.sourceType && filters.sourceType !== "marketplace")) {
    return { query, condition, listings: [], counts: {}, live: true, partial: true, phase: "fast", provider: "Delilah v9 fast lane", fastSkipped: true };
  }

  const normalizedQuery = normalizeHumanNumbers(query);
  const key = JSON.stringify({ q: normalizedQuery.toLowerCase(), condition, filters: { ...filters, seller: "Syarah" } });
  const hit = fastCache.get(key);
  if (hit && Date.now() - hit.at < FAST_CACHE_TTL) return { ...hit.value, cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAST_DEADLINE);
  try {
    const r = await fetch(`http://127.0.0.1:${v7Port}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: normalizedQuery, condition, filters: { ...filters, seller: "Syarah" } }),
      signal: controller.signal
    });
    if (!r.ok) throw new Error(`Fast source HTTP ${r.status}`);
    const d = await r.json();
    const listings = (Array.isArray(d.listings) ? d.listings : []).map(safeFastListing).slice(0, FAST_LIMIT);
    const value = {
      ...d,
      query,
      condition,
      listings,
      counts: counts(listings),
      answer: listings.length
        ? `Found ${listings.length} verified cars quickly. Scanning the rest of the Saudi market…`
        : "Fast source checked. Scanning the wider Saudi market…",
      live: true,
      cached: false,
      partial: true,
      phase: "fast",
      provider: "Delilah v9 fast lane — proven Syarah inventory path"
    };
    fastCache.set(key, { at: Date.now(), value });
    for (const [k, v] of fastCache) if (Date.now() - v.at > FAST_CACHE_TTL) fastCache.delete(k);
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function proxy(req, res) {
  const target = `http://127.0.0.1:${v8Port}${req.originalUrl}`;
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
    const data = await fastViaProvenPath(req.body);
    data.elapsedMs = Date.now() - started;
    return res.json(data);
  } catch (e) {
    const timedOut = e?.name === "AbortError";
    return res.status(timedOut ? 504 : (e.status || 500)).json({
      error: timedOut ? "Fast lane deadline reached" : (e.message || "Fast search failed"),
      partial: true,
      phase: "fast",
      elapsedMs: Date.now() - started
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const r = await fetch(`http://127.0.0.1:${v8Port}/api/health`);
    const d = await r.json();
    res.json({ ...d, edge: "inventory-v9", fastLane: "proven-source-first", fastDeadlineMs: FAST_DEADLINE });
  } catch {
    res.status(503).json({ ok: false, edge: "inventory-v9" });
  }
});

app.use(proxy);
app.listen(externalPort, () => console.log(`Delilah inventory-v9 running at http://localhost:${externalPort}`));
