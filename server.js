import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const app = express();
const port = process.env.PORT || 3000;
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";

const CACHE_TTL = 45_000;
const IMAGE_TOKEN_TTL = 30 * 60_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const searchCache = new Map();
const sourceHealth = new Map();
const imageRegistry = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

function normalizeDigits(s = "") {
  return String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}
function detectArabic(s = "") {
  return /[\u0600-\u06FF]/.test(s);
}
function hostMatches(host, base) {
  host = String(host || "").toLowerCase();
  base = String(base || "").toLowerCase();
  return host === base || host.endsWith(`.${base}`);
}
function safeUrl(v) {
  try {
    const u = new URL(v);
    return /^https?:$/i.test(u.protocol) ? u : null;
  } catch {
    return null;
  }
}
function canonicalUrl(url = "") {
  const u = safeUrl(url);
  if (!u) return url;
  u.hash = "";
  const host = u.hostname.toLowerCase();
  if (hostMatches(host, "haraj.com.sa") && /^\/\d{7,}(?:\/|$)/.test(u.pathname)) {
    return `https://haraj.com.sa${u.pathname}${u.search}`;
  }
  return u.href;
}
function directPath(url, base, regex) {
  const u = safeUrl(url);
  return !!u && hostMatches(u.hostname.toLowerCase(), base) && regex.test(u.pathname);
}
function deepPage(url, base, blocked = []) {
  const u = safeUrl(url);
  if (!u || !hostMatches(u.hostname.toLowerCase(), base)) return false;
  const p = u.pathname.toLowerCase().replace(/\/$/, "") || "/";
  if (p === "/" || blocked.some(x => p === x || p.startsWith(`${x}/`))) return false;
  return p.split("/").filter(Boolean).length >= 2;
}

