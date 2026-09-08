import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const FETCH_TIMEOUT = Number(process.env.DALELAH_FETCH_TIMEOUT || 6500);
const FAST_WAIT_MS = Number(process.env.DALELAH_FAST_WAIT_MS || 1600);
const MAX_RESULTS = 500;
const MAX_INDEX = 25000;
const STALE_MS = 36 * 60 * 60_000;
const jobs = new Map();
const inventory = new Map();
const fetchCache = new Map();
const sourceState = new Map();
const running = new Map();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function norm(s = "") {
  return digits(s).toLowerCase().normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
}
function htmlDecode(s = "") {
  return String(s).replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function strip(s = "") {
  return htmlDecode(String(s)).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function canonical(v = "") {
  const u = safeUrl(v); if (!u) return String(v || "");
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  return u.href.replace(/\/$/, "");
}
function absolute(v, base) { try { return new URL(htmlDecode(String(v || "")), base).href; } catch { return null; } }
function attr(tag, name) { return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] || null; }
function num(v, min = 0, max = 5_000_000) {
  const n = Number(String(v || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function yearOf(t = "") {
  const ys = [...digits(t).matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => Number(m[1])).filter(y => y >= 1980 && y <= 2030);
  return ys[0] || null;
}
function mileageOf(t = "") {
  const x = digits(t);
  let m = x.match(/(?:mileage|الممشى|ممشى)[^0-9]{0,20}([0-9][\d,.]{0,8})\s*(?:km|kilometers?|كيلو|كم)?/i)
    || x.match(/([0-9][\d,.]{0,8})\s*(?:km|kilometers?|كيلو|كم)\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[,.]/g, ""));
  return Number.isFinite(n) && n >= 0 && n <= 1_500_000 ? n : null;
}
function priceOf(t = "") {
  const x = digits(t);
  const patterns = [
    /(?:cash price(?: with vat)?|selling price|current price|السعر(?: النقدي)?)[^0-9]{0,45}([0-9][\d,]{3,})/i,
    /(?:SAR|ر\.?س|ريال)\s*([0-9][\d,]{3,})/i,
    /([0-9][\d,]{3,})\s*(?:SAR|ر\.?س|ريال)\b/i
  ];
  for (const re of patterns) {
    const m = x.match(re), p = m ? num(m[1], 1000) : null;
    if (p) return p;
  }
  return null;
}
function cityOf(t = "") {
  const x = norm(t);
  if (/\briyadh\b|الرياض/.test(x)) return "Riyadh";
  if (/\bjeddah\b|جده/.test(x)) return "Jeddah";
  if (/\bdammam\b|الدمام/.test(x)) return "Dammam";
  if (/\bkhobar\b|الخبر/.test(x)) return "Khobar";
  if (/\bmakkah\b|\bmecca\b|مكه/.test(x)) return "Makkah";
  if (/\bmadinah\b|\bmedina\b|المدينه/.test(x)) return "Madinah";
  if (/\btabuk\b|تبوك/.test(x)) return "Tabuk";
  if (/\babha\b|ابها/.test(x)) return "Abha";
  return null;
}
function imageOkay(u = "") {
  const x = safeUrl(u);
  return !!x && !/(logo|favicon|icon|sprite|placeholder|avatar|profile|social|share|badge|banner)/i.test(`${x.pathname} ${x.search}`);
}
function bestImage(seg, base) {
  const meta = String(seg).match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
    || String(seg).match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  if (meta) { const u = absolute(meta[1], base); if (u && imageOkay(u)) return u; }
  for (const m of String(seg).matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    for (const k of ["src","data-src","data-lazy-src","data-original","data-image"]) {
      const u = absolute(attr(m[0], k), base); if (u && imageOkay(u)) return u;
    }
  }
  return null;
}

const AR_ALIASES = new Map([
  ["تويوتا","toyota"],["نيسان","nissan"],["جيب","jeep"],["هيونداي","hyundai"],["كيا","kia"],["فورد","ford"],
  ["شفروليه","chevrolet"],["مرسيدس","mercedes"],["لكزس","lexus"],["بي ام دبليو","bmw"],["بي ام","bmw"],
  ["مازدا","mazda"],["هوندا","honda"],["جيلي","geely"],["شانجان","changan"],["جيتور","jetour"],["هافال","haval"],
  ["اودي","audi"],["بورش","porsche"],["لاند روفر","land rover"],["رينج روفر","range rover"],["جي ام سي","gmc"],
  ["رانجلر","wrangler"],["باترول","patrol"],["لاندكروزر","land cruiser"],["لاند كروزر","land cruiser"],
  ["كامري","camry"],["كورولا","corolla"],["يارس","yaris"],["صني","sunny"],["توسان","tucson"],["سبورتاج","sportage"],
  ["تاهو","tahoe"],["سوناتا","sonata"],["اكسنت","accent"],["النترا","elantra"],["برادو","prado"],["فورتشنر","fortuner"],
  ["هايلوكس","hilux"],["توروس","taurus"],["تورس","taurus"],["تيريتوري","territory"],["سورينتو","sorento"],["سيراتو","cerato"]
]);
function semantic(s = "") {
  let x = norm(s);
  for (const [a,b] of [...AR_ALIASES.entries()].sort((m,n)=>n[0].length-m[0].length)) x = x.replaceAll(norm(a), b);
  return x.replace(/\s+/g, " ").trim();
}
const BRANDS = ["toyota","nissan","jeep","hyundai","kia","ford","chevrolet","mercedes","lexus","bmw","mazda","honda","geely","changan","jetour","haval","audi","porsche","volkswagen","gmc","dodge","suzuki","peugeot","renault","chery","tesla","lucid","genesis","land rover","range rover"];
const MODEL_BRAND = new Map([
  ["camry","toyota"],["corolla","toyota"],["land cruiser","toyota"],["prado","toyota"],["yaris","toyota"],["fortuner","toyota"],["hilux","toyota"],["rav4","toyota"],
  ["patrol","nissan"],["sunny","nissan"],["x trail","nissan"],["kicks","nissan"],["wrangler","jeep"],["grand cherokee","jeep"],
  ["tucson","hyundai"],["elantra","hyundai"],["accent","hyundai"],["sonata","hyundai"],["sportage","kia"],["sorento","kia"],["cerato","kia"],["k5","kia"],
  ["taurus","ford"],["territory","ford"],["explorer","ford"],["tahoe","chevrolet"],["x5","bmw"],["gle","mercedes"],["rx","lexus"],["lx","lexus"]
]);
function identity(text = "") {
  const x = semantic(text);
  let brand = BRANDS.find(b => x.includes(b)) || null, model = null;
  for (const [m,b] of [...MODEL_BRAND.entries()].sort((a,b)=>b[0].length-a[0].length)) {
    if (x.includes(m)) { model = m; if (!brand) brand = b; break; }
  }
  const tc = s => s ? s.split(" ").map(z => z ? z[0].toUpperCase()+z.slice(1) : z).join(" ") : null;
  return { brand: tc(brand), model: tc(model) };
}
function conditionOf(text = "", source = "") {
  const x = semantic(text);
  if (/\bnew\b|جديد|جديده|اصفار|أصفار|بطاقه|بطاقة/.test(x)) return "new";
  if (/\bused\b|مستعمل|ممشى|مالك/.test(x)) return "used";
  const km = mileageOf(text);
  if (km != null && km > 100) return "used";
  if (source === "Saleh Cars") return "new";
  if (source === "Syarah" || source === "YallaMotor" || source === "ArabWheels" || source === "CarSwitch Saudi" || source === "Motory") return "used";
  if (source === "Haraj") return "used";
  return "unknown";
}

async function fetchHtml(url, timeout = FETCH_TIMEOUT) {
  const key = canonical(url), hit = fetchCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(key, { redirect: "follow", signal: AbortSignal.timeout(timeout), headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DalelahBot/1.4; +https://www.dalelah.co)",
        "Accept": "text/html,application/xhtml+xml"
      }});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("text/html")) throw new Error(`content-type ${ct}`);
      const value = { html: (await r.text()).slice(0, 4_000_000), url: r.url || key };
      fetchCache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      last = e;
      if (attempt === 0) await sleep(250);
    }
  }
  throw last || new Error("fetch failed");
}

