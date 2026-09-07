import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;
const allowedListingHosts=["haraj.com.sa","www.haraj.com.sa","ksa.motory.com","motory.com","www.motory.com","syarah.com","www.syarah.com","opensooq.com","sa.opensooq.com","www.opensooq.com"];

app.use(express.json({limit:"1mb"}));
app.use(express.static("public"));

function detectArabic(s=""){ return /[\u0600-\u06FF]/.test(s); }

function basicIntent(query=""){
  const q=query.toLowerCase().replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const i={brand:null,model:null,minYear:null,maxYear:null,maxPrice:null,maxMileage:null,city:null,keywords:[]};
  const brands={
    "jeep":"Jeep","جيب":"Jeep","wrangler":"Jeep","رانجلر":"Jeep",
    "toyota":"Toyota","تويوتا":"Toyota","land cruiser":"Toyota","لاندكروزر":"Toyota",
    "nissan":"Nissan","نيسان":"Nissan","patrol":"Nissan","باترول":"Nissan",
    "lexus":"Lexus","لكزس":"Lexus","mercedes":"Mercedes","مرسيدس":"Mercedes",
    "bmw":"BMW","بي ام":"BMW","porsche":"Porsche","بورش":"Porsche",
    "ford":"Ford","فورد":"Ford","chevrolet":"Chevrolet","شفروليه":"Chevrolet",
    "hyundai":"Hyundai","هيونداي":"Hyundai","kia":"Kia","كيا":"Kia"
  };
  for(const [k,v] of Object.entries(brands)) if(q.includes(k)) i.brand=v;
  const models=[["wrangler","Wrangler"],["رانجلر","Wrangler"],["patrol","Patrol"],["باترول","Patrol"],["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"]];
  for(const [k,v] of models) if(q.includes(k)) i.model=v;
  const yrs=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1])); if(yrs.length)i.minYear=Math.min(...yrs);
  const price=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,6})/); if(price)i.maxPrice=Number(price[1]);
  const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,6})\s*(?:km|كم|كيلو)/); if(km)i.maxMileage=Number(km[1]);
  if(q.includes("riyadh")||q.includes("الرياض")) i.city="Riyadh";
  if(q.includes("jeddah")||q.includes("جدة")) i.city="Jeddah";
  if(q.includes("dammam")||q.includes("الدمام")) i.city="Dammam";
  return i;
}

async function parseIntent(query){
  if(!openai) return basicIntent(query);
  const r=await openai.responses.create({
    model,
    input:`You are Delilah, a Saudi car-search assistant.\nConvert the user query into JSON only with:\nbrand, model, minYear, maxYear, maxPrice, maxMileage, city, keywords.\nUse null if unspecified. Normalize brand and Saudi city names into common English.\nNever invent a constraint.\nUser: ${JSON.stringify(query)}`
  });
  const raw=r.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  try{return JSON.parse(raw)}catch{return basicIntent(query)}
}

function makeSearchQuery(query){
  const domains=["haraj.com.sa","ksa.motory.com","syarah.com","opensooq.com"];
  const sites=domains.map(d=>`site:${d}`).join(" OR ");
  return `${query} (${sites})`;
}

async function braveWebSearch(query,count=20){
  if(!braveKey) throw new Error("BRAVE_SEARCH_API_KEY is missing");
  const u=new URL("https://api.search.brave.com/res/v1/web/search");
  u.searchParams.set("q",makeSearchQuery(query));
  u.searchParams.set("country","SA");
  u.searchParams.set("count",String(Math.min(count,20)));
  u.searchParams.set("text_decorations","false");
  const r=await fetch(u,{headers:{"Accept":"application/json","Accept-Encoding":"gzip","X-Subscription-Token":braveKey}});
  if(!r.ok) throw new Error(`Search provider error ${r.status}`);
  const d=await r.json();
  return d.web?.results || [];
}

function domainName(url=""){
  try{
    const h=new URL(url).hostname.replace(/^www\./,"");
    if(h.includes("haraj")) return "Haraj";
    if(h.includes("motory")) return "Motory";
    if(h.includes("syarah")) return "Syarah";
    if(h.includes("opensooq")) return "OpenSooq";
    return h;
  }catch{return "Web";}
}

function sourceImage(result={}){ return result.thumbnail?.src || result.thumbnail?.original || result.profile?.img || null; }

