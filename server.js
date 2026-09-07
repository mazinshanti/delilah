import "dotenv/config";
import express from "express";

const app=express();
const port=process.env.PORT||3000;
const braveKey=process.env.BRAVE_SEARCH_API_KEY||"";
const CACHE_TTL=45_000;
const searchCache=new Map();
const sourceHealth=new Map();

app.use(express.json({limit:"1mb"}));
app.use(express.static("public"));

function normalizeDigits(s=""){return String(s).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d))}
function detectArabic(s=""){return /[\u0600-\u06FF]/.test(s)}
function hostMatches(host,base){return host===base||host.endsWith(`.${base}`)}
function safeUrl(v){try{return new URL(v)}catch{return null}}
function deepPage(url,base,blocked=[]){const u=safeUrl(url);if(!u||!hostMatches(u.hostname.toLowerCase(),base))return false;const p=u.pathname.toLowerCase().replace(/\/$/,"")||"/";if(p==="/"||blocked.includes(p))return false;return p.split("/").filter(Boolean).length>=2}
function canonicalUrl(url=""){const u=safeUrl(url);if(!u)return url;u.hash="";if(hostMatches(u.hostname.toLowerCase(),"haraj.com.sa")&&/^\/\d{7,}(?:\/|$)/.test(u.pathname))return `https://haraj.com.sa${u.pathname}${u.search}`;return u.href}