const SOURCES = [
  {
    name: "Haraj",
    type: "marketplace",
    seller: "Haraj",
    conditions: ["new", "used"],
    brands: [],
    priority: 100,
    strict: true,
    baseHost: "haraj.com.sa",
    queries: (q, c) => [
      `${q} ${c === "new" ? "جديد وكالة صفر" : "مستعمل ممشى"} site:haraj.com.sa/11`,
      `${q} ${c === "new" ? "جديد" : "مستعمل"} site:haraj.com.sa inurl:111`,
      `${q} site:haraj.com.sa "للبيع"`
    ],
    isCandidate: url => directPath(url, "haraj.com.sa", /^\/\d{7,}(?:\/|$)/)
  },
  {
    name: "Syarah",
    type: "marketplace",
    seller: "Syarah",
    conditions: ["new", "used"],
    brands: [],
    priority: 99,
    strict: true,
    baseHost: "syarah.com",
    queries: (q, c) => [
      `${q} ${c === "new" ? "new" : "used"} site:syarah.com/en/cardetail`,
      `${q} ${c === "new" ? "جديد" : "مستعمل"} site:syarah.com/ar/cardetail`,
      `${q} site:syarah.com/cardetail`
    ],
    isCandidate: url => directPath(url, "syarah.com", /^\/(?:en|ar)?\/?cardetail\/[^/]+-\d+\/?$/i) ||
      directPath(url, "syarah.com", /^\/cardetail\/[^/]+-\d+\/?$/i)
  },
  {
    name: "CarSwitch Saudi",
    type: "marketplace",
    seller: "CarSwitch Saudi",
    conditions: ["used"],
    brands: [],
    priority: 98,
    strict: true,
    baseHost: "carswitch.com",
    queries: q => [
      `${q} site:ksa.carswitch.com/en/saudi/used-car`,
      `${q} site:ksa.carswitch.com/en/used-cars`
    ],
    isCandidate: url => {
      const u = safeUrl(url);
      if (!u || !hostMatches(u.hostname.toLowerCase(), "carswitch.com")) return false;
      const p = u.pathname.toLowerCase().replace(/\/$/, "");
      return p.includes("/used-cars/") && !/(\/search|\/used-cars)$/.test(p) && p.split("/").filter(Boolean).length >= 3;
    }
  },
  {
    name: "Carly",
    type: "certified_used",
    seller: "Carly - كارلي",
    conditions: ["new", "used"],
    brands: [],
    priority: 98,
    strict: true,
    baseHost: "halacarly.com",
    queries: (q, c) => [
      `${q} ${c === "new" ? "new" : "used"} site:halacarly.com/en/vehicle-details`,
      `${q} ${c === "new" ? "جديد" : "مستعمل"} site:halacarly.com/ar/vehicle-details`
    ],
    isCandidate: url => directPath(url, "halacarly.com", /^\/(?:en|ar)\/vehicle-details\/[^/]+\/?$/i)
  },
  {
    name: "Saleh Cars",
    type: "independent_dealer",
    seller: "Saleh Cars Group",
    conditions: ["new"],
    brands: [],
    priority: 97,
    strict: true,
    baseHost: "salehcars.com",
    queries: q => [
      `${q} site:salehcars.com/cars/`,
      `${q} site:salehcars.com/en/cars/`
    ],
    isCandidate: url => directPath(url, "salehcars.com", /^\/(?:en\/)?cars\/[a-f0-9]{20,32}\/[^/]+\/?$/i)
  },
  {
    name: "Motory",
    type: "marketplace",
    seller: "Motory",
    conditions: ["new", "used"],
    brands: [],
    priority: 96,
    strict: true,
    baseHost: "motory.com",
    queries: (q, c) => [
      `${q} ${c === "new" ? "new" : "used"} site:ksa.motory.com/en/cars-for-sale/ "Listing #"`,
      `${q} site:ksa.motory.com/en/cars-for-sale/ "Images & Specifications"`
    ],
    isCandidate: url => {
      const u = safeUrl(url);
      if (!u || !hostMatches(u.hostname.toLowerCase(), "motory.com")) return false;
      return /^\/en\/cars-for-sale\/[^/]+\/[^/]+\/[^/]+\/20\d{2}\/\d+\/?$/i.test(u.pathname);
    }
  },
  {
    name: "OpenSooq",
    type: "marketplace",
    seller: "OpenSooq",
    conditions: ["new", "used"],
    brands: [],
    priority: 88,
    strict: false,
    baseHost: "opensooq.com",
    queries: (q, c) => [
      `${q} ${c === "new" ? "new" : "used"} site:sa.opensooq.com/en/`,
      `${q} ${c === "new" ? "جديد" : "مستعمل"} site:sa.opensooq.com/ar/`
    ],
    isCandidate: url => {
      const u = safeUrl(url);
      if (!u || !hostMatches(u.hostname.toLowerCase(), "opensooq.com")) return false;
      const p = u.pathname.toLowerCase();
      if (/\/reviews?(\/|$)/.test(p)) return false;
      if (/\/cars\/cars-for-sale(?:\/[^/]+){0,4}\/?$/.test(p)) return false;
      return /\/(?:ad|listing|post|search)\//.test(p) && /\d{5,}/.test(p);
    }
  },
  {
    name: "Key Used Cars",
    type: "independent_dealer",
    seller: "Key Used Cars",
    conditions: ["used"],
    brands: [],
    priority: 87,
    strict: false,
    baseHost: "key.sa",
    queries: q => [`${q} site:key.sa "Price" "Kilometers" "Used"`],
    isCandidate: url => deepPage(url, "key.sa", ["/en", "/ar", "/en/car-selling-saudi-arabia"])
  },
  {
    name: "Toyota ALJ",
    type: "official_dealer",
    seller: "Abdul Latif Jameel Motors",
    conditions: ["new"],
    brands: ["Toyota"],
    priority: 93,
    strict: false,
    baseHost: "toyota.com.sa",
    queries: q => [`${q} site:toyota.com.sa buy reserve price`],
    isCandidate: url => deepPage(url, "toyota.com.sa", ["/en", "/en/vehicles"])
  },
  {
    name: "Lexus ALJ",
    type: "official_dealer",
    seller: "Lexus Abdul Latif Jameel",
    conditions: ["new"],
    brands: ["Lexus"],
    priority: 92,
    strict: false,
    baseHost: "lexus.com.sa",
    queries: q => [`${q} site:lexus.com.sa buy reserve price`],
    isCandidate: url => deepPage(url, "lexus.com.sa", ["/en"])
  },
  {
    name: "Nissan Petromin",
    type: "official_dealer",
    seller: "Petromin Nissan",
    conditions: ["new"],
    brands: ["Nissan"],
    priority: 92,
    strict: false,
    baseHost: "petromin-nissan.com",
    queries: q => [`${q} site:petromin-nissan.com buy price reserve`],
    isCandidate: url => deepPage(url, "petromin-nissan.com", ["/", "/vehicles"])
  },
  {
    name: "Ford Al Jazirah",
    type: "official_dealer",
    seller: "Al Jazirah Vehicles Agencies",
    conditions: ["new"],
    brands: ["Ford", "Lincoln"],
    priority: 91,
    strict: false,
    baseHost: "aljazirahford.com",
    queries: q => [`${q} site:aljazirahford.com price buy reserve`],
    isCandidate: url => deepPage(url, "aljazirahford.com", ["/"])
  },
  {
    name: "Mercedes Juffali",
    type: "official_dealer",
    seller: "Juffali Automotive Company",
    conditions: ["new", "used"],
    brands: ["Mercedes"],
    priority: 91,
    strict: false,
    baseHost: "mercedes-benz-mena.com",
    queries: (q, c) => [`${q} ${c === "used" ? "pre-owned stock" : "available cars"} site:mercedes-benz-mena.com/ksa/en`],
    isCandidate: url => deepPage(url, "mercedes-benz-mena.com", ["/ksa/en", "/ksa/en/new-models", "/ksa/en/buy-new"])
  },
  {
    name: "BMW Naghi",
    type: "official_dealer",
    seller: "Mohamed Yousuf Naghi Motors BMW",
    conditions: ["new", "used"],
    brands: ["BMW"],
    priority: 91,
    strict: false,
    baseHost: "bmw-saudiarabia.com",
    queries: (q, c) => [`${q} ${c === "used" ? "certified pre-owned stock" : "view stock buy"} site:bmw-saudiarabia.com`],
    isCandidate: url => deepPage(url, "bmw-saudiarabia.com", ["/", "/models", "/new-models"])
  },
  {
    name: "Kia Aljabr",
    type: "official_dealer",
    seller: "Aljabr Kia",
    conditions: ["new"],
    brands: ["Kia"],
    priority: 89,
    strict: false,
    baseHost: "kia.com",
    queries: q => [`${q} site:kia.com/aljabr price buy`],
    isCandidate: url => deepPage(url, "kia.com", ["/aljabr/en"])
  },
  {
    name: "Porsche SAMACO",
    type: "official_dealer",
    seller: "SAMACO Porsche",
    conditions: ["new", "used"],
    brands: ["Porsche"],
    priority: 90,
    strict: false,
    baseHost: "samaco.com.sa",
    queries: (q, c) => [`${q} ${c === "used" ? "pre-owned stock" : "reserve online price"} site:samaco.com.sa/en/porsche`],
    isCandidate: url => deepPage(url, "samaco.com.sa", ["/en/porsche"])
  },
  {
    name: "Volkswagen SAMACO",
    type: "certified_used",
    seller: "SAMACO Volkswagen",
    conditions: ["new", "used"],
    brands: ["Volkswagen"],
    priority: 88,
    strict: false,
    baseHost: "vw.com.sa",
    queries: (q, c) => [`${q} ${c === "used" ? "certified used stock" : "buy online price"} site:vw.com.sa`],
    isCandidate: url => deepPage(url, "vw.com.sa", ["/"])
  },
  {
    name: "Chevrolet Saudi Dealers",
    type: "official_dealer",
    seller: "Aljomaih / Universal Motors",
    conditions: ["new"],
    brands: ["Chevrolet"],
    priority: 87,
    strict: false,
    baseHost: "chevroletarabia.com",
    queries: q => [`${q} site:chevroletarabia.com/sa-en price buy`],
    isCandidate: url => deepPage(url, "chevroletarabia.com", ["/sa-en"])
  }
];

