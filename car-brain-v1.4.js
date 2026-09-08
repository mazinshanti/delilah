// Dalelah automotive knowledge engine — v1.4
// Purpose: normalize Saudi-market car language, plan searches, rank REAL vehicle listings,
// and explain results without inventing listing facts.

export const BRAIN_VERSION = "1.4.2-car-brain";

export function norm(s=""){
  return String(s||"").toLowerCase().normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670]/g,"")
    .replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();
}

const M = (name, body, aliases=[]) => ({name,body,aliases});
const K = (name, origin, aliases, models) => ({name,origin,aliases,models});

export const MAKES = [
  K("Toyota","Japanese",["toyota","تويوتا"],[M("Camry","Sedan",["camry","كامري"]),M("Corolla","Sedan",["corolla","كورولا"]),M("Yaris","Sedan",["yaris","يارس"]),M("Land Cruiser","SUV",["land cruiser","landcruiser","لاندكروزر","لاند كروزر"]),M("Prado","SUV",["prado","برادو"]),M("Fortuner","SUV",["fortuner","فورتشنر"]),M("RAV4","SUV",["rav4","rav 4","راف فور","راف4"]),M("Hilux","Pickup",["hilux","هايلوكس"]),M("C-HR","Crossover",["c hr","c-hr"]),M("Highlander","SUV",["highlander","هايلاندر"]),M("Crown","Sedan",["crown","كراون"])]),
  K("Nissan","Japanese",["nissan","نيسان"],[M("Patrol","SUV",["patrol","باترول"]),M("Sunny","Sedan",["sunny","صني"]),M("Altima","Sedan",["altima","التيما"]),M("X-Trail","SUV",["x trail","x-trail","اكس تريل"]),M("Pathfinder","SUV",["pathfinder","باثفايندر"]),M("Kicks","Crossover",["kicks","كيكس"]),M("X-Terra","SUV",["x terra","x-terra","اكس تيرا"]),M("Navara","Pickup",["navara","نافارا"])]),
  K("Lexus","Japanese",["lexus","لكزس"],[M("ES","Sedan",["lexus es","es"]),M("IS","Sedan",["lexus is"]),M("LS","Sedan",["lexus ls"]),M("RX","SUV",["lexus rx"]),M("NX","SUV",["lexus nx"]),M("LX","SUV",["lexus lx"]),M("GX","SUV",["lexus gx"]),M("UX","Crossover",["lexus ux"])]),
  K("Honda","Japanese",["honda","هوندا"],[M("Accord","Sedan",["accord","اكورد"]),M("Civic","Sedan",["civic","سيفيك"]),M("City","Sedan",["honda city"]),M("CR-V","SUV",["cr v","cr-v"]),M("HR-V","Crossover",["hr v","hr-v"]),M("Pilot","SUV",["pilot","بايلوت"])]),
  K("Mazda","Japanese",["mazda","مازدا"],[M("Mazda 3","Sedan",["mazda 3","مازدا 3"]),M("Mazda 6","Sedan",["mazda 6","مازدا 6"]),M("CX-5","SUV",["cx5","cx 5","cx-5"]),M("CX-9","SUV",["cx9","cx 9","cx-9"]),M("CX-60","SUV",["cx60","cx 60","cx-60"])]),
  K("Mitsubishi","Japanese",["mitsubishi","ميتسوبيشي"],[M("Pajero","SUV",["pajero","باجيرو"]),M("Outlander","SUV",["outlander","اوتلاندر"]),M("ASX","Crossover",["asx"]),M("L200","Pickup",["l200"])]),
  K("Suzuki","Japanese",["suzuki","سوزوكي"],[M("Jimny","SUV",["jimny","جيمني"]),M("Swift","Hatchback",["swift","سويفت"]),M("Dzire","Sedan",["dzire","ديزاير"]),M("Grand Vitara","SUV",["grand vitara","جراند فيتارا"])]),
  K("Isuzu","Japanese",["isuzu","ايسوزو"],[M("D-Max","Pickup",["d max","d-max","دي ماكس"]),M("MU-X","SUV",["mu x","mu-x"])]),
  K("Hyundai","Korean",["hyundai","هيونداي","هونداي"],[M("Accent","Sedan",["accent","اكسنت"]),M("Elantra","Sedan",["elantra","النترا"]),M("Sonata","Sedan",["sonata","سوناتا"]),M("Tucson","SUV",["tucson","توسان"]),M("Santa Fe","SUV",["santa fe","سنتافي","سانتافي"]),M("Palisade","SUV",["palisade","باليسيد"]),M("Kona","Crossover",["kona","كونا"])]),
  K("Kia","Korean",["kia","كيا"],[M("Pegas","Sedan",["pegas","بيجاس"]),M("Cerato","Sedan",["cerato","سيراتو"]),M("K5","Sedan",["k5","كي 5"]),M("K8","Sedan",["k8","كي 8"]),M("Sportage","SUV",["sportage","سبورتاج"]),M("Sorento","SUV",["sorento","سورينتو"]),M("Telluride","SUV",["telluride","تيلورايد"]),M("Carnival","Van",["carnival","كارنفال"]),M("Seltos","Crossover",["seltos","سيلتوس"])]),
  K("Genesis","Korean",["genesis","جينيسس","جينيسس"],[M("G70","Sedan",["g70"]),M("G80","Sedan",["g80"]),M("G90","Sedan",["g90"]),M("GV70","SUV",["gv70"]),M("GV80","SUV",["gv80"])]),
  K("Ford","American",["ford","فورد"],[M("Taurus","Sedan",["taurus","تورس","توروس"]),M("Territory","SUV",["territory","تيريتوري"]),M("Explorer","SUV",["explorer","اكسبلورر"]),M("Expedition","SUV",["expedition","اكسبديشن"]),M("Everest","SUV",["everest","ايفرست"]),M("Bronco","SUV",["bronco","برونكو"]),M("Ranger","Pickup",["ranger","رينجر"]),M("F-150","Pickup",["f150","f 150","f-150"]),M("Mustang","Coupe",["mustang","موستنج"])]),
  K("Chevrolet","American",["chevrolet","chevy","شفروليه","شيفروليه"],[M("Tahoe","SUV",["tahoe","تاهو"]),M("Suburban","SUV",["suburban","سوبربان"]),M("Traverse","SUV",["traverse","ترافيرس"]),M("Captiva","SUV",["captiva","كابتيفا"]),M("Silverado","Pickup",["silverado","سلفرادو"]),M("Camaro","Coupe",["camaro","كمارو"])]),
  K("GMC","American",["gmc","جي ام سي"],[M("Yukon","SUV",["yukon","يوكن"]),M("Sierra","Pickup",["sierra","سييرا"]),M("Acadia","SUV",["acadia","اكاديا"]),M("Terrain","SUV",["terrain","تيرين"])]),
  K("Jeep","American",["jeep","جيب"],[M("Wrangler","SUV",["wrangler","رانجلر"]),M("Grand Cherokee","SUV",["grand cherokee","جراند شيروكي"]),M("Cherokee","SUV",["cherokee","شيروكي"]),M("Compass","SUV",["compass","كومباس"]),M("Gladiator","Pickup",["gladiator","جلاديتور"])]),
  K("Dodge","American",["dodge","دودج"],[M("Charger","Sedan",["charger","تشارجر"]),M("Challenger","Coupe",["challenger","تشالنجر"]),M("Durango","SUV",["durango","دورانجو"])]),
  K("BMW","German",["bmw","بي ام دبليو","بي ام"],[M("3 Series","Sedan",["3 series","320i","330i"]),M("5 Series","Sedan",["5 series","520i","530i"]),M("7 Series","Sedan",["7 series","740i"]),M("X1","SUV",["bmw x1","x1"]),M("X3","SUV",["bmw x3","x3"]),M("X5","SUV",["bmw x5","x5"]),M("X6","SUV",["bmw x6","x6"]),M("X7","SUV",["bmw x7","x7"])]),
  K("Mercedes","German",["mercedes","mercedes benz","مرسيدس","مرسيدس بنز"],[M("C-Class","Sedan",["c class","c-class"]),M("E-Class","Sedan",["e class","e-class"]),M("S-Class","Sedan",["s class","s-class"]),M("GLC","SUV",["glc"]),M("GLE","SUV",["gle"]),M("GLS","SUV",["gls"]),M("G-Class","SUV",["g class","g-class","g63","جي كلاس"])]),
  K("Audi","German",["audi","اودي","أودي"],[M("A3","Sedan",["audi a3"]),M("A4","Sedan",["audi a4"]),M("A6","Sedan",["audi a6"]),M("Q3","SUV",["audi q3"]),M("Q5","SUV",["audi q5"]),M("Q7","SUV",["audi q7"]),M("Q8","SUV",["audi q8"])]),
  K("Volkswagen","German",["volkswagen","vw","فولكس واجن","فولكس فاجن"],[M("Tiguan","SUV",["tiguan","تيجوان"]),M("Teramont","SUV",["teramont","تيرامونت"]),M("Golf","Hatchback",["golf","جولف"]),M("Passat","Sedan",["passat","باسات"])]),
  K("Porsche","German",["porsche","بورش"],[M("Cayenne","SUV",["cayenne","كايين"]),M("Macan","SUV",["macan","ماكان"]),M("Panamera","Sedan",["panamera","باناميرا"]),M("911","Coupe",["porsche 911"])]),
  K("Land Rover","British",["land rover","لاند روفر"],[M("Defender","SUV",["defender","ديفندر"]),M("Discovery","SUV",["discovery","ديسكفري"])]),
  K("Range Rover","British",["range rover","رينج روفر"],[M("Range Rover","SUV",["range rover","رينج روفر"]),M("Range Rover Sport","SUV",["range rover sport","رينج روفر سبورت"]),M("Velar","SUV",["velar","فيلار"]),M("Evoque","SUV",["evoque","ايفوك"])]),
  K("Geely","Chinese",["geely","جيلي"],[M("Coolray","SUV",["coolray","كولراي"]),M("Emgrand","Sedan",["emgrand","امجراند"]),M("Monjaro","SUV",["monjaro","مونجارو"]),M("Starray","SUV",["starray","ستاراي"])]),
  K("Changan","Chinese",["changan","شانجان"],[M("CS35 Plus","SUV",["cs35","cs35 plus"]),M("CS55 Plus","SUV",["cs55","cs55 plus"]),M("CS75 Plus","SUV",["cs75","cs75 plus"]),M("UNI-K","SUV",["uni k","uni-k"]),M("UNI-T","SUV",["uni t","uni-t"]),M("Alsvin","Sedan",["alsvin","السفن"])]),
  K("Haval","Chinese",["haval","هافال"],[M("H6","SUV",["h6"]),M("Jolion","SUV",["jolion","جوليان"]),M("Dargo","SUV",["dargo","دارجو"]),M("H9","SUV",["h9"])]),
  K("MG","Chinese",["mg","ام جي","إم جي"],[M("MG 5","Sedan",["mg5","mg 5"]),M("MG 7","Sedan",["mg7","mg 7"]),M("GT","Sedan",["mg gt"]),M("ZS","SUV",["mg zs"]),M("HS","SUV",["mg hs"]),M("RX5","SUV",["rx5"])]),
  K("BYD","Chinese",["byd","بي واي دي"],[M("Atto 3","SUV",["atto 3"]),M("Song Plus","SUV",["song plus"]),M("Seal","Sedan",["byd seal"]),M("Han","Sedan",["byd han"]),M("Tang","SUV",["byd tang"])]),
  K("Jetour","Chinese",["jetour","جيتور"],[M("Dashing","SUV",["dashing","داشينج"]),M("X70","SUV",["x70"]),M("X90 Plus","SUV",["x90","x90 plus"]),M("T1","SUV",["jetour t1"]),M("T2","SUV",["jetour t2","t2"])]),
  K("GAC","Chinese",["gac","جي ايه سي"],[M("GS3","SUV",["gs3"]),M("GS4","SUV",["gs4"]),M("GS8","SUV",["gs8"]),M("Empow","Sedan",["empow"])]),
  K("Hongqi","Chinese",["hongqi","هونشي"],[M("H5","Sedan",["hongqi h5"]),M("H9","Sedan",["hongqi h9"]),M("HS5","SUV",["hs5"])]),
  K("Tesla","American",["tesla","تسلا"],[M("Model 3","Sedan",["model 3","موديل 3"]),M("Model Y","SUV",["model y","موديل واي"]),M("Model S","Sedan",["model s"]),M("Model X","SUV",["model x"])]),
  K("Lucid","American",["lucid","لوسيد"],[M("Air","Sedan",["lucid air","لوسيد اير"]),M("Gravity","SUV",["lucid gravity"])]),
];

