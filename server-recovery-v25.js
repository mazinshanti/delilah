import express from 'express';
import path from 'path';
import {exactYearIntent,enforceExactYear} from './lib/search-intent.js';

const externalPort=Number(process.env.PORT||3000);
const upstreamPort=Number(process.env.DALELAH_V24_PORT||6100);
process.env.PORT=String(upstreamPort);
await import('./server-v24.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(process.cwd(),'public')));
const searchState=new Map();
const SEARCH_STATE_TTL=20*60_000;
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const canonical=v=>{try{const u=new URL(v);u.hash='';return u.href.replace(/\/$/,'')}catch{return String(v||'')}};
const BRAND_MODELS={
  toyota:['Camry','Corolla','Land Cruiser','Prado','Yaris','Fortuner','Hilux','RAV4'],
  nissan:['Patrol','Sunny','Altima','X-Trail','Pathfinder','Kicks','X-Terra'],
  hyundai:['Accent','Elantra','Sonata','Tucson','Santa Fe','Palisade'],
  kia:['Sportage','Cerato','K5','Sorento','Pegas','Carnival'],
  jeep:['Wrangler','Grand Cherokee','Gladiator','Compass'],
  ford:['Taurus','Territory','Explorer','Expedition','Everest','Ranger','F-150','Bronco'],
  chevrolet:['Tahoe','Suburban','Traverse','Captiva','Silverado','Camaro'],
  lexus:['ES','RX','LX','NX','GX'],
  bmw:['X3','X5','X6','X7','3 Series','5 Series'],
  mercedes:['C-Class','E-Class','S-Class','GLC','GLE','GLS','G-Class']
};
const GENERAL=['Toyota Camry','Toyota Corolla','Toyota Land Cruiser','Toyota Prado','Nissan Patrol','Nissan Sunny','Hyundai Tucson','Hyundai Elantra','Kia Sportage','Kia K5','Jeep Wrangler','Ford Taurus','Ford Territory','Chevrolet Tahoe','Lexus ES','Lexus RX','BMW X5','Mercedes GLE'];
const SUV=['Toyota Land Cruiser','Toyota Prado','Toyota Fortuner','Nissan Patrol','Nissan X-Trail','Hyundai Tucson','Hyundai Santa Fe','Kia Sportage','Kia Sorento','Jeep Wrangler','Jeep Grand Cherokee','Ford Explorer','Ford Expedition','Chevrolet Tahoe','Lexus RX','Lexus LX','BMW X5','Mercedes GLE'];

async function upstreamSearch(body){
  const r=await fetch(`http://127.0.0.1:${upstreamPort}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,300)}};return{r,d};
}
function titleFromUrl(c){
  try{
    const u=new URL(c.url||'');
    let slug=u.pathname.split('/').filter(Boolean).pop()||'';
    slug=slug.replace(/-(?:used|new)-\d+$/i,'').replace(/-for-sale-in-[^-]+-\d+$/i,'').replace(/-\d+$/,'');
    const words=slug.split('-').filter(Boolean).map(x=>x.length<=3?x.toUpperCase():x[0].toUpperCase()+x.slice(1));
    return words.join(' ');
  }catch{return''}
}
function clean(c){
  if(!c)return c;
  const t=String(c.title||'').trim();
  const bad=!t||/^\d[\d,\.]*\s*(?:sar|ريال|ر\.?س)?$/i.test(t)||/^(call for price|price on request)$/i.test(t);
  if(!bad)return c;
  const derived=titleFromUrl(c);
  return derived?{...c,title:derived}:c;
}
function merge(groups=[]){const m=new Map();for(const g of groups)for(const raw of(g||[])){if(!raw?.url)continue;const c=clean(raw),k=canonical(c.url),o=m.get(k);m.set(k,o?{...c,...o,image:o.image||c.image,displayImage:o.displayImage||c.displayImage,price:o.price??c.price??null,title:clean(o).title||clean(c).title}:c)}return[...m.values()];}
function fanoutQueries(q){
  const n=norm(q);
  if(/\bsuv\b|دفع رباعي/.test(n))return SUV;
  for(const [b,models] of Object.entries(BRAND_MODELS))if(n===b||n===`${b} cars`)return models.map(m=>`${b} ${m}`);
  if(/^(?:used cars|cars riyadh|used cars riyadh|سيارات مستعمل|سيارات مستعمله)(?:\s|$)/.test(n))return GENERAL;
  return[];
}
function counts(xs){return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});}
function hasExplicitYearFilters(body={}){return Boolean(body?.filters?.minYear||body?.filters?.maxYear);}
function exactListings(xs,y){return enforceExactYear(xs,y,{requireEvidence:true});}
function exactBodyFor(state={}){return state.exactYear?{...state.body,filters:{...(state.body?.filters||{}),minYear:state.exactYear,maxYear:state.exactYear}}:state.body||{};}
function filtered(xs=[],state={}){const cleanList=(xs||[]).map(clean);return state.exactYear?exactListings(cleanList,state.exactYear):cleanList;}
function combinedListings(base=[],state={}){let xs=merge([filtered(base,state),state.edgeListings||[]]);if(state.exactYear)xs=exactListings(xs,state.exactYear);return xs.slice(0,500);}
function safeFilters(raw={}){
  const out={};
  for(const k of['minYear','maxYear','maxPrice','maxMileage','city','seller','sourceType','sort'])if(raw&&raw[k]!=null&&String(raw[k]).length<=120)out[k]=raw[k];
  return out;
}
function makeSearchId(state={}){
  const payload={v:1,q:String(state.body?.query||'').slice(0,300),c:state.body?.condition==='new'?'new':'used',f:safeFilters(state.body?.filters||{}),y:state.exactYear||null,u:state.internalSearchId||null};
  return `d15.${Buffer.from(JSON.stringify(payload),'utf8').toString('base64url')}`;
}
function stateFromSearchId(externalId=''){
  if(!String(externalId).startsWith('d15.')||String(externalId).length>1800)return null;
  try{
    const raw=Buffer.from(String(externalId).slice(4),'base64url').toString('utf8');
    const p=JSON.parse(raw);
    if(p?.v!==1||typeof p.q!=='string'||p.q.length>300||!['used','new'].includes(p.c))return null;
    const body={query:p.q,condition:p.c,filters:safeFilters(p.f||{})};
    const y=Number(p.y)||null;
    return{body,exactYear:y,internalSearchId:p.u?String(p.u):null,externalId:String(externalId),initialListings:[],edgeListings:[],fanoutQueries:fanoutQueries(p.q),edgeRecoveryComplete:false,edgeRecoveryStarted:false,exactRecovery:false,at:Date.now(),recoveries:0,reconstructed:true};
  }catch{return null;}
}
function decorate(d={},state={},extra={}){
  const base=Array.isArray(d.listings)?d.listings:[];
  const listings=combinedListings(base,state);
  const upstreamComplete=d.complete===true||d.marketScanComplete===true;
  const complete=upstreamComplete&&state.edgeRecoveryComplete!==false;
  return{
    ...d,
    ...extra,
    searchId:state.externalId||d.searchId,
    listings,
    counts:counts(listings),
    complete,
    marketScanComplete:complete,
    exactYearIntent:state.exactYear||null,
    exactRecovery:Boolean(state.exactRecovery),
    exactYearFiltered:state.exactYear?Math.max(0,base.length-filtered(base,state).length):0,
    recoveryFanout:{active:Boolean(state.fanoutQueries?.length),queries:state.fanoutQueries?.length||0,total:listings.length,pending:state.edgeRecoveryComplete===false},
    searchRecoveryCount:state.recoveries||0,
    searchStateReconstructed:Boolean(state.reconstructed),
    product:{...(d.product||{}),recovery:'v25-progressive'}
  };
}
async function runEdgeRecovery(state){
  if(state.edgeRecoveryStarted)return;
  state.edgeRecoveryStarted=true;
  state.edgeRecoveryComplete=false;
  state.at=Date.now();
  try{
    const collected=[];
    const q=String(state.body?.query||'');
    if(state.exactYear&&state.initialListings.length===0){
      const relaxed=q.replace(new RegExp(`\\b${state.exactYear}\\b`),'').replace(/\s+/g,' ').trim();
      if(relaxed){
        const z=await upstreamSearch({...state.body,query:relaxed,filters:{...(state.body?.filters||{}),minYear:'',maxYear:''}}).catch(()=>null);
        if(z?.r?.ok){
          const recovered=exactListings(merge([z.d.listings||[]]),state.exactYear);
          if(recovered.length){collected.push(recovered);state.exactRecovery=true;}
        }
      }
    }
    if((state.initialListings.length+(state.edgeListings?.length||0))<100&&state.fanoutQueries.length){
      const batches=[];
      for(let i=0;i<state.fanoutQueries.length;i+=6){
        const part=state.fanoutQueries.slice(i,i+6);
        const settled=await Promise.all(part.map(x=>upstreamSearch({...state.body,query:x,filters:{...(state.body?.filters||{}),...(state.exactYear?{minYear:state.exactYear,maxYear:state.exactYear}:{})}}).then(z=>z.r.ok?(z.d.listings||[]).map(clean):[]).catch(()=>[])));
        batches.push(...settled);
        let merged=merge([state.initialListings,...collected,...batches]);
        if(state.exactYear)merged=exactListings(merged,state.exactYear);
        if(merged.length>=400)break;
      }
      collected.push(...batches);
    }
    let edge=merge(collected);
    if(state.exactYear)edge=exactListings(edge,state.exactYear);
    state.edgeListings=edge.slice(0,500);
  }finally{
    state.edgeRecoveryComplete=true;
    state.edgeRecoveryStarted=false;
    state.at=Date.now();
  }
}
async function restartState(state){
  const restarted=await upstreamSearch(exactBodyFor(state));
  if(!restarted.r.ok)return restarted;
  state.recoveries=(state.recoveries||0)+1;
  state.at=Date.now();
  state.internalSearchId=restarted.d.searchId?String(restarted.d.searchId):null;
  state.initialListings=filtered(restarted.d.listings||[],state);
  state.edgeListings=[];
  state.edgeRecoveryStarted=false;
  const needsEdgeRecovery=Boolean((state.exactYear&&state.initialListings.length===0)||(state.initialListings.length<100&&state.fanoutQueries.length));
  state.edgeRecoveryComplete=!needsEdgeRecovery;
  if(needsEdgeRecovery)runEdgeRecovery(state).catch(()=>{state.edgeRecoveryComplete=true;state.edgeRecoveryStarted=false;state.at=Date.now();});
  searchState.set(state.externalId,state);
  return restarted;
}

app.get('/api/health',async(req,res)=>{
  try{
    const r=await fetch(`http://127.0.0.1:${upstreamPort}/api/health`,{signal:AbortSignal.timeout(7000)});
    const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={}};
    if(!r.ok)return res.status(r.status).json(d);
    return res.json({...d,edge:'dalelah-v15',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,progressiveEdgeRecovery:true,exactYearEdgeGuard:true,restartSafeSearchIds:true});
  }catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,restartSafeSearchIds:true,error:e?.message||'health unavailable'});}
});
app.post('/api/search',async(req,res)=>{
  const body=req.body||{},q=String(body.query||'');
  try{
    const y=hasExplicitYearFilters(body)?null:exactYearIntent(q);
    const exactBody=y?{...body,filters:{...(body.filters||{}),minYear:y,maxYear:y}}:body;
    const first=await upstreamSearch(exactBody);if(!first.r.ok)return res.status(first.r.status).json(first.d);
    const initial=filtered(first.d.listings||[],{exactYear:y});
    const fq=fanoutQueries(q);
    const needsEdgeRecovery=Boolean((y&&initial.length===0)||(initial.length<100&&fq.length));
    const needsProgress=Boolean(first.d.searchId||first.d.complete===false||first.d.marketScanComplete===false||needsEdgeRecovery);
    const state={body:{...body,condition:body.condition==='new'?'new':'used',filters:safeFilters(body.filters||{})},exactYear:y,internalSearchId:first.d.searchId?String(first.d.searchId):null,externalId:null,initialListings:initial,edgeListings:[],fanoutQueries:fq,edgeRecoveryComplete:!needsEdgeRecovery,edgeRecoveryStarted:false,exactRecovery:false,at:Date.now(),recoveries:0,reconstructed:false};
    if(needsProgress){state.externalId=makeSearchId(state);searchState.set(state.externalId,state);if(needsEdgeRecovery)runEdgeRecovery(state).catch(()=>{state.edgeRecoveryComplete=true;state.edgeRecoveryStarted=false;state.at=Date.now();});}
    const out=decorate({...first.d,listings:initial},state);
    if(!needsProgress)delete out.searchId;
    return res.json(out);
  }catch(e){return res.status(502).json({error:e?.message||'Dalelah recovery search unavailable'})}
});
app.get('/api/search/progress/:id',async(req,res)=>{
  try{
    const externalId=String(req.params.id);
    let state=searchState.get(externalId);
    if(!state){
      state=stateFromSearchId(externalId);
      if(!state)return res.status(404).json({error:'Search expired'});
      searchState.set(externalId,state);
      if(state.edgeRecoveryComplete===false)runEdgeRecovery(state).catch(()=>{state.edgeRecoveryComplete=true;state.edgeRecoveryStarted=false;state.at=Date.now();});
    }
    state.at=Date.now();

    if(!state.internalSearchId){
      const restarted=await restartState(state);
      if(!restarted.r.ok)return res.status(restarted.r.status).json(restarted.d);
      return res.json(decorate(restarted.d,state,{searchRecovered:true}));
    }

    const internalId=String(state.internalSearchId);
    const r=await fetch(`http://127.0.0.1:${upstreamPort}/api/search/progress/${encodeURIComponent(internalId)}`,{signal:AbortSignal.timeout(20000)});
    const text=await r.text();
    const contentType=r.headers.get('content-type')||'application/json';
    let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,300)}};

    const expired=r.status===404&&/search expired/i.test(String(d?.error||''));
    if(expired&&state.recoveries<3){
      const restarted=await restartState(state);
      if(restarted.r.ok)return res.json(decorate(restarted.d,state,{searchRecovered:true}));
      return res.status(restarted.r.status).json(restarted.d);
    }

    if(!contentType.includes('application/json'))return res.status(r.status).type(contentType).send(text);
    if(!r.ok)return res.status(r.status).json(d);
    state.at=Date.now();
    searchState.set(externalId,state);
    return res.json(decorate(d,state));
  }catch(e){res.status(502).json({error:e?.message||'progress unavailable'})}
});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(30000)});const buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);res.status(r.status).send(buf)}catch(e){res.status(502).json({error:e?.message||'upstream unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of searchState)if(now-v.at>SEARCH_STATE_TTL)searchState.delete(k);},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah recovery-v25 progressive fanout + restart-safe search IDs running at http://localhost:${externalPort} -> v24 ${upstreamPort}`));
