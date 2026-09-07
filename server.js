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

function deepPage(url, host, blocked=[]){
  try{
    const u=new URL(url);
    if(!u.hostname.toLowerCase().includes(host)) return false;
    const p=u.pathname.toLowerCase();
    if(p==="/"||blocked.some(x=>p===x||p===`${x}/`)) return false;
    return p.split("/").filter(Boolean).length>=2;
  }catch{return false}
}

const SOURCES = [
  {
    name:"Haraj", type:"marketplace", seller:"Haraj", brands:[], conditions:["new","used"], priority:100,
    queries:(q,c)=>[
      `${q} ${c==="new"?"جديد وكالة صفر":"مستعمل ممشى"} site:haraj.com.sa/11`,
      `${q} ${c==="new"?"جديد":"مستعمل"} site:haraj.com.sa inurl:111`
    ],
    isResult:url=>{try{const u=new URL(url);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{8,}(?:\/|$)/.test(u.pathname)}catch{return false}}
  },
  {
    name:"Syarah", type:"marketplace", seller:"Syarah", brands:[], conditions:["new","used"], priority:98,
    queries:(q,c)=>[`${q} ${c==="new"?"new car جديد":"used car مستعمل"} site:syarah.com`],
    isResult:url=>deepPage(url,"syarah.com",["/search","/cars","/used-cars","/new-cars"])
  },
  {
    name:"Motory", type:"marketplace", seller:"Motory", brands:[], conditions:["new","used"], priority:96,
    queries:(q,c)=>[`${q} ${c==="new"?"new car جديد":"used car مستعمل"} site:ksa.motory.com`],
    isResult:url=>deepPage(url,"motory.com",["/search","/cars-for-sale","/used-cars","/new-cars"])
  },
  {
    name:"OpenSooq", type:"marketplace", seller:"OpenSooq", brands:[], conditions:["new","used"], priority:94,
    queries:(q,c)=>[`${q} ${c==="new"?"جديدة new":"مستعملة used"} site:opensooq.com السعودية سيارات`],
    isResult:url=>deepPage(url,"opensooq.com",["/cars","/cars-for-sale","/vehicles","/search"])
  },
  {
    name:"Toyota ALJ", type:"official_dealer", seller:"Abdul Latif Jameel Motors", brands:["Toyota"], conditions:["new"], priority:93,
    queries:q=>[`${q} site:toyota.com.sa/en/vehicles`,`${q} site:toyota.com.sa "Starting at"`],
    isResult:url=>deepPage(url,"toyota.com.sa",["/en","/en/vehicles"])
  },
  {
    name:"Lexus ALJ", type:"official_dealer", seller:"Lexus Abdul Latif Jameel", brands:["Lexus"], conditions:["new"], priority:92,
    queries:q=>[`${q} site:lexus.com.sa/en new Lexus Saudi price`],
    isResult:url=>deepPage(url,"lexus.com.sa",["/en"])
  },
  {
    name:"Nissan Petromin", type:"official_dealer", seller:"Petromin Nissan", brands:["Nissan"], conditions:["new"], priority:92,
    queries:q=>[`${q} site:petromin-nissan.com Nissan Saudi price`,`${q} site:en.petromin-nissan.com`],
    isResult:url=>deepPage(url,"petromin-nissan.com",["/","/vehicles"])
  },
  {
    name:"Ford Al Jazirah", type:"official_dealer", seller:"Al Jazirah Vehicles Agencies", brands:["Ford","Lincoln"], conditions:["new"], priority:91,
    queries:q=>[`${q} site:aljazirahford.com Ford Saudi price`,`${q} site:en.aljazirahford.com`],
    isResult:url=>deepPage(url,"aljazirahford.com",["/"])
  },
  {
    name:"Mercedes Juffali", type:"official_dealer", seller:"Juffali Automotive Company", brands:["Mercedes"], conditions:["new","used"], priority:91,
    queries:(q,c)=>[`${q} ${c==="used"?"pre-owned used":"new available cars"} site:mercedes-benz-mena.com/ksa/en`],
    isResult:url=>deepPage(url,"mercedes-benz-mena.com",["/ksa/en","/ksa/en/new-models","/ksa/en/buy-new"])
  },
  {
    name:"BMW Naghi", type:"official_dealer", seller:"Mohamed Yousuf Naghi Motors BMW", brands:["BMW"], conditions:["new","used"], priority:91,
    queries:(q,c)=>[`${q} ${c==="used"?"certified pre-owned":"view stock new"} site:bmw-saudiarabia.com`],
    isResult:url=>deepPage(url,"bmw-saudiarabia.com",["/","/models","/new-models"])
  },
  {
    name:"Kia Aljabr", type:"official_dealer", seller:"Aljabr Kia", brands:["Kia"], conditions:["new"], priority:89,
    queries:q=>[`${q} site:kia.com/aljabr Saudi Kia`],
    isResult:url=>deepPage(url,"kia.com",["/aljabr/en"])
  },
  {
    name:"Porsche SAMACO", type:"official_dealer", seller:"SAMACO Porsche", brands:["Porsche"], conditions:["new","used"], priority:90,
    queries:(q,c)=>[`${q} ${c==="used"?"used pre-owned":"new reserve online"} site:samaco.com.sa/en/porsche`],
    isResult:url=>deepPage(url,"samaco.com.sa",["/en/porsche"])
  },
  {
    name:"Volkswagen SAMACO", type:"certified_used", seller:"SAMACO Volkswagen", brands:["Volkswagen"], conditions:["new","used"], priority:88,
    queries:(q,c)=>[`${q} ${c==="used"?"certified used cars":"new buy online"} site:vw.com.sa`],
    isResult:url=>deepPage(url,"vw.com.sa",["/"])
  },
  {
    name:"Chevrolet Saudi Dealers", type:"official_dealer", seller:"Aljomaih / Universal Motors", brands:["Chevrolet"], conditions:["new"], priority:87,
    queries:q=>[`${q} site:chevroletarabia.com/sa-en Saudi Chevrolet`],
    isResult:url=>deepPage(url,"chevroletarabia.com",["/sa-en"])
  }
];

