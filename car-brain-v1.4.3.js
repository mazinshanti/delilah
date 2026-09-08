import { MAKES, PART_TERMS, norm } from "./car-brain-v1.4.js";

export const BRAIN_VERSION="1.4.3-car-brain";

const makeAliases=[],modelAliases=[];
for(const make of MAKES){
  for(const a of [make.name,...make.aliases])makeAliases.push({key:norm(a),make});
  for(const model of make.models)for(const a of [model.name,...model.aliases])modelAliases.push({key:norm(a),make,model});
}
makeAliases.sort((a,b)=>b.key.length-a.key.length);modelAliases.sort((a,b)=>b.key.length-a.key.length);
const phrase=(text,key)=>Boolean(key)&&(` ${text} `).includes(` ${key} `);
const partNorm=PART_TERMS.map(norm).sort((a,b)=>b.length-a.length);
const NON_LISTING_URL=/(?:^|\/)(?:price|prices|specs?|specifications?|review|reviews|news|blog|compare|comparison|calculator|valuation|sell-car|car-value)(?:\/|$)|(?:19|20)\d{2}-price(?:\/|$)|-price(?:\/|$)/i;
const WANTED=/(?:^|\s)(?:wanted|want to buy|looking for|wtb|مطلوب|ابي اشتري|ابغى اشتري|ارغب شراء|شراء سياره|شراء سيارة)(?:\s|$)/i;

const BODY_PATTERNS=[
  ["SUV",/\bsuv\b|دفع رباعي|جيب عائلي|سياره مرتفعه|سيارة مرتفعة/],
  ["Sedan",/\bsedan\b|سيدان/],["Pickup",/\bpickup\b|pick up|بيك اب|وانيت|حوض/],
  ["Coupe",/\bcoupe\b|كوبيه/],["Hatchback",/\bhatchback\b|هاتشباك/],["Van",/\bvan\b|minivan|فان|ميني فان/],["Crossover",/\bcrossover\b|كروس اوفر/]
];
const ORIGIN_PATTERNS=[["Japanese",/japanese|ياباني/],["Korean",/korean|كوري/],["German",/german|الماني|ألماني/],["American",/american|امريكي|أمريكي/],["Chinese",/chinese|صيني/],["European",/european|اوروبي|أوروبي/]];
const NEED_PATTERNS=[
  ["family",/family|عائلي|عائليه|عائلية|للعائله|للعائلة|اطفال|أطفال/],
  ["offroad",/off road|offroad|بر|تطعيس|كشتات|كشته|كشتة|طرق وعره|طرق وعرة/],
  ["economy",/economical|economy|fuel efficient|موفر|اقتصادي|بنزين قليل|صرفيه|صرفية/],
  ["luxury",/luxury|premium|فاخر|فخمه|فخمة/],["city",/city car|داخل المدينه|داخل المدينة|زحمه|زحمة/],
  ["performance",/performance|sporty|sports car|رياضي|سريع|قوي/],["work",/work truck|للشغل|شغل|تحميل|حمل/]
];