const makeAliases=[]; const modelAliases=[];
for(const make of MAKES){
  for(const a of [make.name,...make.aliases]) makeAliases.push({key:norm(a),make});
  for(const model of make.models) for(const a of [model.name,...model.aliases]) modelAliases.push({key:norm(a),make,model});
}
makeAliases.sort((a,b)=>b.key.length-a.key.length); modelAliases.sort((a,b)=>b.key.length-a.key.length);

export const PART_TERMS=[
  "spare part","spare parts","parts","parting out","accessory","accessories","body kit","bumper","bonnet","hood","fender","headlight","head light","tail light","taillight","grille","grill","door","mirror","windshield","windscreen","glass","engine","gearbox","transmission","differential","axle","suspension","shock absorber","coilover","radiator","compressor","alternator","starter motor","exhaust","catalytic","turbo","injector","spark plug","brake pad","brake disc","spoiler","roof rack","floor mat","seat cover","wheel rim","alloy rim","rim only","tyre","tire",
  "قطع غيار","قطع","تشليح","اكسسوارات","إكسسوارات","صدام","كبوت","رفرف","شمعة","شمعات","كشاف","كشافات","باب","مراية","مرايات","زجاج","مكينة","مكينه","ماكينة","قير","دفرنس","اكسل","رديتر","راديتر","كمبروسر","دينمو","سلف","شكمان","دبة","دبه","تيربو","بخاخ","بواجي","فحمات","هوبات","جنوط","جنط","كفرات","كفر","سبويلر","فرش","مساعدات"
];
const partNorm=PART_TERMS.map(norm).sort((a,b)=>b.length-a.length);
const NON_LISTING_URL=/(?:^|\/)(?:price|prices|specs?|specifications?|review|reviews|news|blog|compare|comparison|calculator|valuation|sell-car|car-value)(?:\/|$)|(?:19|20)\d{2}-price(?:\/|$)|-price(?:\/|$)/i;

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
  ["luxury",/luxury|premium|فاخر|فخمه|فخمة/],
  ["city",/city car|داخل المدينه|داخل المدينة|زحمه|زحمة/],
  ["performance",/performance|sporty|sports car|رياضي|سريع|قوي/],
  ["work",/work truck|للشغل|شغل|تحميل|حمل/]
];

