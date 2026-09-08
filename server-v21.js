import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v20Port = Number(process.env.DELILAH_V20_PORT || 4500);
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";
const INDEX_CACHE_TTL = 10 * 60_000;
const EXTRA_TTL = 15 * 60_000;
const FETCH_TIMEOUT = 6500;
const MAX_EXTRA_RESULTS = 160;
const INDEX_PAGES = 2;

process.env.PORT = String(v20Port);
await import("./server-v20.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const indexCache = new Map();
const extraJobs = new Map();
const searchBodies = new Map();
let braveTail = Promise.resolve();
let braveLastAt = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
function humanNumbers(s = "") {
  let q = digits(s);
  q = q.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi, (_, n) => String(Math.round(Number(n) * 1000)));
  q = q.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g, (_, n) => String(Math.round(Number(n) * 1000)));
  return q;
}
function norm(s = "") {
  return humanNumbers(s).toLowerCase().normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
}
function safeUrl(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } }
function hostIs(host, base) { host = String(host || "").toLowerCase(); base = String(base || "").toLowerCase(); return host === base || host.endsWith(`.${base}`); }
function canonical(v = "") {
  const u = safeUrl(v); if (!u) return v; u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  return u.href.replace(/\/$/, "");
}
function decodeHtml(s = "") { return String(s).replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"); }
function strip(s = "") { return decodeHtml(String(s)).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function number(v, min = 0, max = Number.MAX_SAFE_INTEGER) { const n = Number(String(v || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n >= min && n <= max ? n : null; }
function yearOf(text = "") { const m = digits(text).match(/\b(20\d{2})\b/); const y = m ? Number(m[1]) : null; return y && y >= 2000 && y <= 2035 ? y : null; }
function mileageOf(text = "") { const m = digits(text).match(/([0-9][\d,]{0,8})\s*(?:km|kilometers?|كيلو|كم)/i); return m ? number(m[1], 0, 1_500_000) : null; }
function cityOf(text = "") { const t = norm(text); if (/\briyadh\b|الرياض/.test(t)) return "Riyadh"; if (/\bjeddah\b|جده/.test(t)) return "Jeddah"; if (/\bdammam\b|الدمام/.test(t)) return "Dammam"; if (/\bkhobar\b|الخبر/.test(t)) return "Khobar"; if (/\bmakkah\b|\bmecca\b|مكه/.test(t)) return "Makkah"; if (/\bmadinah\b|\bmedina\b|المدينه/.test(t)) return "Madinah"; return null; }
function titleCase(s = "") { return String(s).split(/[\s-]+/).filter(Boolean).map(x => x.length <= 3 && /^[a-z0-9]+$/i.test(x) ? x.toUpperCase() : x[0]?.toUpperCase() + x.slice(1)).join(" "); }
function imageOkay(url = "") { const u = safeUrl(url); return !!u && !/(logo|favicon|icon|placeholder|sprite|social|share|banner|brandmark|default[-_]?image|discount|coupon|avatar|profile|app-store|google-play)/i.test(u.href); }
function metaImage(html = "", base = "") {
  const m = String(html).match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i);
  if (!m) return null;
  try { const u = new URL(decodeHtml(m[1]), base).href; return imageOkay(u) ? u : null; } catch { return null; }
}

const ALIAS = new Map([
  ["تويوتا","toyota"],["نيسان","nissan"],["جيب","jeep"],["هيونداي","hyundai"],["كيا","kia"],["فورد","ford"],["شفروليه","chevrolet"],["مرسيدس","mercedes"],["لكزس","lexus"],["بورش","porsche"],["مازدا","mazda"],["هوندا","honda"],["ميتسوبيشي","mitsubishi"],["جيلي","geely"],["شانجان","changan"],["جيتور","jetour"],["هافال","haval"],["اودي","audi"],["جينيسيس","genesis"],["فولكس","volkswagen"],["بي ام دبليو","bmw"],["بي ام","bmw"],["لاند روفر","land rover"],["رينج روفر","range rover"],["كاديلاك","cadillac"],["جي ام سي","gmc"],["دودج","dodge"],["سوزوكي","suzuki"],["بيجو","peugeot"],["رينو","renault"],["شيري","chery"],["تسلا","tesla"],["لوسيد","lucid"],
  ["رانجلر","wrangler"],["باترول","patrol"],["لاند كروزر","land cruiser"],["لاندكروزر","land cruiser"],["كامري","camry"],["كورولا","corolla"],["يارس","yaris"],["صني","sunny"],["توسان","tucson"],["سبورتاج","sportage"],["تاهو","tahoe"],["سوناتا","sonata"],["اكسنت","accent"],["النترا","elantra"],["برادو","prado"],["فورتشنر","fortuner"],["اكسبلورر","explorer"],["جراند شيروكي","grand cherokee"],["كايين","cayenne"],["تيجوان","tiguan"],["بيجاس","pegas"],["سيراتو","cerato"],["سورينتو","sorento"],["جوليون","jolion"],["كولراي","coolray"],["امجراند","emgrand"]
]);
const MODEL_BRAND = new Map([
  ["wrangler","Jeep"],["grand cherokee","Jeep"],["patrol","Nissan"],["sunny","Nissan"],["land cruiser","Toyota"],["camry","Toyota"],["corolla","Toyota"],["yaris","Toyota"],["prado","Toyota"],["fortuner","Toyota"],
  ["accent","Hyundai"],["elantra","Hyundai"],["sonata","Hyundai"],["tucson","Hyundai"],["pegas","Kia"],["cerato","Kia"],["sportage","Kia"],["sorento","Kia"],["k5","Kia"],
  ["accord","Honda"],["civic","Honda"],["city","Honda"],["mazda 6","Mazda"],["cx 5","Mazda"],["cx-5","Mazda"],["h6","Haval"],["jolion","Haval"],["alsvin","Changan"],["cs35","Changan"],["cs75","Changan"],["coolray","Geely"],["emgrand","Geely"],["x5","BMW"],["c200","Mercedes"],["territory","Ford"],["tahoe","Chevrolet"],["x70","Jetour"],["x50","Jetour"],["t1","Jetour"],["t2","Jetour"]
]);
const BRANDS = ["Toyota","Nissan","Jeep","Hyundai","Kia","Ford","Chevrolet","Mercedes","Lexus","Porsche","Mazda","Honda","Mitsubishi","Geely","Changan","Jetour","Haval","Audi","Genesis","Volkswagen","BMW","Land Rover","Range Rover","Cadillac","GMC","Dodge","Suzuki","Peugeot","Renault","Chery","Tesla","Lucid"];
const STOP = new Set(norm("ابي ابغى اريد سيارة سياره سيارات car cars vehicle vehicles used new مستعمل مستعملة مستعمله جديد جديده جديدة موديل model سنة سنه year years وفوق واكثر تحت اقل أقل من الى إلى في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام السعودية السعوديه saudi arabia ksa riyadh jeddah dammam under below less than above over more than around about budget ريال sar km كيلو كم").split(" "));
function identity(query = "") {
  let q = norm(query);
  for (const [a,b] of [...ALIAS.entries()].sort((x,y)=>y[0].length-x[0].length)) q = q.replaceAll(norm(a), b);
  const tokens = q.split(" ").filter(Boolean);
  let brand = BRANDS.find(b => q.includes(norm(b))) || null;
  const core = tokens.filter(t => !STOP.has(t) && !/^\d+(?:\.\d+)?$/.test(t) && !/^(?:20\d{2}|riyadh|jeddah|dammam|saudi|arabia|sar|km)$/.test(t));
  if (brand) {
    const bw = norm(brand).split(" ");
    for (let i=0;i<=core.length-bw.length;i++) if (bw.every((x,j)=>core[i+j]===x)) { core.splice(i,bw.length); break; }
  }
  let model = core.slice(0,3).join(" ").trim() || null;
  if (!brand && model) {
    const keys = [...MODEL_BRAND.keys()].sort((a,b)=>b.length-a.length);
    const mk = keys.find(k => norm(model).includes(norm(k)) || norm(q).includes(norm(k)));
    if (mk) { brand = MODEL_BRAND.get(mk); model = mk; }
  }
  if (!model && brand) model = null;
  return { brand, model, phrase: [brand, model].filter(Boolean).join(" ") || core.join(" ") || String(query || "").trim() };
}
function requestFilters(body = {}) {
  const f = body.filters && typeof body.filters === "object" ? body.filters : {}, q = humanNumbers(String(body.query || "")), nq = norm(q), ys = [...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  const km = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  const p = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{4,7})(?!\s*(?:km|كم|كيلو))/i);
  return { minYear:Number(f.minYear)||(ys.length?Math.min(...ys):null), maxYear:Number(f.maxYear)||null, maxPrice:Number(f.maxPrice)||(p?Number(p[1]):null), maxMileage:Number(f.maxMileage)||(km?Number(km[1]):null), city:f.city||cityOf(q), seller:f.seller||null, sourceType:f.sourceType||null };
}
function matches(c, f, condition) {
  if (!c?.url || c.saleVerified !== true || c.condition !== condition) return false;
  if ((f.minYear || f.maxYear) && !c.year) return false;
  if (f.minYear && Number(c.year) < f.minYear) return false;
  if (f.maxYear && Number(c.year) > f.maxYear) return false;
  if (f.maxPrice && c.price && Number(c.price) > f.maxPrice) return false;
  if (f.maxMileage && c.mileage != null && Number(c.mileage) > f.maxMileage) return false;
  if (f.city && c.city && c.city !== f.city) return false;
  return true;
}
function counts(xs = []) { return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{}); }
function mergeListings(...groups) {
  const map = new Map();
  for (const group of groups) for (const c of (group || [])) {
    if (!c?.url || c.saleVerified !== true) continue;
    const key = canonical(c.url), old = map.get(key);
    if (!old) { map.set(key, c); continue; }
    const useNewPrice = c.priceVerified && !old.priceVerified;
    const useNewImage = c.imageVerified && !old.imageVerified;
    map.set(key, {
      ...old, ...c,
      price: useNewPrice ? c.price : old.price ?? c.price ?? null,
      priceVerified: Boolean(old.priceVerified || c.priceVerified),
      priceSource: useNewPrice ? c.priceSource : old.priceSource || c.priceSource || null,
      image: useNewImage ? c.image : old.image || c.image || null,
      displayImage: useNewImage ? c.displayImage : old.displayImage || c.displayImage || null,
      imageVerified: Boolean(old.imageVerified || c.imageVerified),
      imageSource: useNewImage ? c.imageSource : old.imageSource || c.imageSource || null
    });
  }
  return [...map.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,2000);
}

const validators = {
  Syarah: u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"syarah.com")&&/^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-(?:used|new)-\d+\/?$/i.test(x.pathname); },
  ArabWheels: u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"arabwheels.sa")&&/^\/(?:en\/)?used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(x.pathname); },
  Haraj: u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"haraj.com.sa")&&/^\/\d{7,}(?:\/|$)/.test(x.pathname); },
  "Saudi Sale": u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"saudisale.com")&&/^\/(?:en\/)?listings\/[A-Za-z0-9_-]{4,20}\/[^/]+\/?$/i.test(x.pathname); },
  YallaMotor: u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"yallamotor.com")&&/^\/used-cars\/[^/]+\/[^/]+\/20\d{2}\/(?:used|new)-[^/]+-\d+\/?$/i.test(x.pathname); },
  "CarSwitch Saudi": u => { const x=safeUrl(u); if(!x||!hostIs(x.hostname,"carswitch.com"))return false; const p=x.pathname.toLowerCase().replace(/\/$/,""); return p.includes("/used-cars/")&&!/(\/search|\/used-cars)$/.test(p)&&p.split("/").filter(Boolean).length>=3; },
  Carly: u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"halacarly.com")&&/^\/(?:en|ar)\/vehicle-details\/[^/]+\/?$/i.test(x.pathname); },
  "Saleh Cars": u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"salehcars.com")&&/^\/(?:en\/)?cars\/[a-f0-9]{20,32}\/[^/]+\/?$/i.test(x.pathname); },
  Motory: u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"motory.com")&&/^\/en\/cars-for-sale\/(?:[^/]+-haraj\/)?[^/]+\/[^/]+\/20\d{2}\/\d+\/?$/i.test(x.pathname); },
  "Jetour KSA": u => { const x=safeUrl(u); return !!x&&hostIs(x.hostname,"jetourksa.com")&&/^\/en\/inventory\/new-cars\/[a-z0-9.-]+_\d+\/?$/i.test(x.pathname); }
};
function plansFor(body = {}) {
  const id=identity(body.query),f=requestFilters(body),condition=body.condition==="new"?"new":"used",phrase=id.phrase;
  const exactYear=f.minYear&&f.maxYear&&Number(f.minYear)===Number(f.maxYear)?Number(f.minYear):null;
  const searchPhrase=[phrase,exactYear].filter(Boolean).join(" ");
  const allUsed=[
    {name:"Syarah",seller:"Syarah",type:"marketplace",q:`site:syarah.com/en/cardetail \"${searchPhrase}\"`,condition},
    {name:"ArabWheels",seller:"ArabWheels",type:"marketplace",q:`site:arabwheels.sa/en/used-cars \"${searchPhrase}\" Saudi`,condition:"used"},
    {name:"Haraj",seller:"Haraj",type:"marketplace",q:`site:haraj.com.sa \"${searchPhrase}\" سيارات`,condition},
    {name:"Saudi Sale",seller:"Saudi Sale",type:"marketplace",q:`site:cars.saudisale.com/en/listings \"${searchPhrase}\"`,condition:"used"},
    {name:"YallaMotor",seller:"YallaMotor",type:"marketplace",q:`site:ksa.yallamotor.com/used-cars \"${searchPhrase}\"`,condition:"used"},
    {name:"CarSwitch Saudi",seller:"CarSwitch Saudi",type:"marketplace",q:`site:ksa.carswitch.com/used-cars \"${searchPhrase}\"`,condition:"used"},
    {name:"Carly",seller:"Carly - كارلي",type:"certified_used",q:`site:halacarly.com/vehicle-details \"${searchPhrase}\"`,condition:"used"}
  ];
  const allNew=[
    {name:"Syarah",seller:"Syarah",type:"marketplace",q:`site:syarah.com/en/cardetail \"${searchPhrase}\" new`,condition:"new"},
    {name:"Jetour KSA",seller:"Jetour KSA / National Motors Supplies",type:"official_dealer",q:`site:jetourksa.com/en/inventory/new-cars \"${searchPhrase}\"`,condition:"new"},
    {name:"Saleh Cars",seller:"Saleh Cars Group",type:"independent_dealer",q:`site:salehcars.com/cars \"${searchPhrase}\"`,condition:"new"},
    {name:"Motory",seller:"Motory",type:"marketplace",q:`site:ksa.motory.com/en/cars-for-sale \"${searchPhrase}\"`,condition:"new"}
  ];
  return (condition==="new"?allNew:allUsed).filter(p => (!f.seller || f.seller===p.name || f.seller===p.seller) && (!f.sourceType || f.sourceType===p.type));
}
async function brave(query,offset=0) {
  if (!braveKey) return {results:[],more:false};
  const cacheKey=`${offset}:${query}`;
  const hit=indexCache.get(cacheKey); if(hit&&Date.now()-hit.at<INDEX_CACHE_TTL)return hit.page;
  const task=async()=>{
    const wait=Math.max(0,1150-(Date.now()-braveLastAt)); if(wait)await sleep(wait); braveLastAt=Date.now();
    const u=new URL("https://api.search.brave.com/res/v1/web/search"); u.searchParams.set("q",query); u.searchParams.set("country","SA"); u.searchParams.set("count","20"); u.searchParams.set("offset",String(offset));
    const r=await fetch(u,{headers:{Accept:"application/json","X-Subscription-Token":braveKey},signal:AbortSignal.timeout(10000)}); if(!r.ok)throw new Error(`Brave HTTP ${r.status}`);
    const d=await r.json(); const page={results:d.web?.results||[],more:Boolean(d.query?.more_results_available)}; indexCache.set(cacheKey,{at:Date.now(),page}); return page;
  };
  const p=braveTail.then(task,task); braveTail=p.catch(()=>{}); return p;
}
async function fetchHtml(url) {
  const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(FETCH_TIMEOUT),headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahListingVerifier/1.0)",Accept:"text/html,application/xhtml+xml"}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`); const ct=(r.headers.get("content-type")||"").toLowerCase(); if(!ct.includes("text/html"))throw new Error(`Unexpected ${ct}`);
  return {html:(await r.text()).slice(0,3_000_000),url:r.url||url};
}
function cashPriceSyarah(text="") { const t=digits(text); const m=t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?[^0-9]{0,40}([0-9][\d,]*)\s*SAR/i)||t.match(/السعر\s*النقدي[^0-9]{0,50}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i); return m?number(m[1],1000,5_000_000):null; }
function currentPriceArab(text="") { const t=digits(text); const m=t.match(/Current\s*Price[^0-9]{0,30}(?:SAR\s*)?([0-9][\d,]*)/i); return m?number(m[1],1000,5_000_000):null; }
async function enrichExact(card) {
  if(!["Syarah","ArabWheels"].includes(card.source))return card;
  try {
    const d=await fetchHtml(card.url); if(!validators[card.source](d.url||card.url))return card; const text=strip(d.html);
    const image=metaImage(d.html,d.url);
    if(card.source==="Syarah") {
      const price=cashPriceSyarah(text);
      return {...card,year:card.year||yearOf(text),mileage:card.mileage??mileageOf(text),city:card.city||cityOf(text),price:price||null,priceVerified:Boolean(price),priceSource:price?"syarah_cash_price":null,image:image||card.image||null,displayImage:image||card.displayImage||null,imageVerified:Boolean(image||card.imageVerified),imageSource:image?"listing_page":card.imageSource||null,score:Math.max(card.score||0,price?91:86)};
    }
    const price=currentPriceArab(text);
    return {...card,year:card.year||yearOf(text),mileage:card.mileage??mileageOf(text),city:card.city||cityOf(text),price:price||null,priceVerified:Boolean(price),priceSource:price?"arabwheels_current_price":null,image:image||null,displayImage:image||null,imageVerified:Boolean(image),imageSource:image?"listing_page":null,score:Math.max(card.score||0,price?91:86)};
  } catch { return card; }
}
function cardFromIndex(plan,r,body) {
  const url=canonical(r.url||""); if(!validators[plan.name]?.(url))return null;
  const text=`${r.title||""} ${r.description||""}`,id=identity(body.query),f=requestFilters(body),condition=plan.condition;
  const c={source:plan.name,sourceType:plan.type,seller:plan.seller,sourceStrict:true,title:r.title||`${id.phrase} listing`,snippet:r.description||"Publicly indexed individual vehicle listing",url,brand:id.brand||null,model:id.model?titleCase(id.model):null,year:yearOf(text)||null,mileage:mileageOf(text),city:cityOf(text),price:null,priceVerified:false,priceSource:null,condition,saleVerified:true,saleEvidence:["direct_listing_url","public_search_index"],image:null,displayImage:null,imageVerified:false,imageSource:null,score:82,discovery:"public_index_exact_listing"};
  return matches(c,f,body.condition==="new"?"new":"used")?c:null;
}
async function scanIndexed(body, job) {
  const plans=plansFor(body),f=requestFilters(body),condition=body.condition==="new"?"new":"used";
  for(const plan of plans) {
    try {
      const raw=[],seen=new Set();let pages=0;
      for(let offset=0;offset<INDEX_PAGES;offset++){
        const page=await brave(plan.q,offset);pages++;
        for(const r of page.results){const key=canonical(r.url||'');if(!key||seen.has(key))continue;seen.add(key);raw.push(r)}
        if(!page.more)break;
      }
      const cards=[];
      for(const r of raw) { const c=cardFromIndex(plan,r,body); if(c)cards.push(c); }
      const selected=cards.slice(0,40);
      let enriched=selected;
      if(["Syarah","ArabWheels"].includes(plan.name)) {
        const first=selected.slice(0,8),rest=selected.slice(8),out=[]; let next=0;
        async function worker(){for(;;){const i=next++;if(i>=first.length)return;out[i]=await enrichExact(first[i]);}}
        await Promise.all(Array.from({length:Math.min(3,first.length||1)},worker)); enriched=[...out.filter(Boolean),...rest];
      }
      for(const c of enriched) if(matches(c,f,condition))job.listings.set(canonical(c.url),c);
      job.diagnostics.push({source:plan.name,indexedReturned:raw.length,pages,exactKept:enriched.length});
      if(job.listings.size>=MAX_EXTRA_RESULTS)break;
    } catch(e) { job.diagnostics.push({source:plan.name,error:e?.message||String(e)}); }
  }
}
function ensureExtra(searchId,body) {
  let j=extraJobs.get(searchId); if(j)return j;
  j={id:searchId,body,createdAt:Date.now(),complete:false,listings:new Map(),diagnostics:[]}; extraJobs.set(searchId,j);
  scanIndexed(body,j).catch(e=>j.diagnostics.push({source:"indexed-scan",error:e?.message||String(e)})).finally(()=>{j.complete=true;j.finishedAt=Date.now()});
  return j;
}
function combineResponse(d,extra) {
  const listings=mergeListings(d.listings||[],extra?[...extra.listings.values()]:[]),complete=Boolean(d.complete)&&Boolean(extra?.complete);
  return {...d,listings,counts:counts(listings),complete,marketScanComplete:complete,indexedFallbackScan:true,indexedFallbackComplete:Boolean(extra?.complete),indexedFallbackDiagnostics:extra?.diagnostics||[],answer:complete?`${listings.length} verified listings found across the completed accessible-source scan.`:`${listings.length} verified listings found so far. Delilah is still scanning connected Saudi sources.`};
}
async function upstreamJson(path,options={}) {
  const r=await fetch(`http://127.0.0.1:${v20Port}${path}`,{...options,signal:options.signal||AbortSignal.timeout(30000)}); const d=await r.json().catch(()=>({error:`Upstream HTTP ${r.status}`})); return {r,d};
}