function roughExtract(title="",snippet="",url="",image=null){
  const t=`${title} ${snippet}`.replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const years=[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  const moneyMatches=[...t.matchAll(/(?:sar|ريال|ر\.س|rs)?\s*([1-9]\d{3,6})/gi)].map(x=>Number(x[1]));
  const price=moneyMatches.find(n=>n>=10000&&n<=1500000)||null;
  const kmM=t.match(/([1-9]\d{2,6})\s*(?:km|كم|كيلو)/i);
  const city = /riyadh|الرياض/i.test(t) ? "Riyadh" : /jeddah|جدة/i.test(t) ? "Jeddah" : /dammam|الدمام/i.test(t) ? "Dammam" : null;
  const brand = /jeep|جيب/i.test(t)?"Jeep":/toyota|تويوتا|land cruiser|لاندكروزر/i.test(t)?"Toyota":/nissan|نيسان|patrol|باترول/i.test(t)?"Nissan":/lexus|لكزس/i.test(t)?"Lexus":/mercedes|مرسيدس/i.test(t)?"Mercedes":/bmw|بي ام/i.test(t)?"BMW":/porsche|بورش/i.test(t)?"Porsche":null;
  const model=/wrangler|رانجلر/i.test(t)?"Wrangler":/patrol|باترول/i.test(t)?"Patrol":/land cruiser|لاندكروزر/i.test(t)?"Land Cruiser":null;
  return {source:domainName(url),title,brand,model,year:years[0]||null,price,mileage:kmM?Number(kmM[1]):null,city,url,snippet,image,imageVerified:false,priceVerified:false};
}

async function aiExtract(results){
  if(!openai) return results.map(x=>roughExtract(x.title,x.description,x.url,sourceImage(x)));
  const compact=results.slice(0,20).map((r,idx)=>({idx,title:r.title,url:r.url,snippet:r.description}));
  const rsp=await openai.responses.create({
    model,
    input:`You are Delilah, a Saudi automotive search-result parser.\nFrom these search results, identify actual individual car listings only.\nReturn a JSON array. For each result use:\nidx, brand, model, trim, year, price, mileage, city, source, confidence.\nRules:\n- Use null for missing facts.\n- Do not invent facts.\n- Keep only results that look like a specific car listing, not category/search pages or general articles.\n- price/mileage/year must be numeric.\n- Extract price only when explicitly present in the indexed title or snippet.\n- confidence is 0-100 based on how clearly this is a specific listing.\nResults: ${JSON.stringify(compact)}`
  });
  const raw=rsp.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  let arr=[]; try{arr=JSON.parse(raw)}catch{return results.map(x=>roughExtract(x.title,x.description,x.url,sourceImage(x)))}
  return arr.map(x=>{
    const src=results[x.idx]||{};
    return {...x,title:src.title||"",snippet:src.description||"",url:src.url||"",source:x.source||domainName(src.url||""),image:sourceImage(src),imageVerified:false,priceVerified:false};
  });
}

function decodeHtml(s=""){
  return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function metaValue(html,key){
  const k=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const a=new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`,`i`).exec(html);
  if(a) return decodeHtml(a[1]);
  const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`,`i`).exec(html);
  return b?decodeHtml(b[1]):null;
}
function absoluteUrl(value,base){
  if(!value) return null;
  try{return new URL(value,base).href}catch{return null}
}
function numericPrice(v){
  if(v==null) return null;
  const n=Number(String(v).replace(/[^0-9.]/g,""));
  return Number.isFinite(n)&&n>=1000&&n<=5000000?n:null;
}
function collectJsonLd(node,out=[]){
  if(!node) return out;
  if(Array.isArray(node)){for(const x of node) collectJsonLd(x,out);return out;}
  if(typeof node!=="object") return out;
  out.push(node);
  if(node["@graph"]) collectJsonLd(node["@graph"],out);
  return out;
}
function jsonLdMetadata(html,base){
  let image=null,price=null;
  const scripts=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const m of scripts){
    try{
      const parsed=JSON.parse(m[1].trim());
      for(const o of collectJsonLd(parsed)){
        const img=Array.isArray(o.image)?o.image[0]:(typeof o.image==="object"?(o.image?.url||o.image?.contentUrl):o.image);
        if(!image&&img) image=absoluteUrl(img,base);
        const offer=Array.isArray(o.offers)?o.offers[0]:o.offers;
        if(!price&&offer) price=numericPrice(offer.price||offer.lowPrice||offer.highPrice);
        if(!price) price=numericPrice(o.price);
      }
    }catch{}
  }
  return {image,price};
}
function isAllowedListingUrl(url){
  try{
    const u=new URL(url);
    return u.protocol==="https:"&&allowedListingHosts.includes(u.hostname.toLowerCase());
  }catch{return false}
}

