import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const SOURCES = [
  {
    name:"Haraj", host:"haraj.com.sa",
    queries:(q,c)=>[
      `${q} ${c==="new"?"جديد وكالة صفر":"مستعمل ممشى"} site:haraj.com.sa/11`,
      `${q} ${c==="new"?"جديد":"مستعمل"} site:haraj.com.sa inurl:111`
    ],
    isListing:url=>{try{const u=new URL(url);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{8,}(?:\/|$)/.test(u.pathname)}catch{return false}}
  },
  {
    name:"Syarah", host:"syarah.com",
    queries:(q,c)=>[`${q} ${c==="new"?"new car جديد":"used car مستعمل"} site:syarah.com`],
    isListing:url=>{try{const u=new URL(url);if(!/(^|\.)syarah\.com$/i.test(u.hostname))return false;const p=u.pathname.toLowerCase();if(/\/(search|cars|used-cars|new-cars|brands?|makes?)\/?$/.test(p))return false;return p.split("/").filter(Boolean).length>=2}catch{return false}}
  },
  {
    name:"Motory", host:"motory.com",
    queries:(q,c)=>[`${q} ${c==="new"?"new car جديد":"used car مستعمل"} site:ksa.motory.com`],
    isListing:url=>{try{const u=new URL(url);if(!/(^|\.)motory\.com$/i.test(u.hostname))return false;const p=u.pathname.toLowerCase();if(/\/(search|cars-for-sale|used-cars|new-cars)\/?$/.test(p))return false;return p.split("/").filter(Boolean).length>=3}catch{return false}}
  },
  {
    name:"OpenSooq", host:"opensooq.com",
    queries:(q,c)=>[`${q} ${c==="new"?"جديدة new":"مستعملة used"} site:opensooq.com السعودية سيارات`],
    isListing:url=>{try{const u=new URL(url);if(!/(^|\.)opensooq\.com$/i.test(u.hostname))return false;const p=u.pathname.toLowerCase();if(/\/(cars|cars-for-sale|vehicles|search)\/?$/.test(p))return false;return p.split("/").filter(Boolean).length>=3}catch{return false}}
  }
];

function detectArabic(s=""){return /[\u0600-\u06FF]/.test(s)}
function domainName(url=""){try{const h=new URL(url).hostname.toLowerCase();if(h.includes("haraj"))return"Haraj";if(h.includes("syarah"))return"Syarah";if(h.includes("motory"))return"Motory";if(h.includes("opensooq"))return"OpenSooq";return h}catch{return"Web"}}
function normalizeDigits(s=""){return s.replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d))}

function basicIntent(query=""){
  const q=normalizeDigits(query.toLowerCase());
  const i={brand:null,model:null,minYear:null,maxYear:null,maxPrice:null,maxMileage:null,city:null,keywords:[]};
  const brands={jeep:"Jeep",جيب:"Jeep",wrangler:"Jeep",رانجلر:"Jeep",toyota:"Toyota",تويوتا:"Toyota","land cruiser":"Toyota",لاندكروزر:"Toyota",nissan:"Nissan",نيسان:"Nissan",patrol:"Nissan",باترول:"Nissan",lexus:"Lexus",لكزس:"Lexus",mercedes:"Mercedes",مرسيدس:"Mercedes",bmw:"BMW","بي ام":"BMW",porsche:"Porsche",بورش:"Porsche",ford:"Ford",فورد:"Ford",hyundai:"Hyundai",هيونداي:"Hyundai",kia:"Kia",كيا:"Kia"};
  for(const[k,v]of Object.entries(brands))if(q.includes(k))i.brand=v;
  for(const[k,v]of [["wrangler","Wrangler"],["رانجلر","Wrangler"],["patrol","Patrol"],["باترول","Patrol"],["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"]])if(q.includes(k))i.model=v;
  const yrs=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));if(yrs.length)i.minYear=Math.min(...yrs);
  const price=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,6})/);if(price)i.maxPrice=Number(price[1]);
  const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,6})\s*(?:km|كم|كيلو)/);if(km)i.maxMileage=Number(km[1]);
  if(q.includes("riyadh")||q.includes("الرياض"))i.city="Riyadh";if(q.includes("jeddah")||q.includes("جدة"))i.city="Jeddah";if(q.includes("dammam")||q.includes("الدمام"))i.city="Dammam";
  return i;
}