function urlInfoTitle(url = "") {
  try {
    let s = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
    s = s.replace(/-(?:used|new)-\d+$/i,"").replace(/-\d+$/,'').replace(/[_-]+/g,' ');
    return s.replace(/\b\w/g, c => c.toUpperCase()).trim();
  } catch { return ""; }
}
function extractCards(html, base, source) {
  const raw = [];
  for (const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(m[1])?.[1], u = absolute(href, base);
    if (u && source.candidate(u)) raw.push({ u: canonical(u), inner: m[2], index: m.index || 0 });
  }
  const out = [], seen = new Set();
  for (let i=0; i<raw.length; i++) {
    const r = raw[i]; if (seen.has(r.u)) continue; seen.add(r.u);
    const next = raw[i+1]?.index || Math.min(String(html).length, r.index + 7500);
    const seg = String(html).slice(Math.max(0,r.index-500), Math.min(next,r.index+7500));
    const anchor = strip(r.inner);
    const text = `${anchor} ${strip(seg).slice(0,2600)}`.trim();
    const id = identity(`${anchor} ${r.u}`);
    const title = anchor && anchor.length >= 5 && anchor.length <= 220 ? anchor : (urlInfoTitle(r.u) || `${source.name} car`);
    const price = priceOf(text), image = bestImage(seg, base);
    let condition = source.conditionFromUrl ? source.conditionFromUrl(r.u, text) : conditionOf(text, source.name);
    out.push({
      source: source.name, sourceType: source.type, seller: source.name, channel: source.channel,
      title: title.slice(0,220), snippet: text.slice(0,800), url: r.u, brand: id.brand, model: id.model,
      year: yearOf(`${title} ${text}`), mileage: mileageOf(text), city: cityOf(text), price,
      priceVerified: Boolean(price), condition, saleVerified: true,
      image, displayImage: image, imageVerified: Boolean(image), score: source.priority || 80,
      discovery: "native_background_index"
    });
  }
  return out;
}

