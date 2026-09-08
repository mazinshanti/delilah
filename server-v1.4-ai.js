import "dotenv/config";
import express from "express";
import crypto from "node:crypto";

const externalPort=Number(process.env.PORT||3000);
const upstreamPort=Number(process.env.DALELAH_V14_CORE_PORT||6200);
const openaiKey=process.env.OPENAI_API_KEY||"";
const openaiModel=process.env.OPENAI_MODEL||"gpt-5.6-luna";
const AI_TIMEOUT=Number(process.env.DALELAH_AI_TIMEOUT||1200);

process.env.PORT=String(upstreamPort);
await import("./server-v1.4.js");
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:"1mb"}));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();
const canonical=v=>{try{const u=new URL(v);u.hash="";return u.href.replace(/\/$/,"")}catch{return String(v||"")}};

const PART_TERMS=[
  "spare part","spare parts","parts","parting out","accessory","accessories","body kit","bumper","bonnet","hood","fender","headlight","head light","tail light","taillight","grille","grill","door","mirror","windshield","windscreen","glass","engine","gearbox","transmission","differential","axle","suspension","shock absorber","coilover","radiator","compressor","alternator","starter motor","exhaust","catalytic","turbo","injector","spark plug","brake pad","brake disc","spoiler","roof rack","floor mat","seat cover","wheel rim","alloy rim","rim only","tyre","tire",
  "قطع غيار","قطع","تشليح","اكسسوارات","إكسسوارات","صدام","كبوت","رفرف","شمعة","شمعات","كشاف","كشافات","باب","مراية","مرايات","زجاج","مكينة","مكينه","ماكينة","قير","دفرنس","اكسل","رديتر","راديتر","كمبروسر","دينمو","سلف","شكمان","دبة","دبه","تيربو","بخاخ","بواجي","فحمات","هوبات","جنوط","جنط","كفرات","كفر","سبويلر","فرش","مساعدات"
];
const PART_RE=new RegExp(`(?:^|\\b|\\s)(${PART_TERMS.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})(?:\\b|\\s|$)`,`i`);
const VEHICLE_TERMS=/\b(sedan|suv|coupe|hatchback|pickup|truck|crossover|4x4|awd|fwd|rwd|automatic|manual|mileage|odometer|km|كيلو|ممشى|سياره|سيارة|مستعمل|جديد)\b/i;

function isVehicleListing(c){
  if(!c?.url||c.saleVerified!==true)return false;
  const title=norm(`${c.title||""} ${(()=>{try{return decodeURIComponent(new URL(c.url).pathname)}catch{return""}})()}`);
  if(PART_RE.test(title))return false;
  if(c.sourceType==="independent_dealer"||c.sourceType==="certified_used"||c.channel==="certified_inventory"||c.channel==="dealer_inventory")return true;
  const blob=norm(`${c.title||""} ${c.snippet||""}`);
  const hasIdentity=Boolean(c.brand||c.model);
  const hasVehicleFacts=Boolean(c.year||c.mileage!=null||c.price||VEHICLE_TERMS.test(blob));
  return hasIdentity&&hasVehicleFacts;
}
function merge(...groups){const m=new Map();for(const g of groups)for(const c of(g||[])){if(!isVehicleListing(c))continue;const k=canonical(c.url);const old=m.get(k);m.set(k,old?{...c,...old,image:old.image||c.image,displayImage:old.displayImage||c.displayImage,price:old.price??c.price??null}:c)}return[...m.values()];}
function counts(xs){return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});}

