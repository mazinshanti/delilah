import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_VOLUME_INNER_PORT||7000);
const JOB_TTL=25*60_000;
const MAX_RESULTS=500;
const FANOUT_CONCURRENCY=4;
process.env.PORT=String(innerPort);
await import('./server-v15-ux.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
const jobs=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const USED_QUERIES=[
  'Toyota Corolla','Toyota Camry','Toyota Yaris','Toyota Land Cruiser','Toyota Prado','Toyota Fortuner',
  'Nissan Patrol','Nissan Sunny','Nissan Altima','Nissan X-Trail',
  'Hyundai Elantra','Hyundai Sonata','Hyundai Tucson','Hyundai Accent',
  'Kia Sportage','Kia Cerato','Kia K5','Jeep Wrangler','Chevrolet Tahoe','Ford Territory',
  'Lexus ES','Lexus RX','BMW X5','Mercedes E-Class','Geely Coolray','Changan CS75','Haval H6','MG 5'
];
const NEW_QUERIES=[
  'Toyota Corolla 2026','Toyota Yaris 2026','Toyota Camry 2026','Toyota Land Cruiser 2026',
  'Hyundai Elantra 2026','Hyundai Tucson 2026','Kia Sportage 2026','Kia K5 2026',
  'Geely Preface 2026','Geely Coolray 2026','Changan Eado 2026','Changan CS75 2026',
  'Haval H6 2026','Jetour T2 2026','MG 5 2026','BYD Song Plus 2026'
];

function canonical(v=''){try{const u=new URL(v);u.hash='';for(const k of[...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(v||'')}}
function mergeInto(map,items=[]){for(const c of items||[]){if(!c?.url)continue;const k=canonical(c.url),old=map.get(k);map.set(k,old?{...old,...c,image:c.image||old.image,displayImage:c.displayImage||old.displayImage,price:c.price??old.price??null}:c);if(map.size>=MAX_RESULTS)break}}
function counts(items=[]){const out={};for(const x of items)out[x.source||'Source']=(out[x.source||'Source']||0)+1;return out}
function broadIntent(body={}){const q=String(body.query||'').trim().toLowerCase();const f=body.filters||{};return q==='__all_cars__'||q==='all cars'||q==='cars'||q==='سيارات'||(!q&&!f.seller&&!f.city&&!f.minYear&&!f.maxYear&&!f.maxPrice&&!f.maxMileage)}
async function inner(pathname,opts={}){const r=await fetch(`http://127.0.0.1:${innerPort}${pathname}`,{...opts,signal:opts.signal||AbortSignal.timeout(50000)});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,400)}};return{r,d}}
async function scanOne(query,condition,filters,map,job){
  try{
    const {r,d}=await inner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters}),signal:AbortSignal.timeout(50000)});
    if(!r.ok){job.errors.push(`${query}:HTTP ${r.status}`);return}
    mergeInto(map,d.listings||[]);
    job.completedQueries++;
    if(d.searchId&&d.complete!==true&&d.marketScanComplete!==true){
      let latest=d;
      for(let i=0;i<20;i++){
        await sleep(i===0?500:900);
        const p=await inner(`/api/search/progress/${encodeURIComponent(d.searchId)}`,{signal:AbortSignal.timeout(35000)});
        if(!p.r.ok)break;latest=p.d;mergeInto(map,latest.listings||[]);
        if(latest.complete===true||latest.marketScanComplete===true)break;
      }
    }
  }catch(e){job.errors.push(`${query}:${e?.message||e}`)}
}
function ensureJob(id,body){
  let j=jobs.get(id);if(j)return j;
  const queries=body.condition==='new'?NEW_QUERIES:USED_QUERIES;
  j={id,body,createdAt:Date.now(),complete:false,completedQueries:0,totalQueries:queries.length,listings:[],errors:[]};jobs.set(id,j);
  (async()=>{
    const map=new Map();
    for(let i=0;i<queries.length;i+=FANOUT_CONCURRENCY){
      const batch=queries.slice(i,i+FANOUT_CONCURRENCY);
      await Promise.all(batch.map(q=>scanOne(q,body.condition||'used',body.filters||{},map,j)));
      j.listings=[...map.values()].slice(0,MAX_RESULTS);
      if(j.listings.length>=MAX_RESULTS)break;
    }
    j.listings=[...map.values()].slice(0,MAX_RESULTS);j.complete=true;j.finishedAt=Date.now();
  })();
  return j;
}
function publicJob(j){return{searchId:j.id,listings:j.listings,counts:counts(j.listings),complete:j.complete,marketScanComplete:j.complete,volumeBrowse:true,volumeBrowseListings:j.listings.length,volumeQueriesComplete:j.completedQueries,volumeQueriesTotal:j.totalQueries,volumeErrors:j.errors.slice(0,12),answer:j.complete?`${j.listings.length} verified cars found across the Saudi market.`:`${j.listings.length} verified cars found so far. Dalelah is scanning the market.`}}
function idFor(body){return `vol.${Buffer.from(JSON.stringify({q:body.query||'',c:body.condition||'used',f:body.filters||{},t:Date.now()})).toString('base64url')}`}

app.get('/',async(req,res)=>{try{const r=await fetch(`http://127.0.0.1:${innerPort}/`,{signal:AbortSignal.timeout(10000)});let html=await r.text();html=html.replace("function browse(){const q=[selectedBrand,$('model').value,$('category').value].filter(Boolean).join(' ');$('q').value=q;run()}","function browse(){const q=[selectedBrand,$('model').value,$('category').value].filter(Boolean).join(' ')||'__all_cars__';$('q').value=q==='__all_cars__'?'':q;run(q)}");html=html.replace("async function run(){const query=$('q').value.trim();if(!query)return;", "async function run(forcedQuery){const query=String(forcedQuery??$('q').value).trim();if(!query)return;");return res.status(r.status).type('html').send(html)}catch(e){return res.status(502).send(`Dalelah UI unavailable: ${e?.message||e}`)}});
app.get('/api/health',async(req,res)=>{try{const {r,d}=await inner('/api/health',{signal:AbortSignal.timeout(8000)});return res.status(r.status).json({...d,edge:'dalelah-v15-volume',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||d.renderGitCommit||null,volumeBrowse:true,volumeBrowseMaxResults:MAX_RESULTS})}catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15-volume',productVersion:'1.5',volumeBrowse:true,error:e?.message||'health unavailable'})}});
app.post('/api/search',async(req,res)=>{const body=req.body||{};if(!broadIntent(body)){const {r,d}=await inner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(50000)});return res.status(r.status).json(d)}const id=idFor(body);const j=ensureJob(id,{...body,query:'__all_cars__'});return res.json(publicJob(j))});
app.get('/api/search/progress/:id',async(req,res)=>{const id=String(req.params.id);if(id.startsWith('vol.')){const j=jobs.get(id);if(!j)return res.status(404).json({error:'Search expired'});return res.json(publicJob(j))}const {r,d}=await inner(`/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(40000)});return res.status(r.status).json(d)});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${innerPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)});const buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch(e){return res.status(502).json({error:e?.message||'Dalelah unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of jobs)if(now-v.createdAt>JOB_TTL)jobs.delete(k)},60000).unref();
app.listen(externalPort,()=>console.log(`Dalelah 1.5 volume edge listening on ${externalPort}; UX core ${innerPort}`));