const SOURCES=[
{name:"Haraj",type:"marketplace",seller:"Haraj",conditions:["new","used"],brands:[],priority:100,strict:true,queries:(q,c)=>[`${q} ${c==="new"?"جديد وكالة صفر":"مستعمل ممشى"} site:haraj.com.sa/11`,`${q} ${c==="new"?"جديد":"مستعمل"} site:haraj.com.sa inurl:111`],isCandidate:url=>{const u=safeUrl(url);return !!u&&hostMatches(u.hostname.toLowerCase(),"haraj.com.sa")&&/^\/\d{7,}(?:\/|$)/.test(u.pathname)}},
{name:"Syarah",type:"marketplace",seller:"Syarah",conditions:["new","used"],brands:[],priority:99,strict:false,queries:(q,c)=>[`${q} ${c==="new"?"new car جديد":"used car مستعمل"} site:syarah.com`],isCandidate:url=>deepPage(url,"syarah.com",["/search","/cars","/used-cars","/new-cars","/brands"])},
{name:"CarSwitch Saudi",type:"marketplace",seller:"CarSwitch Saudi",conditions:["used"],brands:[],priority:98,strict:true,queries:q=>[`${q} site:ksa.carswitch.com used car`],isCandidate:url=>{const u=safeUrl(url);if(!u||!hostMatches(u.hostname.toLowerCase(),"carswitch.com"))return false;const p=u.pathname.toLowerCase();return p.includes("/used-cars/")&&!/\/(search|used-cars)\/?$/.test(p)}},
{name:"Carly",type:"certified_used",seller:"Carly - كارلي",conditions:["new","used"],brands:[],priority:98,strict:true,queries:(q,c)=>[`${q} ${c==="new"?"new":"used"} site:halacarly.com/vehicle-details`,`${q} ${c==="new"?"جديد":"مستعمل"} site:halacarly.com/vehicle-details`],isCandidate:url=>{const u=safeUrl(url);return !!u&&hostMatches(u.hostname.toLowerCase(),"halacarly.com")&&u.pathname.toLowerCase().includes("/vehicle-details/")}},
{name:"Saleh Cars",type:"independent_dealer",seller:"Saleh Cars Group",conditions:["new"],brands:[],priority:97,strict:true,queries:q=>[`${q} site:salehcars.com/cars/`,`${q} site:salehcars.com/en/cars/`],isCandidate:url=>{const u=safeUrl(url);if(!u||!hostMatches(u.hostname.toLowerCase(),"salehcars.com"))return false;const p=u.pathname.toLowerCase();if(p==="/cars/all"||p==="/en/cars/all"||/\/(offers|contact-us|brands)(\/|$)/.test(p))return false;return p.includes("/cars/")&&p.split("/").filter(Boolean).length>=2}},
{name:"Key Used Cars",type:"independent_dealer",seller:"Key Used Cars",conditions:["used"],brands:[],priority:95,strict:false,queries:q=>[`${q} site:key.sa car selling used price kilometers`],isCandidate:url=>deepPage(url,"key.sa",[])},
{name:"Motory",type:"marketplace",seller:"Motory",conditions:["new","used"],brands:[],priority:96,strict:false,queries:(q,c)=>[`${q} ${c==="new"?"new car جديد":"used car مستعمل"} site:ksa.motory.com`],isCandidate:url=>deepPage(url,"motory.com",["/search","/cars-for-sale","/used-cars","/new-cars"])},
{name:"OpenSooq",type:"marketplace",seller:"OpenSooq",conditions:["new","used"],brands:[],priority:94,strict:false,queries:(q,c)=>[`${q} ${c==="new"?"new جديدة":"used مستعملة"} site:opensooq.com السعودية سيارات`],isCandidate:url=>deepPage(url,"opensooq.com",["/cars","/cars-for-sale","/vehicles","/search"])},
{name:"Toyota ALJ",type:"official_dealer",seller:"Abdul Latif Jameel Motors",conditions:["new"],brands:["Toyota"],priority:93,strict:false,queries:q=>[`${q} site:toyota.com.sa buy reserve price`],isCandidate:url=>deepPage(url,"toyota.com.sa",["/en","/en/vehicles"])},
{name:"Lexus ALJ",type:"official_dealer",seller:"Lexus Abdul Latif Jameel",conditions:["new"],brands:["Lexus"],priority:92,strict:false,queries:q=>[`${q} site:lexus.com.sa buy reserve price`],isCandidate:url=>deepPage(url,"lexus.com.sa",["/en"])},
{name:"Nissan Petromin",type:"official_dealer",seller:"Petromin Nissan",conditions:["new"],brands:["Nissan"],priority:92,strict:false,queries:q=>[`${q} site:petromin-nissan.com buy price reserve`],isCandidate:url=>deepPage(url,"petromin-nissan.com",["/","/vehicles"])},
{name:"Ford Al Jazirah",type:"official_dealer",seller:"Al Jazirah Vehicles Agencies",conditions:["new"],brands:["Ford","Lincoln"],priority:91,strict:false,queries:q=>[`${q} site:aljazirahford.com price buy reserve`],isCandidate:url=>deepPage(url,"aljazirahford.com",["/"])},
{name:"Mercedes Juffali",type:"official_dealer",seller:"Juffali Automotive Company",conditions:["new","used"],brands:["Mercedes"],priority:91,strict:false,queries:(q,c)=>[`${q} ${c==="used"?"pre-owned stock price":"available cars buy price"} site:mercedes-benz-mena.com/ksa/en`],isCandidate:url=>deepPage(url,"mercedes-benz-mena.com",["/ksa/en","/ksa/en/new-models","/ksa/en/buy-new"])},
{name:"BMW Naghi",type:"official_dealer",seller:"Mohamed Yousuf Naghi Motors BMW",conditions:["new","used"],brands:["BMW"],priority:91,strict:false,queries:(q,c)=>[`${q} ${c==="used"?"certified pre-owned stock":"view stock buy"} site:bmw-saudiarabia.com`],isCandidate:url=>deepPage(url,"bmw-saudiarabia.com",["/","/models","/new-models"])},
{name:"Kia Aljabr",type:"official_dealer",seller:"Aljabr Kia",conditions:["new"],brands:["Kia"],priority:89,strict:false,queries:q=>[`${q} site:kia.com/aljabr price buy`],isCandidate:url=>deepPage(url,"kia.com",["/aljabr/en"])},
{name:"Porsche SAMACO",type:"official_dealer",seller:"SAMACO Porsche",conditions:["new","used"],brands:["Porsche"],priority:90,strict:false,queries:(q,c)=>[`${q} ${c==="used"?"pre-owned stock":"reserve online price"} site:samaco.com.sa/en/porsche`],isCandidate:url=>deepPage(url,"samaco.com.sa",["/en/porsche"])},
{name:"Volkswagen SAMACO",type:"certified_used",seller:"SAMACO Volkswagen",conditions:["new","used"],brands:["Volkswagen"],priority:88,strict:false,queries:(q,c)=>[`${q} ${c==="used"?"certified used stock":"buy online price"} site:vw.com.sa`],isCandidate:url=>deepPage(url,"vw.com.sa",["/"])},
{name:"Chevrolet Saudi Dealers",type:"official_dealer",seller:"Aljomaih / Universal Motors",conditions:["new"],brands:["Chevrolet"],priority:87,strict:false,queries:q=>[`${q} site:chevroletarabia.com/sa-en price buy`],isCandidate:url=>deepPage(url,"chevroletarabia.com",["/sa-en"])}
];

