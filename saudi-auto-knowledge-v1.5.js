// Dalelah Saudi automotive domain knowledge — v1.5
// This is durable reasoning context, not a substitute for live listing/spec verification.

export const SAUDI_KNOWLEDGE_VERSION = "1.5-saudi-auto-domain";

export const SAUDI_CITIES = [
  ["Riyadh",["riyadh","الرياض"]],["Jeddah",["jeddah","jedda","جده","جدة"]],
  ["Dammam",["dammam","الدمام"]],["Khobar",["khobar","al khobar","الخبر"]],
  ["Dhahran",["dhahran","الظهران"]],["Makkah",["makkah","mecca","مكه","مكة"]],
  ["Madinah",["madinah","medina","المدينه","المدينة"]],["Taif",["taif","الطايف","الطائف"]],
  ["Tabuk",["tabuk","تبوك"]],["Abha",["abha","ابها","أبها"]],
  ["Khamis Mushait",["khamis mushait","خميس مشيط"]],["Jazan",["jazan","jizan","جازان","جيزان"]],
  ["Najran",["najran","نجران"]],["Hail",["hail","ha'il","حائل"]],
  ["Buraydah",["buraydah","buraidah","بريدة"]],["Unaizah",["unaizah","عنيزة"]],
  ["Al Ahsa",["al ahsa","alahsa","الاحساء","الأحساء"]],["Jubail",["jubail","الجبيل"]],
  ["Yanbu",["yanbu","ينبع"]],["Al Baha",["al baha","الباحه","الباحة"]],
  ["Sakaka",["sakaka","سكاكا"]],["Arar",["arar","عرعر"]]
];

export const SAUDI_TERMS = {
  condition: {
    new:["جديد","زيرو","اصفار","أصفار","بطاقة جمركية","new"],
    used:["مستعمل","ممشى","مالك أول","مالك اول","used","pre-owned"]
  },
  trim:["فل كامل","فل","نص فل","ستاندر","ستاندرد","وكالة","limited","platinum","premium","sport","base"],
  drivetrain:["دبل","دبل ثقيل","دفع رباعي","4x4","awd","4wd","دفع خلفي","rwd","دفع امامي","fwd"],
  provenance:["سعودي","خليجي","وارد امريكي","وارد كندي","وارد","GCC","Saudi spec","GCC spec"],
  inspection:["فحص دوري","فحص","موجز","تقرير موجز","استمارة","تأمين","حادث","حوادث","رش","صبغ","بدي بلد","وكالة"],
  mechanical:["مكينة","مكينه","قير","جير","دفرنس","شاص","شاصي","مكيف","حرارة","تهريب","صيانة","سيرفس"],
  seller:["مالك","مستخدم","معرض","وكالة","موزع","dealer","showroom","certified","معتمد"],
  finance:["كاش","نقدا","نقداً","تمويل","اقساط","أقساط","دفعة","قسط","lease","finance","cash"],
  excluded:["مطلوب","شراء","تشليح","قطع غيار","بدل","للتنازل عن الطلب","حراج قطع","اكسسوارات","إكسسوارات"]
};

export const VEHICLE_SEGMENTS = {
  micro:["city car","micro"], hatchback:["hatchback","هاتشباك"],
  sedan:["sedan","سيدان"], coupe:["coupe","كوبيه"],
  crossover:["crossover","كروس اوفر","كروس أوفر"], suv:["suv","جيب","دفع رباعي"],
  pickup:["pickup","pick-up","وانيت","بيك اب"], van:["van","minivan","فان","ميني فان"]
};

export const POWERTRAIN_TERMS = {
  petrol:["petrol","gasoline","بنزين"], diesel:["diesel","ديزل"],
  hybrid:["hybrid","هايبرد","هجين"], phev:["plug-in hybrid","phev","هايبرد قابل للشحن"],
  electric:["electric","ev","bev","كهربائي","كهربائية"]
};

