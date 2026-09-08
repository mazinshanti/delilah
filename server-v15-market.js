import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const corePort=Number(process.env.DALELAH_CORE_PORT||6300);
const CACHE_TTL=10*60_000;
const JOB_TTL=20*60_000;
const FETCH_TIMEOUT=8500;
const MAX_PAGES=3;

process.env.PORT=String(corePort);
await import('./server-recovery-v25.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

const pageCache=new Map();
const jobs=new Map();
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeUrl=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u:null}catch{return null}};
const canonical=v=>{const u=safeUrl(v);if(!u)return String(v||'');u.hash='';for(const k of[...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')};
const absolute=(v,b)=>{try{return new URL(String(v||'').replace(/&amp;/g,'&'),b).href}catch{return null}};
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const strip=s=>decode(String(s||'')).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const num=(v,min=0,max=5_000_000)=>{const n=Number(String(v||'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>=min&&n<=max?n:null};
const slug=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const titleCase=s=>String(s||'').split(/[\s-]+/).filter(Boolean).map(x=>x.length<=3?x.toUpperCase():x[0].toUpperCase()+x.slice(1)).join(' ');

const ALIAS=new Map([
  ['تويوتا','toyota'],['نيسان','nissan'],['جيب','jeep'],['هيونداي','hyundai'],['كيا','kia'],['فورد','ford'],['شفروليه','chevrolet'],['مرسيدس','mercedes-benz'],['لكزس','lexus'],['بورش','porsche'],['مازدا','mazda'],['هوندا','honda'],['ميتسوبيشي','mitsubishi'],['جيلي','geely'],['شانجان','changan'],['جيتور','jetour'],['هافال','haval'],['اودي','audi'],['جينيسيس','genesis'],['فولكس','volkswagen'],['بي ام دبليو','bmw'],['بي ام','bmw'],['لاند روفر','land-rover'],['رينج روفر','range-rover'],['كاديلاك','cadillac'],['جي ام سي','gmc'],['دودج','dodge'],['سوزوكي','suzuki'],['بيجو','peugeot'],['رينو','renault'],['شيري','chery'],['تسلا','tesla'],['لوسيد','lucid'],
  ['رانجلر','wrangler'],['باترول','patrol'],['لاند كروزر','land-cruiser'],['لاندكروزر','land-cruiser'],['كامري','camry'],['كورولا','corolla'],['يارس','yaris'],['صني','sunny'],['توسان','tucson'],['سبورتاج','sportage'],['تاهو','tahoe'],['سوناتا','sonata'],['اكسنت','accent'],['النترا','elantra'],['برادو','prado'],['فورتشنر','fortuner'],['اكسبلورر','explorer'],['جراند شيروكي','grand-cherokee'],['كايين','cayenne'],['تيجوان','tiguan'],['بيجاس','pegas'],['سيراتو','cerato'],['سورينتو','sorento'],['جوليون','jolion'],['كولراي','coolray'],['امجراند','emgrand']
]);
const BRANDS=['mercedes-benz','land-rover','range-rover','volkswagen','chevrolet','mitsubishi','hyundai','toyota','nissan','lexus','porsche','ford','lincoln','kia','mazda','honda','geely','changan','jetour','haval','audi','bmw','gmc','dodge','suzuki','peugeot','renault','chery','tesla','lucid','jeep'];
const MODEL_BRAND=new Map([
  ['wrangler','jeep'],['grand-cherokee','jeep'],['patrol','nissan'],['sunny','nissan'],['land-cruiser','toyota'],['camry','toyota'],['corolla','toyota'],['yaris','toyota'],['prado','toyota'],['fortuner','toyota'],['accent','hyundai'],['elantra','hyundai'],['sonata','hyundai'],['tucson','hyundai'],['pegas','kia'],['cerato','kia'],['sportage','kia'],['sorento','kia'],['k5','kia'],['accord','honda'],['civic','honda'],['city','honda'],['h6','haval'],['jolion','haval'],['coolray','geely'],['emgrand','geely'],['x5','bmw'],['territory','ford'],['tahoe','chevrolet']
]);
const STOP=new Set(norm('ابي ابغى اريد سيارة سياره سيارات car cars vehicle vehicles used new مستعمل مستعملة مستعمله جديد جديده جديدة موديل model سنة سنه year years وفوق واكثر تحت اقل أقل من الى إلى في بالرياض الرياض بجدة بجده جدة جده بالدمام الدمام السعودية السعوديه saudi arabia ksa riyadh jeddah dammam under below less than above over more than around about budget ريال sar km كيلو كم').split(' '));
function identity(query=''){
  let q=norm(query);
  for(const[a,b]of[...ALIAS.entries()].sort((x,y)=>y[0].length-x[0].length))q=q.replaceAll(norm(a),b.replace(/-/g,' '));
  let brand=BRANDS.find(b=>q.includes(b.replace(/-/g,' ')))||null;
  let toks=q.split(' ').filter(t=>t&&!STOP.has(t)&&!/^\d/.test(t)&&!['riyadh','jeddah','dammam','saudi','arabia'].includes(t));
  if(brand){const bw=brand.replace(/-/g,' ').split(' ');for(let i=0;i<=toks.length-bw.length;i++)if(bw.every((w,j)=>toks[i+j]===w)){toks.splice(i,bw.length);break}}
  let model=toks.slice(0,3).join('-')||null;
  if(!brand&&model){const k=[...MODEL_BRAND.keys()].sort((a,b)=>b.length-a.length).find(k=>model.includes(k)||q.includes(k.replace(/-/g,' ')));if(k){brand=MODEL_BRAND.get(k);model=k}}
  return{brand,model};
}
function exactYear(body={}){
  const f=body.filters||{};
  if(Number(f.minYear)&&Number(f.maxYear)&&Number(f.minYear)===Number(f.maxYear))return Number(f.minYear);
  const q=digits(String(body.query||''));
  const years=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  if(years.length!==1)return null;
  if(/\b(?:from|since|after|newer|above|over)\b|\+|وفوق|واكثر|أكثر|من\s*20\d{2}|(?:20\d{2})\s*(?:-|to|الى|إلى)\s*20\d{2}/i.test(q))return null;
  return years[0];
}
function cityFromPath(url=''){
  const u=safeUrl(url);if(!u)return null;
  const parts=u.pathname.split('/').filter(Boolean);const i=parts.indexOf('cars-for-sale');const maybe=i>=0?parts[i+1]||'':'';
  if(!/-haraj$/i.test(maybe))return null;
  const x=maybe.replace(/-haraj$/i,'').replace(/-/g,' ');
  const map={riyadh:'Riyadh',jeddah:'Jeddah',dammam:'Dammam','al khobar':'Khobar',makkah:'Makkah',madinah:'Madinah',mecca:'Makkah'};
  return map[x]||titleCase(x);
}
function yearFromUrl(url=''){const u=safeUrl(url);if(!u)return null;const m=u.pathname.match(/\/(20\d{2})\/\d+\/?$/);return m?Number(m[1]):null}
function directMotory(url=''){const u=safeUrl(url);return!!u&&(u.hostname==='motory.com'||u.hostname.endsWith('.motory.com'))&&/^\/en\/cars-for-sale\/(?:[^/]+-haraj\/)?[^/]+\/[^/]+\/20\d{2}\/\d+\/?$/i.test(u.pathname)}
function priceOf(text=''){
  const t=digits(text);
  for(const re of[/(?:Cash Price(?: with VAT)?|Selling Price)[^0-9]{0,45}([0-9][\d,]{3,})/i,/(?:سعر الكاش|سعر البيع)[^0-9]{0,45}([0-9][\d,]{3,})/i,/([0-9][\d,]{3,})\s*(?:SAR|SR|ريال)/i]){const m=t.match(re),p=m?num(m[1],3000,5_000_000):null;if(p)return p}
  return null;
}
function mileageOf(text=''){
  const t=digits(text);
  let m=t.match(/([0-9][\d,]{1,8})\s*\+\s*(?:km|kilometers?|كم|كيلو)/i);if(m)return num(m[1],0,1_500_000);
  m=t.match(/([0-9][\d,]{1,8})\s*-\s*([0-9][\d,]{1,8})\s*(?:km|kilometers?|كم|كيلو)/i);if(m)return num(m[2],0,1_500_000)||num(m[1],0,1_500_000);
  m=t.match(/([0-9][\d,]{1,8})\s*(?:km|kilometers?|كم|كيلو)/i);return m?num(m[1],0,1_500_000):null;
}
function imageOf(html='',base=''){
  for(const m of String(html).matchAll(/<(?:img|source)\b[^>]*>/gi)){
    const tag=m[0];
    for(const k of['src','data-src','data-lazy-src','data-original']){const v=new RegExp(`${k}=["']([^"']+)["']`,'i').exec(tag)?.[1],u=absolute(v,base);if(u&&!/(logo|icon|placeholder|avatar|profile|sprite|banner)/i.test(u))return u}
  }
  return null;
}
async function fetchHtml(url){
  const key=canonical(url),hit=pageCache.get(key);if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.d;
  const r=await fetch(key,{redirect:'follow',signal:AbortSignal.timeout(FETCH_TIMEOUT),headers:{'User-Agent':'Mozilla/5.0 (compatible; DalelahMotoryCatalog/1.0)',Accept:'text/html,application/xhtml+xml'}});
  if(!r.ok)throw new Error(`Motory HTTP ${r.status}`);
  const d={html:(await r.text()).slice(0,4_000_000),url:r.url||key};pageCache.set(key,{at:Date.now(),d});return d;
}
function parseMotory(html='',base='',body={}){
  const id=identity(body.query),wantedYear=exactYear(body),out=[],seen=new Set();
  for(const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/href=["']([^"']+)["']/i.exec(m[1])?.[1],url=canonical(absolute(href,base));
    if(!url||!directMotory(url)||seen.has(url))continue;seen.add(url);
    const year=yearFromUrl(url);if(wantedYear&&year!==wantedYear)continue;
    const start=Math.max(0,(m.index||0)-1800),end=Math.min(String(html).length,(m.index||0)+m[0].length+2800),seg=String(html).slice(start,end),text=strip(seg);
    const city=cityFromPath(url),price=priceOf(strip(m[0]))||priceOf(text.slice(0,2500)),mileage=mileageOf(strip(m[0]))||mileageOf(text.slice(0,2500)),image=imageOf(m[0],base)||imageOf(seg,base);
    const titleText=strip(m[2]).replace(/Images?\s*&\s*Specifications?/gi,'').trim();
    const title=titleText.length>=8&&titleText.length<=180?titleText:`${titleCase(id.brand)} ${titleCase(id.model)} ${year}`.trim();
    out.push({source:'Motory',sourceType:'marketplace',seller:'Motory',sourceStrict:true,title,snippet:text.slice(0,650),url,brand:id.brand?titleCase(id.brand):null,model:id.model?titleCase(id.model):null,year,mileage,city,price,priceVerified:Boolean(price),priceSource:price?'motory_source_catalog_price':null,condition:'used',saleVerified:true,saleEvidence:['motory_direct_listing_url','motory_source_catalog'],image:image||null,displayImage:image||null,imageVerified:Boolean(image),imageSource:image?'motory_source_catalog':null,score:92,discovery:'motory_source_native_catalog',motoryNativeVerified:true});
  }
  return out;
}
function strictFilter(c,body={}){
  const f=body.filters||{},y=exactYear(body);
  if(body.condition==='new'||c.condition!=='used')return false;
  if(y&&Number(c.year)!==y)return false;
  if(f.minYear&&Number(c.year)<Number(f.minYear))return false;
  if(f.maxYear&&Number(c.year)>Number(f.maxYear))return false;
  if(f.maxPrice&&(!c.priceVerified||c.price==null||Number(c.price)>Number(f.maxPrice)))return false;
  if(f.maxMileage&&(c.mileage==null||Number(c.mileage)>Number(f.maxMileage)))return false;
  if(f.city&&norm(c.city||'')!==norm(f.city))return false;
  if(f.seller&&norm(f.seller)!==norm('Motory'))return false;
  if(f.sourceType&&f.sourceType!=='marketplace')return false;
  return true;
}
async function scanMotory(body={}){
  const id=identity(body.query),y=exactYear(body);if(body.condition==='new'||!id.brand||!id.model)return[];
  if(body.filters?.seller&&norm(body.filters.seller)!==norm('Motory'))return[];
  if(body.filters?.sourceType&&body.filters.sourceType!=='marketplace')return[];
  const root=`https://ksa.motory.com/en/cars-for-sale/${slug(id.brand)}/${slug(id.model)}/${y?`${y}/`:''}`;
  const pages=Array.from({length:MAX_PAGES},(_,i)=>i===0?root:`${root}?page=${i+1}`),all=[];
  for(const url of pages){
    try{const d=await fetchHtml(url),xs=parseMotory(d.html,d.url,body);all.push(...xs);if(url!==root&&xs.length===0)break}catch(e){if(url===root)throw e;break}
  }
  const map=new Map();for(const c of all)if(strictFilter(c,body)&&!map.has(canonical(c.url)))map.set(canonical(c.url),c);
  return[...map.values()].slice(0,120);
}
function bodyFromSearchId(id=''){
  if(!String(id).startsWith('d15.'))return null;
  try{const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));if(p?.v!==1||!p.q)return null;return{query:p.q,condition:p.c==='new'?'new':'used',filters:p.f&&typeof p.f==='object'?p.f:{}}}catch{return null}
}
function ensureJob(searchId,body){
  let j=jobs.get(searchId);if(j)return j;
  j={id:searchId,body,createdAt:Date.now(),complete:false,listings:[],error:null};jobs.set(searchId,j);
  scanMotory(body).then(xs=>j.listings=xs).catch(e=>j.error=e?.message||String(e)).finally(()=>{j.complete=true;j.finishedAt=Date.now()});
  return j;
}
function mergeListings(a=[],b=[]){const map=new Map();for(const c of[...a,...b]){if(!c?.url)continue;const k=canonical(c.url),o=map.get(k);map.set(k,o?{...c,...o,image:o.image||c.image,displayImage:o.displayImage||c.displayImage,price:o.price??c.price??null,priceVerified:Boolean(o.priceVerified||c.priceVerified),imageVerified:Boolean(o.imageVerified||c.imageVerified)}:c)}return[...map.values()]}
const counts=xs=>xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});
function combine(d={},j=null){
  if(!j)return d;
  const listings=mergeListings(d.listings||[],j.listings||[]),upstreamComplete=d.complete===true||d.marketScanComplete===true,complete=upstreamComplete&&j.complete;
  return{...d,listings,counts:counts(listings),complete,marketScanComplete:complete,motoryNativeCatalog:true,motoryNativeComplete:j.complete,motoryNativeListings:j.listings.length,motoryNativeError:j.error||null,answer:complete?`${listings.length} verified listings found across the completed accessible-source scan.`:`${listings.length} verified listings found so far. Dalelah is still scanning connected Saudi sources.`};
}
async function core(pathname,opts={}){
  const r=await fetch(`http://127.0.0.1:${corePort}${pathname}`,{...opts,signal:opts.signal||AbortSignal.timeout(40000)}),text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,400)}};return{r,d,text};
}

