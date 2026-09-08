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
function fanoutQueries(q){const n=norm(q);if(/\bsuv\b|دفع رباعي|جيب/.test(n))return SUV;for(const [b,models] of Object.entries(BRAND_MODELS))if(n===b||n===b+' cars'||n.includes(' '+b+' ')||n.startsWith(b+' '))return models.map(m=>`${b} ${m}`);if(/used cars|cars riyadh|سيارات مستعمل/.test(n))return GENERAL;return[];}
function counts(xs){return xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});}
function hasExplicitYearFilters(body={}){return Boolean(body?.filters?.minYear||body?.filters?.maxYear);}

app.post('/api/search',async(req,res)=>{
  const body=req.body||{},q=String(body.query||'');
  try{
    const y=hasExplicitYearFilters(body)?null:exactYearIntent(q);
    const exactBody=y?{...body,filters:{...(body.filters||{}),minYear:y,maxYear:y}}:body;
    const first=await upstreamSearch(exactBody);if(!first.r.ok)return res.status(first.r.status).json(first.d);
    const initial=Array.isArray(first.d.listings)?first.d.listings.map(clean):[];
    let listings=y?enforceExactYear(initial,y):initial;
    let exactRecovery=false;
    let relaxed='';

    if(y&&listings.length===0){
      relaxed=q.replace(new RegExp(`\\b${y}\\b`),'').replace(/\s+/g,' ').trim();
      if(relaxed){
        const z=await upstreamSearch({...body,query:relaxed,filters:{...(body.filters||{}),minYear:'',maxYear:''}}).catch(()=>null);
        if(z?.r?.ok){
          listings=enforceExactYear(merge([z.d.listings||[]]),y);
          exactRecovery=true;
        }
      }
    }

    const fq=fanoutQueries(q);
    if(listings.length<100&&fq.length){
      const batches=[];
      for(let i=0;i<fq.length;i+=6){
        const part=fq.slice(i,i+6);
        const settled=await Promise.all(part.map(x=>upstreamSearch({...body,query:x,filters:{...(body.filters||{}),...(y?{minYear:y,maxYear:y}:{})}}).then(z=>z.r.ok?(z.d.listings||[]).map(clean):[]).catch(()=>[])));
        batches.push(...settled);
        const merged=y?enforceExactYear(merge([listings,...batches]),y):merge([listings,...batches]);
        if(merged.length>=400)break;
      }
      listings=merge([listings,...batches]);
      if(y)listings=enforceExactYear(listings,y);
      listings=listings.slice(0,500);
    }

    const out={...first.d,listings,counts:counts(listings),recoveryFanout:{active:Boolean(fq.length),queries:fq.length,total:listings.length},exactYearIntent:y,exactRecovery,exactYearFiltered:y?Math.max(0,initial.length-enforceExactYear(initial,y).length):0,product:{...(first.d.product||{}),recovery:'v25-fanout'}};
    return res.json(out);
  }catch(e){return res.status(502).json({error:e?.message||'Dalelah recovery search unavailable'})}
});
app.get('/api/search/progress/:id',async(req,res)=>{try{const r=await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`,{signal:AbortSignal.timeout(20000)});const t=await r.text();res.status(r.status).type(r.headers.get('content-type')||'application/json').send(t)}catch(e){res.status(502).json({error:e?.message||'progress unavailable'})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(30000)});const buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);res.status(r.status).send(buf)}catch(e){res.status(502).json({error:e?.message||'upstream unavailable'})}}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah recovery-v25 fanout + native UI running at http://localhost:${externalPort} -> v24 ${upstreamPort}`));