function findMakeModel(text=""){
  const n=norm(text);let make=null,model=null;
  const mm=modelAliases.find(x=>phrase(n,x.key));if(mm){make=mm.make;model=mm.model;}
  if(!make){const ma=makeAliases.find(x=>phrase(n,x.key));if(ma)make=ma.make;}
  return{make,model};
}
function bodyFromQuery(n){for(const[v,re]of BODY_PATTERNS)if(re.test(n))return v;return null;}
function originFromQuery(n){for(const[v,re]of ORIGIN_PATTERNS)if(re.test(n))return v;return null;}
function needsFromQuery(n){return NEED_PATTERNS.filter(([,re])=>re.test(n)).map(([v])=>v);}
function cityFromQuery(n){if(/riyadh|الرياض/.test(n))return"Riyadh";if(/jeddah|جده|جدة/.test(n))return"Jeddah";if(/dammam|الدمام/.test(n))return"Dammam";if(/khobar|الخبر/.test(n))return"Khobar";if(/makkah|mecca|مكه|مكة/.test(n))return"Makkah";if(/madinah|medina|المدينه|المدينة/.test(n))return"Madinah";if(/tabuk|تبوك/.test(n))return"Tabuk";if(/abha|ابها|أبها/.test(n))return"Abha";return null;}
function numbers(s){return String(s||"").replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));}
function yearHints(q){const x=numbers(q),ys=[...x.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=1980&&y<=2030),n=norm(x);if(ys.length>=2)return{exactYear:null,minYear:Math.min(...ys),maxYear:Math.max(...ys)};if(ys.length===1){const y=ys[0];if(/and above|or newer|newer|above|from|وفوق|واحدث|وأحدث|فوق/.test(n))return{exactYear:null,minYear:y,maxYear:null};if(/and below|or older|older|below|وتحت|واقدم|وأقدم/.test(n))return{exactYear:null,minYear:null,maxYear:y};return{exactYear:y,minYear:null,maxYear:null}}return{exactYear:null,minYear:null,maxYear:null};}
function parseAmount(raw){if(raw==null)return null;const m=String(raw).replace(/,/g,"").match(/([0-9]+(?:\.[0-9]+)?)\s*([kK])?/);if(!m)return null;let v=Number(m[1]);if(m[2])v*=1000;return Number.isFinite(v)?Math.round(v):null;}
function maxMileageFrom(n){
  let m=n.match(/(?:mileage|odometer|ممشى|الممشى)[^0-9]{0,14}([0-9][0-9,.]*\s*k?)/i);if(m)return parseAmount(m[1]);
  m=n.match(/(?:under|below|less than|اقل|أقل|تحت)[^0-9]{0,10}([0-9][0-9,.]*\s*k?)\s*(?:km|kilometers?|كيلو|كم)\b/i);if(m)return parseAmount(m[1]);
  m=n.match(/([0-9][0-9,.]*\s*k?)\s*(?:km|kilometers?|كيلو|كم)\b/i);return m?parseAmount(m[1]):null;
}
function maxPriceFrom(n){
  let m=n.match(/(?:budget|max price|price under|under|below|less than|ميزانيه|ميزانية|حدي|اقل|أقل|تحت)[^0-9]{0,12}([0-9][0-9,.]*\s*k?)(?!\s*(?:km|kilometers?|كيلو|كم))/i);if(m)return parseAmount(m[1]);
  m=n.match(/([0-9][0-9,.]*\s*k?)\s*(?:sar|ريال|ر س)\b/i);return m?parseAmount(m[1]):null;
}
function partsRequested(n){return partNorm.some(p=>phrase(n,p));}

export function detectAutomotiveIntent(query="",body={}){
  const n=norm(query),f=body.filters&&typeof body.filters==="object"?body.filters:{},mm=findMakeModel(query),yh=yearHints(query);
  const explicitBody=bodyFromQuery(n),explicitOrigin=originFromQuery(n),needs=needsFromQuery(n),maxPrice=Number(f.maxPrice)||maxPriceFrom(n),maxMileage=Number(f.maxMileage)||maxMileageFrom(n),city=String(f.city||cityFromQuery(n)||"").trim()||null;
  const condition=body.condition==="new"?"new":body.condition==="used"?"used":(/\bnew\b|جديد|زيرو/.test(n)?"new":/\bused\b|مستعمل/.test(n)?"used":null);
  const sort=/cheapest|lowest price|ارخص|الأرخص/.test(n)?"lowest_price":/lowest mileage|اقل ممشى|أقل ممشى/.test(n)?"lowest_mileage":/newest|احدث|أحدث/.test(n)?"newest":"relevance";
  const explicit=[];if(mm.make)explicit.push("brand");if(mm.model)explicit.push("model");if(explicitBody)explicit.push("bodyType");if(explicitOrigin)explicit.push("nationality");if(yh.exactYear||yh.minYear||yh.maxYear||f.minYear||f.maxYear)explicit.push("year");if(maxPrice)explicit.push("maxPrice");if(maxMileage)explicit.push("maxMileage");if(city)explicit.push("city");if(condition)explicit.push("condition");
  return{vehicleOnly:true,partsRequested:partsRequested(n),brand:mm.make?.name||null,model:mm.model?.name||null,bodyType:explicitBody||mm.model?.body||null,nationality:explicitOrigin||mm.make?.origin||null,needs,exactYear:yh.exactYear,minYear:Number(f.minYear)||yh.minYear||null,maxYear:Number(f.maxYear)||yh.maxYear||null,maxPrice,maxMileage,city,condition,sort,explicit:[...new Set(explicit)]};
}