app.get('/api/health',async(req,res)=>{try{const{r,d}=await core('/api/health',{signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(r.status).json(d);return res.json({...d,edge:'dalelah-v15-market',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||d.renderGitCommit||null,motoryNativeCatalog:true})}catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15-market',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,motoryNativeCatalog:true,error:e?.message||'health unavailable'})}});
app.post('/api/search',async(req,res)=>{
  const body=req.body||{};
  try{const{r,d}=await core('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});if(!r.ok)return res.status(r.status).json(d);const j=d.searchId?ensureJob(String(d.searchId),body):null;return res.json(combine(d,j))}catch(e){return res.status(502).json({error:e?.message||'Dalelah market search unavailable'})}
});
app.get('/api/search/progress/:id',async(req,res)=>{
  const id=String(req.params.id);let j=jobs.get(id);if(!j){const body=bodyFromSearchId(id);if(body)j=ensureJob(id,body)}
  try{const{r,d}=await core(`/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)return res.status(r.status).json(d);return res.json(combine(d,j))}catch(e){return res.status(502).json({error:e?.message||'Search progress unavailable'})}
});
app.get('/api/source-plugins',async(req,res)=>{try{const{r,d}=await core('/api/source-plugins',{signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(r.status).json(d);const plugins=Array.isArray(d.plugins)?d.plugins.map(p=>p.name==='Motory'?{...p,status:'active-source-native+indexed'}:p):[];return res.json({...d,plugins,edge:'dalelah-v15-market',motoryNativeCatalog:true})}catch(e){return res.status(502).json({error:e?.message||'Plugin registry unavailable'})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${corePort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(40000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch(e){return res.status(502).json({error:e?.message||'Dalelah core unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of pageCache)if(now-v.at>CACHE_TTL*2)pageCache.delete(k);for(const[k,v]of jobs)if(now-v.createdAt>JOB_TTL)jobs.delete(k)},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah 1.5 market edge running at http://localhost:${externalPort} -> core ${corePort}`));