async function parseIntent(query){
  if(!openai)return basicIntent(query);
  try{const r=await openai.responses.create({model,input:`Return JSON only with brand, model, minYear, maxYear, maxPrice, maxMileage, city, keywords. Never invent constraints. User: ${JSON.stringify(query)}`});return JSON.parse(r.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim())}catch{return basicIntent(query)}
}

async function braveSearchRaw(q,count=20){
  if(!braveKey)throw new Error("BRAVE_SEARCH_API_KEY is missing");
  const u=new URL("https://api.search.brave.com/res/v1/web/search");u.searchParams.set("q",q);u.searchParams.set("country","SA");u.searchParams.set("count",String(Math.min(count,20)));u.searchParams.set("text_decorations","false");
  const r=await fetch(u,{headers:{Accept:"application/json","Accept-Encoding":"gzip","X-Subscription-Token":braveKey}});if(!r.ok)throw new Error(`Search provider error ${r.status}`);const d=await r.json();return d.web?.results||[];
}

async function searchSource(source,query,condition){
  const batches=await Promise.allSettled(source.queries(query,condition).map(q=>braveSearchRaw(q,20)));const all=[];for(const b of batches)if(b.status==="fulfilled")all.push(...b.value);
  const seen=new Set(),strict=[];for(const r of all){if(!r.url||!source.isListing(r.url))continue;const key=r.url.replace(/\/$/,"");if(seen.has(key))continue;seen.add(key);strict.push({...r,marketplace:source.name})}return strict.slice(0,10);
}
async function searchAllMarketplaces(query,condition,sourceFilter){
  const enabled=SOURCES.filter(s=>!sourceFilter?.length||sourceFilter.includes(s.name));
  const batches=await Promise.allSettled(enabled.map(s=>searchSource(s,query,condition)));const all=[];for(const b of batches)if(b.status==="fulfilled")all.push(...b.value);const seen=new Set();return all.filter(r=>{const k=(r.url||"").replace(/\/$/,"");if(!k||seen.has(k))return false;seen.add(k);return true});
}

function sourceImage(r={}){return r.thumbnail?.src||r.thumbnail?.original||null}
function inferCondition(text="",mileage=null){
  const t=normalizeDigits(text.toLowerCase());
  if(/\bnew\b|brand new|جديد|جديدة|زيرو|صفر كيلو|وكالة|غير مستخدم/.test(t))return"new";
  if(/\bused\b|pre-owned|مستعمل|مستعملة|ممشى|كيلو متر|kilomet|mileage/.test(t))return"used";
  if(mileage!=null&&Number(mileage)>100)return"used";
  return null;
}
function roughExtract(title="",snippet="",url="",image=null){
  const t=normalizeDigits(`${title} ${snippet}`);const years=[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));const money=[...t.matchAll(/(?:sar|ريال|ر\.س|rs)?\s*([1-9]\d{3,6})/gi)].map(x=>Number(x[1]));const price=money.find(n=>n>=10000&&n<=1500000)||null;const km=t.match(/([1-9]\d{2,6})\s*(?:km|كم|كيلو)/i);const mileage=km?Number(km[1]):null;const city=/riyadh|الرياض/i.test(t)?"Riyadh":/jeddah|جدة/i.test(t)?"Jeddah":/dammam|الدمام/i.test(t)?"Dammam":null;const brand=/jeep|جيب/i.test(t)?"Jeep":/toyota|تويوتا|land cruiser|لاندكروزر/i.test(t)?"Toyota":/nissan|نيسان|patrol|باترول/i.test(t)?"Nissan":/lexus|لكزس/i.test(t)?"Lexus":/mercedes|مرسيدس/i.test(t)?"Mercedes":/bmw|بي ام/i.test(t)?"BMW":/porsche|بورش/i.test(t)?"Porsche":null;const model=/wrangler|رانجلر/i.test(t)?"Wrangler":/patrol|باترول/i.test(t)?"Patrol":/land cruiser|لاندكروزر/i.test(t)?"Land Cruiser":null;return{source:domainName(url),title,brand,model,year:years[0]||null,price,mileage,city,url,snippet,image,condition:inferCondition(t,mileage),confidence:70,imageVerified:false,priceVerified:false};
}