const JAPANESE=["Toyota","Nissan","Lexus","Honda","Mazda","Mitsubishi","Suzuki","Subaru","Isuzu"];
const KOREAN=["Hyundai","Kia","Genesis"];
const GERMAN=["Mercedes","BMW","Audi","Porsche","Volkswagen"];
const SUV_MODELS=["Toyota Land Cruiser","Toyota Prado","Toyota Fortuner","Toyota RAV4","Nissan Patrol","Nissan X-Trail","Nissan Pathfinder","Lexus RX","Lexus LX","Honda CR-V","Mazda CX-5","Hyundai Tucson","Hyundai Santa Fe","Kia Sportage","Kia Sorento","Ford Explorer","Ford Expedition","Chevrolet Tahoe","Jeep Wrangler","Jeep Grand Cherokee","BMW X5","Mercedes GLE"];
const SEDAN_MODELS=["Toyota Camry","Toyota Corolla","Toyota Yaris","Nissan Sunny","Nissan Altima","Honda Accord","Honda Civic","Mazda 6","Hyundai Elantra","Hyundai Sonata","Hyundai Accent","Kia K5","Kia Cerato","Ford Taurus","Lexus ES","BMW 5 Series","Mercedes E-Class"];
const PICKUP_MODELS=["Toyota Hilux","Ford Ranger","Ford F-150","Chevrolet Silverado","GMC Sierra","Isuzu D-Max","Jeep Gladiator"];

function fallbackIntent(body={}){
  const q=String(body.query||"").trim(),n=norm(q),f=body.filters&&typeof body.filters==="object"?body.filters:{};
  const year=[...q.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(x=>Number(x[1]));
  const maxPrice=Number(f.maxPrice)||Number((n.match(/(?:under|below|less than|تحت|اقل|أقل)[^0-9]{0,10}([0-9]{4,7})/)||[])[1])||null;
  const maxMileage=Number(f.maxMileage)||Number((n.match(/(?:under|below|less than|تحت|اقل|أقل)[^0-9]{0,10}([0-9]{2,7})\s*(?:km|كم|كيلو)/)||[])[1])||null;
  const city=f.city||(/riyadh|الرياض/.test(n)?"Riyadh":/jeddah|جده|جدة/.test(n)?"Jeddah":/dammam|الدمام/.test(n)?"Dammam":null);
  const bodyType=/\bsuv\b|دفع رباعي|جيب/.test(n)?"SUV":/sedan|سيدان/.test(n)?"Sedan":/pickup|بيك اب|وانيت/.test(n)?"Pickup":null;
  const nationality=/japanese|ياباني/.test(n)?"Japanese":/korean|كوري/.test(n)?"Korean":/german|الماني|ألماني/.test(n)?"German":null;
  return {vehicleOnly:true,brand:null,model:null,preferredBrands:[],bodyType,nationality,exactYear:year.length===1?year[0]:null,minYear:Number(f.minYear)||null,maxYear:Number(f.maxYear)||null,maxPrice,maxMileage,city,condition:body.condition==="new"?"new":body.condition==="used"?"used":null,retrievalQueries:[q],sort:"relevance",ai:false};
}

const schema={
  type:"object",additionalProperties:false,required:["vehicleOnly","brand","model","preferredBrands","bodyType","nationality","exactYear","minYear","maxYear","maxPrice","maxMileage","city","condition","retrievalQueries","sort"],
  properties:{
    vehicleOnly:{type:"boolean"},brand:{type:["string","null"]},model:{type:["string","null"]},preferredBrands:{type:"array",items:{type:"string"},maxItems:8},bodyType:{type:["string","null"],enum:["SUV","Sedan","Pickup","Coupe","Hatchback","Crossover","Van",null]},nationality:{type:["string","null"],enum:["Japanese","Korean","German","American","Chinese","European",null]},exactYear:{type:["integer","null"]},minYear:{type:["integer","null"]},maxYear:{type:["integer","null"]},maxPrice:{type:["integer","null"]},maxMileage:{type:["integer","null"]},city:{type:["string","null"]},condition:{type:["string","null"],enum:["new","used",null]},retrievalQueries:{type:"array",items:{type:"string"},minItems:1,maxItems:8},sort:{type:"string",enum:["relevance","lowest_price","newest","lowest_mileage"]}
  }
};

function responseText(d){
  if(typeof d?.output_text==="string")return d.output_text;
  for(const item of d?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&typeof c.text==="string")return c.text;
  return null;
}
async function aiIntent(body){
  const fallback=fallbackIntent(body);if(!openaiKey)return fallback;
  const system=`You are Dalelah's Saudi car search intent engine. Convert the user's request into strict structured filters for REAL WHOLE CARS only. Dalelah does not currently search spare parts, body parts, engines, gearboxes, tyres, rims, accessories or dismantled vehicles. If the user asks for parts, vehicleOnly must still be true and retrievalQueries should target whole cars only or a generic whole-car equivalent. Never invent a listing. retrievalQueries are short make/model searches used only to retrieve candidates from Dalelah's real inventory. For broad needs such as family SUV, recommend diverse concrete models that reasonably match. Respect explicit user constraints exactly. Arabic and English are both supported.`;
  const payload={model:openaiModel,input:[{role:"system",content:[{type:"input_text",text:system}]},{role:"user",content:[{type:"input_text",text:JSON.stringify({query:body.query,condition:body.condition||null,filters:body.filters||{}})}]}],text:{format:{type:"json_schema",name:"dalelah_car_search_intent",strict:true,schema}},max_output_tokens:450};
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${openaiKey}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(AI_TIMEOUT)});
    if(!r.ok)throw new Error(`OpenAI ${r.status}`);const d=await r.json(),txt=responseText(d);if(!txt)throw new Error("No structured output");const out=JSON.parse(txt);return {...fallback,...out,vehicleOnly:true,ai:true,modelUsed:openaiModel};
  }catch(e){return {...fallback,ai:false,aiError:e?.message||String(e)}}
}