function host(u, h) { try { const x = new URL(u).hostname.toLowerCase(); return x === h || x.endsWith(`.${h}`); } catch { return false; } }
const HAR_TAGS = ["كامري","كورولا","لاندكروزر","برادو","يارس","فورتشنر","هايلوكس","باترول","صني","رانجلر","توسان","سبورتاج","تاهو","اكسنت","النترا","سوناتا","تورس","تيريتوري","سورينتو","سيراتو","k5","cx5","اكسبلورر","جيلي","شانجان","هافال","جيتور"];
const range = (n, fn) => Array.from({length:n},(_,i)=>fn(i+1));
const SOURCES = [
  {
    name:"Haraj", type:"marketplace", channel:"classifieds", priority:100, refreshMs:45_000,
    seeds: HAR_TAGS.map(t=>`https://haraj.com.sa/tags/${encodeURIComponent(t)}/`),
    candidate:u=>host(u,"haraj.com.sa") && /^\/\d{8,14}(?:\/[^/?#]+)?\/?$/i.test(new URL(u).pathname),
    queryUrls:q=>[`https://haraj.com.sa/tags/${encodeURIComponent(String(q||"").trim())}/`]
  },
  {
    name:"Syarah", type:"marketplace", channel:"managed_marketplace", priority:99, refreshMs:55_000,
    seeds:range(14,p=>`https://syarah.com/en/autos?page=${p}`),
    candidate:u=>host(u,"syarah.com") && /^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-(?:used|new)-\d+\/?$/i.test(new URL(u).pathname),
    conditionFromUrl:u=>/-new-\d+\/?$/i.test(new URL(u).pathname)?"new":"used"
  },
  {
    name:"YallaMotor", type:"marketplace", channel:"marketplace", priority:96, refreshMs:60_000,
    seeds:range(12,p=>`https://ksa.yallamotor.com/used-cars?page=${p}`),
    candidate:u=>host(u,"ksa.yallamotor.com") && /^\/(?:ar\/)?used-cars\/[^/]+\/[^/]+\/(?:19|20)\d{2}\/[^/]*-\d+\/?$/i.test(new URL(u).pathname),
    conditionFromUrl:()=> "used",
    queryUrls:(q,intent)=>{
      if (intent.brand && intent.model) return [`https://ksa.yallamotor.com/used-cars/${intent.brand.toLowerCase().replace(/\s+/g,"-")}/${intent.model.toLowerCase().replace(/\s+/g,"-")}?page=1`];
      if (intent.brand) return [`https://ksa.yallamotor.com/used-cars/${intent.brand.toLowerCase().replace(/\s+/g,"-")}?page=1`];
      return [];
    }
  },
  {
    name:"ArabWheels", type:"marketplace", channel:"marketplace", priority:94, refreshMs:70_000,
    seeds:range(8,p=>`https://www.arabwheels.sa/en/used-cars/?page=${p}`),
    candidate:u=>host(u,"arabwheels.sa") && /^\/(?:en\/)?used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(new URL(u).pathname),
    conditionFromUrl:()=> "used"
  },
  {
    name:"Saudi Sale", type:"marketplace", channel:"classifieds", priority:93, refreshMs:65_000,
    seeds:["https://cars.saudisale.com/en?newest=1","https://cars.saudisale.com/en?most_viewed=1","https://cars.saudisale.com/en"],
    candidate:u=>host(u,"cars.saudisale.com") && /^\/en\/listings\/[^/]+\/[^/]+\/?$/i.test(new URL(u).pathname)
  },
  {
    name:"Saleh Cars", type:"independent_dealer", channel:"dealer_inventory", priority:92, refreshMs:180_000,
    seeds:["https://www.salehcars.com/en/cars","https://www.salehcars.com/cars"],
    candidate:u=>host(u,"salehcars.com") && /^\/(?:en\/)?cars\/[a-f0-9]{20,32}(?:\/[^/]+)?\/?$/i.test(new URL(u).pathname),
    conditionFromUrl:()=> "new"
  },
  {
    name:"Motory", type:"marketplace", channel:"marketplace", priority:91, refreshMs:70_000,
    seeds:range(10,p=>`https://ksa.motory.com/en/cars-for-sale/?page=${p}`),
    candidate:u=>host(u,"ksa.motory.com") && /^\/en\/cars-for-sale\/(?:[^/]+-haraj\/)?[^/]+\/[^/]+\/(?:19|20)\d{2}\/\d+\/?$/i.test(new URL(u).pathname),
    conditionFromUrl:()=> "used",
    queryUrls:(q,intent)=>{
      if (intent.brand && intent.model) return [`https://ksa.motory.com/en/cars-for-sale/${intent.brand.toLowerCase().replace(/\s+/g,"-")}/${intent.model.toLowerCase().replace(/\s+/g,"-")}/`];
      return [];
    }
  },
  {
    name:"CarSwitch Saudi", type:"managed_marketplace", channel:"inspected_marketplace", priority:90, refreshMs:85_000,
    seeds:range(8,p=>`https://ksa.carswitch.com/en/saudi/used-cars/search?page=${p}`),
    candidate:u=>{
      if (!host(u,"ksa.carswitch.com")) return false;
      const p=new URL(u).pathname.toLowerCase();
      return p.includes("/used-cars/") && !p.endsWith("/search") && !p.includes("/search/") && /\d{4,}/.test(p);
    },
    conditionFromUrl:()=> "used"
  },
  {
    name:"Genesis Wallan Certified", type:"certified_used", channel:"certified_inventory", priority:88, refreshMs:300_000,
    seeds:["https://genesiswallan.com/en/inventory"],
    candidate:u=>host(u,"genesiswallan.com") && /^\/en\/inventory\/(?:19|20)\d{2}-[^/]+\/?$/i.test(new URL(u).pathname),
    conditionFromUrl:()=> "used"
  }
];
for (const s of SOURCES) sourceState.set(s.name,{name:s.name,type:s.type,channel:s.channel,status:"starting",indexed:0,lastSuccess:null,lastAttempt:null,lastError:null,cursor:0,refreshing:false});

function sourceCount(name) { let n=0; for (const c of inventory.values()) if (c.source===name) n++; return n; }
function ingest(cards = []) {
  const now=Date.now(); let added=0, updated=0;
  for (const raw of cards) {
    if (!raw?.url || raw.saleVerified !== true) continue;
    const key=canonical(raw.url), old=inventory.get(key);
    const c={...(old||{}),...raw,url:key,_seenAt:now,_verifiedAt:old?._verifiedAt||null};
    if (!old) added++; else updated++;
    inventory.set(key,c);
  }
  if (inventory.size > MAX_INDEX) {
    const oldest=[...inventory.entries()].sort((a,b)=>(a[1]._seenAt||0)-(b[1]._seenAt||0)).slice(0,inventory.size-MAX_INDEX);
    for(const [k] of oldest) inventory.delete(k);
  }
  return {added,updated};
}
async function enrichHaraj(cards) {
  const targets=cards.slice(0,8), out=[...cards]; let i=0;
  async function worker(){
    for(;;){const n=i++;if(n>=targets.length)return;const c=targets[n];
      try{
        const d=await fetchHtml(c.url,5000), text=strip(d.html).slice(0,80_000), img=bestImage(d.html,d.url), title=strip(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(d.html)?.[1]||"")||c.title;
        const p=priceOf(text), km=mileageOf(text), city=cityOf(text), y=yearOf(`${title} ${text.slice(0,12000)}`), cond=conditionOf(`${title} ${text.slice(0,15000)}`,"Haraj");
        out[n]={...c,title:title.slice(0,220),year:y||c.year,mileage:km??c.mileage,city:city||c.city,price:p??c.price,priceVerified:Boolean(p||c.priceVerified),condition:cond,image:img||c.image,displayImage:img||c.displayImage,imageVerified:Boolean(img||c.imageVerified),_verifiedAt:Date.now()};
      }catch{}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,targets.length||1)},worker));
  return out;
}