export const MARKET_MAKES = {
  Japanese:["Toyota","Nissan","Lexus","Honda","Mazda","Mitsubishi","Suzuki","Isuzu","Subaru","Infiniti"],
  Korean:["Hyundai","Kia","Genesis","SsangYong","KGM"],
  American:["Ford","Chevrolet","GMC","Cadillac","Lincoln","Jeep","Dodge","RAM","Chrysler","Tesla","Lucid"],
  German:["BMW","Mercedes-Benz","Audi","Volkswagen","Porsche","MINI"],
  British:["Land Rover","Range Rover","Bentley","Rolls-Royce","Aston Martin","McLaren","Lotus"],
  Italian:["Ferrari","Lamborghini","Maserati","Alfa Romeo","Fiat"],
  French:["Peugeot","Renault","Citroen"],
  Swedish:["Volvo","Polestar"],
  Czech:["Skoda"], Spanish:["Cupra","SEAT"],
  Chinese:["MG","Geely","Changan","Haval","GWM","Tank","BYD","Chery","Exeed","Jetour","Hongqi","GAC","BAIC","JAC","Bestune","Dongfeng","Zeekr","Lynk & Co","Omoda","Jaecoo","NIO","XPeng"]
};

export const SAUDI_POPULAR_MODELS = [
  "Toyota Camry","Toyota Corolla","Toyota Yaris","Toyota Land Cruiser","Toyota Prado","Toyota Fortuner","Toyota Hilux","Toyota RAV4","Toyota Highlander","Toyota Raize","Toyota Urban Cruiser","Toyota Crown",
  "Nissan Patrol","Nissan Sunny","Nissan Altima","Nissan X-Trail","Nissan Pathfinder","Nissan Kicks","Nissan X-Terra","Nissan Navara",
  "Lexus ES","Lexus IS","Lexus LS","Lexus NX","Lexus RX","Lexus GX","Lexus LX","Lexus UX",
  "Honda Accord","Honda Civic","Honda City","Honda CR-V","Honda HR-V","Honda Pilot",
  "Mazda 3","Mazda 6","Mazda CX-3","Mazda CX-30","Mazda CX-5","Mazda CX-60","Mazda CX-9","Mazda CX-90",
  "Hyundai Accent","Hyundai Elantra","Hyundai Sonata","Hyundai Azera","Hyundai Tucson","Hyundai Santa Fe","Hyundai Palisade","Hyundai Kona","Hyundai Creta",
  "Kia Pegas","Kia Cerato","Kia K3","Kia K5","Kia K8","Kia Sportage","Kia Sorento","Kia Seltos","Kia Telluride","Kia Carnival",
  "Ford Taurus","Ford Territory","Ford Explorer","Ford Expedition","Ford Everest","Ford Bronco","Ford Ranger","Ford F-150","Ford Mustang",
  "Chevrolet Tahoe","Chevrolet Suburban","Chevrolet Traverse","Chevrolet Captiva","Chevrolet Groove","Chevrolet Silverado","Chevrolet Camaro",
  "GMC Yukon","GMC Sierra","GMC Acadia","GMC Terrain","Jeep Wrangler","Jeep Grand Cherokee","Jeep Compass","Jeep Gladiator",
  "BMW 3 Series","BMW 5 Series","BMW 7 Series","BMW X1","BMW X3","BMW X5","BMW X6","BMW X7",
  "Mercedes-Benz C-Class","Mercedes-Benz E-Class","Mercedes-Benz S-Class","Mercedes-Benz GLC","Mercedes-Benz GLE","Mercedes-Benz GLS","Mercedes-Benz G-Class",
  "Audi A3","Audi A4","Audi A6","Audi Q3","Audi Q5","Audi Q7","Audi Q8",
  "Range Rover","Range Rover Sport","Range Rover Velar","Range Rover Evoque","Land Rover Defender","Land Rover Discovery",
  "Geely Emgrand","Geely Coolray","Geely Monjaro","Geely Starray","Changan Alsvin","Changan CS35 Plus","Changan CS55 Plus","Changan CS75 Plus","Changan UNI-T","Changan UNI-K",
  "Haval Jolion","Haval H6","Haval Dargo","Haval H9","Tank 300","Tank 500","MG 5","MG GT","MG 7","MG ZS","MG HS","MG RX5",
  "BYD Atto 3","BYD Song Plus","BYD Seal","BYD Qin Plus","Jetour X70","Jetour X90","Jetour T2","Chery Tiggo 4","Chery Tiggo 7","Chery Tiggo 8","Exeed RX","Exeed VX","Hongqi H5","Hongqi H9","GAC GS3","GAC GS8","Zeekr 001","Zeekr X",
  "Tesla Model 3","Tesla Model Y","Lucid Air","Genesis G70","Genesis G80","Genesis G90","Genesis GV70","Genesis GV80"
];

