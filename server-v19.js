import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v18Port = Number(process.env.DELILAH_V18_PORT || 4300);
const REFRESH_MS = 20 * 60_000;
const FETCH_TIMEOUT = 8000;
const MAX_RESULTS = 2000;

process.env.PORT = String(v18Port);
await import("./server-v18.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));
const inventory = new Map();
let refreshing = false, lastRefreshStarted = null, lastRefreshFinished = null, lastRefreshError = null;

const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function norm(s = "") { return digits(s).toLowerCase().normalize("NFKD").replace(/[\u064b-\u065f\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim(); }
function decodeHtml(s = "") { return String(s).replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"); }
function strip(s = "") { return decodeHtml(String(s)).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function absolute(v, b) { try { return new URL(decodeHtml(String(v || "")), b).href; } catch { return null; } }
function canonical(v = "") { const u = safeUrl(v); if (!u) return v; u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k); u.pathname = u.pathname.replace(/\/$/, "") + "/"; return u.href; }
function directJetour(url = "") { const u = safeUrl(url); return !!u && (u.hostname === "www.jetourksa.com" || u.hostname === "jetourksa.com") && /^\/en\/inventory\/new-cars\/[a-z0-9.-]+_\d+\/?$/i.test(u.pathname); }
function attr(tag, name) { return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] || null; }
function meta(html, key) { return new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i").exec(html)?.[1] || null; }
function imageOkay(url = "") { const u = safeUrl(url); return !!u && !/(logo|favicon|icon|placeholder|sprite|social|share|banner|brandmark|default[-_]?image|accessor|brochure|payment|footer|header)/i.test(u.href); }
function jsonObjects(node, out = []) { if (!node) return out; if (Array.isArray(node)) { for (const x of node) jsonObjects(x, out); return out; } if (typeof node !== "object") return out; out.push(node); for (const v of Object.values(node)) if (v && typeof v === "object") jsonObjects(v, out); return out; }
function bestImage(html, base) {
  const candidates = [];
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { for (const o of jsonObjects(JSON.parse(m[1]))) { const imgs = Array.isArray(o.image) ? o.image : [o.image]; for (const x of imgs) { const v = typeof x === "string" ? x : x?.url || x?.contentUrl, u = absolute(v, base); if (u && imageOkay(u)) candidates.push({ u, s: 120 }); } } } catch {}
  }
  for (const k of ["og:image", "twitter:image"]) { const u = absolute(meta(html, k), base); if (u && imageOkay(u)) candidates.push({ u, s: k === "og:image" ? 110 : 105 }); }
  for (const m of String(html).matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0], alt = attr(tag, "alt") || "";
    for (const k of ["src", "data-src", "data-lazy-src", "data-original", "data-image"]) { const u = absolute(attr(tag, k), base); if (u && imageOkay(u)) candidates.push({ u, s: /t2|x70|x90|dashing|g700|jetour|vehicle|product/i.test(`${u} ${alt}`) ? 90 : 70 }); }
  }
  return candidates.sort((a,b)=>b.s-a.s)[0]?.u || null;
}
function titleFrom(html = "") { const h = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]; return h ? strip(h).slice(0, 220) : null; }
function number(v, min = 0, max = 5_000_000) { const n = Number(String(v || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n >= min && n <= max ? n : null; }
function priceFrom(text = "") {
  const t = digits(text);
  const m = t.match(/([0-9][\d,]*(?:\.\d{1,2})?)\s*Plus\s+Taxes\s*&?\s*Licensing/i)
    || t.match(/Price:\s*[^0-9]{0,12}([0-9][\d,]*(?:\.\d{1,2})?)/i);
  return m ? number(m[1], 1000, 5_000_000) : null;
}
function yearFrom(text = "", title = "") { const m = `${text} ${title}`.match(/(?:ModelYear:\s*)?(20\d{2})\b/i); const y = m ? Number(m[1]) : null; return y && y >= 2020 && y <= 2035 ? y : null; }
function modelFrom(text = "", title = "") { const m = text.match(/\bModel:\s*([A-Za-z0-9 +_-]{1,35}?)(?=\s+(?:Fuel|Four Wheel|Mileage|ModelYear|Stock Number|Drive Type):|$)/i); if (m) return m[1].trim(); const t = String(title || "").split(":")[0].trim(); return t || null; }
function stockFrom(text = "") { return text.match(/Stock\s+Number:\s*([A-Za-z0-9_-]+)/i)?.[1] || null; }
async function fetchHtml(url) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), FETCH_TIMEOUT);
  try { const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; DelilahInventoryIndexer/4.0)", Accept: "text/html,application/xhtml+xml" } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); const ct = (r.headers.get("content-type") || "").toLowerCase(); if (!ct.includes("text/html")) throw new Error(`Unexpected content type ${ct}`); return { html: (await r.text()).slice(0, 3_500_000), url: r.url || url }; }
  finally { clearTimeout(t); }
}
function linksFrom(html, base) { const out = new Set(); for (const m of String(html).matchAll(/href=["']([^"']+)["']/gi)) { const u = absolute(m[1], base); if (u && directJetour(u)) out.add(canonical(u)); } return [...out]; }
async function detail(url) {
  const d = await fetchHtml(url); if (!directJetour(d.url || url)) throw new Error("redirected away from direct stock page");
  const text = strip(d.html); if (/Not\s+available\s+product/i.test(text)) throw new Error("stock unavailable");
  const title = titleFrom(d.html) || "Jetour new car", year = yearFrom(text, title), model = modelFrom(text, title), price = priceFrom(text), image = bestImage(d.html, d.url), stock = stockFrom(text);
  if (!year || !model || !stock) throw new Error("missing unit identity evidence");
  return { source: "Jetour KSA", sourceType: "official_dealer", seller: "Jetour KSA / National Motors Supplies", sourceStrict: true, title, snippet: [stock ? `Stock ${stock}` : null, "New vehicle listed by Jetour KSA"].filter(Boolean).join(" · "), url: canonical(d.url), brand: "Jetour", model, year, trim: title.includes(":") ? title.split(":").slice(1).join(":").trim().replace(/\s+20\d{2}\s*$/, "") : null, mileage: null, city: null, price, priceVerified: Boolean(price), priceSource: price ? "jetour_exact_stock_price" : null, condition: "new", saleVerified: true, saleEvidence: ["direct_stock_url", "stock_number", "vehicle_status_new", price ? "exact_price" : null].filter(Boolean), image, displayImage: image, imageVerified: Boolean(image), imageSource: image ? "listing_page" : null, score: Math.min(98, 86 + (price ? 4 : 0) + (image ? 4 : 0) + (stock ? 3 : 0)), discovery: "jetour_official_stock", stockNumber: stock };
}
async function refresh() {
  if (refreshing) return; refreshing = true; lastRefreshStarted = new Date().toISOString(); lastRefreshError = null;
  try {
    const pages = ["https://www.jetourksa.com/en/inventory/new-cars/", "https://www.jetourksa.com/en/inventory/new-cars/p2/", "https://www.jetourksa.com/en/inventory/new-cars/p3/", "https://www.jetourksa.com/en/inventory/new-cars/p4/"];
    const links = new Set();
    for (const p of pages) { try { const d = await fetchHtml(p); for (const u of linksFrom(d.html, d.url)) links.add(u); } catch (e) { lastRefreshError = `${p}: ${e?.message || e}`; } }
    const all = [...links].slice(0, 120), fresh = new Map(); let k = 0;
    async function worker() { for (;;) { const i = k++; if (i >= all.length) return; const u = all[i]; try { const c = await detail(u); fresh.set(c.url, { ...c, indexedAt: Date.now() }); } catch (e) { if (!/stock unavailable/.test(e?.message || "")) lastRefreshError = `${u}: ${e?.message || e}`; } } }
    await Promise.all(Array.from({ length: Math.min(6, all.length || 1) }, worker));
    if (fresh.size) { inventory.clear(); for (const [u,c] of fresh) inventory.set(u,c); }
    lastRefreshFinished = new Date().toISOString();
  } finally { refreshing = false; }
}
const STOP = new Set(norm("ابي ابغى أبغى اريد أريد سيارة سياره سيارات car cars vehicle vehicles مستعمل مستعمله مستعملة used جديد جديده جديدة new موديل model سنة سنه year years وفوق واكثر وأكثر above over more than تحت اقل أقل under below less than من في الى إلى around about budget ريال sar كم كيلو km بالرياض الرياض riyadh بجدة بجده جدة جده jeddah بالدمام الدمام dammam السعودية السعوديه saudi arabia ksa").split(" "));
const ALIAS = new Map([["جيتور","jetour"]]);
function queryTerms(q = "") { return [...new Set(norm(q).split(" ").filter(t=>t.length>=2&&!STOP.has(t)&&!/^\d+$/.test(t)).map(t=>ALIAS.get(t)||t))]; }
function constraints(body = {}) { const f=body.filters&&typeof body.filters==="object"?body.filters:{},q=digits(String(body.query||"")),ys=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1])); return { terms:queryTerms(q), minYear:Number(f.minYear)||(ys.length?Math.min(...ys):null), maxYear:Number(f.maxYear)||null, maxPrice:Number(f.maxPrice)||null, seller:f.seller||null, sourceType:f.sourceType||null }; }
function results(body = {}) {
  if (body.condition !== "new") return []; const f=constraints(body); if (f.seller && f.seller !== "Jetour KSA") return []; if (f.sourceType && f.sourceType !== "official_dealer") return [];
  return [...inventory.values()].filter(c=>{const b=norm(`${c.brand} ${c.model} ${c.title} ${c.trim||""}`);if(f.terms.length&&!f.terms.every(t=>b.includes(t)))return false;if(f.minYear&&c.year&&c.year<f.minYear)return false;if(f.maxYear&&c.year&&c.year>f.maxYear)return false;if(f.maxPrice&&c.price&&c.price>f.maxPrice)return false;return true}).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,MAX_RESULTS).map(({indexedAt,...c})=>c);
}
function merge(a=[],b=[],max=MAX_RESULTS){const out=[],seen=new Set();for(const c of [...a,...b]){if(!c?.url)continue;const k=canonical(c.url);if(seen.has(k))continue;seen.add(k);out.push(c);if(out.length>=max)break}return out}
function counts(xs=[]){return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{})}
async function upstream(body){const r=await fetch(`http://127.0.0.1:${v18Port}/api/search`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(300000)}),d=await r.json().catch(()=>({error:`Upstream HTTP ${r.status}`}));return{r,d}}