async function refreshSource(source, {query=null,intent=null,force=false}={}) {
  const key=source.name, current=running.get(key);
  if (current && !force) return current;
  const task=(async()=>{
    const st=sourceState.get(key); st.refreshing=true; st.lastAttempt=new Date().toISOString(); st.status="refreshing";
    try{
      let urls=[];
      if(query && source.queryUrls) urls=source.queryUrls(query,intent||{})||[];
      if(!urls.length){
        const count=Math.min(source.name==="Haraj"?2:1,source.seeds.length);
        for(let j=0;j<count;j++){urls.push(source.seeds[st.cursor % source.seeds.length]);st.cursor=(st.cursor+1)%source.seeds.length;}
      }
      let cards=[];
      const fetched=await Promise.allSettled(urls.map(u=>fetchHtml(u)));
      for(const f of fetched) if(f.status==="fulfilled") cards.push(...extractCards(f.value.html,f.value.url,source));
      if(source.name==="Haraj" && cards.length) cards=await enrichHaraj(cards);
      const delta=ingest(cards);
      st.lastSuccess=new Date().toISOString(); st.lastError=null; st.status=cards.length?"healthy":"empty"; st.indexed=sourceCount(key); st.lastBatch=cards.length; st.added=delta.added;
      return cards.length;
    }catch(e){
      st.status="error";st.lastError=e?.message||String(e);st.indexed=sourceCount(key);return 0;
    }finally{st.refreshing=false;running.delete(key);}
  })();
  running.set(key,task);return task;
}