function detectArabic(s=""){return /[\u0600-\u06FF]/.test(s)}
function normalizeDigits(s=""){return String(s).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d))}
function findSource(url=""){return SOURCES.find(s=>s.isResult(url))||null}
function sourceName(url=""){return findSource(url)?.name||"Web"}

function basicIntent(query=""){
  const q=normalizeDigits(query.toLowerCase());
  const i={brand:null,model:null,minYear:null,maxYear:null,maxPrice:null,maxMileage:null,city:null,keywords:[]};
  const brands={jeep:"Jeep",جيب:"Jeep",wrangler:"Jeep",رانجلر:"Jeep",toyota:"Toyota",تويوتا:"Toyota","land cruiser":"Toyota",لاندكروزر:"Toyota",nissan:"Nissan",نيسان:"Nissan",patrol:"Nissan",باترول:"Nissan",lexus:"Lexus",لكزس:"Lexus",mercedes:"Mercedes",مرسيدس:"Mercedes",bmw:"BMW","بي ام":"BMW",porsche:"Porsche",بورش:"Porsche",ford:"Ford",فورد:"Ford",lincoln:"Lincoln",لينكون:"Lincoln",hyundai:"Hyundai",هيونداي:"Hyundai",kia:"Kia",كيا:"Kia",volkswagen:"Volkswagen",فولكس:"Volkswagen",chevrolet:"Chevrolet",شفروليه:"Chevrolet"};
  for(const[k,v]of Object.entries(brands))if(q.includes(k))i.brand=v;
  for(const[k,v]of [["wrangler","Wrangler"],["رانجلر","Wrangler"],["patrol","Patrol"],["باترول","Patrol"],["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"]])if(q.includes(k))i.model=v;
  const yrs=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));if(yrs.length)i.minYear=Math.min(...yrs);
  const price=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})/);if(price)i.maxPrice=Number(price[1]);
  const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/);if(km)i.maxMileage=Number(km[1]);
  if(q.includes("riyadh")||q.includes("الرياض"))i.city="Riyadh";if(q.includes("jeddah")||q.includes("جدة"))i.city="Jeddah";if(q.includes("dammam")||q.includes("الدمام"))i.city="Dammam";
  return i;
}

async function parseIntent(query){
  if(!openai)return basicIntent(query);
  try{const r=await openai.responses.create({model,input:`Return JSON only with brand, model, minYear, maxYear, maxPrice, maxMileage, city, keywords. Never invent constraints. User: ${JSON.stringify(query)}`});return JSON.parse(r.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim())}catch{return basicIntent(query)}
}