function basicIntent(query=""){
 const q=normalizeDigits(query.toLowerCase());
 const i={brand:null,model:null,minYear:null,maxYear:null,maxPrice:null,maxMileage:null,city:null};
 const brands={jeep:"Jeep",جيب:"Jeep",wrangler:"Jeep",رانجلر:"Jeep",toyota:"Toyota",تويوتا:"Toyota","land cruiser":"Toyota",لاندكروزر:"Toyota",nissan:"Nissan",نيسان:"Nissan",patrol:"Nissan",باترول:"Nissan",lexus:"Lexus",لكزس:"Lexus",mercedes:"Mercedes",مرسيدس:"Mercedes",bmw:"BMW","بي ام":"BMW",porsche:"Porsche",بورش:"Porsche",ford:"Ford",فورد:"Ford",lincoln:"Lincoln",لينكون:"Lincoln",hyundai:"Hyundai",هيونداي:"Hyundai",kia:"Kia",كيا:"Kia",volkswagen:"Volkswagen",فولكس:"Volkswagen",chevrolet:"Chevrolet",شفروليه:"Chevrolet"};
 for(const[k,v]of Object.entries(brands))if(q.includes(k))i.brand=v;
 const models=[["wrangler","Wrangler"],["رانجلر","Wrangler"],["patrol","Patrol"],["باترول","Patrol"],["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"],["camry","Camry"],["كامري","Camry"],["x5","X5"],["c200","C200"],["tucson","Tucson"],["توسان","Tucson"],["sportage","Sportage"],["سبورتاج","Sportage"],["territory","Territory"],["تيريتوري","Territory"],["tahoe","Tahoe"],["تاهو","Tahoe"]];
 for(const[k,v]of models)if(q.includes(k))i.model=v;
 const yrs=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));if(yrs.length)i.minYear=Math.min(...yrs);
 const price=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})/);if(price)i.maxPrice=Number(price[1]);
 const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/);if(km)i.maxMileage=Number(km[1]);
 if(/riyadh|الرياض/.test(q))i.city="Riyadh";else if(/jeddah|جدة/.test(q))i.city="Jeddah";else if(/dammam|الدمام/.test(q))i.city="Dammam";
 return i;
}
function mergedIntent(i,f={}){return{...i,minYear:Number(f.minYear)||i.minYear,maxYear:Number(f.maxYear)||i.maxYear,maxPrice:Number(f.maxPrice)||i.maxPrice,maxMileage:Number(f.maxMileage)||i.maxMileage,city:f.city||i.city}}
function eligibleSources(condition,intent,filters={}){let x=SOURCES.filter(s=>s.conditions.includes(condition));if(filters.sourceType)x=x.filter(s=>s.type===filters.sourceType);if(filters.seller)x=x.filter(s=>s.name===filters.seller);if(intent.brand)x=x.filter(s=>!s.brands.length||s.brands.some(b=>b.toLowerCase()===intent.brand.toLowerCase()));return x.sort((a,b)=>b.priority-a.priority)}

async function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function braveSearch(q,count=20){
 if(!braveKey)throw new Error("BRAVE_SEARCH_API_KEY is missing");
 const u=new URL("https://api.search.brave.com/res/v1/web/search");u.searchParams.set("q",q);u.searchParams.set("country","SA");u.searchParams.set("count",String(Math.min(count,20)));u.searchParams.set("text_decorations","false");
 let err;
 for(let a=0;a<3;a++){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10_000);
  try{const r=await fetch(u,{signal:c.signal,headers:{Accept:"application/json","Accept-Encoding":"gzip","X-Subscription-Token":braveKey}});if(r.ok){const d=await r.json();return d.web?.results||[]}err=new Error(`Search provider error ${r.status}`);if(r.status!==429&&r.status<500)throw err}catch(e){err=e}finally{clearTimeout(timer)}
  if(a<2)await sleep(300*(2**a));
 }
 throw err||new Error("Search provider failed");
}