function yearIntent(query="", filters={}) {
  if(filters.minYear || filters.maxYear) return {exactYear:null,minYear:Number(filters.minYear)||null,maxYear:Number(filters.maxYear)||null};
  const q=digits(query), ys=[...q.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=1980&&y<=2030);
  if(ys.length>=2) return {exactYear:null,minYear:Math.min(...ys),maxYear:Math.max(...ys)};
  if(ys.length===1){
    const y=ys[0], n=norm(q);
    if(/(?:and above|or newer|and newer|above|from)\b|وفوق|واحدث|وأحدث|فوق/.test(n)) return {exactYear:null,minYear:y,maxYear:null};
    if(/(?:and below|or older|below)\b|وتحت|واقدم|وأقدم/.test(n)) return {exactYear:null,minYear:null,maxYear:y};
    return {exactYear:y,minYear:null,maxYear:null};
  }
  return {exactYear:null,minYear:null,maxYear:null};
}
const STOP=new Set(semantic("ابي ابغى اريد car cars vehicle vehicles used new مستعمل جديد سيارة سياره سيارات show me find search under below above more than less than in from saudi arabia ksa riyadh jeddah dammam الرياض جدة جده الدمام ريال sar km كيلو كم سنة سنه موديل model year years").split(" "));
function intentFrom(body={}) {
  const query=String(body.query||"").trim(), filters=body.filters&&typeof body.filters==="object"?body.filters:{}, sq=semantic(query);
  const id=identity(query), y=yearIntent(query,filters);
  const maxPrice=Number(filters.maxPrice)||num((sq.match(/(?:under|below|less than|تحت|اقل|أقل)[^0-9]{0,10}([0-9]{4,7})/)||[])[1],1000)||null;
  const maxMileage=Number(filters.maxMileage)||num((sq.match(/(?:under|below|less than|تحت|اقل|أقل)[^0-9]{0,10}([0-9]{2,7})\s*(?:km|كم|كيلو)/)||[])[1],0,1_500_000)||null;
  const city=String(filters.city||cityOf(query)||"").trim()||null;
  const remove=new Set([...(id.brand?semantic(id.brand).split(" "):[]),...(id.model?semantic(id.model).split(" "):[]),...digits(query).match(/\b(?:19|20)\d{2}\b/g)||[]]);
  const terms=sq.split(" ").filter(t=>t.length>1&&!STOP.has(t)&&!remove.has(t)&&!/^\d+$/.test(t)).slice(0,8);
  return {query,brand:id.brand,model:id.model,terms,city,maxPrice,maxMileage,...y,source:String(filters.source||"").trim()||null};
}
function matches(c,intent,condition){
  if(!c?.url||c.saleVerified!==true)return false;
  if(condition && c.condition!=="unknown" && c.condition!==condition)return false;
  if(condition==="new" && c.condition==="unknown")return false;
  if(intent.source && c.source!==intent.source)return false;
  if(intent.exactYear && Number(c.year)!==intent.exactYear)return false;
  if(intent.minYear && (!c.year||Number(c.year)<intent.minYear))return false;
  if(intent.maxYear && (!c.year||Number(c.year)>intent.maxYear))return false;
  if(intent.maxPrice && (!c.price||Number(c.price)>intent.maxPrice))return false;
  if(intent.maxMileage && (c.mileage==null||Number(c.mileage)>intent.maxMileage))return false;
  if(intent.city && (!c.city||norm(c.city)!==norm(intent.city)))return false;
  const blob=semantic(`${c.brand||""} ${c.model||""} ${c.title||""} ${c.snippet||""}`);
  if(intent.brand && !blob.includes(semantic(intent.brand)))return false;
  if(intent.model && !blob.includes(semantic(intent.model)))return false;
  if(intent.terms.length && !intent.terms.every(t=>blob.includes(t)))return false;
  return true;
}
function score(c,intent){
  let s=Number(c.score||70);
  if(c.imageVerified)s+=5;if(c.priceVerified)s+=5;if(c.year)s+=3;if(c.mileage!=null)s+=2;if(c.city)s+=1;
  if(intent.brand&&semantic(`${c.brand} ${c.title}`).includes(semantic(intent.brand)))s+=6;
  if(intent.model&&semantic(`${c.model} ${c.title}`).includes(semantic(intent.model)))s+=8;
  s+=Math.max(0,4-Math.floor((Date.now()-(c._seenAt||0))/3_600_000));
  return s;
}
function searchIndex(intent,condition){
  return [...inventory.values()].filter(c=>matches(c,intent,condition)).sort((a,b)=>score(b,intent)-score(a,intent)).slice(0,MAX_RESULTS).map(({_seenAt,_verifiedAt,...c})=>({...c,aiScore:Math.min(99,Math.round(score(c,intent)))}));
}
function counts(xs=[]){return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});}

