import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const app=express();
const port=process.env.PORT||3000;
const braveKey=process.env.BRAVE_SEARCH_API_KEY||"";
const CACHE_TTL=45_000, IMAGE_TOKEN_TTL=30*60_000, MAX_IMAGE_BYTES=8*1024*1024;
const searchCache=new Map(), sourceHealth=new Map(), imageRegistry=new Map();

app.use(express.json({limit:"1mb"}));
app.use(express.static("public"));

const norm=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
const isArabic=s=>/[\u0600-\u06FF]/.test(String(s||""));
function safeUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u:null}catch{return null}}
function hostIs(host,base){host=String(host||"").toLowerCase();base=String(base||"").toLowerCase();return host===base||host.endsWith(`.${base}`)}
function canonical(url=""){const u=safeUrl(url);if(!u)return url;u.hash="";if(hostIs(u.hostname,"haraj.com.sa")&&/^\/\d{7,}(?:\/|$)/.test(u.pathname))return `https://haraj.com.sa${u.pathname}${u.search}`;return u.href}
function direct(url,base,re){const u=safeUrl(url);return !!u&&hostIs(u.hostname,base)&&re.test(u.pathname)}
function deep(url,base,blocked=[]){const u=safeUrl(url);if(!u||!hostIs(u.hostname,base))return false;const p=u.pathname.toLowerCase().replace(/\/$/,"")||"/";if(p==="/"||blocked.some(x=>p===x||p.startsWith(`${x}/`)))return false;return p.split("/").filter(Boolean).length>=2}

const strict=(name,type,seller,conditions,priority,baseHost,queries,isCandidate,brands=[])=>({name,type,seller,conditions,priority,baseHost,queries,isCandidate,brands,strict:true});
const flexible=(name,type,seller,conditions,priority,baseHost,queries,isCandidate,brands=[])=>({name,type,seller,conditions,priority,baseHost,queries,isCandidate,brands,strict:false});

