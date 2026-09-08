import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import {
  BRAIN_VERSION, detectAutomotiveIntent, buildRetrievalQueries,
  knowledgePrompt, prepareResults, resultSummary
} from "./car-brain-v1.4.4.js";

const externalPort=Number(process.env.PORT||3000);
const upstreamPort=Number(process.env.DALELAH_V14_CORE_PORT||6200);
const openaiKey=process.env.OPENAI_API_KEY||"";
const openaiModel=process.env.OPENAI_MODEL||"gpt-5.6-luna";
const AI_TIMEOUT=Number(process.env.DALELAH_AI_TIMEOUT||1400);

process.env.PORT=String(upstreamPort);
await import("./server-v1.4.js");
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:"1mb"}));
const jobs=new Map();

function counts(xs=[]){return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});}
function responseText(d){
  if(typeof d?.output_text==="string")return d.output_text;
  for(const item of d?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&typeof c.text==="string")return c.text;
  return null;
}

const schema={
  type:"object",additionalProperties:false,
  required:["vehicleOnly","brand","model","preferredBrands","bodyType","nationality","needs","exactYear","minYear","maxYear","maxPrice","maxMileage","city","condition","retrievalQueries","sort"],
  properties:{
    vehicleOnly:{type:"boolean"},
    brand:{type:["string","null"]},model:{type:["string","null"]},
    preferredBrands:{type:"array",items:{type:"string"},maxItems:8},
    bodyType:{type:["string","null"],enum:["SUV","Sedan","Pickup","Coupe","Hatchback","Crossover","Van",null]},
    nationality:{type:["string","null"],enum:["Japanese","Korean","German","American","Chinese","European",null]},
    needs:{type:"array",items:{type:"string",enum:["family","offroad","economy","luxury","city","performance","work"]},maxItems:5},
    exactYear:{type:["integer","null"]},minYear:{type:["integer","null"]},maxYear:{type:["integer","null"]},
    maxPrice:{type:["integer","null"]},maxMileage:{type:["integer","null"]},city:{type:["string","null"]},
    condition:{type:["string","null"],enum:["new","used",null]},
    retrievalQueries:{type:"array",items:{type:"string"},minItems:0,maxItems:8},
    sort:{type:"string",enum:["relevance","lowest_price","newest","lowest_mileage"]}
  }
};

function fallbackIntent(body={}){
  const detected=detectAutomotiveIntent(String(body.query||""),body);
  return {...detected,preferredBrands:[],retrievalQueries:[],ai:false,brainVersion:BRAIN_VERSION};
}
function mergeAIWithDetected(ai,detected){
  const out={...detected,...ai,vehicleOnly:true,brainVersion:BRAIN_VERSION};
  const explicit=new Set(detected.explicit||[]);
  if(explicit.has("brand"))out.brand=detected.brand;
  if(explicit.has("model"))out.model=detected.model;
  if(explicit.has("bodyType"))out.bodyType=detected.bodyType;
  if(explicit.has("nationality"))out.nationality=detected.nationality;
  if(explicit.has("year")){out.exactYear=detected.exactYear;out.minYear=detected.minYear;out.maxYear=detected.maxYear;}
  if(explicit.has("maxPrice"))out.maxPrice=detected.maxPrice;
  if(explicit.has("maxMileage"))out.maxMileage=detected.maxMileage;
  if(explicit.has("city"))out.city=detected.city;
  if(explicit.has("condition"))out.condition=detected.condition;
  out.partsRequested=detected.partsRequested===true;
  out.needs=[...new Set([...(detected.needs||[]),...(ai.needs||[])])];
  out.explicit=detected.explicit||[];
  out.preferredBrands=[...new Set(ai.preferredBrands||[])].slice(0,8);
  out.retrievalQueries=[...new Set(ai.retrievalQueries||[])].slice(0,8);
  return out;
}
async function aiIntent(body={}){
  const detected=detectAutomotiveIntent(String(body.query||""),body),fallback=fallbackIntent(body);
  if(!openaiKey)return fallback;
  const system=`You are the intent-planning layer inside Dalelah, a Saudi automotive search engine.\n${knowledgePrompt(detected)}\nReturn search intent only. Do not answer the user conversationally and do not invent inventory. A direct make/model explicitly typed by the user is literal. Lifestyle needs may expand to suitable models. Keep retrievalQueries short and diverse.`;
  const payload={
    model:openaiModel,
    input:[
      {role:"system",content:[{type:"input_text",text:system}]},
      {role:"user",content:[{type:"input_text",text:JSON.stringify({query:body.query,condition:body.condition||null,filters:body.filters||{},detected})}]}
    ],
    text:{format:{type:"json_schema",name:"dalelah_automotive_intent",strict:true,schema}},
    max_output_tokens:500
  };
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${openaiKey}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(AI_TIMEOUT)});
    if(!r.ok)throw new Error(`OpenAI ${r.status}`);
    const d=await r.json(),txt=responseText(d);if(!txt)throw new Error("No structured intent");
    const ai=JSON.parse(txt),merged=mergeAIWithDetected(ai,detected);
    return {...merged,ai:true,modelUsed:openaiModel};
  }catch(e){return {...fallback,ai:false,aiError:e?.message||String(e)};}
}

