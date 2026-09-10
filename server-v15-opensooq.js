import express from 'express';
import {fetchOpenSooqUsed} from './lib/opensooq-source.js';
import {filterBrandRelevance} from './lib/search-relevance.js';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_OPENSOOQ_INNER_PORT||7300);
const JOB_TTL=20*60_000;
const BROAD_MAX=500;
const BROAD_OPENSOOQ_QUOTA=150;
const EXACT_MAX=180;
process.env.PORT=String(innerPort);
await import('./server-v15-new-fast.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
const jobs=new Map();
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
function isBroad(body={}){const q=norm(body.query);return q==='__all_cars__'||q==='all cars'||q==='cars'||q==='سيارات'||!q}
function eligible(body={}){if(body.condition==='new')return false;const seller=norm(body.filters?.seller);return !seller||seller===norm('OpenSooq')}
function decodeBody(id=''){
  try{
    if(String(id).startsWith('d15.')){const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));return{query:p?.q||'',condition:p?.c==='new'?'new':'used',filters:p?.f||{}}}
    if(String(id).startsWith('vol.')){const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));return{query:p?.q||'__all_cars__',condition:p?.c==='new'?'new':'used',filters:p?.f||{}}}
  }catch{}
  return null;
}
function canonical(url=''){try{const u=new URL(url);u.hash='';for(const k of[...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(url||'')}}
function dedupe(xs=[]){const m=new Map();for(const x of xs){if(!x?.url)continue;const k=canonical(x.url);const old=m.get(k);m.set(k,old?{...old,...x,image:x.image||old.image,displayImage:x.displayImage||old.displayImage,price:x.price??old.price??null}:x)}return[...m.values()]}
function counts(xs=[]){return xs.reduce((o,x)=>(o[x.source||x.seller||'Other']=(o[x.source||x.seller||'Other']||0)+1,o),{})}
function mix(lower=[],open=[],broad=false){
  if(!open.length)return dedupe(lower).slice(0,broad?BROAD_MAX:EXACT_MAX);
  if(!broad)return dedupe([...open,...lower]).slice(0,EXACT_MAX);
  const os=dedupe(open).slice(0,BROAD_OPENSOOQ_QUOTA);
  const other=dedupe(lower.filter(x=>x.source!=='OpenSooq')).slice(0,BROAD_MAX-os.length);
  return dedupe([...os,...other]).slice(0,BROAD_MAX);
}
async function scan(body={}){
  if(!eligible(body))return{listings:[],errors:[],root:null};
  const broad=isBroad(body),pages=broad?5:2;
  return fetchOpenSooqUsed({pages,query:broad?'':String(body.query||''),filters:body.filters||{},nativeQuery:!broad});
}
function ensureJob(id,body){let j=jobs.get(id);if(j)return j;j={id,body,createdAt:Date.now(),complete:false,listings:[],errors:[],root:null,broad:isBroad(body)};jobs.set(id,j);scan(body).then(r=>{j.listings=r.listings||[];j.errors=r.errors||[];j.root=r.root||null}).catch(e=>j.errors=[{error:e?.message||String(e)}]).finally(()=>{j.complete=true;j.finishedAt=Date.now()});return j}
function attach(d={},j){
  if(!j)return d;
  const lower=Array.isArray(d.listings)?d.listings:[];
  const mixed=mix(lower,j.listings,j.broad);
  const listings=j.broad?mixed:filterBrandRelevance(mixed,String(j.body?.query||''));
  const lowerComplete=d.complete===true||d.marketScanComplete===true,complete=lowerComplete&&j.complete;
  return{...d,listings,counts:counts(listings),complete,marketScanComplete:complete,opensooqStructuredInventory:true,opensooqComplete:j.complete,opensooqListings:listings.filter(x=>x.source==='OpenSooq').length,opensooqFetchedListings:j.listings.length,opensooqErrors:j.errors.slice(0,8),opensooqRoot:j.root,opensooqBroadQuota:BROAD_OPENSOOQ_QUOTA,opensooqSourceMix:j.broad,opensooqBrandRelevanceGate:!j.broad};
}
async function inner(path,opts={}){const r=await fetch(`http://127.0.0.1:${innerPort}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(55000)});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,500)}};return{r,d,text}}

app.get('/api/health',async(req,res)=>{try{const{r,d}=await inner('/api/health',{signal:AbortSignal.timeout(9000)});return res.status(r.status).json({...d,edge:'dalelah-v15-volume',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||d.renderGitCommit||null,opensooqStructuredInventory:true,opensooqBroadQuota:BROAD_OPENSOOQ_QUOTA,opensooqNativeExact:true,opensooqBrandRelevanceGate:true})}catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15-volume',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,opensooqStructuredInventory:true,opensooqBrandRelevanceGate:true,error:e?.message||String(e)})}});
app.post('/api/search',async(req,res)=>{const body=req.body||{};try{const{r,d}=await inner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});if(!r.ok)return res.status(r.status).json(d);const j=d.searchId&&eligible(body)?ensureJob(String(d.searchId),body):null;return res.json(attach(d,j))}catch(e){return res.status(502).json({error:e?.message||'Dalelah OpenSooq search unavailable'})}});
app.get('/api/search/progress/:id',async(req,res)=>{const id=String(req.params.id),body=decodeBody(id),j=body&&eligible(body)?ensureJob(id,body):null;try{const{r,d}=await inner(`/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(50000)});if(!r.ok)return res.status(r.status).json(d);return res.json(attach(d,j))}catch(e){return res.status(502).json({error:e?.message||'Dalelah OpenSooq progress unavailable'})}});
app.get('/api/source-plugins',async(req,res)=>{try{const{r,d}=await inner('/api/source-plugins',{signal:AbortSignal.timeout(9000)});if(!r.ok)return res.status(r.status).json(d);let plugins=Array.isArray(d.plugins)?d.plugins:[];if(!plugins.some(p=>p.name==='OpenSooq'))plugins=[...plugins,{name:'OpenSooq',type:'marketplace',status:'active-structured-native'}];else plugins=plugins.map(p=>p.name==='OpenSooq'?{...p,status:'active-structured-native'}:p);return res.json({...d,plugins,opensooqStructuredInventory:true,opensooqNativeExact:true,opensooqBrandRelevanceGate:true})}catch(e){return res.status(502).json({error:e?.message||'Plugin registry unavailable'})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${innerPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(55000)});const buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch(e){return res.status(502).json({error:e?.message||'Dalelah unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of jobs)if(now-v.createdAt>JOB_TTL)jobs.delete(k)},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah 1.5 OpenSooq edge on ${externalPort}; exact-new core ${innerPort}`));