function findMakeModel(text=""){
  const n=norm(text); let make=null,model=null;
  const mm=modelAliases.find(x=>x.key&&n.includes(x.key));
  if(mm){make=mm.make;model=mm.model;}
  if(!make){const ma=makeAliases.find(x=>x.key&&n.includes(x.key));if(ma)make=ma.make;}
  return {make,model};
}
function bodyFromQuery(n){for(const [v,re] of BODY_PATTERNS)if(re.test(n))return v;return null;}
function originFromQuery(n){for(const [v,re] of ORIGIN_PATTERNS)if(re.test(n))return v;return null;}
function needsFromQuery(n){return NEED_PATTERNS.filter(([,re])=>re.test(n)).map(([v])=>v);}
function cityFromQuery(n){if(/riyadh|الرياض/.test(n))return"Riyadh";if(/jeddah|جده|جدة/.test(n))return"Jeddah";if(/dammam|الدمام/.test(n))return"Dammam";if(/khobar|الخبر/.test(n))return"Khobar";if(/makkah|mecca|مكه|مكة/.test(n))return"Makkah";if(/madinah|medina|المدينه|المدينة/.test(n))return"Madinah";if(/tabuk|تبوك/.test(n))return"Tabuk";if(/abha|ابها|أبها/.test(n))return"Abha";return null;}
function numbers(s){return String(s||"").replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));}
function yearHints(q){const x=numbers(q),ys=[...x.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=1980&&y<=2030),n=norm(x);if(ys.length>=2)return{exactYear:null,minYear:Math.min(...ys),maxYear:Math.max(...ys)};if(ys.length===1){const y=ys[0];if(/and above|or newer|newer|above|from|وفوق|واحدث|وأحدث|فوق/.test(n))return{exactYear:null,minYear:y,maxYear:null};if(/and below|or older|older|below|وتحت|واقدم|وأقدم/.test(n))return{exactYear:null,minYear:null,maxYear:y};return{exactYear:y,minYear:null,maxYear:null}}return{exactYear:null,minYear:null,maxYear:null};}
function amountAfter(n, words, min=0,max=5_000_000){for(const w of words){const re=new RegExp(`${w}[^0-9]{0,14}([0-9][0-9,]{2,})`);const m=n.match(re);if(m){let v=Number(m[1].replace(/,/g,""));if(/\b(k|thousand)\b/.test(n.slice(m.index,m.index+40))&&v<1000)v*=1000;if(Number.isFinite(v)&&v>=min&&v<=max)return v;}}return null;}