const BRAND_ALIASES = {
  jeep: "Jeep", جيب: "Jeep", toyota: "Toyota", تويوتا: "Toyota", nissan: "Nissan", نيسان: "Nissan",
  lexus: "Lexus", لكزس: "Lexus", mercedes: "Mercedes", "mercedes-benz": "Mercedes", مرسيدس: "Mercedes",
  bmw: "BMW", "بي ام": "BMW", porsche: "Porsche", بورش: "Porsche", ford: "Ford", فورد: "Ford",
  lincoln: "Lincoln", لينكون: "Lincoln", hyundai: "Hyundai", هيونداي: "Hyundai", kia: "Kia", كيا: "Kia",
  volkswagen: "Volkswagen", فولكس: "Volkswagen", chevrolet: "Chevrolet", شفروليه: "Chevrolet", mazda: "Mazda", مازدا: "Mazda",
  honda: "Honda", هوندا: "Honda", mitsubishi: "Mitsubishi", ميتسوبيشي: "Mitsubishi", geely: "Geely", جيلي: "Geely",
  changan: "Changan", شانجان: "Changan", gac: "GAC", "جي ايه سي": "GAC", mg: "MG", "ام جي": "MG",
  genesis: "Genesis", جينيسيس: "Genesis", jetour: "Jetour", جيتور: "Jetour", haval: "Haval", هافال: "Haval",
  audi: "Audi", اودي: "Audi", "land rover": "Land Rover", "لاند روفر": "Land Rover", "range rover": "Range Rover", "رينج روفر": "Range Rover",
  cadillac: "Cadillac", كاديلاك: "Cadillac", gmc: "GMC", "جي ام سي": "GMC", dodge: "Dodge", دودج: "Dodge",
  suzuki: "Suzuki", سوزوكي: "Suzuki", isuzu: "Isuzu", ايسوزو: "Isuzu", peugeot: "Peugeot", بيجو: "Peugeot",
  renault: "Renault", رينو: "Renault", chery: "Chery", شيري: "Chery", hongqi: "Hongqi", هونشي: "Hongqi",
  byd: "BYD", بيوايدي: "BYD", tesla: "Tesla", تسلا: "Tesla", lucid: "Lucid", لوسيد: "Lucid"
};
const MODEL_ALIASES = [
  ["wrangler", "Wrangler"], ["رانجلر", "Wrangler"], ["patrol", "Patrol"], ["باترول", "Patrol"],
  ["land cruiser", "Land Cruiser"], ["لاندكروزر", "Land Cruiser"], ["camry", "Camry"], ["كامري", "Camry"],
  ["x5", "X5"], ["c200", "C200"], ["tucson", "Tucson"], ["توسان", "Tucson"],
  ["sportage", "Sportage"], ["سبورتاج", "Sportage"], ["territory", "Territory"], ["تيريتوري", "Territory"],
  ["tahoe", "Tahoe"], ["تاهو", "Tahoe"], ["sonata", "Sonata"], ["سوناتا", "Sonata"],
  ["accent", "Accent"], ["اكسنت", "Accent"], ["elantra", "Elantra"], ["النترا", "Elantra"],
  ["yaris", "Yaris"], ["يارس", "Yaris"], ["corolla", "Corolla"], ["كورولا", "Corolla"],
  ["prado", "Prado"], ["برادو", "Prado"], ["fortuner", "Fortuner"], ["فورتشنر", "Fortuner"],
  ["explorer", "Explorer"], ["اكسبلورر", "Explorer"], ["expedition", "Expedition"], ["اكسبديشن", "Expedition"],
  ["grand cherokee", "Grand Cherokee"], ["جراند شيروكي", "Grand Cherokee"], ["cayenne", "Cayenne"], ["كايين", "Cayenne"],
  ["tiguan", "Tiguan"], ["تيجوان", "Tiguan"]
];
function detectBrand(text = "") { const q = normalizeDigits(text).toLowerCase(); for (const [k, v] of Object.entries(BRAND_ALIASES)) if (q.includes(k)) return v; return null; }
function detectModel(text = "") { const q = normalizeDigits(text).toLowerCase(); for (const [k, v] of MODEL_ALIASES) if (q.includes(k)) return v; return null; }
function basicIntent(query = "") {
  const q = normalizeDigits(query.toLowerCase());
  const i = { brand: detectBrand(q), model: detectModel(q), minYear: null, maxYear: null, maxPrice: null, maxMileage: null, city: null };
  const yrs = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1])); if (yrs.length) i.minYear = Math.min(...yrs);
  const price = q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})/); if (price) i.maxPrice = Number(price[1]);
  const km = q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/); if (km) i.maxMileage = Number(km[1]);
  if (/riyadh|الرياض/.test(q)) i.city = "Riyadh"; else if (/jeddah|جدة/.test(q)) i.city = "Jeddah"; else if (/dammam|الدمام/.test(q)) i.city = "Dammam";
  return i;
}
function mergedIntent(i, f = {}) { return { ...i, minYear: Number(f.minYear) || i.minYear, maxYear: Number(f.maxYear) || i.maxYear, maxPrice: Number(f.maxPrice) || i.maxPrice, maxMileage: Number(f.maxMileage) || i.maxMileage, city: f.city || i.city }; }
function eligibleSources(condition, intent, filters = {}) {
  let x = SOURCES.filter(s => s.conditions.includes(condition));
  if (filters.sourceType) x = x.filter(s => s.type === filters.sourceType);
  if (filters.seller) x = x.filter(s => s.name === filters.seller);
  if (intent.brand) x = x.filter(s => !s.brands.length || s.brands.some(b => b.toLowerCase() === intent.brand.toLowerCase()));
  return x.sort((a, b) => b.priority - a.priority);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function braveSearch(q, count = 20) {
  if (!braveKey) throw new Error("BRAVE_SEARCH_API_KEY is missing");
  const u = new URL("https://api.search.brave.com/res/v1/web/search");
  u.searchParams.set("q", q); u.searchParams.set("country", "SA"); u.searchParams.set("count", String(Math.min(count, 20))); u.searchParams.set("text_decorations", "false");
  let err;
  for (let a = 0; a < 3; a++) {
    const c = new AbortController(); const timer = setTimeout(() => c.abort(), 10_000);
    try {
      const r = await fetch(u, { signal: c.signal, headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": braveKey } });
      if (r.ok) { const d = await r.json(); return d.web?.results || []; }
      err = new Error(`Search provider error ${r.status}`); if (r.status !== 429 && r.status < 500) throw err;
    } catch (e) { err = e; } finally { clearTimeout(timer); }
    if (a < 2) await sleep(300 * (2 ** a));
  }
  throw err || new Error("Search provider failed");
}
async function searchSource(source, query, condition) {
  const runs = await Promise.allSettled(source.queries(query, condition).map(q => braveSearch(q, 20)));
  const failed = runs.filter(x => x.status === "rejected");
  sourceHealth.set(source.name, { ok: failed.length < runs.length, lastChecked: new Date().toISOString(), failures: failed.length, total: runs.length, lastError: failed[0]?.reason?.message || null });
  const out = [], seen = new Set();
  for (const run of runs) {
    if (run.status !== "fulfilled") continue;
    for (const r of run.value) {
      if (!r.url || !source.isCandidate(r.url)) continue;
      const url = canonicalUrl(r.url); if (seen.has(url)) continue; seen.add(url); out.push({ ...r, url, source });
    }
  }
  return out.slice(0, 18);
}
async function searchAll(query, condition, intent, filters) {
  const sources = eligibleSources(condition, intent, filters);
  const batches = await Promise.allSettled(sources.map(s => searchSource(s, query, condition)));
  const out = [], seen = new Set();
  for (const b of batches) if (b.status === "fulfilled") for (const r of b.value) { if (!seen.has(r.url)) { seen.add(r.url); out.push(r); } }
  return out.slice(0, 100);
}

function decodeHtml(s = "") { return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
function stripHtml(html = "") { return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).slice(0, 180000); }
function meta(html, key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i").exec(html) || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`, "i").exec(html);
  return a ? decodeHtml(a[1]) : null;
}
function titleText(html = "") { const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]; const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]; return stripHtml(h1 || meta(html, "og:title") || title || ""); }
function absolute(v, base) { if (!v) return null; try { return new URL(String(v).replace(/\\u002F/gi, "/").replace(/\\\//g, "/"), base).href; } catch { return null; } }
function priceNum(v) { if (v == null) return null; const n = Number(String(v).replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null; }
function collectJson(node, out = []) { if (!node) return out; if (Array.isArray(node)) { for (const x of node) collectJson(x, out); return out; } if (typeof node !== "object") return out; out.push(node); for (const v of Object.values(node)) if (v && typeof v === "object") collectJson(v, out); return out; }
function parseLd(html) { const objects = []; for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { collectJson(JSON.parse(m[1].trim()), objects); } catch {} } return objects; }
function ldType(o) { const t = o?.["@type"]; return Array.isArray(t) ? t.map(String) : t ? [String(t)] : []; }
function imageRejected(url = "", context = "") { const s = `${url} ${context}`.toLowerCase(); return !/^https?:/.test(url) || /(logo|favicon|icon|sprite|placeholder|default[-_]?image|brandmark|social[-_]?share|whatsapp|payment|footer|header|arrow|badge|warranty|inspection|fuel-consumption|app-store|google-play)/.test(s); }
function imageScore(url, baseScore, context, dims, source, listingTitle) {
  if (!url || imageRejected(url, context)) return -999;
  let score = baseScore; const u = safeUrl(url); if (!u) return -999; const host = u.hostname.toLowerCase(), path = u.pathname.toLowerCase();
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(url)) score += 5;
  if (/(car|vehicle|gallery|listing|product|media|upload|image)/.test(path)) score += 5;
  if (/(car|vehicle|gallery|listing|photo)/.test(context.toLowerCase())) score += 8;
  if (listingTitle && context && listingTitle.split(/\s+/).some(t => t.length > 3 && context.toLowerCase().includes(t.toLowerCase()))) score += 12;
  if (dims?.w >= 600) score += 8; if (dims?.h >= 350) score += 8; if (dims?.w && dims?.h && dims.w / dims.h > 1.1 && dims.w / dims.h < 2.3) score += 5;
  if (source.name === "Syarah" && hostMatches(host, "syarah.com")) score += 25;
  if (source.name === "Motory" && (host.endsWith("amazonaws.com") || host.endsWith("cloudfront.net"))) score += 25;
  if (source.name === "Saleh Cars" && (hostMatches(host, "salehcars.com") || /saleh|car/.test(host))) score += 18;
  if (source.name === "Haraj" && !/(logo|avatar|profile)/.test(path)) score += 8;
  if (/nitrous|discount|banner|offer|campaign|promo/.test(`${path} ${context}`.toLowerCase())) score -= 20;
  return score;
}
function pushImageCandidate(list, value, base, baseScore, context = "", dims = null) {
  if (!value) return; const pieces = String(value).split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
  for (const p of pieces) { const url = absolute(p, base); if (url) list.push({ url, baseScore, context, dims }); }
}
function extractImageCandidates(html, base, source, listingTitle) {
  const list = [], ld = parseLd(html);
  for (const o of ld) {
    const imgs = Array.isArray(o.image) ? o.image : [o.image];
    for (const img of imgs) { if (!img) continue; if (typeof img === "string") pushImageCandidate(list, img, base, 110, "jsonld image"); else pushImageCandidate(list, img.url || img.contentUrl, base, 110, `jsonld ${img.caption || ""}`, { w: Number(img.width) || 0, h: Number(img.height) || 0 }); }
  }
  pushImageCandidate(list, meta(html, "og:image"), base, 100, "og:image");
  pushImageCandidate(list, meta(html, "twitter:image"), base, 95, "twitter:image");
  for (const m of html.matchAll(/<(img|source)\b([^>]+)>/gi)) {
    const attrs = m[2], alt = /(?:alt|title)=["']([^"']*)["']/i.exec(attrs)?.[1] || "", w = Number(/(?:width)=["']?(\d+)/i.exec(attrs)?.[1] || 0), h = Number(/(?:height)=["']?(\d+)/i.exec(attrs)?.[1] || 0), dims = { w, h };
    for (const attr of ["src", "data-src", "data-lazy-src", "data-original", "data-image", "srcset", "data-srcset"]) { const v = new RegExp(`${attr}=["']([^"']+)["']`, "i").exec(attrs)?.[1]; if (v) pushImageCandidate(list, v, base, attr.includes("srcset") ? 72 : 75, `${m[1]} ${alt} ${attr}`, dims); }
  }
  const embedded = html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
  const urlRegex = /https?:\/\/[^"'\\\s<>]+?\.(?:jpe?g|png|webp)(?:\?[^"'\\\s<>]*)?/gi; let count = 0;
  for (const m of embedded.matchAll(urlRegex)) { if (count++ > 160) break; pushImageCandidate(list, m[0], base, 52, "embedded-json/gallery"); }
  const bestByUrl = new Map();
  for (const c of list) { const score = imageScore(c.url, c.baseScore, c.context, c.dims, source, listingTitle); if (score < 50) continue; const prev = bestByUrl.get(c.url); if (!prev || score > prev.score) bestByUrl.set(c.url, { ...c, score }); }
  return [...bestByUrl.values()].sort((a, b) => b.score - a.score);
}
function inspectPage(html, url, source) {
  const text = stripHtml(html), ld = parseLd(html), listingTitle = titleText(html); let price = null, structuredVehicle = false, structuredOffer = false, availability = false, stock = false;
  for (const o of ld) {
    const types = ldType(o).map(x => x.toLowerCase()); if (types.some(t => ["vehicle", "car", "product", "individualproduct"].includes(t))) structuredVehicle = true; if (types.includes("offer") || o.offers) structuredOffer = true;
    const offer = Array.isArray(o.offers) ? o.offers[0] : o.offers; if (!price && offer) price = priceNum(offer.price || offer.lowPrice || offer.highPrice); if (!price) price = priceNum(o.price); if (offer?.availability || o.availability) availability = true; if (o.sku || o.mpn || o.vehicleIdentificationNumber || o.vin) stock = true;
  }
  price = price || priceNum(meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price"));
  const currency = /(?:\bSAR\b|ريال|ر\.س)/i.test(text), explicitSale = /(for sale|available now|buy now|reserve now|book now|contact seller|cash price|selling price|للبيع|متاح الآن|احجز الآن|اشتري الآن|اطلب الآن|تواصل مع البائع)/i.test(text), inventoryTerms = /(listing\s*#|post number|ad number|stock number|stock no|vin\b|sku\b|chassis|vehicle id|رقم الهيكل|رقم المخزون|رقم الإعلان)/i.test(text), mileage = /(\d[\d,]{0,8})\s*(?:km|kilometers?|كم|كيلو)/i.test(text), transactional = /(finance this car|monthly payment|apply for finance|book a test drive|request quote|contact sales|احسب التمويل|اطلب عرض|تجربة قيادة|تمويل)/i.test(text);
  const aggregate = /(showing\s+\d{2,}\s+results|cars for sale in .*\-\s*\(\d+\)|used cars for sale in .*\-\s*\(\d+\))/i.test(text) || /\/(?:cars\/cars-for-sale|autos\/used-cars|cars-for-sale)\/?$/i.test(new URL(url).pathname);
  const informative = /(\/news\/|\/blog\/|\/guide\/|\/reviews?\/|brochure|specifications|owner.?s manual|press release|الأخبار|مقال|كتيب)/i.test(`${url} ${meta(html, "og:type") || ""}`);
  let saleScore = 0; if (source.strict) saleScore += 7; if (structuredVehicle) saleScore += 2; if (structuredOffer) saleScore += 3; if (price && currency) saleScore += 3; else if (price) saleScore += 2; if (availability) saleScore += 2; if (stock || inventoryTerms) saleScore += 3; if (explicitSale) saleScore += 3; if (transactional) saleScore += 2; if (mileage) saleScore += 1; if (aggregate) saleScore -= 10; if (informative && !source.strict) saleScore -= 8;
  const saleVerified = !aggregate && !informative && (source.strict || saleScore >= 6), images = saleVerified ? extractImageCandidates(html, url, source, listingTitle) : [], image = images[0]?.url || null;
  return { saleVerified, saleScore, image, imageVerified: Boolean(image), imageScore: images[0]?.score || null, price: price || null, pageText: text.slice(0, 60000), listingTitle, structuredVehicle, structuredOffer, informative, aggregate };
}
async function fetchPage(candidate) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 7000);
  try {
    const r = await fetch(candidate.url, { redirect: "follow", signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahCarSearch/3.0)", Accept: "text/html,application/xhtml+xml" } });
    if (!r.ok) return null; const finalUrl = canonicalUrl(r.url || candidate.url); if (!candidate.source.isCandidate(finalUrl) && candidate.source.strict) return null; const type = r.headers.get("content-type") || ""; if (!type.includes("text/html")) return null; const html = (await r.text()).slice(0, 1_800_000); return { ...inspectPage(html, finalUrl, candidate.source), finalUrl };
  } catch { return null; } finally { clearTimeout(timer); }
}
async function mapLimit(items, limit, fn) { const out = new Array(items.length); let next = 0; async function worker() { for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); } } await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out; }
function extractFields(text = "", preferredTitle = "") {
  const t = normalizeDigits(`${preferredTitle} ${text}`), titlePart = normalizeDigits(preferredTitle || "");
  const yearInTitle = [...titlePart.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1])).find(y => y >= 2000 && y <= 2035), year = yearInTitle || [...t.matchAll(/\b(20\d{2})\b/g)].map(x => Number(x[1])).find(y => y >= 2000 && y <= 2035) || null, brand = detectBrand(titlePart) || detectBrand(t), model = detectModel(titlePart) || detectModel(t);
  const km = t.match(/([1-9][\d,]{1,8})\s*(?:km|kilometers?|كم|كيلو)/i), mileage = km ? Number(km[1].replace(/,/g, "")) : null, city = /riyadh|الرياض/i.test(t) ? "Riyadh" : /jeddah|جدة/i.test(t) ? "Jeddah" : /dammam|الدمام/i.test(t) ? "Dammam" : null;
  const currencyPrice = t.match(/(?:SAR|ر\.س)\s*([1-9][\d,]{3,8})|([1-9][\d,]{3,8})\s*(?:SAR|ريال|ر\.س)/i), price = currencyPrice ? Number((currencyPrice[1] || currencyPrice[2]).replace(/,/g, "")) : null, newSignal = /\bnew\b|brand new|جديد|جديدة|زيرو|صفر كيلو|غير مستخدم|وكالة/i.test(t), usedSignal = /\bused\b|pre-owned|مستعمل|مستعملة|ممشى/i.test(t);
  return { brand, model, year, mileage, city, price, newSignal, usedSignal };
}
function resultCondition(fields, requested, source) { if (source.conditions.length === 1) return source.conditions[0]; if (fields.usedSignal || (fields.mileage != null && fields.mileage > 100)) return "used"; if (fields.newSignal || fields.mileage === 0) return "new"; return requested; }
function matches(c, i, condition) { if (c.condition !== condition) return false; if (i.brand && c.brand && c.brand !== i.brand) return false; if (i.brand && !c.brand) return false; if (i.model && c.model && c.model !== i.model) return false; if (i.model && !c.model) return false; if (i.minYear && c.year && c.year < i.minYear) return false; if (i.maxYear && c.year && c.year > i.maxYear) return false; if (i.maxPrice && c.price && c.price > i.maxPrice) return false; if (i.maxMileage && c.mileage && c.mileage > i.maxMileage) return false; if (i.city && c.city && c.city !== i.city) return false; return true; }
function score(c, i) { let s = 52; if (c.saleVerified) s += 15; if (c.imageVerified) s += 10; if (c.price) s += 4; if (c.mileage != null) s += 3; if (i.brand && c.brand === i.brand) s += 7; if (i.model && c.model === i.model) s += 7; if (c.sourceStrict) s += 2; return Math.min(s, 99); }
function publicImageHostAllowed(host, source) {
  host = String(host || "").toLowerCase(); if (!host) return false; if (source?.baseHost && hostMatches(host, source.baseHost)) return true;
  return ["syarah.com", "carswitch.com", "halacarly.com", "salehcars.com", "motory.com", "haraj.com.sa", "amazonaws.com", "cloudfront.net", "googleusercontent.com", "googleapis.com"].some(base => hostMatches(host, base));
}
function registerImage(url, source) { const u = safeUrl(url); if (!u || !publicImageHostAllowed(u.hostname, source)) return null; const token = crypto.createHash("sha256").update(`${source.name}|${u.href}`).digest("hex").slice(0, 28); imageRegistry.set(token, { url: u.href, source: source.name, at: Date.now() }); return `/api/image/${token}`; }
function isPrivateIp(ip) { if (!ip) return true; if (net.isIP(ip) === 4) { const p = ip.split(".").map(Number); return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0; } const x = ip.toLowerCase(); return x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:"); }
async function assertPublicHost(hostname) { if (/^(localhost|.*\.localhost)$/i.test(hostname)) throw new Error("blocked image host"); const rows = await dns.lookup(hostname, { all: true, verbatim: true }); if (!rows.length || rows.some(r => isPrivateIp(r.address))) throw new Error("blocked image address"); }
async function buildListings(candidates, condition, intent) {
  const pages = await mapLimit(candidates.slice(0, 72), 7, fetchPage), out = [];
  for (let i = 0; i < candidates.length && i < 72; i++) {
    const r = candidates[i], page = pages[i]; if (!page || !page.saleVerified) continue;
    const preferredTitle = page.listingTitle || r.title || "", combined = `${r.title || ""} ${r.description || ""} ${page.pageText || ""}`, f = extractFields(combined, preferredTitle);
    const c = { source: r.source.name, sourceType: r.source.type, seller: r.source.seller, sourceStrict: r.source.strict, title: preferredTitle || r.title || "", snippet: r.description || "", url: canonicalUrl(page.finalUrl || r.url), brand: f.brand, model: f.model, year: f.year, mileage: f.mileage, city: f.city, price: page.price || f.price || null, condition: resultCondition(f, condition, r.source), saleVerified: true, saleScore: page.saleScore, image: page.image || null, imageVerified: Boolean(page.imageVerified), imageSource: page.image ? "listing_page" : null, imageScore: page.imageScore || null };
    if (!matches(c, intent, condition)) continue; c.displayImage = c.image ? (registerImage(c.image, r.source) || c.image) : null; c.score = score(c, intent); out.push(c);
  }
  const seen = new Set(); return out.filter(c => { const key = canonicalUrl(c.url).replace(/\/$/, ""); if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => b.score - a.score).slice(0, 36);
}
function summary(query, cars, condition) {
  if (!cars.length) return detectArabic(query) ? `ما لقيت سيارات ${condition === "new" ? "جديدة" : "مستعملة"} مؤكدة للبيع تطابق طلبك حالياً.` : `I couldn't find verified ${condition} cars for sale matching your request.`;
  const withImages = cars.filter(c => c.imageVerified).length, sourceCount = new Set(cars.map(c => c.source)).size;
  return detectArabic(query) ? `لقيت ${cars.length} سيارة مؤكدة للبيع من ${sourceCount} مصادر، ${withImages} منها بصور مأخوذة من صفحة الإعلان نفسها.` : `I found ${cars.length} verified cars for sale across ${sourceCount} sources; ${withImages} include an image extracted from the exact listing page.`;
}
app.get("/api/sources", (req, res) => res.json({ sources: SOURCES.map(({ name, type, seller, brands, conditions }) => ({ name, type, seller, brands, conditions })) }));
app.get("/api/diagnostics", (req, res) => res.json({ ok: true, logic: "inventory-v3", cacheEntries: searchCache.size, imageTokens: imageRegistry.size, sources: SOURCES.map(s => ({ name: s.name, ...(sourceHealth.get(s.name) || { ok: null, lastChecked: null, failures: 0, total: 0, lastError: null }) })) }));
app.get("/api/health", (req, res) => res.json({ ok: true, search: Boolean(braveKey), sources: SOURCES.length, logic: "inventory-v3", images: "exact-listing-page + guarded same-origin relay" }));
app.get("/api/image/:token", async (req, res) => {
  const entry = imageRegistry.get(req.params.token); if (!entry || Date.now() - entry.at > IMAGE_TOKEN_TTL) return res.status(404).end(); const u = safeUrl(entry.url); if (!u) return res.status(404).end(); const source = SOURCES.find(s => s.name === entry.source); if (!source || !publicImageHostAllowed(u.hostname, source)) return res.status(403).end();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    await assertPublicHost(u.hostname); const r = await fetch(u, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahImageRelay/1.0)", Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", Referer: `https://${source.baseHost}/` } });
    if (!r.ok) return res.status(502).end(); const type = (r.headers.get("content-type") || "").toLowerCase(); if (!type.startsWith("image/")) return res.status(415).end(); const len = Number(r.headers.get("content-length") || 0); if (len && len > MAX_IMAGE_BYTES) return res.status(413).end(); const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length || buf.length > MAX_IMAGE_BYTES) return res.status(413).end(); res.set({ "Content-Type": type, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" }); res.send(buf);
  } catch { res.status(502).end(); } finally { clearTimeout(timer); }
});
app.post("/api/search", async (req, res) => {
  try {
    const query = String(req.body?.query || "").trim(); if (!query) return res.status(400).json({ error: "Query is required" }); if (query.length > 300) return res.status(400).json({ error: "Query is too long" });
    const condition = req.body?.condition === "new" ? "new" : "used", filters = req.body?.filters && typeof req.body.filters === "object" ? req.body.filters : {}, cacheKey = JSON.stringify({ q: query.toLowerCase(), condition, filters }), hit = searchCache.get(cacheKey); if (hit && Date.now() - hit.at < CACHE_TTL) return res.json({ ...hit.value, cached: true });
    const intent = mergedIntent(basicIntent(query), filters), raw = await searchAll(query, condition, intent, filters), listings = await buildListings(raw, condition, intent), counts = listings.reduce((a, c) => { a[c.source] = (a[c.source] || 0) + 1; return a; }, {}), value = { query, condition, intent, answer: summary(query, listings, condition), listings, counts, live: true, cached: false, provider: "Source-specific inventory-v3 + exact listing image extraction" };
    searchCache.set(cacheKey, { at: Date.now(), value }); if (searchCache.size > 200) for (const [k, v] of searchCache) if (Date.now() - v.at > CACHE_TTL) searchCache.delete(k); for (const [k, v] of imageRegistry) if (Date.now() - v.at > IMAGE_TOKEN_TTL) imageRegistry.delete(k); res.json(value);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message || "Live search failed" }); }
});
app.listen(port, () => console.log(`Delilah inventory-v3 running at http://localhost:${port}`));