async function searchSource(source,query,condition){
 const runs=await Promise.allSettled(source.queries(query,condition).map(q=>braveSearch(q,20)));
 const bad=runs.filter(x=>x.status==="rejected");sourceHealth.set(source.name,{ok:bad.length<runs.length,lastChecked:new Date().toISOString(),failures:bad.length,total:runs.length,lastError:bad[0]?.reason?.message||null});
 const out=[],seen=new Set();for(const run of runs){if(run.status!=="fulfilled")continue;for(const r of run.value){if(!r.url||!source.isCandidate(r.url))continue;const url=canonicalUrl(r.url);if(seen.has(url))continue;seen.add(url);out.push({...r,url,source})}}
 return out.slice(0,14);
}
async function searchAll(query,condition,intent,filters){const sources=eligibleSources(condition,intent,filters);const batches=await Promise.allSettled(sources.map(s=>searchSource(s,query,condition)));const out=[],seen=new Set();for(const b of batches){if(b.status!=="fulfilled")continue;for(const r of b.value){if(seen.has(r.url))continue;seen.add(r.url);out.push(r)}}return out.slice(0,90)}

function decodeHtml(s=""){return String(s).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")}
function meta(html,key){const k=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const a=new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`,`i`).exec(html)||new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`,`i`).exec(html);return a?decodeHtml(a[1]):null}
function stripHtml(html=""){return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).slice(0,180000)}
function absolute(v,base){if(!v)return null;try{return new URL(v,base).href}catch{return null}}
function priceNum(v){if(v==null)return null;const n=Number(String(v).replace(/[^0-9.]/g,""));return Number.isFinite(n)&&n>=1000&&n<=5000000?n:null}
function collectJson(node,out=[]){if(!node)return out;if(Array.isArray(node)){for(const x of node)collectJson(x,out);return out}if(typeof node!=="object")return out;out.push(node);for(const v of Object.values(node))if(v&&typeof v==="object")collectJson(v,out);return out}
function parseLd(html){const objects=[];for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{collectJson(JSON.parse(m[1].trim()),objects)}catch{}}return objects}
function imageOkay(url=""){const s=url.toLowerCase();return /^https?:/.test(s)&&!/(logo|favicon|icon|placeholder|sprite|social|share|banner|default[-_]?image|brandmark)/.test(s)}
function ldType(o){const t=o?.["@type"];return Array.isArray(t)?t.map(String):t?[String(t)]:[]}

function inspectPage(html,url,source){
 const text=stripHtml(html),lower=text.toLowerCase(),ld=parseLd(html);let image=null,price=null,structuredVehicle=false,structuredOffer=false,availability=false,stock=false;
 for(const o of ld){const types=ldType(o).map(x=>x.toLowerCase());if(types.some(t=>["vehicle","car","product","individualproduct"].includes(t)))structuredVehicle=true;if(types.includes("offer")||o.offers)structuredOffer=true;const img=Array.isArray(o.image)?o.image[0]:(typeof o.image==="object"?(o.image.url||o.image.contentUrl):o.image);const abs=absolute(img,url);if(!image&&abs&&imageOkay(abs))image=abs;const offer=Array.isArray(o.offers)?o.offers[0]:o.offers;if(!price&&offer)price=priceNum(offer.price||offer.lowPrice||offer.highPrice);if(!price)price=priceNum(o.price);if(offer?.availability||o.availability)availability=true;if(o.sku||o.mpn||o.vehicleIdentificationNumber||o.vin)stock=true}
 const og=absolute(meta(html,"og:image")||meta(html,"twitter:image"),url);if(!image&&og&&imageOkay(og))image=og;
 price=price||priceNum(meta(html,"product:price:amount")||meta(html,"og:price:amount")||meta(html,"price"));
 const currency=/(?:\bSAR\b|ريال|ر\.س)/i.test(text);const explicitSale=/(for sale|available now|buy now|reserve now|book now|add to cart|للبيع|متاح الآن|احجز الآن|اشتري الآن|اطلب الآن)/i.test(text);const inventoryTerms=/(stock number|stock no|vin\b|sku\b|chassis|vehicle id|رقم الهيكل|رقم المخزون)/i.test(text);const mileage=/(\d[\d,]{2,8})\s*(?:km|kilometers?|كم|كيلو)/i.test(text);const transactional=/(finance this car|monthly payment|cash price|book a test drive|request quote|احسب التمويل|اطلب عرض|تجربة قيادة)/i.test(text);
 const informative=/(news|blog|article|review|brochure|specifications|specification|owners manual|press release|الأخبار|مقال|مواصفات|كتيب)/i.test(`${url} ${meta(html,"og:type")||""}`);
 let saleScore=0;if(source.strict)saleScore+=6;if(structuredVehicle)saleScore+=2;if(structuredOffer)saleScore+=3;if(price&&currency)saleScore+=3;else if(price)saleScore+=2;if(availability)saleScore+=2;if(stock||inventoryTerms)saleScore+=3;if(explicitSale)saleScore+=3;if(transactional)saleScore+=2;if(mileage)saleScore+=1;if(informative&&!source.strict)saleScore-=6;
 const saleVerified=source.strict||saleScore>=5;
 return{saleVerified,saleScore,image:image||null,imageVerified:Boolean(image),price:price||null,pageText:text.slice(0,50000),structuredVehicle,structuredOffer,informative};
}