const SOURCES=[
 strict("Haraj","marketplace","Haraj",["new","used"],100,"haraj.com.sa",(q,c)=>[
  `${q} ${c==="new"?"جديد وكالة صفر":"مستعمل ممشى"} site:haraj.com.sa/11`,
  `${q} ${c==="new"?"جديد":"مستعمل"} site:haraj.com.sa inurl:111`,
  `${q} site:haraj.com.sa "للبيع"`
 ],u=>direct(u,"haraj.com.sa",/^\/\d{7,}(?:\/|$)/)),
 strict("Syarah","marketplace","Syarah",["new","used"],99,"syarah.com",(q,c)=>[
  `${q} ${c==="new"?"new":"used"} site:syarah.com/en/cardetail`,
  `${q} ${c==="new"?"جديد":"مستعمل"} site:syarah.com/ar/cardetail`,
  `${q} "cardetail" site:syarah.com`
 ],u=>direct(u,"syarah.com",/^\/(?:(?:en|ar)\/)?cardetail\/[^/]+-\d+\/?$/i)),
 strict("CarSwitch Saudi","marketplace","CarSwitch Saudi",["used"],98,"carswitch.com",q=>[
  `${q} site:ksa.carswitch.com used car`,`${q} site:ksa.carswitch.com/en/used-cars`
 ],u=>{const x=safeUrl(u);if(!x||!hostIs(x.hostname,"carswitch.com"))return false;const p=x.pathname.toLowerCase().replace(/\/$/,"");return p.includes("/used-cars/")&&!/(\/search|\/used-cars)$/.test(p)&&p.split("/").filter(Boolean).length>=3}),
 strict("Carly","certified_used","Carly - كارلي",["new","used"],98,"halacarly.com",(q,c)=>[
  `${q} ${c==="new"?"new":"used"} site:halacarly.com/en/vehicle-details`,`${q} site:halacarly.com/ar/vehicle-details`
 ],u=>direct(u,"halacarly.com",/^\/(?:en|ar)\/vehicle-details\/[^/]+\/?$/i)),
 strict("Saleh Cars","independent_dealer","Saleh Cars Group",["new"],97,"salehcars.com",q=>[
  `${q} site:salehcars.com/cars/`,`${q} site:salehcars.com/en/cars/`
 ],u=>direct(u,"salehcars.com",/^\/(?:en\/)?cars\/[a-f0-9]{20,32}\/[^/]+\/?$/i)),
 strict("Motory","marketplace","Motory",["new","used"],96,"motory.com",(q,c)=>[
  `${q} ${c==="new"?"new":"used"} site:ksa.motory.com/en/cars-for-sale/`,
  `${q} "Listing #" site:ksa.motory.com`
 ],u=>direct(u,"motory.com",/^\/en\/cars-for-sale\/[^/]+\/[^/]+\/[^/]+\/20\d{2}\/\d+\/?$/i)),
 flexible("OpenSooq","marketplace","OpenSooq",["new","used"],88,"opensooq.com",(q,c)=>[
  `${q} ${c==="new"?"new":"used"} site:sa.opensooq.com/en/`,`${q} site:sa.opensooq.com/ar/`
 ],u=>{const x=safeUrl(u);if(!x||!hostIs(x.hostname,"opensooq.com"))return false;const p=x.pathname.toLowerCase();if(/\/reviews?(\/|$)/.test(p)||/\/cars\/cars-for-sale(?:\/[^/]+){0,4}\/?$/.test(p))return false;return /\/(?:ad|listing|post)\//.test(p)&&/\d{5,}/.test(p)}),
 flexible("Key Used Cars","independent_dealer","Key Used Cars",["used"],87,"key.sa",q=>[`${q} site:key.sa "Price" "Kilometers" "Used"`],u=>deep(u,"key.sa",["/en","/ar","/en/car-selling-saudi-arabia"])),
 flexible("Toyota ALJ","official_dealer","Abdul Latif Jameel Motors",["new"],93,"toyota.com.sa",q=>[`${q} site:toyota.com.sa buy reserve price`],u=>deep(u,"toyota.com.sa",["/en","/en/vehicles"]),["Toyota"]),
 flexible("Lexus ALJ","official_dealer","Lexus Abdul Latif Jameel",["new"],92,"lexus.com.sa",q=>[`${q} site:lexus.com.sa buy reserve price`],u=>deep(u,"lexus.com.sa",["/en"]),["Lexus"]),
 flexible("Nissan Petromin","official_dealer","Petromin Nissan",["new"],92,"petromin-nissan.com",q=>[`${q} site:petromin-nissan.com buy price reserve`],u=>deep(u,"petromin-nissan.com",["/","/vehicles"]),["Nissan"]),
 flexible("Ford Al Jazirah","official_dealer","Al Jazirah Vehicles Agencies",["new"],91,"aljazirahford.com",q=>[`${q} site:aljazirahford.com price buy reserve`],u=>deep(u,"aljazirahford.com",["/"]),["Ford","Lincoln"]),
 flexible("Mercedes Juffali","official_dealer","Juffali Automotive Company",["new","used"],91,"mercedes-benz-mena.com",(q,c)=>[`${q} ${c==="used"?"pre-owned stock":"available cars"} site:mercedes-benz-mena.com/ksa/en`],u=>deep(u,"mercedes-benz-mena.com",["/ksa/en","/ksa/en/new-models","/ksa/en/buy-new"]),["Mercedes"]),
 flexible("BMW Naghi","official_dealer","Mohamed Yousuf Naghi Motors BMW",["new","used"],91,"bmw-saudiarabia.com",(q,c)=>[`${q} ${c==="used"?"certified pre-owned stock":"view stock buy"} site:bmw-saudiarabia.com`],u=>deep(u,"bmw-saudiarabia.com",["/","/models","/new-models"]),["BMW"]),
 flexible("Kia Aljabr","official_dealer","Aljabr Kia",["new"],89,"kia.com",q=>[`${q} site:kia.com/aljabr price buy`],u=>deep(u,"kia.com",["/aljabr/en"]),["Kia"]),
 flexible("Porsche SAMACO","official_dealer","SAMACO Porsche",["new","used"],90,"samaco.com.sa",(q,c)=>[`${q} ${c==="used"?"pre-owned stock":"reserve online price"} site:samaco.com.sa/en/porsche`],u=>deep(u,"samaco.com.sa",["/en/porsche"]),["Porsche"]),
 flexible("Volkswagen SAMACO","certified_used","SAMACO Volkswagen",["new","used"],88,"vw.com.sa",(q,c)=>[`${q} ${c==="used"?"certified used stock":"buy online price"} site:vw.com.sa`],u=>deep(u,"vw.com.sa",["/"]),["Volkswagen"]),
 flexible("Chevrolet Saudi Dealers","official_dealer","Aljomaih / Universal Motors",["new"],87,"chevroletarabia.com",q=>[`${q} site:chevroletarabia.com/sa-en price buy`],u=>deep(u,"chevroletarabia.com",["/sa-en"]),["Chevrolet"])
];

const BRAND_ALIASES={
 jeep:"Jeep",جيب:"Jeep",toyota:"Toyota",تويوتا:"Toyota",nissan:"Nissan",نيسان:"Nissan",lexus:"Lexus",لكزس:"Lexus",
 mercedes:"Mercedes","mercedes-benz":"Mercedes",مرسيدس:"Mercedes",bmw:"BMW","بي ام":"BMW",porsche:"Porsche",بورش:"Porsche",
 ford:"Ford",فورد:"Ford",lincoln:"Lincoln",لينكون:"Lincoln",hyundai:"Hyundai",هيونداي:"Hyundai",kia:"Kia",كيا:"Kia",
 volkswagen:"Volkswagen",فولكس:"Volkswagen",chevrolet:"Chevrolet",شفروليه:"Chevrolet",mazda:"Mazda",مازدا:"Mazda",
 honda:"Honda",هوندا:"Honda",mitsubishi:"Mitsubishi",ميتسوبيشي:"Mitsubishi",geely:"Geely",جيلي:"Geely",changan:"Changan",شانجان:"Changan",
 gac:"GAC","جي ايه سي":"GAC",mg:"MG","ام جي":"MG",genesis:"Genesis",جينيسيس:"Genesis",jetour:"Jetour",جيتور:"Jetour",
 haval:"Haval",هافال:"Haval",audi:"Audi",اودي:"Audi","land rover":"Land Rover","لاند روفر":"Land Rover","range rover":"Range Rover","رينج روفر":"Range Rover",
 cadillac:"Cadillac",كاديلاك:"Cadillac",gmc:"GMC","جي ام سي":"GMC",dodge:"Dodge",دودج:"Dodge",suzuki:"Suzuki",سوزوكي:"Suzuki",
 isuzu:"Isuzu",ايسوزو:"Isuzu",peugeot:"Peugeot",بيجو:"Peugeot",renault:"Renault",رينو:"Renault",chery:"Chery",شيري:"Chery",
 hongqi:"Hongqi",هونشي:"Hongqi",byd:"BYD",بيوايدي:"BYD",tesla:"Tesla",تسلا:"Tesla",lucid:"Lucid",لوسيد:"Lucid"
};
const MODEL_ALIASES=[
 ["wrangler","Wrangler"],["رانجلر","Wrangler"],["patrol","Patrol"],["باترول","Patrol"],["land cruiser","Land Cruiser"],["لاندكروزر","Land Cruiser"],
 ["camry","Camry"],["كامري","Camry"],["x5","X5"],["c200","C200"],["tucson","Tucson"],["توسان","Tucson"],["sportage","Sportage"],["سبورتاج","Sportage"],
 ["territory","Territory"],["تيريتوري","Territory"],["tahoe","Tahoe"],["تاهو","Tahoe"],["sonata","Sonata"],["سوناتا","Sonata"],
 ["accent","Accent"],["اكسنت","Accent"],["elantra","Elantra"],["النترا","Elantra"],["yaris","Yaris"],["يارس","Yaris"],["corolla","Corolla"],["كورولا","Corolla"],
 ["prado","Prado"],["برادو","Prado"],["fortuner","Fortuner"],["فورتشنر","Fortuner"],["explorer","Explorer"],["اكسبلورر","Explorer"],
 ["expedition","Expedition"],["اكسبديشن","Expedition"],["grand cherokee","Grand Cherokee"],["جراند شيروكي","Grand Cherokee"],
 ["cayenne","Cayenne"],["كايين","Cayenne"],["tiguan","Tiguan"],["تيجوان","Tiguan"],["pegas","Pegas"],["بيجاس","Pegas"],["x70","X70"]
];
function detectBrand(text=""){const q=norm(text).toLowerCase();for(const[k,v]of Object.entries(BRAND_ALIASES))if(q.includes(k))return v;return null}
function detectModel(text=""){const q=norm(text).toLowerCase();for(const[k,v]of MODEL_ALIASES)if(q.includes(k))return v;return null}
function basicIntent(query=""){
 const q=norm(query.toLowerCase()),i={brand:detectBrand(q),model:detectModel(q),minYear:null,maxYear:null,maxPrice:null,maxMileage:null,city:null};
 const yrs=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>+x[1]);if(yrs.length)i.minYear=Math.min(...yrs);
 const p=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})/);if(p)i.maxPrice=+p[1];
 const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/);if(km)i.maxMileage=+km[1];
 if(/riyadh|الرياض/.test(q))i.city="Riyadh";else if(/jeddah|جدة/.test(q))i.city="Jeddah";else if(/dammam|الدمام/.test(q))i.city="Dammam";
 return i;
}
function mergedIntent(i,f={}){return{...i,minYear:+f.minYear||i.minYear,maxYear:+f.maxYear||i.maxYear,maxPrice:+f.maxPrice||i.maxPrice,maxMileage:+f.maxMileage||i.maxMileage,city:f.city||i.city}}
function eligibleSources(condition,intent,filters={}){
 let x=SOURCES.filter(s=>s.conditions.includes(condition));
 if(filters.sourceType)x=x.filter(s=>s.type===filters.sourceType);
 if(filters.seller)x=x.filter(s=>s.name===filters.seller);
 if(intent.brand)x=x.filter(s=>!s.brands.length||s.brands.some(b=>b.toLowerCase()===intent.brand.toLowerCase()));
 return x.sort((a,b)=>b.priority-a.priority);
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function braveSearch(q,count=20){
 if(!braveKey)throw new Error("BRAVE_SEARCH_API_KEY is missing");
 const u=new URL("https://api.search.brave.com/res/v1/web/search");u.searchParams.set("q",q);u.searchParams.set("country","SA");u.searchParams.set("count",String(Math.min(count,20)));u.searchParams.set("text_decorations","false");
 let err;
 for(let n=0;n<3;n++){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10_000);
  try{const r=await fetch(u,{signal:c.signal,headers:{Accept:"application/json","Accept-Encoding":"gzip","X-Subscription-Token":braveKey}});if(r.ok){const d=await r.json();return d.web?.results||[]}err=new Error(`Search provider error ${r.status}`);if(r.status!==429&&r.status<500)throw err}catch(e){err=e}finally{clearTimeout(timer)}
  if(n<2)await sleep(300*2**n);
 }
 throw err||new Error("Search provider failed");
}
async function searchSource(source,query,condition){
 const runs=await Promise.allSettled(source.queries(query,condition).map(q=>braveSearch(q,20)));
 const failed=runs.filter(x=>x.status==="rejected");sourceHealth.set(source.name,{ok:failed.length<runs.length,lastChecked:new Date().toISOString(),failures:failed.length,total:runs.length,lastError:failed[0]?.reason?.message||null});
 const out=[],seen=new Set();
 for(const run of runs){if(run.status!=="fulfilled")continue;for(const r of run.value){if(!r.url||!source.isCandidate(r.url))continue;const fetchUrl=r.url,url=canonical(fetchUrl),key=url.replace(/\/$/,"");if(seen.has(key))continue;seen.add(key);out.push({...r,fetchUrl,url,source})}}
 return out.slice(0,18);
}
async function searchAll(query,condition,intent,filters){
 const batches=await Promise.allSettled(eligibleSources(condition,intent,filters).map(s=>searchSource(s,query,condition))),out=[],seen=new Set();
 for(const b of batches)if(b.status==="fulfilled")for(const r of b.value){const k=r.url.replace(/\/$/,"");if(!seen.has(k)){seen.add(k);out.push(r)}}
 return out.slice(0,100);
}