async function braveSearchRaw(q,count=12){
  if(!braveKey)throw new Error("BRAVE_SEARCH_API_KEY is missing");
  const u=new URL("https://api.search.brave.com/res/v1/web/search");u.searchParams.set("q",q);u.searchParams.set("country","SA");u.searchParams.set("count",String(Math.min(count,20)));u.searchParams.set("text_decorations","false");
  const r=await fetch(u,{headers:{Accept:"application/json","Accept-Encoding":"gzip","X-Subscription-Token":braveKey}});if(!r.ok)throw new Error(`Search provider error ${r.status}`);const d=await r.json();return d.web?.results||[];
}

function eligibleSources(condition,intent,filters={}){
  let list=SOURCES.filter(s=>s.conditions.includes(condition));
  if(filters.sourceType)list=list.filter(s=>s.type===filters.sourceType);
  if(filters.seller)list=list.filter(s=>s.name===filters.seller);
  if(intent.brand){
    list=list.filter(s=>!s.brands.length||s.brands.some(b=>b.toLowerCase()===intent.brand.toLowerCase()));
  }
  list.sort((a,b)=>b.priority-a.priority);
  if(!intent.brand&&!filters.seller) list=list.slice(0,condition==="new"?10:8);
  return list;
}

async function searchSource(source,query,condition){
  const batches=await Promise.allSettled(source.queries(query,condition).map(q=>braveSearchRaw(q,12)));
  const seen=new Set(),strict=[];
  for(const b of batches){
    if(b.status!=="fulfilled")continue;
    for(const r of b.value){
      if(!r.url||!source.isResult(r.url))continue;
      const key=r.url.replace(/\/$/,"");if(seen.has(key))continue;seen.add(key);
      strict.push({...r,sourceName:source.name,sourceType:source.type,seller:source.seller,sourceBrands:source.brands});
    }
  }
  return strict.slice(0,8);
}

async function searchAllSources(query,condition,intent,filters){
  const enabled=eligibleSources(condition,intent,filters);
  const batches=await Promise.allSettled(enabled.map(s=>searchSource(s,query,condition)));
  const all=[];for(const b of batches)if(b.status==="fulfilled")all.push(...b.value);
  const seen=new Set();
  return all.filter(r=>{const k=(r.url||"").replace(/\/$/,"");if(!k||seen.has(k))return false;seen.add(k);return true}).slice(0,40);
}

function sourceImage(r={}){return r.thumbnail?.src||r.thumbnail?.original||null}
function inferCondition(text="",mileage=null,source=null){
  if(source?.conditions?.length===1)return source.conditions[0];
  const t=normalizeDigits(text.toLowerCase());
  if(/\bnew\b|brand new|جديد|جديدة|زيرو|صفر كيلو|وكالة|غير مستخدم/.test(t))return"new";
  if(/\bused\b|pre-owned|مستعمل|مستعملة|ممشى|kilomet|mileage/.test(t))return"used";
  if(mileage!=null&&Number(mileage)>100)return"used";
  return null;
}

function roughExtract(r){
  const title=r.title||"",snippet=r.description||"",url=r.url||"",image=sourceImage(r),src=findSource(url);
  const t=normalizeDigits(`${title} ${snippet}`);const years=[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));const money=[...t.matchAll(/(?:sar|ريال|ر\.س|rs)?\s*([1-9]\d{3,7}(?:\.\d+)?)/gi)].map(x=>Number(x[1]));const price=money.find(n=>n>=10000&&n<=5000000)||null;const km=t.match(/([1-9]\d{2,7})\s*(?:km|كم|كيلو)/i);const mileage=km?Number(km[1]):null;const city=/riyadh|الرياض/i.test(t)?"Riyadh":/jeddah|جدة/i.test(t)?"Jeddah":/dammam|الدمام/i.test(t)?"Dammam":null;const brand=/jeep|جيب/i.test(t)?"Jeep":/toyota|تويوتا|land cruiser|لاندكروزر/i.test(t)?"Toyota":/nissan|نيسان|patrol|باترول/i.test(t)?"Nissan":/lexus|لكزس/i.test(t)?"Lexus":/mercedes|مرسيدس/i.test(t)?"Mercedes":/bmw|بي ام/i.test(t)?"BMW":/porsche|بورش/i.test(t)?"Porsche":/ford|فورد/i.test(t)?"Ford":/kia|كيا/i.test(t)?"Kia":/volkswagen|فولكس/i.test(t)?"Volkswagen":/chevrolet|شفروليه/i.test(t)?"Chevrolet":null;const model=/wrangler|رانجلر/i.test(t)?"Wrangler":/patrol|باترول/i.test(t)?"Patrol":/land cruiser|لاندكروزر/i.test(t)?"Land Cruiser":null;
  return{source:r.sourceName||src?.name||sourceName(url),sourceType:r.sourceType||src?.type||"marketplace",seller:r.seller||src?.seller||r.sourceName||"Web",title,brand,model,year:years[0]||null,price,mileage,city,url,snippet,image,condition:inferCondition(t,mileage,src),confidence:70,imageVerified:false,priceVerified:false};
}