async function queryRefresh(query,intent){
  const selected=intent.source?SOURCES.filter(s=>s.name===intent.source):SOURCES;
  await Promise.allSettled(selected.map(s=>refreshSource(s,{query,intent,force:true})));
}
function cleanupJobs(){
  const now=Date.now();for(const[k,v]of jobs)if(now-v.at>15*60_000)jobs.delete(k);
  for(const[k,v]of fetchCache)if(now-v.at>5*60_000)fetchCache.delete(k);
}
async function verifyBatch(){
  const candidates=[...inventory.entries()].sort((a,b)=>(a[1]._verifiedAt||0)-(b[1]._verifiedAt||0)).slice(0,18);
  let i=0;
  async function worker(){for(;;){const n=i++;if(n>=candidates.length)return;const [k,c]=candidates[n];
    try{
      const r=await fetch(k,{method:"GET",redirect:"follow",signal:AbortSignal.timeout(4500),headers:{"User-Agent":"Mozilla/5.0 (compatible; DalelahVerifier/1.4)","Accept":"text/html"}});
      if(r.status===404||r.status===410){inventory.delete(k);continue}
      if(r.ok){c._verifiedAt=Date.now();c.saleVerified=true;inventory.set(k,c);}
    }catch{}
  }}
  await Promise.all(Array.from({length:4},worker));
}
function purgeStale(){
  const now=Date.now();for(const[k,c]of inventory)if(now-(c._seenAt||0)>STALE_MS)inventory.delete(k);
  for(const s of SOURCES){const st=sourceState.get(s.name);st.indexed=sourceCount(s.name);}
}