function decodeHtml(s=""){return String(s).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")}
function stripHtml(html=""){return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).slice(0,180000)}
function meta(html,key){const k=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),a=new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]+content=["']([^"']+)["'][^>]*>`,"i").exec(html)||new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`,"i").exec(html);return a?decodeHtml(a[1]):null}
function titleText(html=""){const h1=/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1],t=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];return stripHtml(h1||meta(html,"og:title")||t||"")}
function absolute(v,base){if(!v)return null;try{return new URL(String(v).replace(/\\u002F/gi,"/").replace(/\\\//g,"/"),base).href}catch{return null}}
function priceNum(v){if(v==null)return null;const n=Number(String(v).replace(/[^0-9.]/g,""));return Number.isFinite(n)&&n>=1000&&n<=5_000_000?n:null}
function collectJson(node,out=[]){if(!node)return out;if(Array.isArray(node)){for(const x of node)collectJson(x,out);return out}if(typeof node!=="object")return out;out.push(node);for(const v of Object.values(node))if(v&&typeof v==="object")collectJson(v,out);return out}
function parseLd(html){const out=[];for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{collectJson(JSON.parse(m[1].trim()),out)}catch{}}return out}
function ldTypes(o){const t=o?.["@type"];return(Array.isArray(t)?t:[t]).filter(Boolean).map(x=>String(x).toLowerCase())}
function imageRejected(url="",context=""){return !/^https?:/.test(url)||/(logo|favicon|icon|sprite|placeholder|default[-_]?image|brandmark|social[-_]?share|whatsapp|payment|footer|header|arrow|badge|warranty|inspection|fuel-consumption|app-store|google-play)/i.test(`${url} ${context}`)}
function pushImage(list,value,base,baseScore,context="",dims=null){
 if(!value)return;for(const raw of String(value).split(",")){const p=raw.trim().split(/\s+/)[0],url=absolute(p,base);if(url)list.push({url,baseScore,context,dims})}
}
function imageScore(c,source,listingTitle){
 if(imageRejected(c.url,c.context))return-999;let s=c.baseScore;const u=safeUrl(c.url);if(!u)return-999;const path=u.pathname.toLowerCase(),ctx=c.context.toLowerCase();
 if(/\.(jpe?g|png|webp)(?:$|\?)/i.test(c.url))s+=5;if(/(car|vehicle|gallery|listing|product|media|upload|image)/.test(path))s+=5;if(/(car|vehicle|gallery|listing|photo)/.test(ctx))s+=8;
 if(listingTitle&&listingTitle.split(/\s+/).some(t=>t.length>3&&ctx.includes(t.toLowerCase())))s+=10;
 if(c.dims?.w>=600)s+=8;if(c.dims?.h>=350)s+=8;if(c.dims?.w&&c.dims?.h&&c.dims.w/c.dims.h>1.1&&c.dims.w/c.dims.h<2.4)s+=5;
 if(source.name==="Syarah"&&hostIs(u.hostname,"syarah.com"))s+=20;if(source.name==="Motory"&&(u.hostname.endsWith("amazonaws.com")||u.hostname.endsWith("cloudfront.net")))s+=20;if(source.name==="Haraj")s+=5;
 if(/nitrous|discount|banner|campaign|promo/.test(`${path} ${ctx}`))s-=20;return s;
}
function extractImages(html,base,source,listingTitle){
 const list=[];
 for(const o of parseLd(html)){for(const im of(Array.isArray(o.image)?o.image:[o.image])){if(!im)continue;if(typeof im==="string")pushImage(list,im,base,110,"jsonld vehicle image");else pushImage(list,im.url||im.contentUrl,base,110,`jsonld ${im.caption||""}`,{w:+im.width||0,h:+im.height||0})}}
 pushImage(list,meta(html,"og:image"),base,100,"og:image");pushImage(list,meta(html,"twitter:image"),base,95,"twitter:image");
 for(const m of html.matchAll(/<(img|source)\b([^>]+)>/gi)){const a=m[2],alt=/(?:alt|title)=["']([^"']*)["']/i.exec(a)?.[1]||"",dims={w:+(/width=["']?(\d+)/i.exec(a)?.[1]||0),h:+(/height=["']?(\d+)/i.exec(a)?.[1]||0)};for(const attr of["src","data-src","data-lazy-src","data-original","data-image","srcset","data-srcset"]){const v=new RegExp(`${attr}=["']([^"']+)["']`,"i").exec(a)?.[1];if(v)pushImage(list,v,base,attr.includes("srcset")?72:76,`${m[1]} ${alt} ${attr}`,dims)}}
 const embedded=html.replace(/\\u002F/gi,"/").replace(/\\\//g,"/");let n=0;for(const m of embedded.matchAll(/https?:\/\/[^"'\\\s<>]+?\.(?:jpe?g|png|webp)(?:\?[^"'\\\s<>]*)?/gi)){if(n++>180)break;pushImage(list,m[0],base,52,"embedded gallery json")}
 const best=new Map();for(const c of list){const score=imageScore(c,source,listingTitle);if(score<70)continue;const old=best.get(c.url);if(!old||score>old.score)best.set(c.url,{...c,score})}return[...best.values()].sort((a,b)=>b.score-a.score);
}
function inspectPage(html,url,source){
 const text=stripHtml(html),ld=parseLd(html),listingTitle=titleText(html);let price=null,vehicle=false,offerFlag=false,availability=false,stock=false;
 for(const o of ld){const types=ldTypes(o);if(types.some(t=>["vehicle","car","product","individualproduct"].includes(t)))vehicle=true;if(types.includes("offer")||o.offers)offerFlag=true;const off=Array.isArray(o.offers)?o.offers[0]:o.offers;if(!price&&off)price=priceNum(off.price||off.lowPrice||off.highPrice);if(!price)price=priceNum(o.price);if(off?.availability||o.availability)availability=true;if(o.sku||o.mpn||o.vin||o.vehicleIdentificationNumber)stock=true}
 price=price||priceNum(meta(html,"product:price:amount")||meta(html,"og:price:amount")||meta(html,"price"));
 const currency=/(?:\bSAR\b|ريال|ر\.س)/i.test(text),explicit=/(for sale|available now|buy now|reserve now|book now|contact seller|cash price|selling price|للبيع|متاح الآن|احجز الآن|اشتري الآن|اطلب الآن|تواصل مع البائع)/i.test(text),inventory=/(listing\s*#|post number|ad number|stock number|stock no|vin\b|sku\b|chassis|vehicle id|رقم الهيكل|رقم المخزون|رقم الإعلان)/i.test(text),mileage=/(\d[\d,]{0,8})\s*(?:km|kilometers?|كم|كيلو)/i.test(text),transactional=/(finance this car|monthly payment|apply for finance|book a test drive|request quote|contact sales|احسب التمويل|اطلب عرض|تجربة قيادة|تمويل)/i.test(text);
 const aggregate=/(showing\s+\d{2,}\s+results|cars for sale in .*\-\s*\(\d+\)|used cars for sale in .*\-\s*\(\d+\))/i.test(text)||/\/(?:cars\/cars-for-sale|autos\/used-cars|cars-for-sale)\/?$/i.test(new URL(url).pathname);
 const informative=/(\/news\/|\/blog\/|\/guide\/|\/reviews?\/|brochure|specifications|owner.?s manual|press release|الأخبار|مقال|كتيب)/i.test(`${url} ${meta(html,"og:type")||""}`);
 let saleScore=0;if(vehicle)saleScore+=2;if(offerFlag)saleScore+=3;if(price&&currency)saleScore+=3;else if(price)saleScore+=2;if(availability)saleScore+=2;if(stock||inventory)saleScore+=3;if(explicit)saleScore+=3;if(transactional)saleScore+=2;if(mileage)saleScore+=1;if(aggregate)saleScore-=10;if(informative)saleScore-=8;
 const pageEvidence=!aggregate&&!informative&&(saleScore>=5||vehicle||offerFlag||inventory||explicit),images=pageEvidence?extractImages(html,url,source,listingTitle):[],image=images[0]?.url||null;
 return{saleVerified:source.strict?pageEvidence:saleScore>=6,pageEvidence,saleScore,image,imageVerified:!!image,imageScore:images[0]?.score||null,price,pageText:text.slice(0,60_000),listingTitle,informative,aggregate};
}
async function fetchOne(url,source){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),5500);
 try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahCarSearch/3.1)",Accept:"text/html,application/xhtml+xml","Accept-Language":"ar-SA,ar;q=0.9,en;q=0.8"}});if(!r.ok)return null;const finalUrl=canonical(r.url||url),ct=r.headers.get("content-type")||"";if(!ct.includes("text/html"))return null;if(source.strict&&!source.isCandidate(finalUrl))return null;const html=(await r.text()).slice(0,1_800_000);return{...inspectPage(html,finalUrl,source),finalUrl}}catch{return null}finally{clearTimeout(timer)}
}
async function fetchPage(candidate){
 const tries=[candidate.fetchUrl,candidate.url].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
 for(const u of tries){const p=await fetchOne(u,candidate.source);if(p)return p}
 return null;
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}

function extractFields(text="",preferredTitle=""){
 const t=norm(`${preferredTitle} ${text}`),head=norm(preferredTitle||""),year=[...head.matchAll(/\b(20\d{2})\b/g)].map(x=>+x[1]).find(y=>y>=2000&&y<=2035)||[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>+x[1]).find(y=>y>=2000&&y<=2035)||null;
 const brand=detectBrand(head)||detectBrand(t),model=detectModel(head)||detectModel(t),km=t.match(/([1-9][\d,]{1,8})\s*(?:km|kilometers?|كم|كيلو)/i),mileage=km?+km[1].replace(/,/g,""):null,city=/riyadh|الرياض/i.test(t)?"Riyadh":/jeddah|جدة/i.test(t)?"Jeddah":/dammam|الدمام/i.test(t)?"Dammam":null;
 const cp=t.match(/(?:SAR|ر\.س)\s*([1-9][\d,]{3,8})|([1-9][\d,]{3,8})\s*(?:SAR|ريال|ر\.س)/i),price=cp?+(cp[1]||cp[2]).replace(/,/g,""):null,newSignal=/\bnew\b|brand new|جديد|جديدة|زيرو|صفر كيلو|غير مستخدم|وكالة/i.test(t),usedSignal=/\bused\b|pre-owned|مستعمل|مستعملة|ممشى/i.test(t);
 return{brand,model,year,mileage,city,price,newSignal,usedSignal};
}
function resultCondition(f,requested,source){if(source.conditions.length===1)return source.conditions[0];if(f.usedSignal||(f.mileage!=null&&f.mileage>100))return"used";if(f.newSignal||f.mileage===0)return"new";return requested}
function matches(c,i,condition){
 if(c.condition!==condition)return false;
 if(i.brand&&c.brand!==i.brand)return false;if(i.model&&c.model!==i.model)return false;
 if(i.minYear&&c.year&&c.year<i.minYear)return false;if(i.maxYear&&c.year&&c.year>i.maxYear)return false;if(i.maxPrice&&c.price&&c.price>i.maxPrice)return false;if(i.maxMileage&&c.mileage!=null&&c.mileage>i.maxMileage)return false;if(i.city&&c.city&&c.city!==i.city)return false;return true;
}
function score(c,i){let s=50;if(c.saleVerified)s+=14;if(c.verification==="page_sale_evidence")s+=5;if(c.imageVerified)s+=10;if(c.price)s+=4;if(c.mileage!=null)s+=3;if(i.brand&&c.brand===i.brand)s+=7;if(i.model&&c.model===i.model)s+=7;if(c.sourceStrict)s+=2;return Math.min(s,99)}

function registerImage(url,source){
 const u=safeUrl(url);if(!u)return null;const token=crypto.createHash("sha256").update(`${source.name}|${u.href}`).digest("hex").slice(0,28);imageRegistry.set(token,{url:u.href,source:source.name,at:Date.now()});return`/api/image/${token}`;
}
function isPrivateIp(ip){if(!ip)return true;if(net.isIP(ip)===4){const p=ip.split(".").map(Number);return p[0]===10||p[0]===127||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]===0}const x=ip.toLowerCase();return x==="::1"||x.startsWith("fc")||x.startsWith("fd")||x.startsWith("fe80:")}
async function assertPublicHost(host){if(/^(localhost|.*\.localhost)$/i.test(host))throw new Error("blocked host");const rows=await dns.lookup(host,{all:true,verbatim:true});if(!rows.length||rows.some(r=>isPrivateIp(r.address)))throw new Error("blocked address")}
async function safeImageFetch(start,source){
 let current=start;
 for(let n=0;n<4;n++){
  const u=safeUrl(current);if(!u)throw new Error("bad url");await assertPublicHost(u.hostname);
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);
  let r;try{r=await fetch(u,{redirect:"manual",signal:c.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; DelilahImageRelay/1.1)",Accept:"image/avif,image/webp,image/apng,image/*,*/*;q=0.8",Referer:`https://${source.baseHost}/`}})}finally{clearTimeout(timer)}
  if([301,302,303,307,308].includes(r.status)){const loc=r.headers.get("location");if(!loc)throw new Error("redirect without location");current=new URL(loc,u).href;continue}
  return r;
 }
 throw new Error("too many redirects");
}
async function buildListings(candidates,condition,intent){
 const pages=await mapLimit(candidates.slice(0,72),7,fetchPage),out=[];
 for(let i=0;i<candidates.length&&i<72;i++){
  const r=candidates[i],page=pages[i];if(!r.source.strict&&(!page||!page.saleVerified))continue;if(page&&page.informative)continue;
  const preferred=page?.listingTitle||r.title||"",combined=`${r.title||""} ${r.description||""} ${page?.pageText||""}`,f=extractFields(combined,preferred),saleVerified=!!(page?.saleVerified||r.source.strict);
  const c={source:r.source.name,sourceType:r.source.type,seller:r.source.seller,sourceStrict:r.source.strict,title:preferred||r.title||"",snippet:r.description||"",url:canonical(page?.finalUrl||r.url),brand:f.brand,model:f.model,year:f.year,mileage:f.mileage,city:f.city,price:page?.price||f.price||null,condition:resultCondition(f,condition,r.source),saleVerified,verification:page?.saleVerified?"page_sale_evidence":"direct_listing_url",saleScore:page?.saleScore??(r.source.strict?7:0),image:page?.image||null,imageVerified:!!page?.image,imageSource:page?.image?"listing_page":null,imageScore:page?.imageScore||null};
  if(!matches(c,intent,condition))continue;c.displayImage=c.image?registerImage(c.image,r.source):null;c.score=score(c,intent);out.push(c);
 }
 const seen=new Set();return out.filter(c=>{const k=canonical(c.url).replace(/\/$/,"");if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.score-a.score).slice(0,36);
}
function summary(query,cars,condition){
 if(!cars.length)return isArabic(query)?`ما لقيت سيارات ${condition==="new"?"جديدة":"مستعملة"} مؤكدة تطابق طلبك حالياً.`:`I couldn't find verified ${condition} cars matching your request.`;
 const imgs=cars.filter(c=>c.imageVerified).length,sources=new Set(cars.map(c=>c.source)).size;return isArabic(query)?`لقيت ${cars.length} سيارة مؤكدة من ${sources} مصادر، ${imgs} منها بصورة مأخوذة من صفحة الإعلان نفسها.`:`I found ${cars.length} verified cars across ${sources} sources; ${imgs} have an image extracted from the exact listing page.`;
}

app.get("/api/sources",(req,res)=>res.json({sources:SOURCES.map(({name,type,seller,brands,conditions})=>({name,type,seller,brands,conditions}))}));
app.get("/api/diagnostics",(req,res)=>res.json({ok:true,logic:"inventory-v3.1",cacheEntries:searchCache.size,imageTokens:imageRegistry.size,sources:SOURCES.map(s=>({name:s.name,...(sourceHealth.get(s.name)||{ok:null,lastChecked:null,failures:0,total:0,lastError:null})}))}));
app.get("/api/health",(req,res)=>res.json({ok:true,search:!!braveKey,sources:SOURCES.length,logic:"inventory-v3.1",images:"exact-listing-page + guarded same-origin relay"}));
app.get("/api/image/:token",async(req,res)=>{
 const entry=imageRegistry.get(req.params.token);if(!entry||Date.now()-entry.at>IMAGE_TOKEN_TTL)return res.status(404).end();const source=SOURCES.find(s=>s.name===entry.source);if(!source)return res.status(404).end();
 try{const r=await safeImageFetch(entry.url,source);if(!r.ok)return res.status(502).end();const type=(r.headers.get("content-type")||"").toLowerCase();if(!type.startsWith("image/"))return res.status(415).end();const len=+(r.headers.get("content-length")||0);if(len&&len>MAX_IMAGE_BYTES)return res.status(413).end();const buf=Buffer.from(await r.arrayBuffer());if(!buf.length||buf.length>MAX_IMAGE_BYTES)return res.status(413).end();res.set({"Content-Type":type,"Cache-Control":"public, max-age=3600, stale-while-revalidate=86400","X-Content-Type-Options":"nosniff"});res.send(buf)}catch{res.status(502).end()}
});
app.post("/api/search",async(req,res)=>{
 try{
  const query=String(req.body?.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});if(query.length>300)return res.status(400).json({error:"Query is too long"});
  const condition=req.body?.condition==="new"?"new":"used",filters=req.body?.filters&&typeof req.body.filters==="object"?req.body.filters:{},cacheKey=JSON.stringify({q:query.toLowerCase(),condition,filters}),hit=searchCache.get(cacheKey);if(hit&&Date.now()-hit.at<CACHE_TTL)return res.json({...hit.value,cached:true});
  const intent=mergedIntent(basicIntent(query),filters),raw=await searchAll(query,condition,intent,filters),listings=await buildListings(raw,condition,intent),counts=listings.reduce((a,c)=>{a[c.source]=(a[c.source]||0)+1;return a},{});
  const value={query,condition,intent,answer:summary(query,listings,condition),listings,counts,live:true,cached:false,provider:"Delilah inventory-v3.1 source adapters + exact listing images"};searchCache.set(cacheKey,{at:Date.now(),value});
  if(searchCache.size>200)for(const[k,v]of searchCache)if(Date.now()-v.at>CACHE_TTL)searchCache.delete(k);for(const[k,v]of imageRegistry)if(Date.now()-v.at>IMAGE_TOKEN_TTL)imageRegistry.delete(k);res.json(value);
 }catch(e){console.error(e);res.status(500).json({error:e.message||"Live search failed"})}
});
app.listen(port,()=>console.log(`Delilah inventory-v3.1 running at http://localhost:${port}`));