async function aiExtract(results){
  if(!openai)return results.map(roughExtract);
  try{
    const compact=results.slice(0,36).map((r,idx)=>({idx,title:r.title,url:r.url,snippet:r.description,source:r.sourceName,seller:r.seller,sourceType:r.sourceType}));
    const rsp=await openai.responses.create({model,input:`Return JSON array of real vehicle results only with idx,brand,model,trim,year,price,mileage,city,condition,confidence. condition must be new, used, or null only when supported by the result. New official dealer model/stock pages are valid results. Never invent values. Results: ${JSON.stringify(compact)}`});
    const arr=JSON.parse(rsp.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim());
    return arr.map(x=>{const r=results[x.idx]||{};const src=findSource(r.url||"");return{...x,title:r.title||"",snippet:r.description||"",url:r.url||"",source:r.sourceName||src?.name||sourceName(r.url||""),sourceType:r.sourceType||src?.type||"marketplace",seller:r.seller||src?.seller||r.sourceName||"Web",image:sourceImage(r),condition:x.condition==="new"||x.condition==="used"?x.condition:inferCondition(`${r.title||""} ${r.description||""}`,x.mileage,src),imageVerified:false,priceVerified:false}});
  }catch{return results.map(roughExtract)}
}

function decodeHtml(s=""){return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")}
function metaValue(html,key){const k=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const a=new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`,`i`).exec(html);if(a)return decodeHtml(a[1]);const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`,`i`).exec(html);return b?decodeHtml(b[1]):null}
function absoluteUrl(v,b){if(!v)return null;try{return new URL(v,b).href}catch{return null}}
function numericPrice(v){if(v==null)return null;const n=Number(String(v).replace(/[^0-9.]/g,""));return Number.isFinite(n)&&n>=1000&&n<=5000000?n:null}
function collectJsonLd(node,out=[]){if(!node)return out;if(Array.isArray(node)){for(const x of node)collectJsonLd(x,out);return out}if(typeof node!=="object")return out;out.push(node);if(node["@graph"])collectJsonLd(node["@graph"],out);return out}
function jsonLdMetadata(html,base){let image=null,price=null;for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{for(const o of collectJsonLd(JSON.parse(m[1].trim()))){const img=Array.isArray(o.image)?o.image[0]:(typeof o.image==="object"?(o.image?.url||o.image?.contentUrl):o.image);if(!image&&img)image=absoluteUrl(img,base);const offer=Array.isArray(o.offers)?o.offers[0]:o.offers;if(!price&&offer)price=numericPrice(offer.price||offer.lowPrice||offer.highPrice);if(!price)price=numericPrice(o.price)}}catch{}}return{image,price}}

async function fetchListingMetadata(url){
  const src=findSource(url);if(!src)return null;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
  try{const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahCarSearch/1.0)",Accept:"text/html,application/xhtml+xml"}});if(!r.ok||!(r.headers.get("content-type")||"").includes("text/html"))return null;const html=(await r.text()).slice(0,900000);const j=jsonLdMetadata(html,url);return{image:absoluteUrl(metaValue(html,"og:image")||metaValue(html,"twitter:image")||j.image,url),price:numericPrice(metaValue(html,"product:price:amount")||metaValue(html,"og:price:amount")||metaValue(html,"price")||j.price)}}catch{return null}finally{clearTimeout(timer)}
}
async function enrich(cars){return Promise.all(cars.map(async c=>{const m=await fetchListingMetadata(c.url);if(!m)return c;return{...c,image:m.image||c.image||null,price:m.price||c.price||null,imageVerified:Boolean(m.image),priceVerified:Boolean(m.price)}}))}