app.get("/",async(req,res)=>{
  try{
    let html=await fs.readFile(path.join(__dirname,"public","index.html"),"utf8");
    html=html.replace("</body>",'<script src="/v14-progress.js?v=1"></script></body>');
    res.type("html").send(html);
  }catch(e){res.status(500).send("Dalelah frontend unavailable")}
});
app.get("/api/sources",(req,res)=>res.json({ok:true,version:"1.4",sources:SOURCES.map(s=>({...sourceState.get(s.name),priority:s.priority}))}));
app.get("/api/catalog/stats",(req,res)=>{
  const vals=[...inventory.values()];
  res.json({ok:true,version:"1.4",indexed:vals.length,withImages:vals.filter(x=>x.imageVerified).length,withPrices:vals.filter(x=>x.priceVerified).length,verified:vals.filter(x=>x._verifiedAt).length,counts:counts(vals),sources:SOURCES.map(s=>sourceState.get(s.name))});
});
app.get("/api/health",(req,res)=>res.json({ok:true,product:"Dalelah",version:"1.4-expansion",standalone:true,backgroundIndex:true,backgroundVerification:true,indexed:inventory.size,healthySources:[...sourceState.values()].filter(s=>s.status==="healthy").length,totalSources:SOURCES.length}));
app.post("/api/search",async(req,res)=>{
  const body=req.body||{},query=String(body.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});
  const condition=body.condition==="new"?"new":"used",intent=intentFrom(body),searchId=crypto.randomUUID();
  let listings=searchIndex(intent,condition);
  const job={at:Date.now(),body,intent,condition,done:false,error:null};
  jobs.set(searchId,job);
  const p=queryRefresh(query,intent).then(()=>{job.done=true;}).catch(e=>{job.done=true;job.error=e?.message||String(e);});
  job.promise=p;
  if(listings.length<12){
    await Promise.race([p,sleep(FAST_WAIT_MS)]);
    listings=searchIndex(intent,condition);
  }
  res.json({query,condition,intent,listings,counts:counts(listings),searchId,partial:!job.done,indexed:inventory.size,background:true,responseMode:"index-first"});
});
app.get("/api/search/progress/:id",(req,res)=>{
  const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:"Search expired"});
  const listings=searchIndex(job.intent,job.condition);
  res.json({query:job.body.query,condition:job.condition,listings,counts:counts(listings),searchId:req.params.id,done:job.done,partial:!job.done,indexed:inventory.size,error:job.error});
});

app.listen(PORT,()=>{
  console.log(`Dalelah 1.4 standalone index engine running at http://localhost:${PORT} with ${SOURCES.length} continuous source workers`);
  SOURCES.forEach((s,i)=>setTimeout(()=>refreshSource(s).catch(()=>{}),500+i*700));
});
for(const s of SOURCES){
  const jitter=Math.floor(Math.random()*10_000);
  setInterval(()=>refreshSource(s).catch(()=>{}),s.refreshMs+jitter).unref();
}
setInterval(()=>verifyBatch().catch(()=>{}),120_000).unref();
setInterval(purgeStale,10*60_000).unref();
setInterval(cleanupJobs,60_000).unref();