function expandRetrieval(intent,original){
  const out=[];const push=x=>{x=String(x||"").trim();if(x&&!out.some(y=>norm(y)===norm(x)))out.push(x)};
  if(intent.brand&&intent.model)push(`${intent.brand} ${intent.model}`);else if(intent.brand)push(intent.brand);
  for(const q of intent.retrievalQueries||[])push(q);
  let brands=intent.preferredBrands||[];
  if(intent.nationality==="Japanese")brands=[...new Set([...brands,...JAPANESE])];
  if(intent.nationality==="Korean")brands=[...new Set([...brands,...KOREAN])];
  if(intent.nationality==="German")brands=[...new Set([...brands,...GERMAN])];
  const pool=intent.bodyType==="SUV"?SUV_MODELS:intent.bodyType==="Sedan"?SEDAN_MODELS:intent.bodyType==="Pickup"?PICKUP_MODELS:[];
  for(const m of pool){if(!brands.length||brands.some(b=>norm(m).startsWith(norm(b)+" ")))push(m);if(out.length>=8)break;}
  if(!out.length)push(original);return out.slice(0,8);
}

function bodyForQuery(body,q,intent){
  const f={...(body.filters||{})};
  if(intent.exactYear){f.minYear=intent.exactYear;f.maxYear=intent.exactYear}else{if(intent.minYear)f.minYear=intent.minYear;if(intent.maxYear)f.maxYear=intent.maxYear}
  if(intent.maxPrice)f.maxPrice=intent.maxPrice;if(intent.maxMileage)f.maxMileage=intent.maxMileage;if(intent.city)f.city=intent.city;
  return {...body,query:q,condition:intent.condition||body.condition||"used",filters:f};
}
async function upstreamSearch(body){
  const r=await fetch(`http://127.0.0.1:${upstreamPort}/api/search`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(5500)});
  const d=await r.json().catch(()=>({error:`HTTP ${r.status}`}));return{r,d};
}
const jobs=new Map();
async function runSearch(body){
  const intent=await aiIntent(body),queries=expandRetrieval(intent,body.query),condition=intent.condition||body.condition||"used";
  const settled=await Promise.allSettled(queries.map(q=>upstreamSearch(bodyForQuery(body,q,intent))));
  const groups=[],upstreamJobs=[];
  for(const x of settled)if(x.status==="fulfilled"&&x.value.r.ok){groups.push(x.value.d.listings||[]);if(x.value.d.searchId)upstreamJobs.push(x.value.d.searchId)}
  let listings=merge(...groups);
  if(intent.preferredBrands?.length||intent.nationality){let pref=intent.preferredBrands||[];if(intent.nationality==="Japanese")pref=[...new Set([...pref,...JAPANESE])];if(intent.nationality==="Korean")pref=[...new Set([...pref,...KOREAN])];if(intent.nationality==="German")pref=[...new Set([...pref,...GERMAN])];const p=new Set(pref.map(norm));listings.sort((a,b)=>Number(p.has(norm(b.brand)))-Number(p.has(norm(a.brand))))}
  if(intent.sort==="lowest_price")listings.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  if(intent.sort==="newest")listings.sort((a,b)=>(b.year||0)-(a.year||0));
  if(intent.sort==="lowest_mileage")listings.sort((a,b)=>(a.mileage??Infinity)-(b.mileage??Infinity));
  return{intent,queries,condition,listings: listings.slice(0,500),upstreamJobs};
}