async function fetchPage(candidate){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),6000);try{const r=await fetch(candidate.url,{redirect:"follow",signal:c.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahCarSearch/2.0)",Accept:"text/html,application/xhtml+xml"}});if(!r.ok)return null;const final=canonicalUrl(r.url||candidate.url);if(!candidate.source.isCandidate(final)&&!candidate.source.strict)return null;const type=r.headers.get("content-type")||"";if(!type.includes("text/html"))return null;const html=(await r.text()).slice(0,1_200_000);return{...inspectPage(html,final,candidate.source),finalUrl:final}}catch{return null}finally{clearTimeout(timer)}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}

function extractFields(text=""){
 const t=normalizeDigits(text);const low=t.toLowerCase();const year=[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1])).find(y=>y>=2000&&y<=2035)||null;
 const brand=/jeep|جيب/i.test(t)?"Jeep":/toyota|تويوتا|land cruiser|لاندكروزر/i.test(t)?"Toyota":/nissan|نيسان|patrol|باترول/i.test(t)?"Nissan":/lexus|لكزس/i.test(t)?"Lexus":/mercedes|مرسيدس/i.test(t)?"Mercedes":/bmw|بي ام/i.test(t)?"BMW":/porsche|بورش/i.test(t)?"Porsche":/ford|فورد/i.test(t)?"Ford":/lincoln|لينكون/i.test(t)?"Lincoln":/hyundai|هيونداي/i.test(t)?"Hyundai":/kia|كيا/i.test(t)?"Kia":/volkswagen|فولكس/i.test(t)?"Volkswagen":/chevrolet|شفروليه/i.test(t)?"Chevrolet":null;
 const model=/wrangler|رانجلر/i.test(t)?"Wrangler":/patrol|باترول/i.test(t)?"Patrol":/land cruiser|لاندكروزر/i.test(t)?"Land Cruiser":/camry|كامري/i.test(t)?"Camry":/\bx5\b/i.test(t)?"X5":/\bc200\b/i.test(t)?"C200":/tucson|توسان/i.test(t)?"Tucson":/sportage|سبورتاج/i.test(t)?"Sportage":/territory|تيريتوري/i.test(t)?"Territory":/tahoe|تاهو/i.test(t)?"Tahoe":null;
 const km=t.match(/([1-9][\d,]{1,8})\s*(?:km|kilometers?|كم|كيلو)/i);const mileage=km?Number(km[1].replace(/,/g,"")):null;const city=/riyadh|الرياض/i.test(t)?"Riyadh":/jeddah|جدة/i.test(t)?"Jeddah":/dammam|الدمام/i.test(t)?"Dammam":null;
 const currencyPrice=t.match(/(?:SAR|ر\.س)\s*([1-9][\d,]{3,8})|([1-9][\d,]{3,8})\s*(?:SAR|ريال|ر\.س)/i);const price=currencyPrice?Number((currencyPrice[1]||currencyPrice[2]).replace(/,/g,"")):null;
 const newSignal=/\bnew\b|brand new|جديد|جديدة|زيرو|صفر كيلو|غير مستخدم|وكالة/i.test(t),usedSignal=/\bused\b|pre-owned|مستعمل|مستعملة|ممشى/i.test(t);return{brand,model,year,mileage,city,price,newSignal,usedSignal,lower:low};
}
function resultCondition(fields,requested,source){if(source.conditions.length===1)return source.conditions[0];if(fields.usedSignal||fields.mileage>100)return"used";if(fields.newSignal)return"new";return requested}
function matches(c,i,condition){if(c.condition!==condition)return false;if(i.brand&&c.brand!==i.brand)return false;if(i.model&&c.model!==i.model)return false;if(i.minYear&&c.year&&c.year<i.minYear)return false;if(i.maxYear&&c.year&&c.year>i.maxYear)return false;if(i.maxPrice&&c.price&&c.price>i.maxPrice)return false;if(i.maxMileage&&c.mileage&&c.mileage>i.maxMileage)return false;if(i.city&&c.city&&c.city!==i.city)return false;return true}
function score(c,i){let s=55;if(c.saleVerified)s+=12;if(c.imageVerified)s+=7;if(c.price)s+=4;if(i.brand&&c.brand===i.brand)s+=8;if(i.model&&c.model===i.model)s+=8;if(c.source.strict)s+=3;return Math.min(s,99)}

