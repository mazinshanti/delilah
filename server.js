import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const braveKey = process.env.BRAVE_SEARCH_API_KEY || "";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;

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
    input:`You are Delilah, a Saudi car-search assistant.
Convert the user query into JSON only with:
brand, model, minYear, maxYear, maxPrice, maxMileage, city, keywords.
Use null if unspecified. Normalize brand and Saudi city names into common English.
Never invent a constraint.
User: ${JSON.stringify(query)}`
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
  const r=await fetch(u,{headers:{
    "Accept":"application/json",
    "Accept-Encoding":"gzip",
    "X-Subscription-Token":braveKey
  }});
  if(!r.ok) throw new Error(`Search provider error ${r.status}`);
  const d=await r.json();
  return d.web?.results || [];
}

async function braveImageSearch(query,count=12){
  if(!braveKey) return [];
  const u=new URL("https://api.search.brave.com/res/v1/images/search");
  u.searchParams.set("q",query);
  u.searchParams.set("country","SA");
  u.searchParams.set("count",String(Math.min(count,20)));
  u.searchParams.set("safesearch","strict");
  const r=await fetch(u,{headers:{
    "Accept":"application/json",
    "Accept-Encoding":"gzip",
    "X-Subscription-Token":braveKey
  }});
  if(!r.ok) return [];
  const d=await r.json();
  return d.results || [];
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

function roughExtract(title="",snippet="",url=""){
  const t=`${title} ${snippet}`.replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const years=[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  const moneyMatches=[...t.matchAll(/(?:sar|ريال|ر\.س|rs)?\s*([1-9]\d{3,6})/gi)].map(x=>Number(x[1]));
  const price=moneyMatches.find(n=>n>=10000&&n<=1500000)||null;
  const kmM=t.match(/([1-9]\d{2,6})\s*(?:km|كم|كيلو)/i);
  const city = /riyadh|الرياض/i.test(t) ? "Riyadh" : /jeddah|جدة/i.test(t) ? "Jeddah" : /dammam|الدمام/i.test(t) ? "Dammam" : null;
  const brand = /jeep|جيب/i.test(t)?"Jeep":/toyota|تويوتا|land cruiser|لاندكروزر/i.test(t)?"Toyota":/nissan|نيسان|patrol|باترول/i.test(t)?"Nissan":/lexus|لكزس/i.test(t)?"Lexus":/mercedes|مرسيدس/i.test(t)?"Mercedes":/bmw|بي ام/i.test(t)?"BMW":/porsche|بورش/i.test(t)?"Porsche":null;
  const model=/wrangler|رانجلر/i.test(t)?"Wrangler":/patrol|باترول/i.test(t)?"Patrol":/land cruiser|لاندكروزر/i.test(t)?"Land Cruiser":null;
  return {source:domainName(url),title,brand,model,year:years[0]||null,price,mileage:kmM?Number(kmM[1]):null,city,url,snippet};
}

async function aiExtract(results){
  if(!openai) return results.map(x=>roughExtract(x.title,x.description,x.url));
  const compact=results.slice(0,20).map((r,idx)=>({idx,title:r.title,url:r.url,snippet:r.description}));
  const rsp=await openai.responses.create({
    model,
    input:`You are Delilah, a Saudi automotive search-result parser.
From these search results, identify actual individual car listings only.
Return a JSON array. For each result use:
idx, brand, model, trim, year, price, mileage, city, source, confidence.
Rules:
- Use null for missing facts.
- Do not invent facts.
- Keep only results that look like a specific car listing, not category/search pages or general articles.
- price/mileage/year must be numeric.
- confidence is 0-100 based on how clearly this is a specific listing.
Results: ${JSON.stringify(compact)}`
  });
  const raw=rsp.output_text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
  let arr=[]; try{arr=JSON.parse(raw)}catch{return results.map(x=>roughExtract(x.title,x.description,x.url))}
  return arr.map(x=>{
    const src=results[x.idx]||{};
    return {...x,title:src.title||"",snippet:src.description||"",url:src.url||"",source:x.source||domainName(src.url||"")};
  });
}

function intentMatchScore(c,i){
  let score=50;
  if(i.brand && c.brand?.toLowerCase()===i.brand.toLowerCase()) score+=14;
  if(i.model && c.model?.toLowerCase().includes(i.model.toLowerCase())) score+=14;
  if(i.minYear && c.year>=i.minYear) score+=6;
  if(i.maxPrice && c.price && c.price<=i.maxPrice) score+=6;
  if(i.maxMileage && c.mileage && c.mileage<=i.maxMileage) score+=5;
  if(i.city && c.city?.toLowerCase()===i.city.toLowerCase()) score+=5;
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

async function attachImages(cars,query){
  const images=await braveImageSearch(`${query} Saudi car listing`);
  const unused=[...images];
  return cars.map(c=>{
    let image=null;
    const match=unused.find(img=>{
      const s=`${img.title||""} ${img.source||""}`.toLowerCase();
      return (c.brand && s.includes(c.brand.toLowerCase())) || (c.model && s.includes(c.model.toLowerCase()));
    }) || unused.shift();
    if(match) image=match.thumbnail?.src || match.properties?.url || null;
    return {...c,image};
  });
}

async function summary(query,cars){
  if(!cars.length) return detectArabic(query)?"ما لقيت نتائج واضحة تطابق طلبك حالياً. جرّب توسّع شرط واحد مثل السعر أو الممشى.":"I couldn't find clear current listings matching every constraint. Try widening one condition such as budget or mileage.";
  if(!openai){
    const c=cars[0];
    return `I found ${cars.length} current listing${cars.length===1?"":"s"}. The strongest match appears to be ${c.year||""} ${c.brand||""} ${c.model||""} from ${c.source}.`;
  }
  const top=cars.slice(0,5).map(c=>({source:c.source,brand:c.brand,model:c.model,trim:c.trim,year:c.year,price:c.price,mileage:c.mileage,city:c.city,score:c.score,url:c.url}));
  const r=await openai.responses.create({model,input:`You are Delilah, a concise Saudi car-search assistant.
User query: ${query}
Live search listings: ${JSON.stringify(top)}
Say how many listings were found and name the strongest one, explaining why based only on shown facts. Mention missing data where relevant. Reply in Arabic if the user wrote mainly Arabic.`});
  return r.output_text.trim();
}

app.post("/api/search",async(req,res)=>{
  try{
    const query=String(req.body?.query||"").trim();
    if(!query) return res.status(400).json({error:"Query is required"});
    const intent=await parseIntent(query);
    const raw=await braveWebSearch(query,20);
    let listings=await aiExtract(raw);
    listings=listings.filter(c=>c.url && (c.confidence==null || c.confidence>=45)).filter(c=>satisfies(c,intent));
    listings=listings.map(c=>({...c,score:intentMatchScore(c,intent)})).sort((a,b)=>b.score-a.score).slice(0,10);
    listings=await attachImages(listings,query);
    const answer=await summary(query,listings);
    res.json({query,intent,answer,listings,live:true,provider:"Brave Search"});
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message||"Live search failed"});
  }
});

app.get("/api/health",(req,res)=>res.json({ok:true,search:Boolean(braveKey),ai:Boolean(openai),model:openai?model:null}));
app.listen(port,()=>console.log(`Delilah Live Search running at http://localhost:${port}`));