function mergedFilters(intent,filters={}){return{...intent,minYear:Number(filters.minYear)||intent.minYear||null,maxYear:Number(filters.maxYear)||intent.maxYear||null,maxPrice:Number(filters.maxPrice)||intent.maxPrice||null,maxMileage:Number(filters.maxMileage)||intent.maxMileage||null,city:filters.city||intent.city||null}}
function satisfies(c,i,condition){if(condition&&c.condition&&c.condition!==condition)return false;if(i.brand&&c.brand&&c.brand.toLowerCase()!==i.brand.toLowerCase())return false;if(i.model&&c.model&&!c.model.toLowerCase().includes(i.model.toLowerCase()))return false;if(i.minYear&&c.year&&c.year<i.minYear)return false;if(i.maxYear&&c.year&&c.year>i.maxYear)return false;if(i.maxPrice&&c.price&&c.price>i.maxPrice)return false;if(i.maxMileage&&c.mileage&&c.mileage>i.maxMileage)return false;if(i.city&&c.city&&c.city.toLowerCase()!==i.city.toLowerCase())return false;return true}
function score(c,i){let s=55;if(c.sourceType==="official_dealer"||c.sourceType==="certified_used")s+=4;if(i.brand&&c.brand?.toLowerCase()===i.brand.toLowerCase())s+=12;if(i.model&&c.model?.toLowerCase().includes(i.model.toLowerCase()))s+=12;if(i.minYear&&c.year>=i.minYear)s+=5;if(i.maxPrice&&c.price&&c.price<=i.maxPrice)s+=5;if(i.city&&c.city?.toLowerCase()===i.city.toLowerCase())s+=4;if(c.imageVerified)s+=3;if(c.priceVerified)s+=3;return Math.min(s,99)}
async function summary(query,cars,condition){if(!cars.length)return detectArabic(query)?`ما لقيت نتائج ${condition==="new"?"جديدة":"مستعملة"} واضحة تطابق طلبك حالياً.`:`I couldn't find clear ${condition} results matching your request.`;const dealerCount=cars.filter(c=>c.sourceType!=="marketplace").length;const c=cars[0];return detectArabic(query)?`لقيت ${cars.length} نتيجة ${condition==="new"?"جديدة":"مستعملة"}${dealerCount?`، منها ${dealerCount} من وكلاء/موزعين`:""}. أقوى نتيجة حالياً من ${c.seller||c.source}.`:`I found ${cars.length} ${condition} results${dealerCount?`, including ${dealerCount} dealer results`:""}. The strongest match is from ${c.seller||c.source}.`}

app.get("/api/sources",(req,res)=>res.json({sources:SOURCES.map(({name,type,seller,brands,conditions})=>({name,type,seller,brands,conditions}))}));

app.post("/api/search",async(req,res)=>{
  try{
    const query=String(req.body?.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});
    const condition=req.body?.condition==="new"?"new":"used";
    const filters=req.body?.filters&&typeof req.body.filters==="object"?req.body.filters:{};
    const intent=mergedFilters(await parseIntent(query),filters);
    const raw=await searchAllSources(query,condition,intent,filters);
    let listings=await aiExtract(raw);
    listings=listings.filter(c=>c.url&&findSource(c.url)&&(c.confidence==null||c.confidence>=35));
    listings=await enrich(listings.slice(0,24));
    listings=listings.filter(c=>satisfies(c,intent,condition)).map(c=>({...c,score:score(c,intent)})).sort((a,b)=>b.score-a.score).slice(0,16);
    const counts=listings.reduce((a,c)=>{a[c.source]=(a[c.source]||0)+1;return a},{});
    res.json({query,condition,intent,answer:await summary(query,listings,condition),listings,counts,live:true,provider:"Saudi marketplace + dealer source registry"});
  }catch(e){console.error(e);res.status(500).json({error:e.message||"Live search failed"})}
});

app.get("/api/health",(req,res)=>res.json({ok:true,search:Boolean(braveKey),ai:Boolean(openai),sources:SOURCES.length,sourceNames:SOURCES.map(s=>s.name)}));
app.listen(port,()=>console.log(`Delilah Live Search running at http://localhost:${port}`));