export function detectAutomotiveIntent(query="",body={}){
  const n=norm(query),f=body.filters&&typeof body.filters==="object"?body.filters:{},mm=findMakeModel(query),yh=yearHints(query);
  const bodyType=bodyFromQuery(n),nationality=originFromQuery(n),needs=needsFromQuery(n);
  const maxPrice=Number(f.maxPrice)||amountAfter(n,["under","below","less than","max","budget","تحت","اقل","أقل","حدي","ميزانيه","ميزانية"],1000)||null;
  const maxMileage=Number(f.maxMileage)||amountAfter(n,["under","below","less than","mileage","km","ممشى","الممشى","كيلو"],0,1_500_000)||null;
  const condition=body.condition==="new"?"new":body.condition==="used"?"used":(/\bnew\b|جديد|زيرو/.test(n)?"new":/\bused\b|مستعمل/.test(n)?"used":null);
  const sort=/cheapest|lowest price|ارخص|الأرخص/.test(n)?"lowest_price":/lowest mileage|اقل ممشى|أقل ممشى/.test(n)?"lowest_mileage":/newest|احدث|أحدث/.test(n)?"newest":"relevance";
  const explicit=[]; if(mm.make)explicit.push("brand");if(mm.model)explicit.push("model");if(bodyType)explicit.push("bodyType");if(nationality)explicit.push("nationality");if(yh.exactYear||yh.minYear||yh.maxYear||f.minYear||f.maxYear)explicit.push("year");if(maxPrice)explicit.push("maxPrice");if(maxMileage)explicit.push("maxMileage");if(cityFromQuery(n)||f.city)explicit.push("city");if(condition)explicit.push("condition");
  return {vehicleOnly:true,brand:mm.make?.name||null,model:mm.model?.name||null,bodyType:bodyType||mm.model?.body||null,nationality:nationality||mm.make?.origin||null,needs,exactYear:yh.exactYear,minYear:Number(f.minYear)||yh.minYear||null,maxYear:Number(f.maxYear)||yh.maxYear||null,maxPrice,maxMileage,city:String(f.city||cityFromQuery(n)||"").trim()||null,condition,sort,explicit:[...new Set(explicit)]};
}

