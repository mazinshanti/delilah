import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const app = express();
const port = process.env.PORT || 3000;
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";

const CACHE_TTL = 90_000;
const SEARCH_CACHE_TTL = 10 * 60_000;
const IMAGE_TOKEN_TTL = 30 * 60_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_RESULTS = 80;
const MAX_DETAIL_FETCH = 90;
const MAX_SEEDS_PER_SOURCE = 4;
const BRAVE_MIN_GAP_MS = 1150;

const responseCache = new Map();
const braveCache = new Map();
const sourceHealth = new Map();
const imageRegistry = new Map();
let braveTail = Promise.resolve();
let braveLastAt = 0;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const norm = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const isArabic = s => /[\u0600-\u06FF]/.test(String(s || ""));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function hostIs(host, base) { host = String(host || "").toLowerCase(); base = String(base || "").toLowerCase(); return host === base || host.endsWith(`.${base}`); }
function canonical(url = "") {
  const u = safeUrl(url); if (!u) return url; u.hash = "";
  if (hostIs(u.hostname, "haraj.com.sa") && /^\/\d{7,}(?:\/|$)/.test(u.pathname)) return `https://haraj.com.sa${u.pathname}${u.search}`;
  return u.href;
}
function direct(url, base, re) { const u = safeUrl(url); return !!u && hostIs(u.hostname, base) && re.test(u.pathname); }
function deep(url, base, blocked = []) {
  const u = safeUrl(url); if (!u || !hostIs(u.hostname, base)) return false;
  const p = u.pathname.toLowerCase().replace(/\/$/, "") || "/";
  if (p === "/" || blocked.some(x => p === x || p.startsWith(`${x}/`))) return false;
  return p.split("/").filter(Boolean).length >= 2;
}
function sameSource(url, source) { const u = safeUrl(url); return !!u && hostIs(u.hostname, source.baseHost); }
function slug(s = "") { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

const BRAND_ALIASES = {
  jeep: "Jeep", جيب: "Jeep", toyota: "Toyota", تويوتا: "Toyota", nissan: "Nissan", نيسان: "Nissan", lexus: "Lexus", لكزس: "Lexus",
  mercedes: "Mercedes", "mercedes-benz": "Mercedes", مرسيدس: "Mercedes", bmw: "BMW", "بي ام": "BMW", porsche: "Porsche", بورش: "Porsche",
  ford: "Ford", فورد: "Ford", lincoln: "Lincoln", لينكون: "Lincoln", hyundai: "Hyundai", هيونداي: "Hyundai", kia: "Kia", كيا: "Kia",
  volkswagen: "Volkswagen", فولكس: "Volkswagen", chevrolet: "Chevrolet", شفروليه: "Chevrolet", mazda: "Mazda", مازدا: "Mazda", honda: "Honda", هوندا: "Honda",
  mitsubishi: "Mitsubishi", ميتسوبيشي: "Mitsubishi", geely: "Geely", جيلي: "Geely", changan: "Changan", شانجان: "Changan", gac: "GAC", "جي ايه سي": "GAC",
  mg: "MG", "ام جي": "MG", genesis: "Genesis", جينيسيس: "Genesis", jetour: "Jetour", جيتور: "Jetour", haval: "Haval", هافال: "Haval", audi: "Audi", اودي: "Audi",
  "land rover": "Land Rover", "لاند روفر": "Land Rover", "range rover": "Range Rover", "رينج روفر": "Range Rover", cadillac: "Cadillac", كاديلاك: "Cadillac",
  gmc: "GMC", "جي ام سي": "GMC", dodge: "Dodge", دودج: "Dodge", suzuki: "Suzuki", سوزوكي: "Suzuki", isuzu: "Isuzu", ايسوزو: "Isuzu",
  peugeot: "Peugeot", بيجو: "Peugeot", renault: "Renault", رينو: "Renault", chery: "Chery", شيري: "Chery", hongqi: "Hongqi", هونشي: "Hongqi",
  byd: "BYD", بيوايدي: "BYD", tesla: "Tesla", تسلا: "Tesla", lucid: "Lucid", لوسيد: "Lucid"
};
const MODEL_ALIASES = [
  ["wrangler", "Wrangler"], ["رانجلر", "Wrangler"], ["patrol", "Patrol"], ["باترول", "Patrol"], ["land cruiser", "Land Cruiser"], ["لاندكروزر", "Land Cruiser"],
  ["camry", "Camry"], ["كامري", "Camry"], ["x5", "X5"], ["c200", "C200"], ["tucson", "Tucson"], ["توسان", "Tucson"], ["sportage", "Sportage"], ["سبورتاج", "Sportage"],
  ["territory", "Territory"], ["تيريتوري", "Territory"], ["tahoe", "Tahoe"], ["تاهو", "Tahoe"], ["sonata", "Sonata"], ["سوناتا", "Sonata"],
  ["accent", "Accent"], ["اكسنت", "Accent"], ["elantra", "Elantra"], ["النترا", "Elantra"], ["yaris", "Yaris"], ["يارس", "Yaris"], ["corolla", "Corolla"], ["كورولا", "Corolla"],
  ["prado", "Prado"], ["برادو", "Prado"], ["fortuner", "Fortuner"], ["فورتشنر", "Fortuner"], ["explorer", "Explorer"], ["اكسبلورر", "Explorer"],
  ["expedition", "Expedition"], ["اكسبديشن", "Expedition"], ["grand cherokee", "Grand Cherokee"], ["جراند شيروكي", "Grand Cherokee"], ["cayenne", "Cayenne"], ["كايين", "Cayenne"],
  ["tiguan", "Tiguan"], ["تيجوان", "Tiguan"], ["pegas", "Pegas"], ["بيجاس", "Pegas"], ["x70", "X70"], ["x50", "X50"], ["t2", "T2"], ["t1", "T1"]
];
const MODEL_BRAND = { Wrangler: "Jeep", Patrol: "Nissan", "Land Cruiser": "Toyota", Camry: "Toyota", X5: "BMW", C200: "Mercedes", Tucson: "Hyundai", Sportage: "Kia", Territory: "Ford", Tahoe: "Chevrolet", Sonata: "Hyundai", Accent: "Hyundai", Elantra: "Hyundai", Yaris: "Toyota", Corolla: "Toyota", Prado: "Toyota", Fortuner: "Toyota", Explorer: "Ford", Expedition: "Ford", "Grand Cherokee": "Jeep", Cayenne: "Porsche", Tiguan: "Volkswagen", Pegas: "Kia", X70: "Jetour", X50: "Jetour", T1: "Jetour", T2: "Jetour" };
const AR_MODEL = { Wrangler: "رانجلر", Patrol: "باترول", "Land Cruiser": "لاندكروزر", Camry: "كامري", Tucson: "توسان", Sportage: "سبورتاج", Tahoe: "تاهو", Sonata: "سوناتا", Accent: "اكسنت", Elantra: "النترا", Yaris: "يارس", Corolla: "كورولا", Prado: "برادو", Fortuner: "فورتشنر" };
function detectBrand(text = "") { const q = norm(text).toLowerCase(); for (const [k, v] of Object.entries(BRAND_ALIASES)) if (q.includes(k)) return v; return null; }
function detectModel(text = "") { const q = norm(text).toLowerCase(); for (const [k, v] of MODEL_ALIASES) if (q.includes(k)) return v; return null; }
function basicIntent(query = "") {
  const q = norm(query.toLowerCase()); const model = detectModel(q); const brand = detectBrand(q) || MODEL_BRAND[model] || null;
  const i = { brand, model, minYear: null, maxYear: null, maxPrice: null, maxMileage: null, city: null, query };
  const yrs = [...q.matchAll(/\b(20\d{2})\b/g)].map(x => +x[1]); if (yrs.length) i.minYear = Math.min(...yrs);
  const p = q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})/); if (p) i.maxPrice = +p[1];
  const km = q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/); if (km) i.maxMileage = +km[1];
  if (/riyadh|الرياض/.test(q)) i.city = "Riyadh"; else if (/jeddah|جدة/.test(q)) i.city = "Jeddah"; else if (/dammam|الدمام/.test(q)) i.city = "Dammam";
  return i;
}
function mergedIntent(i, f = {}) { return { ...i, minYear: +f.minYear || i.minYear, maxYear: +f.maxYear || i.maxYear, maxPrice: +f.maxPrice || i.maxPrice, maxMileage: +f.maxMileage || i.maxMileage, city: f.city || i.city }; }