async function fetchListingMetadata(url){
  if(!isAllowedListingUrl(url)) return null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{
      "User-Agent":"Mozilla/5.0 (compatible; DelilahCarSearch/1.0; +https://delilah-pm5f.onrender.com)",
      "Accept":"text/html,application/xhtml+xml"
    }});
    if(!r.ok) return null;
    const type=r.headers.get("content-type")||"";
    if(!type.includes("text/html")) return null;
    const html=(await r.text()).slice(0,900000);
    const json=jsonLdMetadata(html,url);
    const image=absoluteUrl(
      metaValue(html,"og:image")||metaValue(html,"twitter:image")||metaValue(html,"image")||json.image,
      url
    );
    const price=numericPrice(
      metaValue(html,"product:price:amount")||metaValue(html,"og:price:amount")||metaValue(html,"price")||json.price
    );
    return {image,price};
  }catch{return null}
  finally{clearTimeout(timer)}
}

async function enrichFromOriginalPages(cars){
  return Promise.all(cars.map(async c=>{
    const meta=await fetchListingMetadata(c.url);
    if(!meta) return c;
    return {
      ...c,
      image:meta.image||c.image||null,
      price:meta.price||c.price||null,
      imageVerified:Boolean(meta.image),
      priceVerified:Boolean(meta.price),
      sourceMetadata:Boolean(meta.image||meta.price)
    };
  }));
}

function intentMatchScore(c,i){
  let score=50;
  if(i.brand && c.brand?.toLowerCase()===i.brand.toLowerCase()) score+=14;
  if(i.model && c.model?.toLowerCase().includes(i.model.toLowerCase())) score+=14;
  if(i.minYear && c.year>=i.minYear) score+=6;
  if(i.maxPrice && c.price && c.price<=i.maxPrice) score+=6;
  if(i.maxMileage && c.mileage && c.mileage<=i.maxMileage) score+=5;
  if(i.city && c.city?.toLowerCase()===i.city.toLowerCase()) score+=5;
  if(c.imageVerified) score+=2;
  if(c.priceVerified) score+=2;
  score += Math.round((c.confidence||50)/20);
  return Math.min(score,99);
}

function satisfies(c,i){
  if(i.brand && c.brand && c.brand.toLowerCase()!==i.brand.toLowerCase()) return false;
  if(i.model && c.model && !c.model.toLowerCase().includes(i.model.toLowerCase())) return false;
  if(i.minYear && c.year && c.year<i.minYear) return false;
  if(i.maxYear && c.year && c.year>i.maxYear) return false;
  if(i.maxPrice && c.price && c.price>i.maxPrice) return false;
  if(i.maxMileage && c.mileage && c.mileage>i.maxMileage) return false;
  if(i.city && c.city && c.city.toLowerCase()!==i.city.toLowerCase()) return false;
  return true;
}

async function summary(query,cars){
  if(!cars.length) return detectArabic(query)?"ما لقيت نتائج واضحة تطابق طلبك حالياً. جرّب توسّع شرط واحد مثل السعر أو الممشى.":"I couldn't find clear current listings matching every constraint. Try widening one condition such as budget or mileage.";
  if(!openai){
    const c=cars[0];
    return `I found ${cars.length} current listing${cars.length===1?"":"s"}. The strongest match appears to be ${c.year||""} ${c.brand||""} ${c.model||""} from ${c.source}.`;
  }
  const top=cars.slice(0,5).map(c=>({source:c.source,brand:c.brand,model:c.model,trim:c.trim,year:c.year,price:c.price,priceVerified:c.priceVerified,mileage:c.mileage,city:c.city,score:c.score,url:c.url}));
  const r=await openai.responses.create({model,input:`You are Delilah, a concise Saudi car-search assistant.\nUser query: ${query}\nLive search listings: ${JSON.stringify(top)}\nSay how many listings were found and name the strongest one, explaining why based only on shown facts. Mention when a price is not shown. Reply in Arabic if the user wrote mainly Arabic.`});
  return r.output_text.trim();
}

app.post("/api/search",async(req,res)=>{
  try{
    const query=String(req.body?.query||"").trim();
    if(!query) return res.status(400).json({error:"Query is required"});
    const intent=await parseIntent(query);
    const raw=await braveWebSearch(query,20);
    let listings=await aiExtract(raw);
    listings=listings.filter(c=>c.url && (c.confidence==null || c.confidence>=45)).slice(0,10);
    listings=await enrichFromOriginalPages(listings);
    listings=listings.filter(c=>satisfies(c,intent));
    listings=listings.map(c=>({...c,score:intentMatchScore(c,intent)})).sort((a,b)=>b.score-a.score).slice(0,10);
    const answer=await summary(query,listings);
    res.json({query,intent,answer,listings,live:true,provider:"Brave Search + original public listing metadata"});
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message||"Live search failed"});
  }
});

app.get("/api/health",(req,res)=>res.json({ok:true,search:Boolean(braveKey),ai:Boolean(openai),model:openai?model:null}));
app.listen(port,()=>console.log(`Delilah Live Search running at http://localhost:${port}`));
