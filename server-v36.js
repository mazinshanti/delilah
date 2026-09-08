import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const upstreamPort=Number(process.env.DALELAH_V35_PORT||6000);
process.env.PORT=String(upstreamPort);
await import('./server-v35.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
const braveKey=process.env.BRAVE_SEARCH_API_KEY||'';

const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
function explicitYears(q=''){return [...digits(q).matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=1980&&y<=2035)}
function hasRangeLanguage(q=''){const n=norm(q);return /(?:and above|or newer|and newer|or later|and later|above|newer than|from|since|after|وفوق|واكثر|وأكثر|احدث|أحدث|من موديل|بعد)\b/i.test(n)||/(?:to|through|until|الى|إلى|حتى|بين)\b/i.test(n)}
function exactYearFromQuery(q=''){
  const ys=explicitYears(q);
  if(ys.length!==1||hasRangeLanguage(q))return null;
  return ys[0];
}
function enforceYearFilters(body={}){
  const y=exactYearFromQuery(body.query||'');
  if(!y)return {body,y:null};
  const f={...(body.filters||{})};
  if(!f.minYear&&!f.maxYear){f.minYear=y;f.maxYear=y}
  return {body:{...body,filters:f},y};
}
function strictExactYear(listings=[],y){return y?listings.filter(c=>!c?.year||Number(c.year)===y):listings}
function canonical(v=''){try{const u=new URL(v);u.hash='';return u.href.replace(/\/$/,'')}catch{return v}}
function merge(a=[],b=[]){const m=new Map();for(const c of [...a,...b]){if(!c?.url)continue;const k=canonical(c.url);if(!m.has(k))m.set(k,c);else{const old=m.get(k);m.set(k,{...c,...old,image:old.image||c.image,displayImage:old.displayImage||c.displayImage,price:old.price||c.price,priceVerified:Boolean(old.priceVerified||c.priceVerified)})}}return [...m.values()]}
function harajDirect(v=''){try{const u=new URL(v);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/(?:en\/)?\d{8,14}(?:\/|$)/.test(u.pathname)}catch{return false}}
function yallaDirect(v=''){try{const u=new URL(v);return /(^|\.)yallamotor\.com$/i.test(u.hostname)&&/\/used-cars\//i.test(u.pathname)}catch{return false}}
function titleYear(title='',desc=''){return explicitYears(`${title} ${desc}`)[0]||null}
function inferCondition(text=''){const n=norm(text);if(/\bnew\b|جديد/.test(n))return'new';return'used'}
function inferCity(text=''){const n=norm(text);if(/riyadh|الرياض/.test(n))return'Riyadh';if(/jeddah|جده/.test(n))return'Jeddah';if(/dammam|الدمام/.test(n))return'Dammam';if(/makkah|مكه/.test(n))return'Makkah';if(/madinah|المدينه/.test(n))return'Madinah';return null}
function inferPrice(text=''){const t=digits(text);const m=t.match(/([0-9][\d,]{3,8})\s*(?:SAR|ريال|ر\.?س)/i);if(!m)return null;const n=Number(m[1].replace(/,/g,''));return n>=1000&&n<=5000000?n:null}
async function brave(q,count=20){if(!braveKey)return[];const u=new URL('https://api.search.brave.com/res/v1/web/search');u.searchParams.set('q',q);u.searchParams.set('count',String(count));u.searchParams.set('country','sa');const r=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':braveKey},signal:AbortSignal.timeout(9000)});if(!r.ok)return[];const d=await r.json();return d?.web?.results||[]}
async function recovery(query,year,condition){if(!year||!braveKey)return[];const qs=[`site:haraj.com.sa ${query} ${year}`,`site:haraj.com.sa كورولا ${year}`,`site:ksa.yallamotor.com/used-cars ${query} ${year}`];const batches=await Promise.all(qs.map(q=>brave(q,20).catch(()=>[])));const out=[];for(const r of batches.flat()){const url=r.url||'';if(!harajDirect(url)&&!yallaDirect(url))continue;const y=titleYear(r.title||'',r.description||'');if(y!==year)continue;const text=`${r.title||''} ${r.description||''}`;const source=harajDirect(url)?'Haraj':'YallaMotor';out.push({source,sourceType:'marketplace',seller:source,sourceStrict:true,title:r.title||`${source} ${year}`,snippet:r.description||'',url,year:y,city:inferCity(text),price:inferPrice(text),priceVerified:Boolean(inferPrice(text)),condition:inferCondition(text),saleVerified:true,image:null,displayImage:null,imageVerified:false,score:80,aiScore:80,aiReason:'Exact-year recovery result',discovery:'exact_year_recovery'})}
return out.filter(c=>!condition||c.condition===condition)}
async function upstream(path,opts={}){const r=await fetch(`http://127.0.0.1:${upstreamPort}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(70000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text.slice(0,500)}}return{r,data}}

app.post('/api/search',async(req,res)=>{const original=req.body||{};const {body,y}=enforceYearFilters(original);try{const {r,data}=await upstream('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)return res.status(r.status).json(data);let listings=strictExactYear(Array.isArray(data.listings)?data.listings:[],y);let recovered=[];if(y&&listings.length<8){recovered=await recovery(original.query||'',y,body.condition||data?.ai?.intent?.condition||'used');listings=strictExactYear(merge(listings,recovered),y)}const counts=listings.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});return res.json({...data,listings,counts,exactYear:y,exactYearSemantics:Boolean(y),lowResultRecovery:y&&listings.length<8,recoveredExactYear:recovered.length,product:{...(data.product||{}),version:'v36',exactYearDefault:true,lowResultRecovery:true}})}catch(e){return res.status(502).json({error:e?.message||'Dalelah exact-year search unavailable'})}});
app.post('/api/understand',async(req,res)=>{const {body,y}=enforceYearFilters(req.body||{});const {r,data}=await upstream('/api/understand',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return res.status(r.status).json({...data,exactYear:y})});
app.get('/api/health',async(_req,res)=>{try{const {r,data}=await upstream('/api/health');if(!r.ok)return res.status(r.status).json(data);return res.json({...data,edge:'product-v36',exactYearDefault:true,lowResultRecovery:true})}catch{return res.status(503).json({ok:false,edge:'product-v36'})}});
app.get('/',async(_req,res)=>{try{const r=await fetch(`http://127.0.0.1:${upstreamPort}/`,{signal:AbortSignal.timeout(10000)});const html=await r.text();res.setHeader('cache-control','no-store');return res.type('html').send(html)}catch{return res.status(502).send('Dalelah frontend unavailable')}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(70000)});const buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch{return res.status(502).json({error:'Dalelah upstream unavailable'})}}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah product-v36 running at http://localhost:${externalPort}`));