export function parseTyreSize(text="") {
  const m=String(text).toUpperCase().match(/\b(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})\b/);
  if(!m)return null;
  const widthMm=Number(m[1]),aspect=Number(m[2]),wheelIn=Number(m[3]);
  if(widthMm<125||widthMm>405||aspect<20||aspect>95||wheelIn<10||wheelIn>26)return null;
  const sidewallMm=widthMm*aspect/100;
  const diameterMm=wheelIn*25.4+2*sidewallMm;
  return {raw:`${widthMm}/${aspect}R${wheelIn}`,widthMm,aspectRatio:aspect,wheelIn,sidewallMm:Math.round(sidewallMm),overallDiameterMm:Math.round(diameterMm)};
}

export function tyreKnowledgePrompt(query="") {
  const t=parseTyreSize(query);
  const parsed=t?` Parsed tyre query: ${t.raw}; width ${t.widthMm} mm, aspect ratio ${t.aspectRatio}%, wheel ${t.wheelIn} in, approximate overall diameter ${t.overallDiameterMm} mm.`:"";
  return `TYRE/WHEEL KNOWLEDGE:\n- Read a tyre code such as 285/70R17 as width in millimetres / sidewall aspect ratio / wheel diameter in inches.\n- Overall tyre diameter = wheel diameter in mm + twice the sidewall height.\n- Wheel diameter, width, offset, bolt pattern, load index, speed rating, tyre construction and vehicle clearance all matter.\n- Never claim an OEM tyre size, bolt pattern, safe alternate size or fitment for a specific trim unless it is known from structured data or verified from a reliable live source.\n- Different trims/years of the same model can use different wheel and tyre sizes.\n-${parsed}`;
}

export function saudiKnowledgePrompt(query="",intent={}) {
  return `SAUDI AUTOMOTIVE DOMAIN:\n- Market: Saudi Arabia; currency SAR. Users commonly mix Saudi Arabic and English car terminology.\n- Understand Saudi city names and spelling variants, GCC/Saudi-spec language, dealer/showroom terminology, cash/finance terminology, istimara/inspection/history terminology, and common condition language.\n- Treat explicit city, price, mileage, year, make/model, fuel type, drivetrain and condition as constraints when the user states them.\n- Family use is a need, not a body-style command: sedan, hatchback, crossover, SUV or van can all be suitable depending on budget, seats and usage.\n- Riyadh use may favour heat-resilient AC/cooling and everyday urban usability; western/southern/mountain driving may change terrain needs. Do not assert a specific car has those capabilities without data.\n- Saudi heat makes cooling system, battery, tyres and AC condition practically important on used cars; treat these as inspection considerations, not invented listing facts.\n- Resale, parts availability, dealer network, reliability and fuel economy are preferences unless the user explicitly makes them hard requirements.\n- Do not infer accident-free, original paint, agency maintenance, GCC specification, warranty, ownership count or mechanical condition unless the listing/source states it.\n- Recognize major Saudi-market Japanese, Korean, American, German, British, European and Chinese brands, including emerging Chinese EV/PHEV brands. If a make/model is not in the built-in catalog, use live web research rather than guessing.\n${tyreKnowledgePrompt(query)}`;
}

export function internetResearchRules(){
  return `LIVE INTERNET DISCOVERY RULES:\n- Search only public web content. Never bypass login, robots restrictions, CAPTCHAs, paywalls, anti-bot controls or access controls.\n- Prefer official dealer inventory, certified-used inventory, public marketplace/classified listings and auction vehicle pages.\n- A result is usable only if it is a DIRECT vehicle-for-sale page. Reject homepages, search/category pages, price guides, specs, reviews, news, wanted-to-buy posts, parts/accessories and service pages.\n- Never fabricate a URL. A candidate URL must come from live search results and must be independently validated before it can be displayed.\n- Preserve the original source URL and source name. Dalelah is a search engine, not the seller.\n- Unknown fields stay null. Never invent price, mileage, year, city, trim, seller, image, condition or availability.\n- Prefer Saudi Arabia inventory; exclude listings clearly located outside Saudi Arabia unless the user explicitly asks otherwise.`;
}