async function aiExtract(results){
  if(!openai)return results.map(r=>roughExtract(r.title,r.description,r.url,sourceImage(r)));
  try{const compact=results.slice(0,32).map((r,idx)=>({idx,title:r.title,url:r.url,snippet:r.description,marketplace:r.marketplace}));const rsp=await openai.responses.create({model,input:`Return JSON array of actual individual vehicle listings only with idx,brand,model,trim,year,price,mileage,city,condition,confidence. condition must be new, used, or null and only when explicit. Never invent values. Results: ${JSON.stringify(compact)}`});const arr=JSON.parse(rsp.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim());return arr.map(x=>{const src=results[x.idx]||{};const condition=x.condition==="new"||x.condition==="used"?x.condition:inferCondition(`${src.title||""} ${src.description||""}`,x.mileage);return{...x,title:src.title||"",snippet:src.description||"",url:src.url||"",source:src.marketplace||domainName(src.url||""),image:sourceImage(src),condition,imageVerified:false,priceVerified:false}})}catch{return results.map(r=>roughExtract(r.title,r.description,r.url,sourceImage(r)))}
}

function decodeHtml(s=""){return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")}
function metaValue(html,key){const k=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const a=new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`,`i`).exec(html);if(a)return decodeHtml(a[1]);const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`,`i`).exec(html);return b?decodeHtml(b[1]):null}
function absoluteUrl(v,b){if(!v)return null;try{return new URL(v,b).href}catch{return null}}
function numericPrice(v){if(v==null)return null;const n=Number(String(v).replace(/[^0-9.]/g,""));return Number.isFinite(n)&&n>=1000&&n<=5000000?n:null}
function collectJsonLd(node,out=[]){if(!node)return out;if(Array.isArray(node)){for(const x of node)collectJsonLd(x,out);return out}if(typeof node!=="object")return out;out.push(node);if(node["@graph"])collectJsonLd(node["@graph"],out);return out}
function jsonLdMetadata(html,base){let image=null,price=null;for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{for(const o of collectJsonLd(JSON.parse(m[1].trim()))){const img=Array.isArray(o.image)?o.image[0]:(typeof o.image==="object"?(o.image?.url||o.image?.contentUrl):o.image);if(!image&&img)image=absoluteUrl(img,base);const offer=Array.isArray(o.offers)?o.offers[0]:o.offers;if(!price&&offer)price=numericPrice(offer.price||offer.lowPrice||offer.highPrice);if(!price)price=numericPrice(o.price)}}catch{}}return{image,price}}
async function fetchListingMetadata(url){const source=SOURCES.find(s=>s.isListing(url));if(!source)return null;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahCarSearch/1.0)",Accept:"text/html,application/xhtml+xml"}});if(!r.ok||!(r.headers.get("content-type")||"").includes("text/html"))return null;const html=(await r.text()).slice(0,900000);const j=jsonLdMetadata(html,url);return{image:absoluteUrl(metaValue(html,"og:image")||metaValue(html,"twitter:image")||j.image,url),price:numericPrice(metaValue(html,"product:price:amount")||metaValue(html,"og:price:amount")||metaValue(html,"price")||j.price)}}catch{return null}finally{clearTimeout(timer)}}
async function enrich(cars){return Promise.all(cars.map(async c=>{const m=await fetchListingMetadata(c.url);if(!m)return c;return{...c,image:m.image||c.image||null,price:m.price||c.price||null,imageVerified:Boolean(m.image),priceVerified:Boolean(m.price)}}))}