app.post("/api/understand",async(req,res)=>{const query=String(req.body?.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});const intent=await aiIntent(req.body||{});res.json({ok:true,intent,aiEnabled:Boolean(openaiKey)});});
app.post("/api/search",async(req,res)=>{
  const body=req.body||{},query=String(body.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});
  const id=crypto.randomUUID();
  try{const result=await runSearch(body);const job={at:Date.now(),...result,body};jobs.set(id,job);res.json({query,condition:result.condition,intent:result.intent,listings:result.listings,counts:counts(result.listings),searchId:id,partial:result.upstreamJobs.length>0,indexed:null,background:true,responseMode:"ai-intent-index",aiEnabled:Boolean(openaiKey),vehicleOnly:true,retrievalQueries:result.queries});}
  catch(e){res.status(502).json({error:e?.message||"AI search unavailable"})}
});
app.get("/api/search/progress/:id",async(req,res)=>{
  const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:"Search expired"});
  const groups=[job.listings];let done=true;
  const settled=await Promise.allSettled(job.upstreamJobs.map(id=>fetch(`http://127.0.0.1:${upstreamPort}/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():null)));
  for(const x of settled)if(x.status==="fulfilled"&&x.value){groups.push(x.value.listings||[]);if(!x.value.done)done=false}
  const listings=merge(...groups).slice(0,500);job.listings=listings;
  res.json({query:job.body.query,condition:job.condition,intent:job.intent,listings,counts:counts(listings),searchId:req.params.id,done,partial:!done,vehicleOnly:true,aiEnabled:Boolean(openaiKey)});
});

async function proxy(req,res){
  try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!["host","content-length","connection"].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);let body;if(!["GET","HEAD"].includes(req.method)){body=JSON.stringify(req.body||{});headers["content-type"]="application/json"}const r=await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:"manual",signal:AbortSignal.timeout(30000)});let data;if((r.headers.get("content-type")||"").includes("application/json")){const d=await r.json();if(req.path==="/api/health")data=Buffer.from(JSON.stringify({...d,aiSearch:true,aiEnabled:Boolean(openaiKey),vehicleOnly:true,aiModel:openaiKey?openaiModel:null}));else data=Buffer.from(JSON.stringify(d));res.setHeader("content-type","application/json")}else data=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!["content-length","transfer-encoding","connection","content-type"].includes(k.toLowerCase()))res.setHeader(k,v);res.status(r.status).send(data)}catch(e){res.status(502).json({error:e?.message||"Dalelah core unavailable"})}
}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah 1.4 AI search gateway running at http://localhost:${externalPort} -> core ${upstreamPort}; AI ${openaiKey?"enabled":"fallback"}; vehicle-only gate enabled`));
setInterval(()=>{const now=Date.now();for(const[k,v]of jobs)if(now-v.at>15*60_000)jobs.delete(k)},60_000).unref();