app.post("/api/search",async(req,res)=>{
  const body=req.body||{};
  try {
    const {r,d}=await upstreamJson("/api/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(body.phase==="fast"?12000:20000)});
    if(!r.ok)return res.status(r.status).json(d);
    if(body.phase==="fast")return res.json(d);
    if(d.searchId){searchBodies.set(d.searchId,{body,at:Date.now()});const extra=ensureExtra(d.searchId,body);return res.json(combineResponse(d,extra));}
    return res.json(d);
  } catch(e) { return res.status(502).json({error:e?.message||"Delilah search unavailable"}); }
});
app.get("/api/search/progress/:id",async(req,res)=>{
  const saved=searchBodies.get(req.params.id);
  try {
    const {r,d}=await upstreamJson(`/api/search/progress/${encodeURIComponent(req.params.id)}`,{signal:AbortSignal.timeout(10000)}); if(!r.ok)return res.status(r.status).json(d);
    const extra=saved?ensureExtra(req.params.id,saved.body):extraJobs.get(req.params.id); return res.json(combineResponse(d,extra));
  } catch(e) { return res.status(502).json({error:e?.message||"Search progress unavailable"}); }
});
app.get("/api/health",async(req,res)=>{
  try { const {r,d}=await upstreamJson("/api/health",{signal:AbortSignal.timeout(5000)}); if(!r.ok)throw new Error("upstream health"); return res.json({...d,edge:"inventory-v21",logic:"progressive-market-scan-v21",indexedExactFallback:true,frontendProgressPolling:true,accessibleSourceScan:true,indexPages:INDEX_PAGES}); }
  catch { return res.status(503).json({ok:false,edge:"inventory-v21"}); }
});
app.get("/api/source-plugins",async(req,res)=>{
  try {
    const {r,d}=await upstreamJson("/api/source-plugins",{signal:AbortSignal.timeout(7000)}); if(!r.ok)return res.status(r.status).json(d);
    const status={Syarah:"active-deterministic+indexed",ArabWheels:"active-indexed+exact",Haraj:"active-search+indexed",YallaMotor:"indexed-fallback-direct-blocked","Saudi Sale":"active-public-html+indexed","CarSwitch Saudi":"active-search+indexed","Jetour KSA":"indexed-fallback-direct-blocked"};
    const plugins=(d.plugins||[]).map(p=>status[p.name]?{...p,status:status[p.name]}:p); const active=plugins.filter(p=>String(p.status||"").startsWith("active")||String(p.status||"").includes("indexed-fallback")).length;
    return res.json({...d,plugins,active,total:plugins.length,edge:"inventory-v21"});
  } catch(e) { return res.status(502).json({error:e?.message||"Plugin registry unavailable"}); }
});
app.get(["/","/index.html"],async(req,res)=>{
  try { const r=await fetch(`http://127.0.0.1:${v20Port}/`,{signal:AbortSignal.timeout(7000)}); let html=await r.text(); if(!html.includes("/app-v21.js"))html=html.replace("</body>",'<script src="/app-v21.js"></script>\n</body>'); return res.type("html").send(html); }
  catch { return res.status(502).send("Delilah UI unavailable"); }
});
async function proxy(req,res){
  try {
    const headers={}; for(const[k,v]of Object.entries(req.headers))if(!["host","content-length","connection"].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);
    let body; if(!["GET","HEAD"].includes(req.method)&&req.is("application/json")){body=JSON.stringify(req.body||{});headers["content-type"]="application/json";}
    const r=await fetch(`http://127.0.0.1:${v20Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:"manual",signal:AbortSignal.timeout(30000)}),buf=Buffer.from(await r.arrayBuffer());
    for(const[k,v]of r.headers.entries())if(!["content-length","transfer-encoding","connection"].includes(k.toLowerCase()))res.setHeader(k,v); return res.status(r.status).send(buf);
  } catch { return res.status(502).json({error:"Delilah upstream unavailable"}); }
}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of indexCache)if(now-v.at>INDEX_CACHE_TTL*2)indexCache.delete(k);for(const[k,v]of searchBodies)if(now-v.at>EXTRA_TTL)searchBodies.delete(k);for(const[k,v]of extraJobs)if(now-v.createdAt>EXTRA_TTL)extraJobs.delete(k);},60000).unref();
app.listen(externalPort,()=>console.log(`Delilah inventory-v21 running at http://localhost:${externalPort}`));