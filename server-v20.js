import express from "express";
import crypto from "node:crypto";

const externalPort = Number(process.env.PORT || 3000);
const v19Port = Number(process.env.DELILAH_V19_PORT || 4400);
const FETCH_TIMEOUT = 7000;
const JOB_TTL = 15 * 60_000;
const SOURCE_CACHE_TTL = 10 * 60_000;
const MAX_RESULTS = 2000;
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";

process.env.PORT = String(v19Port);
await import("./server-v19.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const jobs = new Map();
const sourceCache = new Map();
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
function absolute(v, base) { try { return new URL(String(v || "").replace(/&amp;/g, "&"), base).href; } catch { return null; } }
function decodeHtml(s = "") { return String(s).replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"); }
function strip(s = "") { return decodeHtml(String(s)).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function attr(tag, name) { return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] || null; }
function canonical(v = "") { const u = safeUrl(v); if (!u) return v; u.hash = ""; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k); return u.href.replace(/\/$/, ""); }
function number(v, min = 0, max = Number.MAX_SAFE_INTEGER) { const n = Number(String(v || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n >= min && n <= max ? n : null; }
function yearOf(text = "") { const m = digits(text).match(/\b(20\d{2})\b/); const y = m ? Number(m[1]) : null; return y && y >= 2000 && y <= 2035 ? y : null; }
function mileageOf(text = "") { const m = digits(text).match(/([0-9][\d,]{0,8})\s*(?:KM|km|KiloMeters?|كيلو|كم)/i); return m ? number(m[1], 0, 1_500_000) : null; }
function cityOf(text = "") { const t = norm(text); if (/\briyadh\b|الرياض/.test(t)) return "Riyadh"; if (/\bjeddah\b|جده/.test(t)) return "Jeddah"; if (/\bdammam\b|الدمام/.test(t)) return "Dammam"; if (/\bkhobar\b|الخبر/.test(t)) return "Khobar"; if (/\bmakkah\b|\bmecca\b|مكه/.test(t)) return "Makkah"; if (/\bmadinah\b|\bmedina\b|المدينه/.test(t)) return "Madinah"; return null; }
function imageOkay(url = "") { const u = safeUrl(url); return !!u && !/(logo|favicon|icon|placeholder|sprite|social|share|banner|brandmark|default[-_]?image|discount|coupon|avatar|profile|app-store|google-play)/i.test(u.href); }
function bestImage(html, base) {
  const candidates = [];
  for (const m of String(html).matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    for (const k of ["src","data-src","data-lazy-src","data-original","data-image"]) { const u = absolute(attr(tag, k), base); if (u && imageOkay(u)) candidates.push(u); }
    const ss = attr(tag, "srcset") || attr(tag, "data-srcset"); if (ss) for (const p of ss.split(",")) { const u = absolute(p.trim().split(/\s+/)[0], base); if (u && imageOkay(u)) candidates.push(u); }
  }
  return candidates[0] || null;
}
function counts(xs = []) { return xs.reduce((a, c) => (a[c.source] = (a[c.source] || 0) + 1, a), {}); }
function merge(...groups) {
  const out = [], seen = new Set();
  for (const group of groups) for (const c of (group || [])) {
    if (!c?.url || c.saleVerified !== true) continue;
    const k = canonical(c.url); if (seen.has(k)) continue; seen.add(k); out.push(c);
    if (out.length >= MAX_RESULTS) return out;
  }
  return out;
}

const BRAND_ALIAS = new Map([
  ["تويوتا","toyota"],["نيسان","nissan"],["جيب","jeep"],["هيونداي","hyundai"],["كيا","kia"],["فورد","ford"],["شفروليه","chevrolet"],["مرسيدس","mercedes-benz"],["لكزس","lexus"],["بورش","porsche"],["مازدا","mazda"],["هوندا","honda"],["ميتسوبيشي","mitsubishi"],["جيلي","geely"],["شانجان","changan"],["جيتور","jetour"],["هافال","haval"],["اودي","audi"],["جينيسيس","genesis"],["فولكس","volkswagen"],["بي ام","bmw"],["بي ام دبليو","bmw"],["لاند روفر","land-rover"],["رينج روفر","range-rover"],["كاديلاك","cadillac"],["جي ام سي","gmc"],["دودج","dodge"],["سوزوكي","suzuki"],["بيجو","peugeot"],["رينو","renault"],["شيري","chery"],["تسلا","tesla"],["لوسيد","lucid"]
]);
const MODEL_ALIAS = new Map([
  ["رانجلر","wrangler"],["باترول","patrol"],["لاند كروزر","land-cruiser"],["لاندكروزر","land-cruiser"],["كامري","camry"],["كورولا","corolla"],["يارس","yaris"],["توسان","tucson"],["سبورتاج","sportage"],["تاهو","tahoe"],["سوناتا","sonata"],["اكسنت","accent"],["النترا","elantra"],["برادو","prado"],["فورتشنر","fortuner"],["اكسبلورر","explorer"],["جراند شيروكي","grand-cherokee"],["كايين","cayenne"],["تيجوان","tiguan"],["بيجاس","pegas"],["سيراتو","cerato"],["سورينتو","sorento"]
]);
const BRANDS = ["mercedes-benz","land-rover","range-rover","volkswagen","chevrolet","mitsubishi","genesis","hyundai","toyota","nissan","lexus","porsche","ford","lincoln","kia","mazda","honda","geely","changan","jetour","haval","audi","bmw","gmc","dodge","suzuki","peugeot","renault","chery","tesla","lucid","jeep"];
const STOP = new Set(norm("ابي ابغى اريد سيارة سياره سيارات car cars vehicle vehicles used new مستعمل مستعملة مستعمله جديد جديده جديدة موديل model سنة سنه year years وفوق فوق واكثر وأكثر تحت اقل أقل من الى إلى في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام السعودية السعوديه saudi arabia ksa riyadh jeddah dammam under below less than above over more than around about budget ريال sar km كيلو كم").split(" "));
function identityFromQuery(query = "") {
  let q = norm(query);
  for (const [ar, en] of [...BRAND_ALIAS.entries()].sort((a,b)=>b[0].length-a[0].length)) q = q.replaceAll(norm(ar), en.replace(/-/g," "));
  for (const [ar, en] of [...MODEL_ALIAS.entries()].sort((a,b)=>b[0].length-a[0].length)) q = q.replaceAll(norm(ar), en.replace(/-/g," "));
  const compact = q.replace(/\s+/g, " ");
  let brand = null;
  for (const b of BRANDS) if (compact.includes(b.replace(/-/g," "))) { brand = b; break; }
  const tokens = compact.split(" ").filter(Boolean);
  let model = null;
  if (brand) {
    const bw = brand.replace(/-/g," ").split(" "), i = tokens.findIndex((_, idx) => bw.every((x,j)=>tokens[idx+j]===x));
    const rest = (i >= 0 ? tokens.slice(i + bw.length) : tokens).filter(t => !STOP.has(t) && !/^\d+(?:\.\d+)?$/.test(t) && !/^(?:20\d{2}|riyadh|jeddah|dammam|saudi|arabia|sar|km)$/.test(t));
    if (rest.length) model = rest.slice(0, 3).join("-");
  }
  return { brand, model, normalized: compact };
}
function requestFilters(body = {}) {
  const f = body.filters && typeof body.filters === "object" ? body.filters : {}, q = humanNumbers(String(body.query || "")), nq = norm(q), ys = [...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  const km = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  const p = nq.match(/(?:under|below|less than|تحت|اقل|أقل)\s*(\d{4,7})(?!\s*(?:km|كم|كيلو))/i);
  return { minYear:Number(f.minYear)||(ys.length?Math.min(...ys):null), maxYear:Number(f.maxYear)||null, maxPrice:Number(f.maxPrice)||(p?Number(p[1]):null), maxMileage:Number(f.maxMileage)||(km?Number(km[1]):null), city:f.city||cityOf(q), seller:f.seller||null, sourceType:f.sourceType||null };
}
function matchesFilters(c, f, condition) {
  if (!c || c.saleVerified !== true || c.condition !== condition) return false;
  if (f.minYear && c.year && c.year < f.minYear) return false;
  if (f.maxYear && c.year && c.year > f.maxYear) return false;
  if (f.maxPrice && c.price && c.price > f.maxPrice) return false;
  if (f.maxMileage && c.mileage != null && c.mileage > f.maxMileage) return false;
  if (f.city && c.city && c.city !== f.city) return false;
  return true;
}
async function fetchText(url, timeout = FETCH_TIMEOUT) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect:"follow", headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahCatalog/5.0)", Accept:"text/html,application/xhtml+xml"} });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = (r.headers.get("content-type") || "").toLowerCase(); if (!ct.includes("text/html")) throw new Error(`Unexpected ${ct}`);
  return { html:(await r.text()).slice(0,3_500_000), url:r.url||url };
}
function syarahInfo(url = "") { const u=safeUrl(url),m=u?.pathname.match(/^\/(?:(?:en|ar)\/)?cardetail\/([^/]+)-(used|new)-(\d+)\/?$/i); return m?{slug:m[1],condition:m[2].toLowerCase(),id:m[3]}:null; }
function syarahCash(text = "") { const t=digits(text); const m=t.match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?[^0-9]{0,40}([0-9][\d,]*)\s*SAR/i)||t.match(/السعر\s*النقدي[^0-9]{0,50}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i); return m?number(m[1],1000,5_000_000):null; }
function parseSyarahPage(html, base, requested) {
  const raw=[]; for(const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)){const href=/href=["']([^"']+)["']/i.exec(m[1])?.[1],url=absolute(href,base),info=syarahInfo(url);if(info)raw.push({m,url:canonical(url),info,index:m.index||0})}
  const out=[],seen=new Set();
  for(let i=0;i<raw.length;i++){
    const r=raw[i]; if(seen.has(r.info.id))continue; seen.add(r.info.id);
    const next=raw[i+1]?.index||Math.min(String(html).length,r.index+7000),seg=String(html).slice(r.index,Math.min(next,r.index+7000)),anchor=strip(r.m[2]),text=`${anchor} ${strip(seg).slice(0,2400)}`.trim();
    const price=syarahCash(text),image=bestImage(seg,base),year=yearOf(`${r.info.slug} ${text}`);
    out.push({source:"Syarah",sourceType:"marketplace",seller:"Syarah",sourceStrict:true,title:anchor||r.info.slug.replace(/-/g," "),snippet:text.slice(0,700),url:r.url,brand:requested.brand?requested.brand.split("-").map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" "):null,model:requested.model?requested.model.split("-").map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" "):null,year,mileage:mileageOf(text),city:cityOf(text),price,priceVerified:Boolean(price),priceSource:price?"syarah_catalog_cash_price":null,condition:r.info.condition,saleVerified:true,saleEvidence:["direct_ad_url",price?"cash_price_on_source_catalog":null].filter(Boolean),image,displayImage:image,imageVerified:Boolean(image),imageSource:image?"source_catalog":null,score:Math.min(97,86+(price?4:0)+(image?4:0)+(year?2:0)),discovery:"syarah_deterministic_catalog"});
  }
  return out;
}
async function syarahCatalog(body, maxPages = 8) {
  const id=identityFromQuery(body.query),f=requestFilters(body),condition=body.condition==="new"?"new":"used";
  if(!id.brand||!id.model)return[];
  if((f.seller&&f.seller!=="Syarah")||(f.sourceType&&f.sourceType!=="marketplace"))return[];
  const base=`https://syarah.com/en/autos/${id.brand}/${id.model}`;
  const key=`syarah|${base}|${condition}`; const hit=sourceCache.get(key); if(hit&&Date.now()-hit.at<SOURCE_CACHE_TTL)return hit.listings.filter(c=>matchesFilters(c,f,condition));
  const pages=Array.from({length:maxPages},(_,i)=>i+1),all=[];
  for(let i=0;i<pages.length;i+=4){const batch=pages.slice(i,i+4);const rs=await Promise.allSettled(batch.map(p=>fetchText(p===1?base:`${base}?page=${p}`)));let added=0;for(const r of rs)if(r.status==="fulfilled"){const xs=parseSyarahPage(r.value.html,r.value.url,id);all.push(...xs);added+=xs.length}if(i>=4&&added===0)break}
  const merged=merge(all); sourceCache.set(key,{at:Date.now(),listings:merged}); return merged.filter(c=>matchesFilters(c,f,condition));
}
function directArab(url = "") { const u=safeUrl(url); return !!u && (u.hostname==="arabwheels.sa"||u.hostname==="www.arabwheels.sa") && /^\/(?:en\/)?used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(u.pathname); }
function anchorLinks(html, base) { const out=[]; for(const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)){const href=/href=["']([^"']+)["']/i.exec(m[1])?.[1],url=absolute(href,base),text=strip(m[2]);if(url)out.push({url,text,index:m.index||0,m})}return out; }
function arabPrice(text=""){const t=digits(text);const m=t.match(/Current\s*Price[^0-9]{0,20}(?:SAR\s*)?([0-9][\d,]*)/i)||t.match(/(?:SAR|ريال)\s*([0-9][\d,]{2,9})/i)||t.match(/([0-9][\d,]{2,9})\s*(?:SAR|ريال)/i);return m?number(m[1],1000,5_000_000):null}
function parseArabPage(html,base,requested){const links=anchorLinks(html,base).filter(x=>directArab(x.url)),out=[],seen=new Set();for(let i=0;i<links.length;i++){const r=links[i],url=canonical(r.url);if(seen.has(url))continue;seen.add(url);const next=links[i+1]?.index||Math.min(String(html).length,r.index+6500),seg=String(html).slice(r.index,Math.min(next,r.index+6500)),text=`${r.text} ${strip(seg).slice(0,2200)}`.trim(),image=bestImage(seg,base),price=arabPrice(text);out.push({source:"ArabWheels",sourceType:"marketplace",seller:"ArabWheels",sourceStrict:true,title:r.text||"ArabWheels car",snippet:text.slice(0,700),url,brand:requested.brand?requested.brand.split("-").map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" "):null,model:requested.model?requested.model.split("-").map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" "):null,year:yearOf(text),mileage:mileageOf(text),city:cityOf(text),price,priceVerified:Boolean(price),priceSource:price?"arabwheels_catalog_current_price":null,condition:"used",saleVerified:true,saleEvidence:["direct_ad_url",price?"current_price_on_source_catalog":null].filter(Boolean),image,displayImage:image,imageVerified:Boolean(image),imageSource:image?"source_catalog":null,score:Math.min(95,84+(price?4:0)+(image?4:0)),discovery:"arabwheels_deterministic_catalog"})}return out}
async function arabModelUrl(id){const root=await fetchText("https://www.arabwheels.sa/en/used-cars/");const brandLabel=id.brand.replace(/-/g," "),make=anchorLinks(root.html,root.url).find(x=>{const t=norm(x.text);return t===brandLabel||t===`${brandLabel} cars for sale`||t.startsWith(`${brandLabel} cars`)})?.url;if(!make)return null;const d=await fetchText(make);const modelLabel=id.model.replace(/-/g," "),m=anchorLinks(d.html,d.url).find(x=>{const t=norm(x.text);return t===modelLabel||t.startsWith(`${modelLabel} `)})?.url;return m||null}
async function arabCatalog(body,maxPages=4){const id=identityFromQuery(body.query),f=requestFilters(body),condition=body.condition==="new"?"new":"used";if(condition!=="used"||!id.brand||!id.model)return[];if((f.seller&&f.seller!=="ArabWheels")||(f.sourceType&&f.sourceType!=="marketplace"))return[];const ck=`arab|${id.brand}|${id.model}`;const hit=sourceCache.get(ck);if(hit&&Date.now()-hit.at<SOURCE_CACHE_TTL)return hit.listings.filter(c=>matchesFilters(c,f,condition));const modelUrl=await arabModelUrl(id);if(!modelUrl)return[];const pages=Array.from({length:maxPages},(_,i)=>i+1),all=[];for(let i=0;i<pages.length;i+=2){const rs=await Promise.allSettled(pages.slice(i,i+2).map(p=>fetchText(p===1?modelUrl:`${modelUrl}?page=${p}`)));let added=0;for(const r of rs)if(r.status==="fulfilled"){const xs=parseArabPage(r.value.html,r.value.url,id);all.push(...xs);added+=xs.length}if(i>=2&&added===0)break}const merged=merge(all);sourceCache.set(ck,{at:Date.now(),listings:merged});return merged.filter(c=>matchesFilters(c,f,condition))}
async function brave(query){if(!braveKey)return[];const task=async()=>{const wait=Math.max(0,1150-(Date.now()-braveLastAt));if(wait)await sleep(wait);braveLastAt=Date.now();const u=new URL("https://api.search.brave.com/res/v1/web/search");u.searchParams.set("q",query);u.searchParams.set("country","SA");u.searchParams.set("count","20");const r=await fetch(u,{headers:{Accept:"application/json","X-Subscription-Token":braveKey},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Brave HTTP ${r.status}`);const d=await r.json();return d.web?.results||[]};const p=braveTail.then(task,task);braveTail=p.catch(()=>{});return p}
function directJetour(url=""){const u=safeUrl(url);return !!u&&(u.hostname==="jetourksa.com"||u.hostname==="www.jetourksa.com")&&/^\/en\/inventory\/new-cars\/[a-z0-9.-]+_\d+\/?$/i.test(u.pathname)}
async function jetourIndexed(body){const id=identityFromQuery(body.query),f=requestFilters(body),condition=body.condition==="new"?"new":"used";if(condition!=="new"||(id.brand&&id.brand!=="jetour"))return[];if((f.seller&&f.seller!=="Jetour KSA")||(f.sourceType&&f.sourceType!=="official_dealer"))return[];const q=`site:jetourksa.com/en/inventory/new-cars/ ${id.model?`Jetour ${id.model.replace(/-/g," ")}`:"Jetour"} ${f.minYear||""}`.trim();let rs=[];try{rs=await brave(q)}catch{return[]}const out=[];for(const r of rs){const url=canonical(r.url||"");if(!directJetour(url))continue;const text=`${r.title||""} ${r.description||""}`,price=arabPrice(text);out.push({source:"Jetour KSA",sourceType:"official_dealer",seller:"Jetour KSA / National Motors Supplies",sourceStrict:true,title:r.title||"Jetour new vehicle",snippet:r.description||"Official Jetour KSA stock page",url,brand:"Jetour",model:id.model?id.model.replace(/-/g," ").toUpperCase():null,year:yearOf(text)||f.minYear||null,mileage:null,city:cityOf(text),price,priceVerified:false,priceSource:price?"indexed_snippet_unverified":null,condition:"new",saleVerified:true,saleEvidence:["direct_official_stock_url","public_search_index"],image:null,displayImage:null,imageVerified:false,imageSource:null,score:88,discovery:"jetour_public_index_fallback"})}return out.filter(c=>matchesFilters(c,f,condition))}
async function deterministic(body,deep=false){const tasks=[];const f=requestFilters(body);if(!f.seller||f.seller==="Syarah")tasks.push(syarahCatalog(body,deep?12:4));if(body.condition!=="new"&&(!f.seller||f.seller==="ArabWheels"))tasks.push(arabCatalog(body,deep?8:2));if(body.condition==="new"&&(!f.seller||f.seller==="Jetour KSA"))tasks.push(jetourIndexed(body));const rs=await Promise.allSettled(tasks);return merge(...rs.filter(r=>r.status==="fulfilled").map(r=>r.value))}
async function upstream(body,phase="fast",timeout=12000){const r=await fetch(`http://127.0.0.1:${v19Port}/api/search`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,phase}),signal:AbortSignal.timeout(timeout)});const d=await r.json().catch(()=>({error:`Upstream HTTP ${r.status}`}));if(!r.ok)throw new Error(d.error||`Upstream HTTP ${r.status}`);return d}
function jobId(body){return crypto.createHash("sha1").update(JSON.stringify({q:norm(body.query),condition:body.condition||"used",filters:body.filters||{}})).digest("hex").slice(0,20)}
function publicJob(j){const listings=[...j.listings.values()].sort((a,b)=>(b.score||0)-(a.score||0));return{query:j.body.query,condition:j.body.condition==="new"?"new":"used",listings,counts:counts(listings),live:true,phase:"full",partial:!j.complete,complete:j.complete,searchId:j.id,marketScan:true,marketScanComplete:j.complete,diagnostics:j.diagnostics,answer:j.complete?`${listings.length} verified listings found across the completed accessible-source scan.`:`${listings.length} verified listings found so far. Delilah is still scanning connected Saudi sources.`}}
function addToJob(j,xs=[]){for(const c of xs){if(!c?.url||c.saleVerified!==true)continue;const k=canonical(c.url);const old=j.listings.get(k);j.listings.set(k,old?{...old,...c,image:old.image||c.image||null,displayImage:old.displayImage||c.displayImage||null,price:old.price??c.price??null,imageVerified:Boolean(old.imageVerified||c.imageVerified),priceVerified:Boolean(old.priceVerified||c.priceVerified)}:c)}}
async function runJob(j){j.startedAt=Date.now();try{const [det,fast]=await Promise.allSettled([deterministic(j.body,false),upstream(j.body,"fast",12000)]);if(det.status==="fulfilled")addToJob(j,det.value);else j.diagnostics.push({source:"deterministic-fast",error:String(det.reason?.message||det.reason)});if(fast.status==="fulfilled")addToJob(j,fast.value.listings||[]);else j.diagnostics.push({source:"upstream-fast",error:String(fast.reason?.message||fast.reason)});j.quickReady=true;const [deep,full]=await Promise.allSettled([deterministic(j.body,true),upstream(j.body,"full",120000)]);if(deep.status==="fulfilled")addToJob(j,deep.value);else j.diagnostics.push({source:"deterministic-deep",error:String(deep.reason?.message||deep.reason)});if(full.status==="fulfilled"){addToJob(j,full.value.listings||[]);j.upstreamExhaustive=Boolean(full.value.exhaustive);j.upstreamCapHit=Boolean(full.value.exhaustiveCapHit)}else j.diagnostics.push({source:"upstream-full",error:String(full.reason?.message||full.reason)});}finally{j.complete=true;j.finishedAt=Date.now()}}
function ensureJob(body){const id=jobId(body),now=Date.now();let j=jobs.get(id);if(j&&now-j.createdAt<JOB_TTL)return j;j={id,body:{...body,condition:body.condition==="new"?"new":"used"},createdAt:now,quickReady:false,complete:false,listings:new Map(),diagnostics:[]};jobs.set(id,j);runJob(j).catch(e=>{j.diagnostics.push({source:"job",error:e?.message||String(e)});j.complete=true});return j}
async function waitQuick(j,ms=13000){const end=Date.now()+ms;while(!j.quickReady&&!j.complete&&Date.now()<end)await sleep(120);return publicJob(j)}
setInterval(()=>{const now=Date.now();for(const[id,j]of jobs)if(now-j.createdAt>JOB_TTL)jobs.delete(id);for(const[k,v]of sourceCache)if(now-v.at>SOURCE_CACHE_TTL*2)sourceCache.delete(k)},60000).unref();

app.post("/api/search",async(req,res)=>{const body=req.body||{};if(body.phase==="fast"){try{return res.json(await upstream(body,"fast",9000))}catch{const xs=await deterministic(body,false).catch(()=>[]);return res.json({query:body.query,condition:body.condition==="new"?"new":"used",listings:xs.slice(0,18),counts:counts(xs.slice(0,18)),live:true,phase:"fast",partial:true,fallback:"deterministic_sources"})}}const j=ensureJob(body);return res.json(await waitQuick(j))});
app.get("/api/search/progress/:id",(req,res)=>{const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:"Search expired"});return res.json(publicJob(j))});
app.get("/api/health",(req,res)=>res.json({ok:true,edge:"inventory-v20",logic:"progressive-market-scan-v20",search:Boolean(braveKey),marketScan:true,progressiveSearch:true,fastFirst:true,maxResults:MAX_RESULTS,deterministicSources:["Syarah","ArabWheels"],blockedSourceFallbacks:["Jetour KSA via public index when direct crawl is unavailable"]}));
app.get("/api/catalog/stats",async(req,res)=>{try{const r=await fetch(`http://127.0.0.1:${v19Port}/api/catalog/stats`,{signal:AbortSignal.timeout(5000)});if(r.ok){const d=await r.json();return res.json({...d,edge:"inventory-v20",progressiveSearch:true})}}catch{}return res.json({ok:true,edge:"inventory-v20",progressiveSearch:true,indexed:0,models:0,samples:[],note:"upstream catalog stats temporarily unavailable; search remains available"})});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!["host","content-length","connection"].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);let body;if(!["GET","HEAD"].includes(req.method)&&req.is("application/json")){body=JSON.stringify(req.body||{});headers["content-type"]="application/json"}const r=await fetch(`http://127.0.0.1:${v19Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:"manual",signal:AbortSignal.timeout(30000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!["content-length","transfer-encoding","connection"].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch{return res.status(502).json({error:"Delilah upstream unavailable"})}}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Delilah inventory-v20 running at http://localhost:${externalPort}`));