function modelsFor({bodyType,nationality,needs=[]}={}){
  let body=bodyType;
  if(!body&&needs.includes("family"))body="SUV";
  if(!body&&needs.includes("offroad"))body="SUV";
  if(!body&&needs.includes("work"))body="Pickup";
  const out=[];
  for(const make of MAKES){if(nationality&&make.origin!==nationality&&!(nationality==="European"&&["German","British"].includes(make.origin)))continue;for(const model of make.models){if(body&&model.body!==body&&!(body==="SUV"&&model.body==="Crossover"))continue;out.push(`${make.name} ${model.name}`)}}
  const preferred=needs.includes("offroad")?["Toyota Land Cruiser","Toyota Prado","Nissan Patrol","Jeep Wrangler","Ford Bronco","Land Rover Defender","GMC Yukon"]:needs.includes("family")?["Toyota Land Cruiser","Toyota Fortuner","Toyota RAV4","Nissan Patrol","Nissan X-Trail","Hyundai Tucson","Hyundai Santa Fe","Kia Sportage","Kia Sorento","Honda CR-V","Mazda CX-5"]:needs.includes("economy")?["Toyota Corolla","Toyota Yaris","Nissan Sunny","Hyundai Accent","Hyundai Elantra","Kia Pegas","Honda City","MG MG 5"]:[];
  return [...preferred.filter(x=>out.includes(x)),...out.filter(x=>!preferred.includes(x))];
}

