import express from 'express';
import {randomUUID} from 'node:crypto';
import {searchDirectFirst,mergeDirectListings,strictDirectListings} from './lib/direct-search.js';
import {exactYearIntent,enforceExactYear} from './lib/search-intent.js';

const externalPort=Number(process.env.PORT||3000);
const legacyBase=String(process.env.DALELAH_LEGACY_BASE_URL||'https://delilah-pm5f.onrender.com').replace(/\/$/,'');
const DIRECT_BUDGET_MS=Number(process.env.DALELAH_DIRECT_BUDGET_MS||1800);
const FULL_HEAD_START_MS=Number(process.env.DALELAH_FULL_HEAD_START_MS||900);
const JOB_TTL=10*60_000;
const COALESCE_TTL=3_000;

const app=express();
app.use(express.json({limit:'1mb'}));
const jobs=new Map();
const inFlight=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>String(value??'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const keyFor=body=>JSON.stringify({q:norm(body?.query||''),c:body?.condition==='new'?'new':'used',f:body?.filters||{}});

function counts(listings=[]){return listings.reduce((out,car)=>{const key=car?.source||car?.seller||'Other';out[key]=(out[key]||0)+1;return out;},{});}
function exactFor(body={}){const f=body.filters||{};if(Number(f.minYear)&&Number(f.maxYear)&&Number(f.minYear)===Number(f.maxYear))return Number(f.minYear);return exactYearIntent(String(body.query||''));}
function strictMerged(listings=[],body={}){let xs=Array.isArray(listings)?listings:[];const year=exactFor(body);if(year)xs=enforceExactYear(xs,year,{requireEvidence:true});return strictDirectListings(xs,body);}

async function legacy(path,opts={}){
  const response=await fetch(`${legacyBase}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(55_000)});
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={error:text.slice(0,1000)}}
  return{response,data,text};
}

function publicJob(job){
  const direct=job.directData||{};
  const full=job.fullData||{};
  const listings=strictMerged(mergeDirectListings(direct.listings,full.listings),job.body);
  const complete=Boolean(job.fullData&&(full.complete===true||full.marketScanComplete===true));
  const base=job.fullData||job.directData||{};
  const out={...base,listings,counts:counts(listings),complete,marketScanComplete:complete,directCoreLane:true,directCoreFirstResultMs:job.firstResultMs??null,directCoreDurationMs:direct.durationMs??null,directCoreSources:direct.sources||[],directCoreErrors:direct.errors||[],deepScanStarted:Boolean(job.fullPromise),deepScanMode:'remote-legacy-fallback',exactBrandQualityGate:true};
  if(!complete)out.searchId=job.id;else delete out.searchId;
  if(!out.answer)out.answer=listings.length?`${listings.length} verified cars found. Dalelah is continuing the market scan.`:'Dalelah is scanning the Saudi market…';
  return out;
}

function kickFull(job){
  if(job.fullPromise)return job.fullPromise;
  job.fullStartedAt=Date.now();
  job.fullPromise=legacy('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(job.body),signal:AbortSignal.timeout(55_000)})
    .then(({response,data})=>{
      job.fullDone=true;
      if(!response.ok){job.error=data?.error||`HTTP ${response.status}`;return null;}
      job.fullData=data;
      job.upstreamId=data?.searchId||job.upstreamId||null;
      if(Array.isArray(data?.listings)&&data.listings.length&&!job.firstResultMs)job.firstResultMs=Date.now()-job.createdAt;
      return data;
    })
    .catch(error=>{job.fullDone=true;job.error=error?.message||String(error);return null;});
  return job.fullPromise;
}

function startJob(body={}){
  const key=keyFor(body),existing=inFlight.get(key);
  if(existing&&Date.now()-existing.createdAt<COALESCE_TTL)return existing;
  const job={id:`dc.${randomUUID()}`,key,body,createdAt:Date.now(),directData:null,fullData:null,fullPromise:null,fullDone:false,upstreamId:null,error:null,firstResultMs:null};
  jobs.set(job.id,job);inFlight.set(key,job);
  job.directPromise=searchDirectFirst(body,{timeoutMs:DIRECT_BUDGET_MS})
    .then(data=>{job.directData=data;if(data?.listings?.length&&!job.firstResultMs)job.firstResultMs=Date.now()-job.createdAt;return data;})
    .catch(error=>{job.directData={listings:[],counts:{},sources:[],errors:[error?.message||String(error)],durationMs:Date.now()-job.createdAt};return job.directData;})
    .finally(()=>{kickFull(job);});
  const timer=setTimeout(()=>kickFull(job),FULL_HEAD_START_MS);timer.unref?.();
  return job;
}

async function advanceFull(job){
  if(!job.fullPromise)kickFull(job);
  if(!job.fullData&&!job.fullDone)await Promise.race([job.fullPromise,sleep(60)]);
  if(!job.fullData)return;
  if(job.fullData.complete===true||job.fullData.marketScanComplete===true)return;
  const upstream=job.upstreamId||job.fullData.searchId;
  if(!upstream)return;
  try{
    const {response,data}=await legacy(`/api/search/progress/${encodeURIComponent(upstream)}`,{signal:AbortSignal.timeout(50_000)});
    if(response.ok){job.fullData={...job.fullData,...data};job.upstreamId=data?.searchId||job.upstreamId||upstream;}
  }catch{}
}

function isBroad(body={}){const q=String(body.query||'').trim();return !q||q==='__all_cars__';}

app.post('/api/search',async(req,res)=>{
  const body=req.body||{};
  if(isBroad(body)){
    try{const {response,data}=await legacy('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return res.status(response.status).json(data);}catch(error){return res.status(502).json({error:error?.message||'Dalelah search unavailable'});}
  }
  const started=Date.now(),job=startJob(body);
  await Promise.race([job.directPromise,sleep(DIRECT_BUDGET_MS)]);
  if(!(job.directData?.listings?.length)&&!job.fullData){const left=Math.max(0,DIRECT_BUDGET_MS-(Date.now()-started));if(left)await Promise.race([job.fullPromise,sleep(left)]);}
  const out=publicJob(job);
  res.setHeader('Server-Timing',`dalelah-direct;dur=${Date.now()-started}`);
  res.setHeader('X-Dalelah-Core',out.listings.length?'direct-first':'scanning');
  return res.json(out);
});

app.get('/api/search/progress/:id',async(req,res)=>{
  const id=String(req.params.id||'');
  if(!id.startsWith('dc.')){
    try{const {response,data}=await legacy(`/api/search/progress/${encodeURIComponent(id)}`);return res.status(response.status).json(data);}catch(error){return res.status(502).json({error:error?.message||'Dalelah progress unavailable'});}
  }
  const job=jobs.get(id);if(!job)return res.status(404).json({error:'Search expired'});
  await advanceFull(job);
  const out=publicJob(job);
  if(out.complete){inFlight.delete(job.key);const timer=setTimeout(()=>jobs.delete(job.id),60_000);timer.unref?.();}
  if(job.error&&job.fullDone&&!out.listings.length)return res.status(502).json({...out,error:job.error});
  return res.json(out);
});

app.get('/api/health',async(_req,res)=>{
  try{const {response,data}=await legacy('/api/health',{signal:AbortSignal.timeout(9000)});return res.status(response.status).json({...data,directCoreLane:true,directCoreStrategy:'direct-first-remote-deep-scan',directCoreBudgetMs:DIRECT_BUDGET_MS,directCoreFullHeadStartMs:FULL_HEAD_START_MS,directCoreJobs:jobs.size,legacyBase});}
  catch(error){return res.status(503).json({ok:false,directCoreLane:true,directCoreStrategy:'direct-first-remote-deep-scan',error:error?.message||String(error)});}
});

async function proxy(req,res){
  try{
    const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);
    let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json';}
    const response=await fetch(`${legacyBase}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(55_000)});
    const buf=Buffer.from(await response.arrayBuffer());for(const[k,v]of response.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);
    return res.status(response.status).send(buf);
  }catch(error){return res.status(502).json({error:error?.message||'Dalelah unavailable'});}
}
app.use(proxy);

setInterval(()=>{const now=Date.now();for(const[id,job]of jobs)if(now-job.createdAt>JOB_TTL){jobs.delete(id);if(inFlight.get(job.key)===job)inFlight.delete(job.key);}},60_000).unref?.();
app.listen(externalPort,()=>console.log(`Dalelah direct-core candidate on ${externalPort}; deep scan ${legacyBase}`));