app.post("/api/search",async(req,res)=>{const body=req.body||{},add=results(body),fast=body.phase==="fast";try{const{r,d}=await upstream(body);if(!r.ok){if(add.length)return res.json({query:body.query,condition:"new",listings:add.slice(0,fast?18:MAX_RESULTS),counts:counts(add),live:true,partial:fast,phase:fast?"fast":"full",fallback:"jetour_official_stock"});return res.status(r.status).json(d)}const base=Array.isArray(d.listings)?d.listings:[],listings=merge(base,add,fast?18:MAX_RESULTS);const extraAdded=listings.filter(c=>c.source==="Jetour KSA").length;return res.json({...d,listings,counts:counts(listings),jetourIndexed:inventory.size,jetourAdded:extraAdded,exhaustiveUnique:d.exhaustive?Number(d.exhaustiveUnique||base.length)+extraAdded:d.exhaustiveUnique})}catch(e){if(add.length)return res.json({query:body.query,condition:"new",listings:add.slice(0,fast?18:MAX_RESULTS),counts:counts(add),live:true,partial:fast,phase:fast?"fast":"full",fallback:"jetour_official_stock"});return res.status(502).json({error:e?.message||"Delilah upstream unavailable"})}});
app.get("/api/jetour/stats",(req,res)=>res.json({ok:true,index:"jetour-official-stock-v1",indexed:inventory.size,withImages:[...inventory.values()].filter(c=>c.imageVerified).length,withPrices:[...inventory.values()].filter(c=>c.priceVerified).length,refreshing,lastRefreshStarted,lastRefreshFinished,lastRefreshError,samples:[...inventory.values()].slice(0,8).map(c=>({title:c.title,url:c.url,stockNumber:c.stockNumber,price:c.price}))}));
app.get("/api/health",async(req,res)=>{try{const r=await fetch(`http://127.0.0.1:${v18Port}/api/health`),d=await r.json();res.json({...d,edge:"inventory-v19",jetourOfficialStock:true,jetourIndexed:inventory.size,jetourRefreshing:refreshing})}catch{res.status(503).json({ok:false,edge:"inventory-v19",jetourIndexed:inventory.size})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!["host","content-length","connection"].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);let body;if(!["GET","HEAD"].includes(req.method)&&req.is("application/json")){body=JSON.stringify(req.body||{});headers["content-type"]="application/json"}const r=await fetch(`http://127.0.0.1:${v18Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:"manual"}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!["content-length","transfer-encoding","connection"].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch{return res.status(502).json({error:"Delilah upstream unavailable"})}}
app.use(proxy);
app.listen(externalPort,()=>{console.log(`Delilah inventory-v19 running at http://localhost:${externalPort}`);refresh().catch(()=>{});setInterval(()=>refresh().catch(()=>{}),REFRESH_MS).unref()});