async function buildListings(candidates,condition,intent){
 const pages=await mapLimit(candidates.slice(0,60),7,fetchPage);const out=[];
 for(let i=0;i<candidates.length&&i<60;i++){
  const r=candidates[i],page=pages[i];if(!page&&!r.source.strict)continue;if(page&&!page.saleVerified)continue;
  const combined=`${r.title||""} ${r.description||""} ${page?.pageText||""}`;const f=extractFields(combined);const c={source:r.source.name,sourceType:r.source.type,seller:r.source.seller,title:r.title||"",snippet:r.description||"",url:canonicalUrl(page?.finalUrl||r.url),brand:f.brand,model:f.model,year:f.year,mileage:f.mileage,city:f.city,price:page?.price||f.price||null,condition:resultCondition(f,condition,r.source),saleVerified:Boolean(page?.saleVerified||r.source.strict),saleScore:page?.saleScore||6,image:page?.image||null,imageVerified:Boolean(page?.imageVerified),imageSource:page?.image?"listing_page":null};
  if(matches(c,intent,condition)){c.score=score(c,intent);out.push(c)}
 }
 const seen=new Set();return out.filter(c=>{if(seen.has(c.url))return false;seen.add(c.url);return true}).sort((a,b)=>b.score-a.score).slice(0,36);
}

function summary(query,cars,condition){if(!cars.length)return detectArabic(query)?`ما لقيت سيارات ${condition==="new"?"جديدة":"مستعملة"} مؤكدة للبيع تطابق طلبك حالياً.`:`I couldn't find verified ${condition} cars for sale matching your request.`;const withImages=cars.filter(c=>c.imageVerified).length;return detectArabic(query)?`لقيت ${cars.length} سيارة مؤكدة للبيع، ${withImages} منها بصور مأخوذة من صفحة الإعلان نفسها.`:`I found ${cars.length} verified cars for sale; ${withImages} include an image taken from the exact listing page.`}

app.get("/api/sources",(req,res)=>res.json({sources:SOURCES.map(({name,type,seller,brands,conditions})=>({name,type,seller,brands,conditions}))}));
app.get("/api/diagnostics",(req,res)=>res.json({ok:true,cacheEntries:searchCache.size,sources:SOURCES.map(s=>({name:s.name,...(sourceHealth.get(s.name)||{ok:null,lastChecked:null,failures:0,total:0,lastError:null})}))}));
app.get("/api/health",(req,res)=>res.json({ok:true,search:Boolean(braveKey),sources:SOURCES.length,logic:"inventory-v2",images:"exact-listing-page-only"}));
app.post("/api/search",async(req,res)=>{
 try{
  const query=String(req.body?.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});if(query.length>300)return res.status(400).json({error:"Query is too long"});const condition=req.body?.condition==="new"?"new":"used";const filters=req.body?.filters&&typeof req.body.filters==="object"?req.body.filters:{};const cacheKey=JSON.stringify({q:query.toLowerCase(),condition,filters});const hit=searchCache.get(cacheKey);if(hit&&Date.now()-hit.at<CACHE_TTL)return res.json({...hit.value,cached:true});
  const intent=mergedIntent(basicIntent(query),filters);const raw=await searchAll(query,condition,intent,filters);const listings=await buildListings(raw,condition,intent);const counts=listings.reduce((a,c)=>{a[c.source]=(a[c.source]||0)+1;return a},{});const value={query,condition,intent,answer:summary(query,listings,condition),listings,counts,live:true,cached:false,provider:"Source-specific inventory discovery + exact listing-page metadata"};searchCache.set(cacheKey,{at:Date.now(),value});if(searchCache.size>200)for(const[k,v]of searchCache)if(Date.now()-v.at>CACHE_TTL)searchCache.delete(k);res.json(value);
 }catch(e){console.error(e);res.status(500).json({error:e.message||"Live search failed"})}
});

app.listen(port,()=>console.log(`Delilah inventory-v2 running at http://localhost:${port}`));