function modelsFor(intent={}){
  const needs=intent.needs||[];let body=intent.bodyType;if(!body&&needs.includes("family"))body="SUV";if(!body&&needs.includes("offroad"))body="SUV";if(!body&&needs.includes("work"))body="Pickup";
  if(!body&&!intent.nationality&&!needs.length)return[];
  const out=[];for(const make of MAKES){if(intent.nationality&&make.origin!==intent.nationality&&!(intent.nationality==="European"&&["German","British"].includes(make.origin)))continue;for(const model of make.models){if(body&&model.body!==body&&!(body==="SUV"&&model.body==="Crossover"))continue;out.push(`${make.name} ${model.name}`)}}
  const preferred=needs.includes("offroad")?["Toyota Land Cruiser","Toyota Prado","Nissan Patrol","Jeep Wrangler","Ford Bronco","Land Rover Defender","GMC Yukon"]:needs.includes("family")?["Toyota Land Cruiser","Toyota Fortuner","Toyota RAV4","Nissan Patrol","Nissan X-Trail","Honda CR-V","Mazda CX-5","Hyundai Tucson","Hyundai Santa Fe","Kia Sportage","Kia Sorento"]:needs.includes("economy")?["Toyota Corolla","Toyota Yaris","Nissan Sunny","Hyundai Accent","Hyundai Elantra","Kia Pegas","Honda City","MG MG 5"]:[];
  return[...preferred.filter(x=>out.includes(x)),...out.filter(x=>!preferred.includes(x))];
}
export function buildRetrievalQueries(intent,original=""){
  if(intent.partsRequested)return[];
  const out=[],push=q=>{q=String(q||"").trim();if(q&&!out.some(x=>norm(x)===norm(q)))out.push(q)};
  if(intent.brand&&intent.model)push(`${intent.brand} ${intent.model}`);else if(intent.brand)push(intent.brand);
  for(const q of intent.retrievalQueries||[])push(q);
  if(!intent.brand&&!intent.model)for(const q of modelsFor(intent)){push(q);if(out.length>=10)break;}
  if(!out.length)push(`${intent.condition||"used"} cars`);
  return out.slice(0,10);
}
export function knowledgePrompt(intent={}){
  const detected=[intent.brand,intent.model,intent.bodyType,intent.nationality,...(intent.needs||[])].filter(Boolean).join(", ")||"none";
  return `DALELAH AUTOMOTIVE KNOWLEDGE RULES:\n- Search REAL WHOLE VEHICLES for sale only. Never return wanted-to-buy posts, spare parts, dismantled cars, accessories, service pages, price guides, reviews, specs or editorial pages.\n- Parts search is not supported yet. If the user asks for a bumper, engine, tyre, rim or other part, mark it as a parts request; do not substitute unrelated whole cars.\n- Never invent a listing, price, mileage, year, city, trim, seller, condition, image, feature or availability. Unknown facts stay unknown.\n- Understand Saudi Arabic and English automotive language, spelling variants and model aliases. Match short model names such as ES, IS, LS, X5 or K5 only as complete tokens, never inside another word.\n- Explicit make/model, year, budget, mileage, city, body style and condition are hard constraints. Lifestyle language such as family, economical, luxury or off-road is a recommendation preference.\n- Retrieve broadly with short MAKE MODEL queries, then verify constraints against real listing metadata. Missing metadata creates a POSSIBLE match, never a fake verified match.\n- Rank verified matches first, then possible matches. Prefer direct sale listings with real image, price, year, mileage and city. Diversify sources when quality is similar.\nDetected deterministic hints: ${detected}.`;
}