export function buildRetrievalQueries(intent, original=""){
  const out=[];const push=q=>{q=String(q||"").trim();if(q&&!out.some(x=>norm(x)===norm(q)))out.push(q)};
  if(intent.brand&&intent.model)push(`${intent.brand} ${intent.model}`); else if(intent.brand)push(intent.brand);
  for(const q of intent.retrievalQueries||[])push(q);
  if(!intent.brand&&!intent.model){for(const q of modelsFor(intent)){push(q);if(out.length>=10)break;}}
  if(!out.length)push(original);return out.slice(0,10);
}

export function knowledgePrompt(intent={}){
  const detected=[intent.brand,intent.model,intent.bodyType,intent.nationality,...(intent.needs||[])].filter(Boolean).join(", ")||"none";
  return `DALLELAH AUTOMOTIVE KNOWLEDGE RULES:\n- Search REAL WHOLE VEHICLES only. Never return spare parts, dismantled cars, accessories, service pages, price guides, reviews, specs or editorial pages.\n- Never invent a listing, price, mileage, year, city, trim, seller, condition, image, feature or availability. Unknown facts stay unknown.\n- Understand Saudi Arabic and English automotive language, spelling variants and common model aliases.\n- Make/model requests are literal hard constraints when explicitly stated. Year, budget, mileage, city and condition are hard constraints when explicitly stated.\n- A lifestyle phrase such as family, economical, luxury, off-road or city car is a recommendation preference; use automotive knowledge to expand it into sensible real models.\n- If metadata is missing, do not claim it satisfies the constraint. It may be presented as a POSSIBLE match with the missing field clearly identified.\n- Rank verified matches first, then possible matches. Prefer direct sale listings with real image, price, year, mileage and city.\n- Diversify sources when quality is similar.\n- Keep retrieval queries short: normally MAKE MODEL, not the whole natural-language sentence.\nDetected deterministic automotive hints: ${detected}.`;
}

export function isVehicleListing(c){
  if(!c?.url||c.saleVerified!==true)return false;
  let pathname="";try{pathname=decodeURIComponent(new URL(c.url).pathname)}catch{}
  const nt=norm(`${c.title||""} ${pathname}`);
  if(NON_LISTING_URL.test(pathname))return false;
  if(partNorm.some(p=>p&&(` ${nt} `).includes(` ${p} `)))return false;
  if(c.sourceType==="independent_dealer"||c.sourceType==="certified_used"||c.channel==="certified_inventory"||c.channel==="dealer_inventory")return true;
  const mm=findMakeModel(`${c.brand||""} ${c.model||""} ${c.title||""} ${pathname}`);
  const facts=Boolean(c.year||c.mileage!=null||c.price||/\b(sedan|suv|coupe|hatchback|pickup|truck|crossover|4x4|automatic|manual|mileage|km|ممشى|سياره|سيارة|مستعمل|جديد)\b/i.test(`${c.title||""} ${c.snippet||""}`));
  return Boolean(c.brand||c.model||mm.make||mm.model)&&facts;
}