const strict = (name, type, seller, conditions, priority, baseHost, queries, isCandidate, brands = []) => ({ name, type, seller, conditions, priority, baseHost, queries, isCandidate, brands, strict: true });
const flexible = (name, type, seller, conditions, priority, baseHost, queries, isCandidate, brands = []) => ({ name, type, seller, conditions, priority, baseHost, queries, isCandidate, brands, strict: false });
const SOURCES = [
  strict("Haraj", "marketplace", "Haraj", ["new", "used"], 100, "haraj.com.sa", (q, c) => [`${q} site:haraj.com.sa`, `${q} ${c === "new" ? "جديد" : "مستعمل"} حراج سيارات`], u => direct(u, "haraj.com.sa", /^\/\d{7,}(?:\/|$)/)),
  strict("Syarah", "marketplace", "Syarah", ["new", "used"], 99, "syarah.com", q => [`${q} site:syarah.com/en/cardetail`, `${q} site:syarah.com/ar/cardetail`], u => direct(u, "syarah.com", /^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-\d+\/?$/i)),
  strict("CarSwitch Saudi", "marketplace", "CarSwitch Saudi", ["used"], 98, "carswitch.com", q => [`${q} site:ksa.carswitch.com used car`], u => { const x = safeUrl(u); if (!x || !hostIs(x.hostname, "carswitch.com")) return false; const p = x.pathname.toLowerCase().replace(/\/$/, ""); return p.includes("/used-cars/") && !/(\/search|\/used-cars)$/.test(p) && p.split("/").filter(Boolean).length >= 3; }),
  strict("Carly", "certified_used", "Carly - كارلي", ["new", "used"], 98, "halacarly.com", q => [`${q} site:halacarly.com/vehicle-details`], u => direct(u, "halacarly.com", /^\/(?:en|ar)\/vehicle-details\/[^/]+\/?$/i)),
  strict("Saleh Cars", "independent_dealer", "Saleh Cars Group", ["new"], 97, "salehcars.com", q => [`${q} site:salehcars.com/cars`], u => direct(u, "salehcars.com", /^\/(?:en\/)?cars\/[a-f0-9]{20,32}\/[^/]+\/?$/i)),
  strict("Motory", "marketplace", "Motory", ["new", "used"], 96, "motory.com", q => [`${q} site:ksa.motory.com/en/cars-for-sale`], u => direct(u, "motory.com", /^\/en\/cars-for-sale\/(?:[^/]+-haraj\/)?[^/]+\/[^/]+\/20\d{2}\/\d+\/?$/i)),
  flexible("OpenSooq", "marketplace", "OpenSooq", ["new", "used"], 90, "opensooq.com", q => [`${q} site:sa.opensooq.com cars for sale`], u => { const x = safeUrl(u); if (!x || !hostIs(x.hostname, "opensooq.com")) return false; const p = x.pathname.toLowerCase(); if (/\/reviews?(\/|$)/.test(p) || /\/cars\/cars-for-sale(?:\/[^/]+){0,4}\/?$/.test(p)) return false; return /\/(?:ad|listing|post)\//.test(p) && /\d{5,}/.test(p); }),
  flexible("Key Used Cars", "independent_dealer", "Key Used Cars", ["used"], 87, "key.sa", q => [`${q} site:key.sa used car price kilometers`], u => deep(u, "key.sa", ["/en", "/ar", "/en/car-selling-saudi-arabia"])),
  flexible("Toyota ALJ", "official_dealer", "Abdul Latif Jameel Motors", ["new"], 93, "toyota.com.sa", q => [`${q} site:toyota.com.sa price buy`], u => deep(u, "toyota.com.sa", ["/en", "/en/vehicles"]), ["Toyota"]),
  flexible("Lexus ALJ", "official_dealer", "Lexus Abdul Latif Jameel", ["new"], 92, "lexus.com.sa", q => [`${q} site:lexus.com.sa price buy`], u => deep(u, "lexus.com.sa", ["/en"]), ["Lexus"]),
  flexible("Nissan Petromin", "official_dealer", "Petromin Nissan", ["new"], 92, "petromin-nissan.com", q => [`${q} site:petromin-nissan.com price buy`], u => deep(u, "petromin-nissan.com", ["/", "/vehicles"]), ["Nissan"]),
  flexible("Ford Al Jazirah", "official_dealer", "Al Jazirah Vehicles Agencies", ["new"], 91, "aljazirahford.com", q => [`${q} site:aljazirahford.com price buy`], u => deep(u, "aljazirahford.com", ["/"]), ["Ford", "Lincoln"]),
  flexible("Mercedes Juffali", "official_dealer", "Juffali Automotive Company", ["new", "used"], 91, "mercedes-benz-mena.com", (q, c) => [`${q} ${c === "used" ? "pre-owned stock" : "available cars"} site:mercedes-benz-mena.com/ksa/en`], u => deep(u, "mercedes-benz-mena.com", ["/ksa/en", "/ksa/en/new-models", "/ksa/en/buy-new"]), ["Mercedes"]),
  flexible("BMW Naghi", "official_dealer", "Mohamed Yousuf Naghi Motors BMW", ["new", "used"], 91, "bmw-saudiarabia.com", (q, c) => [`${q} ${c === "used" ? "pre-owned" : "stock"} site:bmw-saudiarabia.com`], u => deep(u, "bmw-saudiarabia.com", ["/", "/models", "/new-models"]), ["BMW"]),
  flexible("Kia Aljabr", "official_dealer", "Aljabr Kia", ["new"], 89, "kia.com", q => [`${q} site:kia.com/aljabr price`], u => deep(u, "kia.com", ["/aljabr/en"]), ["Kia"]),
  flexible("Porsche SAMACO", "official_dealer", "SAMACO Porsche", ["new", "used"], 90, "samaco.com.sa", q => [`${q} site:samaco.com.sa/en/porsche`], u => deep(u, "samaco.com.sa", ["/en/porsche"]), ["Porsche"]),
  flexible("Volkswagen SAMACO", "certified_used", "SAMACO Volkswagen", ["new", "used"], 88, "vw.com.sa", q => [`${q} site:vw.com.sa price`], u => deep(u, "vw.com.sa", ["/"]), ["Volkswagen"]),
  flexible("Chevrolet Saudi Dealers", "official_dealer", "Aljomaih / Universal Motors", ["new"], 87, "chevroletarabia.com", q => [`${q} site:chevroletarabia.com/sa-en price`], u => deep(u, "chevroletarabia.com", ["/sa-en"]), ["Chevrolet"])
];
function eligibleSources(condition, intent, filters = {}) {
  let x = SOURCES.filter(s => s.conditions.includes(condition));
  if (filters.sourceType) x = x.filter(s => s.type === filters.sourceType);
  if (filters.seller) x = x.filter(s => s.name === filters.seller);
  if (intent.brand) x = x.filter(s => !s.brands.length || s.brands.some(b => b.toLowerCase() === intent.brand.toLowerCase()));
  return x.sort((a, b) => b.priority - a.priority);
}

async function braveSearchNow(q, count = 20) {
  if (!braveKey) throw new Error("BRAVE_SEARCH_API_KEY is missing");
  const cached = braveCache.get(q); if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL) return cached.value;
  const u = new URL("https://api.search.brave.com/res/v1/web/search"); u.searchParams.set("q", q); u.searchParams.set("country", "SA"); u.searchParams.set("count", String(Math.min(count, 20))); u.searchParams.set("text_decorations", "false");
  let err;
  for (let a = 0; a < 3; a++) {
    const c = new AbortController(), timer = setTimeout(() => c.abort(), 10_000);
    try {
      const r = await fetch(u, { signal: c.signal, headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": braveKey } });
      if (r.ok) { const d = await r.json(); const v = d.web?.results || []; braveCache.set(q, { at: Date.now(), value: v }); return v; }
      err = new Error(`Search provider error ${r.status}`); if (r.status !== 429 && r.status < 500) throw err;
      const retry = Number(r.headers.get("retry-after") || 0); if (retry) await sleep(Math.min(retry * 1000, 5000));
    } catch (e) { err = e; } finally { clearTimeout(timer); }
    if (a < 2) await sleep(500 * (2 ** a));
  }
  throw err || new Error("Search provider failed");
}
function braveSearch(q, count = 20) {
  const job = braveTail.then(async () => { const wait = Math.max(0, BRAVE_MIN_GAP_MS - (Date.now() - braveLastAt)); if (wait) await sleep(wait); const out = await braveSearchNow(q, count); braveLastAt = Date.now(); return out; });
  braveTail = job.catch(() => {}); return job;
}

function decodeHtml(s = "") { return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
function stripHtml(html = "") { return decodeHtml(String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim(); }
function meta(html, key) { const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const a = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i").exec(html) || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`, "i").exec(html); return a ? decodeHtml(a[1]) : null; }
function absolute(v, base) { if (!v) return null; try { return new URL(String(v).replace(/\\u002F/gi, "/").replace(/\\\//g, "/"), base).href; } catch { return null; } }
function priceNum(v) { if (v == null) return null; const n = Number(String(v).replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n >= 1000 && n <= 5_000_000 ? n : null; }
function collectJson(node, out = []) { if (!node) return out; if (Array.isArray(node)) { for (const x of node) collectJson(x, out); return out; } if (typeof node !== "object") return out; out.push(node); for (const v of Object.values(node)) if (v && typeof v === "object") collectJson(v, out); return out; }
function parseLd(html) { const objects = []; for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { collectJson(JSON.parse(m[1].trim()), objects); } catch {} } return objects; }
function ldType(o) { const t = o?.["@type"]; return Array.isArray(t) ? t.map(String) : t ? [String(t)] : []; }
function titleText(html = "") { const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]; const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]; return stripHtml(h1 || meta(html, "og:title") || title || "").slice(0, 240); }
function imageRejected(url = "", context = "") { const s = `${url} ${context}`.toLowerCase(); return !/^https?:/.test(url) || /(logo|favicon|icon|sprite|placeholder|default[-_]?image|brandmark|social[-_]?share|whatsapp|payment|footer|header|arrow|badge|warranty|inspection|app-store|google-play|avatar|profile)/.test(s); }
function pushImage(list, value, base, score, context = "") { if (!value) return; for (const p of String(value).split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean)) { const url = absolute(p, base); if (url && !imageRejected(url, context)) list.push({ url, score, context }); } }
function bestImage(html, base, source) {
  const list = [];
  for (const o of parseLd(html)) { const imgs = Array.isArray(o.image) ? o.image : [o.image]; for (const img of imgs) { if (!img) continue; pushImage(list, typeof img === "string" ? img : (img.url || img.contentUrl), base, 120, "jsonld car image"); } }
  pushImage(list, meta(html, "og:image"), base, 112, "og:image"); pushImage(list, meta(html, "twitter:image"), base, 105, "twitter:image");
  for (const m of String(html).matchAll(/<(?:img|source)\b([^>]+)>/gi)) { const a = m[1], alt = /(?:alt|title)=["']([^"']*)["']/i.exec(a)?.[1] || ""; for (const k of ["src", "data-src", "data-lazy-src", "data-original", "data-image", "srcset", "data-srcset"]) { const v = new RegExp(`${k}=["']([^"']+)["']`, "i").exec(a)?.[1]; if (v) pushImage(list, v, base, /srcset/.test(k) ? 80 : 85, `${alt} ${k}`); } }
  const expanded = String(html).replace(/\\u002F/gi, "/").replace(/\\\//g, "/"); let n = 0; for (const m of expanded.matchAll(/https?:\/\/[^"'\\\s<>]+?\.(?:jpe?g|png|webp)(?:\?[^"'\\\s<>]*)?/gi)) { if (n++ > 160) break; pushImage(list, m[0], base, 60, "embedded"); }
  for (const x of list) { const u = safeUrl(x.url); if (!u) x.score = -1; else { const p = u.pathname.toLowerCase(); if (/(car|vehicle|gallery|listing|product|upload|media)/.test(p)) x.score += 10; if (source.name === "Motory" && (hostIs(u.hostname, "amazonaws.com") || hostIs(u.hostname, "motory.com"))) x.score += 18; if (source.name === "Syarah" && hostIs(u.hostname, "syarah.com")) x.score += 18; if (source.name === "Saleh Cars" && hostIs(u.hostname, "salehcars.com")) x.score += 18; } }
  return list.sort((a, b) => b.score - a.score)[0]?.url || null;
}
function extractCatalogCandidates(html, base, source) {
  const out = [], seen = new Set();
  for (const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1], body = m[2], href = /href=["']([^"']+)["']/i.exec(attrs)?.[1]; const url = canonical(absolute(href, base));
    if (!url || !source.isCandidate(url) || seen.has(url)) continue; seen.add(url);
    const title = stripHtml(body).slice(0, 260); let image = null; const tag = /<(?:img|source)\b([^>]+)>/i.exec(body)?.[1] || "";
    for (const k of ["src", "data-src", "data-lazy-src", "data-original", "srcset", "data-srcset"]) { const v = new RegExp(`${k}=["']([^"']+)["']`, "i").exec(tag)?.[1]; if (v) { const x = absolute(String(v).split(",")[0].trim().split(/\s+/)[0], base); if (x && !imageRejected(x, title)) { image = x; break; } } }
    out.push({ url, title, description: title, catalogImage: image, source });
  }
  const patterns = [];
  if (source.name === "Haraj") patterns.push(/(?:https?:\/\/(?:beta\.)?haraj\.com\.sa)?\/(\d{7,})(?:\/[^"'<>\s]*)?/gi);
  if (source.name === "Syarah") patterns.push(/(?:https?:\/\/[^"'<>\s]*syarah\.com)?\/(?:en|ar)?\/?cardetail\/[a-z0-9%_-]+-\d+\/?/gi);
  if (source.name === "Motory") patterns.push(/(?:https?:\/\/[^"'<>\s]*motory\.com)?\/en\/cars-for-sale\/(?:[^/"'<>\s]+-haraj\/)?[^/"'<>\s]+\/[^/"'<>\s]+\/20\d{2}\/\d+\/?/gi);
  if (source.name === "Saleh Cars") patterns.push(/(?:https?:\/\/[^"'<>\s]*salehcars\.com)?\/(?:en\/)?cars\/[a-f0-9]{20,32}\/[^"'<>\s/]+\/?/gi);
  for (const re of patterns) for (const m of String(html).replace(/\\\//g, "/").matchAll(re)) { const raw = m[0].startsWith("http") ? m[0] : absolute(m[0], base); const url = canonical(raw); if (url && source.isCandidate(url) && !seen.has(url)) { seen.add(url); out.push({ url, title: "", description: "", catalogImage: null, source }); } }
  return out;
}
async function fetchHtml(url, timeout = 7000) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, { redirect: "follow", signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahCarSearch/4.0)", Accept: "text/html,application/xhtml+xml" } }); if (!r.ok) return null; const type = r.headers.get("content-type") || ""; if (!type.includes("text/html")) return null; return { html: (await r.text()).slice(0, 2_200_000), url: canonical(r.url || url) }; } catch { return null; } finally { clearTimeout(timer); }
}
function derivedSeeds(source, query, intent) {
  const seeds = [];
  if (source.name === "Haraj" && intent.model) {
    const term = `${isArabic(query) ? (AR_MODEL[intent.model] || intent.model) : intent.model}${intent.minYear ? ` ${intent.minYear}` : ""}`;
    seeds.push(`https://haraj.com.sa/tags/${encodeURIComponent(term)}/`);
  }
  if (source.name === "Motory" && intent.brand && intent.model) {
    const b = slug(intent.brand), m = slug(intent.model), y = intent.minYear ? `${intent.minYear}/` : "";
    seeds.push(`https://ksa.motory.com/en/cars-for-sale/${b}/${m}/${y}`);
    if (intent.city) seeds.push(`https://ksa.motory.com/en/cars-for-sale/${slug(intent.city)}-haraj/${b}/${m}/${y}`);
  }
  return seeds;
}
async function expandSeed(seed, source) { const doc = await fetchHtml(seed); if (!doc) return []; return extractCatalogCandidates(doc.html, doc.url, source); }
async function searchSource(source, query, condition, intent) {
  const queries = source.queries(query, condition).slice(0, 1);
  const runs = await Promise.allSettled(queries.map(q => braveSearch(q, 20)));
  const out = [], seeds = [...derivedSeeds(source, query, intent)], seen = new Set();
  for (const run of runs) {
    if (run.status !== "fulfilled") continue;
    for (const r of run.value) {
      if (!r.url || !sameSource(r.url, source)) continue;
      const url = canonical(r.url);
      if (source.isCandidate(url)) { if (!seen.has(url)) { seen.add(url); out.push({ ...r, url, source }); } }
      else if (seeds.length < MAX_SEEDS_PER_SOURCE) seeds.push(url);
    }
  }
  const expanded = await Promise.allSettled([...new Set(seeds)].slice(0, MAX_SEEDS_PER_SOURCE).map(s => expandSeed(s, source)));
  for (const e of expanded) if (e.status === "fulfilled") for (const r of e.value) if (!seen.has(r.url)) { seen.add(r.url); out.push(r); }
  const failed = runs.filter(x => x.status === "rejected");
  sourceHealth.set(source.name, { ok: out.length > 0 || failed.length < runs.length, lastChecked: new Date().toISOString(), failures: failed.length, total: runs.length, candidates: out.length, seeds: [...new Set(seeds)].length, lastError: failed[0]?.reason?.message || null });
  return out.slice(0, 45);
}
async function searchAll(query, condition, intent, filters) {
  const sources = eligibleSources(condition, intent, filters); const out = [], seen = new Set();
  const batches = await Promise.allSettled(sources.map(s => searchSource(s, query, condition, intent)));
  for (const b of batches) if (b.status === "fulfilled") for (const r of b.value) { const k = canonical(r.url).replace(/\/$/, ""); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out.slice(0, 180);
}

function inspectPage(html, url, source) {
  const text = stripHtml(html).slice(0, 100000), ld = parseLd(html), listingTitle = titleText(html); let price = null, structuredVehicle = false, structuredOffer = false;
  for (const o of ld) { const types = ldType(o).map(x => x.toLowerCase()); if (types.some(t => ["vehicle", "car", "product", "individualproduct"].includes(t))) structuredVehicle = true; if (types.includes("offer") || o.offers) structuredOffer = true; const offer = Array.isArray(o.offers) ? o.offers[0] : o.offers; if (!price && offer) price = priceNum(offer.price || offer.lowPrice || offer.highPrice); if (!price) price = priceNum(o.price); }
  price = price || priceNum(meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price"));
  const directEvidence = source.isCandidate(url), explicitSale = /(for sale|cash price|selling price|contact seller|buy now|reserve|post number|listing\s*#|vehicle id|للبيع|شراء السيارة|رقم الإعلان|رقم الاعلان|السعر)/i.test(text), informational = /(\/news\/|\/blog\/|\/guide\/|\/reviews?\/|brochure|owner.?s manual|press release|الأخبار|مقال|كتيب)/i.test(url);
  const saleVerified = !informational && (directEvidence || structuredOffer || (structuredVehicle && explicitSale) || explicitSale);
  return { saleVerified, price, pageText: text, listingTitle, image: saleVerified ? bestImage(html, url, source) : null };
}
async function fetchPage(candidate) { const doc = await fetchHtml(candidate.url, 6500); if (!doc) return null; if (candidate.source.strict && !candidate.source.isCandidate(doc.url)) return null; return { ...inspectPage(doc.html, doc.url, candidate.source), finalUrl: doc.url }; }
async function mapLimit(items, limit, fn) { const out = new Array(items.length); let next = 0; async function worker() { for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); } } await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return out; }
const PARTS_RE = /(قطع غيار|صدام|طرمبة|فحمات|مساعدات|شمعات|كفرات|جنط|جنوط|مكينة|قير للبيع|باب|كبوت|تيربو|راديتر|اكسسوارات|bumper|headlight|taillight|spare parts|engine part|gearbox part)/i;
function extractFields(text = "", preferredTitle = "") {
  const t = norm(`${preferredTitle} ${text}`), title = norm(preferredTitle || ""); let model = detectModel(title) || detectModel(t), brand = detectBrand(title) || detectBrand(t) || MODEL_BRAND[model] || null;
  const yearTitle = [...title.matchAll(/\b(20\d{2})\b/g)].map(x => +x[1]).find(y => y >= 2000 && y <= 2035), year = yearTitle || [...t.matchAll(/\b(20\d{2})\b/g)].map(x => +x[1]).find(y => y >= 2000 && y <= 2035) || null;
  const km = t.match(/([0-9][\d,]{0,8})\s*(?:km|kilometers?|كم|كيلو)/i), mileage = km ? +km[1].replace(/,/g, "") : null;
  const city = /riyadh|الرياض/i.test(t) ? "Riyadh" : /jeddah|جدة/i.test(t) ? "Jeddah" : /dammam|الدمام/i.test(t) ? "Dammam" : null;
  const pm = t.match(/(?:SAR|ر\.س)\s*([1-9][\d,]{3,8})|([1-9][\d,]{3,8})\s*(?:SAR|ريال|ر\.س)/i), price = pm ? +(pm[1] || pm[2]).replace(/,/g, "") : null;
  const newSignal = /\bnew\b|brand new|condition\s*:?\s*new|جديد|جديدة|زيرو|صفر كيلو|غير مستخدم/i.test(t), usedSignal = /\bused\b|pre-owned|condition\s*:?\s*used|مستعمل|مستعملة|ممشى/i.test(t);
  return { brand, model, year, mileage, city, price, newSignal, usedSignal };
}
function resultCondition(f, requested, source) { if (source.conditions.length === 1) return source.conditions[0]; if (f.usedSignal || (f.mileage != null && f.mileage > 100)) return "used"; if (f.newSignal || f.mileage === 0) return "new"; return requested; }
function matches(c, i, condition) {
  if (c.condition !== condition) return false;
  if (i.brand && c.brand && c.brand !== i.brand) return false;
  if (i.model && c.model && c.model !== i.model) return false;
  if (i.minYear && c.year && c.year < i.minYear) return false;
  if (i.maxYear && c.year && c.year > i.maxYear) return false;
  if (i.maxPrice && c.price && c.price > i.maxPrice) return false;
  if (i.maxMileage && c.mileage != null && c.mileage > i.maxMileage) return false;
  if (i.city && c.city && c.city !== i.city) return false;
  return true;
}
function score(c, i) { let s = 50; if (c.saleVerified) s += 15; if (c.imageVerified) s += 10; if (c.price) s += 5; if (c.mileage != null) s += 4; if (c.city) s += 2; if (i.brand && c.brand === i.brand) s += 6; if (i.model && c.model === i.model) s += 6; if (c.sourceStrict) s += 2; return Math.min(s, 99); }
function publicImageHostAllowed(host, source) { host = String(host || "").toLowerCase(); if (source?.baseHost && hostIs(host, source.baseHost)) return true; return ["syarah.com", "carswitch.com", "halacarly.com", "salehcars.com", "motory.com", "haraj.com.sa", "amazonaws.com", "cloudfront.net", "googleusercontent.com", "googleapis.com", "imgix.net"].some(base => hostIs(host, base)); }
function registerImage(url, source) { const u = safeUrl(url); if (!u || !publicImageHostAllowed(u.hostname, source)) return null; const token = crypto.createHash("sha256").update(`${source.name}|${u.href}`).digest("hex").slice(0, 28); imageRegistry.set(token, { url: u.href, source: source.name, at: Date.now() }); return `/api/image/${token}`; }
function isPrivateIp(ip) { if (!ip) return true; if (net.isIP(ip) === 4) { const p = ip.split(".").map(Number); return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0; } const x = ip.toLowerCase(); return x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:"); }
async function assertPublicHost(hostname) { if (/^(localhost|.*\.localhost)$/i.test(hostname)) throw new Error("blocked image host"); const rows = await dns.lookup(hostname, { all: true, verbatim: true }); if (!rows.length || rows.some(r => isPrivateIp(r.address))) throw new Error("blocked image address"); }
async function buildListings(candidates, condition, intent) {
  const list = candidates.slice(0, MAX_DETAIL_FETCH), pages = await mapLimit(list, 9, fetchPage), out = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i], page = pages[i], directVerified = r.source.strict && r.source.isCandidate(r.url);
    if (!directVerified && (!page || !page.saleVerified)) continue;
    const preferredTitle = page?.listingTitle || r.title || "", combined = `${r.title || ""} ${r.description || ""} ${page?.pageText || ""}`;
    if (r.source.name === "Haraj" && PARTS_RE.test(`${preferredTitle} ${r.description || ""}`)) continue;
    const f = extractFields(combined, preferredTitle); if (!f.brand && intent.brand) f.brand = intent.brand; if (!f.model && intent.model && !PARTS_RE.test(combined)) f.model = intent.model;
    const image = page?.image || r.catalogImage || null, imageSource = page?.image ? "listing_page" : r.catalogImage ? "source_catalog" : null;
    const c = { source: r.source.name, sourceType: r.source.type, seller: r.source.seller, sourceStrict: r.source.strict, title: preferredTitle || r.title || `${intent.brand || ""} ${intent.model || ""}`.trim(), snippet: r.description || "", url: canonical(page?.finalUrl || r.url), brand: f.brand, model: f.model, year: f.year, mileage: f.mileage, city: f.city, price: page?.price || f.price || null, condition: resultCondition(f, condition, r.source), saleVerified: Boolean(directVerified || page?.saleVerified), image, imageVerified: Boolean(image), imageSource };
    if (!matches(c, intent, condition)) continue; c.displayImage = c.image ? (registerImage(c.image, r.source) || c.image) : null; c.score = score(c, intent); out.push(c);
  }
  const seen = new Set(); return out.filter(c => { const k = canonical(c.url).replace(/\/$/, ""); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
function summary(query, cars, condition) { if (!cars.length) return isArabic(query) ? `ما لقيت سيارات ${condition === "new" ? "جديدة" : "مستعملة"} مؤكدة للبيع تطابق طلبك حالياً.` : `I couldn't find verified ${condition} cars for sale matching your request.`; const imgs = cars.filter(c => c.imageVerified).length, sources = new Set(cars.map(c => c.source)).size; return isArabic(query) ? `لقيت ${cars.length} سيارة حقيقية للبيع من ${sources} مصادر، ${imgs} منها بصور مرتبطة مباشرة بالإعلان.` : `I found ${cars.length} real cars for sale across ${sources} sources; ${imgs} include verified source images tied to the listing.`; }

app.get("/api/sources", (req, res) => res.json({ sources: SOURCES.map(({ name, type, seller, brands, conditions }) => ({ name, type, seller, brands, conditions })) }));
app.get("/api/diagnostics", (req, res) => res.json({ ok: true, logic: "inventory-v4", cacheEntries: responseCache.size, braveCache: braveCache.size, imageTokens: imageRegistry.size, sources: SOURCES.map(s => ({ name: s.name, ...(sourceHealth.get(s.name) || { ok: null, candidates: 0, seeds: 0, lastChecked: null }) })) }));
app.get("/api/health", (req, res) => res.json({ ok: true, search: Boolean(braveKey), sources: SOURCES.length, logic: "inventory-v4", maxResults: MAX_RESULTS, images: "listing-page or source-catalog verified + guarded relay" }));
app.get("/api/image/:token", async (req, res) => {
  const entry = imageRegistry.get(req.params.token); if (!entry || Date.now() - entry.at > IMAGE_TOKEN_TTL) return res.status(404).end(); const u = safeUrl(entry.url); if (!u) return res.status(404).end(); const source = SOURCES.find(s => s.name === entry.source); if (!source || !publicImageHostAllowed(u.hostname, source)) return res.status(403).end();
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 8000);
  try { await assertPublicHost(u.hostname); const r = await fetch(u, { redirect: "follow", signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahImageRelay/2.0)", Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", Referer: `https://${source.baseHost}/` } }); if (!r.ok) return res.status(502).end(); const type = (r.headers.get("content-type") || "").toLowerCase(); if (!type.startsWith("image/")) return res.status(415).end(); const len = +(r.headers.get("content-length") || 0); if (len && len > MAX_IMAGE_BYTES) return res.status(413).end(); const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length || buf.length > MAX_IMAGE_BYTES) return res.status(413).end(); res.set({ "Content-Type": type, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" }); res.send(buf); } catch { res.status(502).end(); } finally { clearTimeout(timer); }
});
app.post("/api/search", async (req, res) => {
  try {
    const query = String(req.body?.query || "").trim(); if (!query) return res.status(400).json({ error: "Query is required" }); if (query.length > 300) return res.status(400).json({ error: "Query is too long" });
    const condition = req.body?.condition === "new" ? "new" : "used", filters = req.body?.filters && typeof req.body.filters === "object" ? req.body.filters : {}, key = JSON.stringify({ q: query.toLowerCase(), condition, filters }), hit = responseCache.get(key); if (hit && Date.now() - hit.at < CACHE_TTL) return res.json({ ...hit.value, cached: true });
    const intent = mergedIntent(basicIntent(query), filters), raw = await searchAll(query, condition, intent, filters), listings = await buildListings(raw, condition, intent), counts = listings.reduce((a, c) => (a[c.source] = (a[c.source] || 0) + 1, a), {}), value = { query, condition, intent, answer: summary(query, listings, condition), listings, counts, rawCandidates: raw.length, live: true, cached: false, provider: "Delilah inventory-v4: broad discovery -> direct-ad resolution -> verified enrichment" };
    responseCache.set(key, { at: Date.now(), value }); if (responseCache.size > 250) for (const [k, v] of responseCache) if (Date.now() - v.at > CACHE_TTL) responseCache.delete(k); for (const [k, v] of imageRegistry) if (Date.now() - v.at > IMAGE_TOKEN_TTL) imageRegistry.delete(k); res.json(value);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message || "Live search failed" }); }
});
app.listen(port, () => console.log(`Delilah inventory-v4 running at http://localhost:${port}`));