export function isVehicleListing(c){
  if(!c?.url||c.saleVerified!==true)return false;let pathname="";try{pathname=decodeURIComponent(new URL(c.url).pathname)}catch{}
  const title=norm(c.title||""),nt=norm(`${c.title||""} ${pathname}`);if(NON_LISTING_URL.test(pathname)||WANTED.test(title))return false;if(partNorm.some(p=>phrase(nt,p)))return false;
  if(c.sourceType==="independent_dealer"||c.sourceType==="certified_used"||c.channel==="certified_inventory"||c.channel==="dealer_inventory")return true;
  const mm=findMakeModel(`${c.brand||""} ${c.model||""} ${c.title||""} ${pathname}`),facts=Boolean(c.year||c.mileage!=null||c.price||/\b(sedan|suv|coupe|hatchback|pickup|truck|crossover|4x4|automatic|manual|mileage|km|ممشى|سياره|سيارة|مستعمل|جديد)\b/i.test(`${c.title||""} ${c.snippet||""}`));
  return Boolean(c.brand||c.model||mm.make||mm.model)&&facts;
}
function canonicalListing(c){const mm=findMakeModel(`${c.brand||""} ${c.model||""} ${c.title||""}`);return{...c,brand:c.brand||mm.make?.name||null,model:c.model||mm.model?.name||null,_knownBody:mm.model?.body||null,_knownOrigin:mm.make?.origin||null};}
const same=(a,b)=>norm(a)===norm(b);
function evaluate(c,intent){
  const missing=[],reasons=[],reject=[],x=canonicalListing(c),exp=new Set(intent.explicit||[]);
  if(intent.brand){if(x.brand&&!same(x.brand,intent.brand))reject.push("brand");else if(!x.brand)missing.push("brand");else reasons.push(intent.brand)}
  if(intent.model){if(x.model&&!same(x.model,intent.model))reject.push("model");else if(!x.model)missing.push("model");else reasons.push(intent.model)}
  if(intent.exactYear){if(x.year==null)missing.push("year");else if(Number(x.year)!==Number(intent.exactYear))reject.push("year");else reasons.push(String(x.year))}
  if(intent.minYear){if(x.year==null)missing.push("year");else if(Number(x.year)<Number(intent.minYear))reject.push("year");else reasons.push(`${intent.minYear}+`)}
  if(intent.maxYear){if(x.year==null)missing.push("year");else if(Number(x.year)>Number(intent.maxYear))reject.push("year")}
  if(intent.maxPrice){if(x.price==null)missing.push("price");else if(Number(x.price)>Number(intent.maxPrice))reject.push("price");else reasons.push(`≤ ${Number(intent.maxPrice).toLocaleString()} SAR`)}
  if(intent.maxMileage){if(x.mileage==null)missing.push("mileage");else if(Number(x.mileage)>Number(intent.maxMileage))reject.push("mileage");else reasons.push(`≤ ${Number(intent.maxMileage).toLocaleString()} km`)}
  if(intent.city){if(!x.city)missing.push("city");else if(!same(x.city,intent.city))reject.push("city");else reasons.push(intent.city)}
  if(intent.condition){if(!x.condition||x.condition==="unknown")missing.push("condition");else if(!same(x.condition,intent.condition))reject.push("condition")}
  if(intent.bodyType&&exp.has("bodyType")){if(x._knownBody&&!same(x._knownBody,intent.bodyType)&&!(intent.bodyType==="SUV"&&x._knownBody==="Crossover"))reject.push("bodyType");else if(!x._knownBody)missing.push("body type");else reasons.push(intent.bodyType)}
  if(intent.nationality&&exp.has("nationality")){const ok=x._knownOrigin&&(same(x._knownOrigin,intent.nationality)||(intent.nationality==="European"&&["German","British"].includes(x._knownOrigin)));if(x._knownOrigin&&!ok)reject.push("origin");else if(!x._knownOrigin)missing.push("origin");else reasons.push(intent.nationality)}
  const m=[...new Set(missing)],r=[...new Set(reasons)];let score=60;if(x.imageVerified||x.image)score+=8;if(x.priceVerified||x.price)score+=8;if(x.year)score+=5;if(x.mileage!=null)score+=4;if(x.city)score+=3;if(x.brand)score+=3;if(x.model)score+=4;score+=Math.min(10,r.length*2);score-=m.length*3;
  return{listing:x,reject:reject.length>0,missing:m,reasons:r,matchTier:m.length?"possible":"verified",matchScore:Math.max(1,Math.min(99,Math.round(score)))};
}
function displayFor(e){const c=e.listing,title=c.title||[c.year,c.brand,c.model].filter(Boolean).join(" ")||"Car listing",facts=[];if(c.year)facts.push(String(c.year));if(c.mileage!=null)facts.push(`${Number(c.mileage).toLocaleString()} km`);if(c.city)facts.push(c.city);return{headline:title,priceText:c.price?`${Number(c.price).toLocaleString()} SAR`:"Price on source",facts,matchLabel:e.matchTier==="verified"?"Verified match":"Possible match",why:e.reasons.slice(0,4),missing:e.missing,cta:"View original listing"};}
function diversify(items,limit=500){const by=new Map();for(const x of items){const k=x.source||"Other";if(!by.has(k))by.set(k,[]);by.get(k).push(x)}for(const a of by.values())a.sort((x,y)=>y.matchScore-x.matchScore);const out=[];while(out.length<limit){const ordered=[...by.entries()].filter(([,a])=>a.length).sort((a,b)=>b[1][0].matchScore-a[1][0].matchScore);if(!ordered.length)break;for(const[,a]of ordered){if(out.length>=limit)break;out.push(a.shift())}}return out;}
export function prepareResults(groups,intent,limit=500){
  const map=new Map();for(const group of groups||[])for(const raw of group||[]){if(!isVehicleListing(raw))continue;let key=String(raw.url||"");try{const u=new URL(key);u.hash="";key=u.href.replace(/\/$/,"")}catch{}const old=map.get(key);map.set(key,old?{...raw,...old,image:old.image||raw.image,displayImage:old.displayImage||raw.displayImage,price:old.price??raw.price??null}:raw)}
  const all=[];for(const raw of map.values()){const e=evaluate(raw,intent);if(e.reject)continue;all.push({...e.listing,matchTier:e.matchTier,matchScore:e.matchScore,matchReasons:e.reasons,missingData:e.missing,presentation:displayFor(e)})}
  all.sort((a,b)=>(a.matchTier==="verified"?0:1)-(b.matchTier==="verified"?0:1)||b.matchScore-a.matchScore);const verified=diversify(all.filter(x=>x.matchTier==="verified"),limit),possible=diversify(all.filter(x=>x.matchTier!=="verified"),Math.max(0,limit-verified.length));return[...verified,...possible].slice(0,limit);
}
export function resultSummary(listings,intent){
  if(intent.partsRequested)return{text:"Dalelah currently searches complete cars only. Parts and accessories search will be added later.",verified:0,possible:0,missing:[]};
  const verified=listings.filter(x=>x.matchTier==="verified").length,possible=listings.length-verified,missing=[...new Set(listings.flatMap(x=>x.missingData||[]))];let text=`${verified} verified match${verified===1?"":"es"}`;if(possible)text+=` + ${possible} possible match${possible===1?"":"es"}`;text+=" found.";if(possible&&missing.length)text+=` Possible matches are missing ${missing.slice(0,3).join(", ")} data on the source.`;if(!listings.length)text="No current indexed car can be confirmed against those constraints yet. Dalelah will keep refreshing the market.";return{text,verified,possible,missing};
}