function retrievalBody(body,q,intent){
  const source=body?.filters?.source||"";
  return {query:q,condition:intent.condition||body.condition||"used",filters:source?{source}:{}};
}
async function upstreamSearch(body){
  const r=await fetch(`http://127.0.0.1:${upstreamPort}/api/search`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(5200)});
  const d=await r.json().catch(()=>({error:`HTTP ${r.status}`}));return{r,d};
}
function sortResults(listings,intent){
  const tier=x=>x.matchTier==="verified"?0:1;
  if(intent.sort==="lowest_price")listings.sort((a,b)=>tier(a)-tier(b)||(a.price??Infinity)-(b.price??Infinity)||b.matchScore-a.matchScore);
  else if(intent.sort==="newest")listings.sort((a,b)=>tier(a)-tier(b)||(b.year||0)-(a.year||0)||b.matchScore-a.matchScore);
  else if(intent.sort==="lowest_mileage")listings.sort((a,b)=>tier(a)-tier(b)||(a.mileage??Infinity)-(b.mileage??Infinity)||b.matchScore-a.matchScore);
  return listings;
}

async function runSearch(body){
  const intent=await aiIntent(body),allQueries=buildRetrievalQueries(intent,String(body.query||"")),condition=intent.condition||body.condition||"used";
  if(intent.partsRequested){const summary=resultSummary([],intent);return{intent,queries:[],allQueries:[],condition,listings:[],upstreamJobs:[],summary};}
  const queries=allQueries.slice(0,4);
  const settled=await Promise.allSettled(queries.map(q=>upstreamSearch(retrievalBody(body,q,intent))));
  const groups=[],upstreamJobs=[];
  for(const x of settled)if(x.status==="fulfilled"&&x.value.r.ok){groups.push(x.value.d.listings||[]);if(x.value.d.searchId)upstreamJobs.push(x.value.d.searchId);}
  let listings=prepareResults(groups,intent,500);sortResults(listings,intent);
  const summary=resultSummary(listings,intent);
  return{intent,queries,allQueries,condition,listings,upstreamJobs,summary};
}

app.post("/api/understand",async(req,res)=>{
  const query=String(req.body?.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});
  const detected=detectAutomotiveIntent(query,req.body||{}),intent=await aiIntent(req.body||{}),queries=buildRetrievalQueries(intent,query);
  res.json({ok:true,brainVersion:BRAIN_VERSION,detected,intent,retrievalQueries:queries,aiEnabled:Boolean(openaiKey)});
});
app.post("/api/search",async(req,res)=>{
  const body=req.body||{},query=String(body.query||"").trim();if(!query)return res.status(400).json({error:"Query is required"});
  const id=crypto.randomUUID();
  try{
    const result=await runSearch(body),job={at:Date.now(),...result,body};jobs.set(id,job);
    res.json({query,condition:result.condition,intent:result.intent,listings:result.listings,counts:counts(result.listings),verifiedCount:result.summary.verified,possibleCount:result.summary.possible,summary:result.summary.text,searchId:id,partial:result.upstreamJobs.length>0,background:true,responseMode:"automotive-brain-index",aiEnabled:Boolean(openaiKey),vehicleOnly:true,brainVersion:BRAIN_VERSION,retrievalQueries:result.queries,plannedQueries:result.allQueries});
  }catch(e){res.status(502).json({error:e?.message||"Dalelah automotive search unavailable"});}
});
app.get("/api/search/progress/:id",async(req,res)=>{
  const job=jobs.get(req.params.id);if(!job)return res.status(404).json({error:"Search expired"});
  const groups=[job.listings],settled=await Promise.allSettled(job.upstreamJobs.map(id=>fetch(`http://127.0.0.1:${upstreamPort}/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():null)));
  let done=true;for(const x of settled)if(x.status==="fulfilled"&&x.value){groups.push(x.value.listings||[]);if(!x.value.done)done=false;}
  let listings=prepareResults(groups,job.intent,500);sortResults(listings,job.intent);job.listings=listings;
  const summary=resultSummary(listings,job.intent);
  res.json({query:job.body.query,condition:job.condition,intent:job.intent,listings,counts:counts(listings),verifiedCount:summary.verified,possibleCount:summary.possible,summary:summary.text,searchId:req.params.id,done,partial:!done,vehicleOnly:true,aiEnabled:Boolean(openaiKey),brainVersion:BRAIN_VERSION});
});

async function proxy(req,res){
  try{
    const headers={};for(const[k,v]of Object.entries(req.headers))if(!["host","content-length","connection"].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(","):String(v);
    let body;if(!["GET","HEAD"].includes(req.method)){body=JSON.stringify(req.body||{});headers["content-type"]="application/json";}
    const r=await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:"manual",signal:AbortSignal.timeout(30000)});
    let data;if((r.headers.get("content-type")||"").includes("application/json")){
      const d=await r.json();data=Buffer.from(JSON.stringify(req.path==="/api/health"?{...d,aiSearch:true,aiEnabled:Boolean(openaiKey),vehicleOnly:true,aiModel:openaiKey?openaiModel:null,brainVersion:BRAIN_VERSION}:d));res.setHeader("content-type","application/json");
    }else data=Buffer.from(await r.arrayBuffer());
    for(const[k,v]of r.headers.entries())if(!["content-length","transfer-encoding","connection","content-type"].includes(k.toLowerCase()))res.setHeader(k,v);
    res.status(r.status).send(data);
  }catch(e){res.status(502).json({error:e?.message||"Dalelah core unavailable"});}
}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah ${BRAIN_VERSION} running at http://localhost:${externalPort} -> core ${upstreamPort}; AI ${openaiKey?"enabled":"fallback"}; automotive knowledge + vehicle-only gate enabled`));
setInterval(()=>{const now=Date.now();for(const[k,v]of jobs)if(now-v.at>15*60_000)jobs.delete(k)},60_000).unref();