function mergedFilters(intent,filters={}){return{...intent,minYear:Number(filters.minYear)||intent.minYear||null,maxYear:Number(filters.maxYear)||intent.maxYear||null,maxPrice:Number(filters.maxPrice)||intent.maxPrice||null,maxMileage:Number(filters.maxMileage)||intent.maxMileage||null,city:filters.city||intent.city||null}}
function satisfies(c,i,condition){if(condition&&c.condition!==condition)return false;if(i.brand&&c.brand&&c.brand.toLowerCase()!==i.brand.toLowerCase())return false;if(i.model&&c.model&&!c.model.toLowerCase().includes(i.model.toLowerCase()))return false;if(i.minYear&&c.year&&c.year<i.minYear)return false;if(i.maxYear&&c.year&&c.year>i.maxYear)return false;if(i.maxPrice&&c.price&&c.price>i.maxPrice)return false;if(i.maxMileage&&c.mileage&&c.mileage>i.maxMileage)return false;if(i.city&&c.city&&c.city.toLowerCase()!==i.city.toLowerCase())return false;return true}
function score(c,i){let s=55;if(i.brand&&c.brand?.toLowerCase()===i.brand.toLowerCase())s+=12;if(i.model&&c.model?.toLowerCase().includes(i.model.toLowerCase()))s+=12;if(i.minYear&&c.year>=i.minYear)s+=5;if(i.maxPrice&&c.price&&c.price<=i.maxPrice)s+=5;if(i.city&&c.city?.toLowerCase()===i.city.toLowerCase())s+=4;if(c.imageVerified)s+=3;if(c.priceVerified)s+=3;return Math.min(s,99)}
async function summary(query,cars,condition){if(!cars.length)return detectArabic(query)?`ما لقيت إعلانات ${condition==="new"?"جديدة":"مستعملة"} واضحة تطابق طلبك حالياً.`:`I couldn't find clear ${condition} listings matching your request.`;const c=cars[0];return detectArabic(query)?`لقيت ${cars.length} إعلان ${condition==="new"?"جديد":"مستعمل"}. أقوى نتيجة حالياً من ${c.source}.`:`I found ${cars.length} ${condition} listings. The strongest current match is from ${c.source}.`}

app.post("/api/search",async(req,res)=>{
  try{
    const query=String(req.body?.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});
    const condition=req.body?.condition==="new"?"new":"used";
    const filters=req.body?.filters&&typeof req.body.filters==="object"?req.body.filters:{};
    const sourceFilter=Array.isArray(filters.sources)?filters.sources.filter(x=>SOURCES.some(s=>s.name===x)):[];
    const intent=mergedFilters(await parseIntent(query),filters);
    const raw=await searchAllMarketplaces(query,condition,sourceFilter);
    let listings=await aiExtract(raw);
    listings=listings.filter(c=>c.url&&SOURCES.some(s=>s.isListing(c.url))&&(c.confidence==null||c.confidence>=35));
    listings=await enrich(listings.slice(0,20));
    listings=listings.filter(c=>satisfies(c,intent,condition)).map(c=>({...c,score:score(c,intent)})).sort((a,b)=>b.score-a.score).slice(0,12);
    const counts=Object.fromEntries(SOURCES.map(s=>[s.name,listings.filter(x=>x.source===s.name).length]));
    res.json({query,condition,intent,answer:await summary(query,listings,condition),listings,counts,live:true,provider:"Strict separated marketplace listings"});
  }catch(e){console.error(e);res.status(500).json({error:e.message||"Live search failed"})}
});

app.get("/api/health",(req,res)=>res.json({ok:true,search:Boolean(braveKey),ai:Boolean(openai),sources:SOURCES.map(s=>s.name)}));
app.listen(port,()=>console.log(`Delilah Live Search running at http://localhost:${port}`));