import express from "express";

const externalPort = Number(process.env.PORT || 3000);
const v7Port = Number(process.env.DELILAH_V7_PORT || 3200);
const v6Port = Number(process.env.DELILAH_V6_PORT || 3201);
const FAST_LIMIT = 18;
const FAST_TIMEOUT = 4800;
const FAST_CACHE_TTL = 2 * 60_000;
const fastCache = new Map();

process.env.PORT = String(v7Port);
process.env.DELILAH_INTERNAL_PORT = String(v6Port);
await import("./server-v7.js");
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: "1mb" }));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const digits = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const norm = s => digits(s).toLowerCase();
const slug = s => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const absolute = (v, b) => { try { return new URL(v, b).href; } catch { return null; } };
const escText = h => String(h || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();

const BRAND_ALIASES = {
  jeep:"Jeep",جيب:"Jeep",toyota:"Toyota",تويوتا:"Toyota",nissan:"Nissan",نيسان:"Nissan",lexus:"Lexus",لكزس:"Lexus",mercedes:"Mercedes","mercedes-benz":"Mercedes",مرسيدس:"Mercedes",bmw:"BMW","بي ام":"BMW",porsche:"Porsche",بورش:"Porsche",ford:"Ford",فورد:"Ford",lincoln:"Lincoln",لينكون:"Lincoln",hyundai:"Hyundai",هيونداي:"Hyundai",kia:"Kia",كيا:"Kia",volkswagen:"Volkswagen",فولكس:"Volkswagen",chevrolet:"Chevrolet",شفروليه:"Chevrolet",mazda:"Mazda",مازدا:"Mazda",honda:"Honda",هوندا:"Honda",mitsubishi:"Mitsubishi",ميتسوبيشي:"Mitsubishi",geely:"Geely",جيلي:"Geely",changan:"Changan",شانجان:"Changan",gac:"GAC","جي ايه سي":"GAC",mg:"MG","ام جي":"MG",genesis:"Genesis",جينيسيس:"Genesis",jetour:"Jetour",جيتور:"Jetour",haval:"Haval",هافال:"Haval",audi:"Audi",اودي:"Audi","land rover":"Land Rover","لاند روفر":"Land Rover","range rover":"Range Rover","رينج روفر":"Range Rover",cadillac:"Cadillac",كاديلاك:"Cadillac",gmc:"GMC","جي ام سي":"GMC",dodge:"Dodge",دودج:"Dodge",suzuki:"Suzuki",سوزوكي:"Suzuki",isuzu:"Isuzu",ايسوزو:"Isuzu",peugeot:"Peugeot",بيجو:"Peugeot",renault:"Renault",رينو:"Renault",chery:"Chery",شيري:"Chery",hongqi:"Hongqi",هونشي:"Hongqi",byd:"BYD",بيوايدي:"BYD",tesla:"Tesla",تسلا:"Tesla",lucid:"Lucid",لوسيد:"Lucid"
};
const MODELS = [
  ["wrangler","Wrangler"],["رانجلر","Wrangler"],["patrol","Patrol"],["باترول","Patrol"],["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"],["camry","Camry"],["كامري","Camry"],["corolla","Corolla"],["كورولا","Corolla"],["yaris","Yaris"],["يارس","Yaris"],["sunny","Sunny"],["صني","Sunny"],["x5","X5"],["c200","C200"],["tucson","Tucson"],["توسان","Tucson"],["sportage","Sportage"],["سبورتاج","Sportage"],["territory","Territory"],["تيريتوري","Territory"],["tahoe","Tahoe"],["تاهو","Tahoe"],["sonata","Sonata"],["سوناتا","Sonata"],["accent","Accent"],["اكسنت","Accent"],["elantra","Elantra"],["النترا","Elantra"],["prado","Prado"],["برادو","Prado"],["fortuner","Fortuner"],["فورتشنر","Fortuner"],["explorer","Explorer"],["اكسبلورر","Explorer"],["expedition","Expedition"],["grand cherokee","Grand Cherokee"],["جراند شيروكي","Grand Cherokee"],["cayenne","Cayenne"],["كايين","Cayenne"],["tiguan","Tiguan"],["تيجوان","Tiguan"],["pegas","Pegas"],["بيجاس","Pegas"],["cerato","Cerato"],["سيراتو","Cerato"],["sorento","Sorento"],["سورينتو","Sorento"],["k5","K5"],["x70","X70"],["x50","X50"],["t2","T2"],["t1","T1"],["dashing","Dashing"],["coolray","Coolray"],["emgrand","Emgrand"],["city","City"],["civic","Civic"],["accord","Accord"],["cx-5","CX-5"],["cx5","CX-5"],["mazda 6","Mazda 6"],["arrizo 5","Arrizo 5"],["tiggo 7","Tiggo 7"],["h6","H6"],["jolion","Jolion"],["alsvin","Alsvin"],["cs35","CS35"],["cs75","CS75"]
];
const MODEL_BRAND = {Wrangler:"Jeep",Patrol:"Nissan","Land Cruiser":"Toyota",Camry:"Toyota",Corolla:"Toyota",Yaris:"Toyota",Sunny:"Nissan",X5:"BMW",C200:"Mercedes",Tucson:"Hyundai",Sportage:"Kia",Territory:"Ford",Tahoe:"Chevrolet",Sonata:"Hyundai",Accent:"Hyundai",Elantra:"Hyundai",Prado:"Toyota",Fortuner:"Toyota",Explorer:"Ford",Expedition:"Ford","Grand Cherokee":"Jeep",Cayenne:"Porsche",Tiguan:"Volkswagen",Pegas:"Kia",Cerato:"Kia",Sorento:"Kia",K5:"Kia",X70:"Jetour",X50:"Jetour",T1:"Jetour",T2:"Jetour",Dashing:"Jetour",Coolray:"Geely",Emgrand:"Geely",City:"Honda",Civic:"Honda",Accord:"Honda","CX-5":"Mazda","Mazda 6":"Mazda","Arrizo 5":"Chery","Tiggo 7":"Chery",H6:"Haval",Jolion:"Haval",Alsvin:"Changan",CS35:"Changan",CS75:"Changan"};

function detectBrand(t="") { const q=norm(t); for (const [k,v] of Object.entries(BRAND_ALIASES)) if(q.includes(k)) return v; return null; }
function detectModel(t="") { const q=norm(t); for (const [k,v] of MODELS) if(q.includes(k)) return v; return null; }
function humanNumbers(q="") {
  let s=digits(q);
  s=s.replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف)(?=\s|$|ريال|ر\.?س)/gi,(_,n)=>String(Math.round(Number(n)*1000)));
  s=s.replace(/(\d+(?:\.\d+)?)\s*[kK](?=\s|$|SAR|ريال|ر\.?س)/g,(_,n)=>String(Math.round(Number(n)*1000)));
  return s;
}
function intentFrom(query, filters={}) {
  const q=norm(humanNumbers(query)), model=detectModel(q), brand=detectBrand(q)||MODEL_BRAND[model]||null;
  const years=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>+x[1]);
  const pm=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{4,7})/i);
  const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/i);
  let city=null;if(/riyadh|الرياض/.test(q))city="Riyadh";else if(/jeddah|جدة/.test(q))city="Jeddah";else if(/dammam|الدمام/.test(q))city="Dammam";
  return {brand,model,minYear:+filters.minYear||(years.length?Math.min(...years):null),maxYear:+filters.maxYear||null,maxPrice:+filters.maxPrice||(pm?+pm[1]:null),maxMileage:+filters.maxMileage||(km?+km[1]:null),city:filters.city||city};
}
function syarahSeedUrls(intent) {
  let base="https://syarah.com/en/autos";
  if(intent.brand)base+=`/${slug(intent.brand)}`;
  if(intent.brand&&intent.model)base+=`/${slug(intent.model)}`;
  const u2=new URL(base);u2.searchParams.set("page","2");
  return [base,u2.href];
}
async function fetchHtml(url) {
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),FAST_TIMEOUT);
  try{
    const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahFastSearch/1.0)",Accept:"text/html,application/xhtml+xml"}});
    if(!r.ok)return null;const ct=r.headers.get("content-type")||"";if(!ct.includes("text/html"))return null;return {url:r.url||url,html:(await r.text()).slice(0,2_000_000)};
  }catch{return null}finally{clearTimeout(timer)}
}
function cashPrice(text="") {
  const m=String(text).match(/Cash\s*Price\s*(?:\(\s*Includes\s*VAT\s*\))?\s*([0-9][\d,]*)\s*SAR/i)||String(text).match(/السعر\s*النقدي[^0-9]{0,30}([0-9][\d,]*)\s*(?:ر\.?س|ريال)/i);
  if(!m)return null;const n=Number(m[1].replace(/,/g,""));return Number.isFinite(n)&&n>=1000&&n<=5_000_000?n:null;
}
function imageFrom(segment, base) {
  const attrs=[...String(segment).matchAll(/<(?:img|source)\b([^>]+)>/gi)];
  for(const m of attrs){
    const x=m[1];
    for(const k of ["data-src","data-lazy-src","src","srcset"]){
      const v=new RegExp(`${k}=["']([^"']+)["']`,`i`).exec(x)?.[1];if(!v)continue;
      const first=String(v).split(",")[0].trim().split(/\s+/)[0],u=absolute(first,base);
      if(u&&!/(logo|icon|placeholder|banner|avatar|app-store|google-play|favicon)/i.test(u))return u;
    }
  }
  return null;
}
function parseCondition(t="") { const s=norm(t); if(/condition\s*:?\s*used\b|\bused\b|مستعمل|مستعملة|ممشى/.test(s))return"used"; if(/condition\s*:?\s*new\b|\bnew\b|جديد|جديدة|زيرو/.test(s))return"new"; return null; }
function parseCard(text,url,intent,requested) {
  const t=digits(`${text} ${decodeURIComponent(url)}`),year=(t.match(/\b(20\d{2})\b/)||[])[1],km=t.match(/([0-9][\d,]{0,8})\s*(?:km|kilometers?|كم|كيلو)/i);
  const city=/riyadh|الرياض/i.test(t)?"Riyadh":/jeddah|جدة/i.test(t)?"Jeddah":/dammam|الدمام/i.test(t)?"Dammam":null;
  const mileage=km?+km[1].replace(/,/g,""):null;let condition=parseCondition(t);if(!condition&&mileage===0)condition="new";else if(!condition&&mileage>100)condition="used";const price=cashPrice(t),brand=detectBrand(t)||intent.brand,model=detectModel(t)||intent.model;
  return {brand,model,year:year?+year:null,mileage,city,condition,price};
}
function matches(c,i,requested){
  if(c.condition!==requested)return false;if(i.brand&&c.brand!==i.brand)return false;if(i.model&&c.model!==i.model)return false;if(i.minYear&&(!c.year||c.year<i.minYear))return false;if(i.maxYear&&(!c.year||c.year>i.maxYear))return false;if(i.maxPrice&&c.price&&c.price>i.maxPrice)return false;if(i.maxMileage&&(c.mileage==null||c.mileage>i.maxMileage))return false;if(i.city&&c.city&&c.city!==i.city)return false;return true;
}
function parseSyarahCatalog(doc,intent,requested){
  if(!doc)return[];const html=doc.html,raw=[];
  for(const m of html.matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/href=["']([^"']+)["']/i.exec(m[1])?.[1],url=absolute(href,doc.url);if(!url)continue;let u;try{u=new URL(url)}catch{continue}if(!(u.hostname==="syarah.com"||u.hostname.endsWith(".syarah.com"))||!/^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-\d+\/?$/i.test(u.pathname))continue;raw.push({m,url,index:m.index||0});
  }
  const out=[],seen=new Set();for(let i=0;i<raw.length;i++){
    const r=raw[i];if(seen.has(r.url))continue;seen.add(r.url);const next=raw[i+1]?.index||Math.min(html.length,r.index+5000),segment=html.slice(r.index,Math.min(next,r.index+5000)),anchor=escText(r.m[2]),text=escText(segment).slice(0,1300),f=parseCard(`${anchor} ${text}`,r.url,intent,requested),image=imageFrom(segment,doc.url);if(!matches(f,intent,requested))continue;
    const title=[f.year,f.brand,f.model].filter(Boolean).join(" ")||anchor||"Syarah car";
    out.push({source:"Syarah",sourceType:"marketplace",seller:"Syarah",sourceStrict:true,title,snippet:text,url:r.url,brand:f.brand,model:f.model,year:f.year,mileage:f.mileage,city:f.city,price:f.price,priceVerified:Boolean(f.price),priceSource:f.price?"syarah_cash_price":null,condition:f.condition,saleVerified:true,image,imageVerified:Boolean(image),imageSource:image?"source_catalog":null,displayImage:image,score:Math.min(99,78+(image?8:0)+(f.price?5:0)+(f.mileage!=null?4:0)+(f.city?2:0))});
  }
  return out;
}
async function fastSearch(body={}) {
  const query=String(body.query||"").trim(),condition=body.condition==="new"?"new":"used",filters=body.filters&&typeof body.filters==="object"?body.filters:{};
  if(!query)throw Object.assign(new Error("Query is required"),{status:400});
  if(filters.seller&&filters.seller!=="Syarah")return {query,condition,intent:intentFrom(query,filters),answer:"Scanning all sources…",listings:[],counts:{},rawCandidates:0,live:true,partial:true,phase:"fast",provider:"Delilah fast lane"};
  if(filters.sourceType&&filters.sourceType!=="marketplace")return {query,condition,intent:intentFrom(query,filters),answer:"Scanning all sources…",listings:[],counts:{},rawCandidates:0,live:true,partial:true,phase:"fast",provider:"Delilah fast lane"};
  const intent=intentFrom(query,filters),key=JSON.stringify({q:query.toLowerCase(),condition,filters});const hit=fastCache.get(key);if(hit&&Date.now()-hit.at<FAST_CACHE_TTL)return {...hit.value,cached:true};
  const docs=await Promise.all(syarahSeedUrls(intent).map(fetchHtml));let listings=[];for(const d of docs)listings.push(...parseSyarahCatalog(d,intent,condition));
  const seen=new Set();listings=listings.filter(c=>{const k=c.url.replace(/\/$/,"");if(seen.has(k))return false;seen.add(k);return true}).slice(0,FAST_LIMIT);
  const value={query,condition,intent,answer:listings.length?`Found ${listings.length} quick matches. Scanning the rest of the Saudi market…`:`Scanning the wider Saudi market…`,listings,counts:listings.length?{Syarah:listings.length}:{},rawCandidates:listings.length,live:true,cached:false,partial:true,phase:"fast",provider:"Delilah fast lane — Syarah direct inventory"};fastCache.set(key,{at:Date.now(),value});for(const[k,v]of fastCache)if(Date.now()-v.at>FAST_CACHE_TTL)fastCache.delete(k);return value;
}
async function proxy(req,res){
  const target=`http://127.0.0.1:${v7Port}${req.originalUrl}`,headers={};for(const[k,v]of Object.entries(req.headers))if(!["host","content-length","connection"].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);
  let body;if(!["GET","HEAD"].includes(req.method)&&req.is("application/json")){body=JSON.stringify(req.body||{});headers["content-type"]="application/json";}
  try{const r=await fetch(target,{method:req.method,headers,body,redirect:"manual"}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!["content-length","transfer-encoding","connection"].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch(e){console.error("v8 proxy error",e);return res.status(502).json({error:"Delilah upstream unavailable"})}
}
app.post("/api/search",async(req,res,next)=>{
  if(req.body?.phase!=="fast")return next();
  const started=Date.now();try{const data=await Promise.race([fastSearch(req.body),sleep(6500).then(()=>{throw Object.assign(new Error("Fast lane timeout"),{status:504})})]);data.elapsedMs=Date.now()-started;return res.json(data)}catch(e){return res.status(e.status||500).json({error:e.message||"Fast search failed",partial:true,phase:"fast",elapsedMs:Date.now()-started})}
});
app.get("/api/health",async(req,res)=>{try{const r=await fetch(`http://127.0.0.1:${v7Port}/api/health`),d=await r.json();res.json({...d,edge:"inventory-v8",fastLane:true})}catch{res.status(503).json({ok:false,edge:"inventory-v8"})}});
app.use(proxy);
app.listen(externalPort,()=>console.log(`Delilah inventory-v8 running at http://localhost:${externalPort}`));