function canonicalListing(c){const mm=findMakeModel(`${c.brand||""} ${c.model||""} ${c.title||""}`);return{...c,brand:c.brand||mm.make?.name||null,model:c.model||mm.model?.name||null,_knownBody:mm.model?.body||null,_knownOrigin:mm.make?.origin||null};}
function same(a,b){return norm(a)===norm(b);}
function evaluate(c,intent){
  const missing=[],reasons=[],reject=[]; const x=canonicalListing(c); const exp=new Set(intent.explicit||[]);
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
  const uniqMissing=[...new Set(missing)],uniqReasons=[...new Set(reasons)];
  let score=60; if(x.imageVerified||x.image)score+=8;if(x.priceVerified||x.price)score+=8;if(x.year)score+=5;if(x.mileage!=null)score+=4;if(x.city)score+=3;if(x.brand)score+=3;if(x.model)score+=4;score+=Math.min(10,uniqReasons.length*2);score-=uniqMissing.length*3;
  return {listing:x,reject:reject.length>0,missing:uniqMissing,reasons:uniqReasons,matchTier:uniqMissing.length?"possible":"verified",matchScore:Math.max(1,Math.min(99,Math.round(score)))};
}

function displayFor(e){
  const c=e.listing,title=c.title||[c.year,c.brand,c.model].filter(Boolean).join(" ")||"Car listing";
  const facts=[];if(c.year)facts.push(String(c.year));if(c.mileage!=null)facts.push(`${Number(c.mileage).toLocaleString()} km`);if(c.city)facts.push(c.city);
  return {headline:title,priceText:c.price?`${Number(c.price).toLocaleString()} SAR`:"Price on source",facts,matchLabel:e.matchTier==="verified"?"Verified match":"Possible match",why:e.reasons.slice(0,4),missing:e.missing,cta:"View original listing"};
}

function sourceDiversify(items,limit=500){
  const by=new Map();for(const x of items){const k=x.source||"Other";if(!by.has(k))by.set(k,[]);by.get(k).push(x)}for(const arr of by.values())arr.sort((a,b)=>b.matchScore-a.matchScore);
  const out=[];while(out.length<limit){let best=null;for(const [k,arr] of by){if(!arr.length)continue;if(!best||arr[0].matchScore>best[1][0].matchScore)best=[k,arr]}if(!best)break;const ordered=[...by.entries()].filter(([,a])=>a.length).sort((a,b)=>b[1][0].matchScore-a[1][0].matchScore);for(const[,arr]of ordered){if(out.length>=limit)break;out.push(arr.shift())}}return out;
}

export function prepareResults(groups,intent,limit=500){
  const map=new Map();for(const group of groups||[])for(const raw of group||[]){if(!isVehicleListing(raw))continue;const key=(()=>{try{const u=new URL(raw.url);u.hash="";return u.href.replace(/\/$/,"")}catch{return String(raw.url||"")}})();const old=map.get(key);map.set(key,old?{...raw,...old,image:old.image||raw.image,displayImage:old.displayImage||raw.displayImage,price:old.price??raw.price??null}:raw)}
  const evaluated=[];for(const raw of map.values()){const e=evaluate(raw,intent);if(e.reject)continue;evaluated.push({...e.listing,matchTier:e.matchTier,matchScore:e.matchScore,matchReasons:e.reasons,missingData:e.missing,presentation:displayFor(e)})}
  evaluated.sort((a,b)=>(a.matchTier==="verified"?0:1)-(b.matchTier==="verified"?0:1)||b.matchScore-a.matchScore);
  const verified=sourceDiversify(evaluated.filter(x=>x.matchTier==="verified"),limit);const possible=sourceDiversify(evaluated.filter(x=>x.matchTier!=="verified"),Math.max(0,limit-verified.length));
  return [...verified,...possible].slice(0,limit);
}

export function resultSummary(listings,intent){
  const verified=listings.filter(x=>x.matchTier==="verified").length,possible=listings.length-verified;
  const missing=[...new Set(listings.flatMap(x=>x.missingData||[]))];
  let text=`${verified} verified match${verified===1?"":"es"}`;if(possible)text+=` + ${possible} possible match${possible===1?"":"es"}`;text+=" found.";if(possible&&missing.length)text+=` Possible matches are missing ${missing.slice(0,3).join(", ")} data on the source.`;if(!listings.length)text="No current indexed car can be confirmed against those constraints yet. Dalelah will keep refreshing the market.";return{text,verified,possible,missing};
}
