import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const marketPort=Number(process.env.DALELAH_MARKET_PORT||6400);
const CACHE_TTL=5*60_000;
const JOB_TTL=20*60_000;
const FETCH_TIMEOUT=9000;

process.env.PORT=String(marketPort);
await import('./server-v15-market.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

const pageCache=new Map();
const jobs=new Map();
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const safeUrl=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u:null}catch{return null}};
const canonical=v=>{const u=safeUrl(v);if(!u)return String(v||'');u.hash='';for(const k of[...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')};
const absolute=(v,b)=>{try{return new URL(String(v||'').replace(/&amp;/g,'&'),b).href}catch{return null}};
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const strip=s=>decode(String(s||'')).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const num=(v,min=0,max=5_000_000)=>{const n=Number(String(v||'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>=min&&n<=max?n:null};
const imageOkay=u=>{const x=safeUrl(u);return!!x&&!/(logo|favicon|icon|placeholder|sprite|avatar|profile|badge|banner)/i.test(x.href)};

const BRAND_ALIAS=new Map([
  ['toyota',{en:'toyota',ar:'تويوتا'}],['nissan',{en:'nissan',ar:'نيسان'}],['jeep',{en:'jeep',ar:'جيب'}],['hyundai',{en:'hyundai',ar:'هيونداي'}],['kia',{en:'kia',ar:'كيا'}],['ford',{en:'ford',ar:'فورد'}],['chevrolet',{en:'chevrolet',ar:'شفروليه'}],['lexus',{en:'lexus',ar:'لكزس'}],['bmw',{en:'bmw',ar:'بي ام دبليو'}],['mercedes',{en:'mercedes',ar:'مرسيدس'}],['mercedes-benz',{en:'mercedes benz',ar:'مرسيدس'}],['mazda',{en:'mazda',ar:'مازدا'}],['honda',{en:'honda',ar:'هوندا'}],['genesis',{en:'genesis',ar:'جينيسيس'}],['geely',{en:'geely',ar:'جيلي'}],['changan',{en:'changan',ar:'شانجان'}],['haval',{en:'haval',ar:'هافال'}],['jetour',{en:'jetour',ar:'جيتور'}],['gmc',{en:'gmc',ar:'جي ام سي'}]
]);
const MODEL_ALIAS=new Map([
  ['corolla',{en:'corolla',ar:['كورولا','كرولا','كورلا','كوريلا']}],['camry',{en:'camry',ar:['كامري']}],['land-cruiser',{en:'land cruiser',ar:['لاند كروزر','لاندكروزر']}],['prado',{en:'prado',ar:['برادو']}],['yaris',{en:'yaris',ar:['يارس']}],['fortuner',{en:'fortuner',ar:['فورتشنر']}],['patrol',{en:'patrol',ar:['باترول']}],['sunny',{en:'sunny',ar:['صني']}],['wrangler',{en:'wrangler',ar:['رانجلر']}],['grand-cherokee',{en:'grand cherokee',ar:['جراند شيروكي','قراند شيروكي']}],['tucson',{en:'tucson',ar:['توسان']}],['elantra',{en:'elantra',ar:['النترا','إلنترا']}],['sonata',{en:'sonata',ar:['سوناتا']}],['accent',{en:'accent',ar:['اكسنت','أكسنت']}],['sportage',{en:'sportage',ar:['سبورتاج']}],['sorento',{en:'sorento',ar:['سورينتو']}],['cerato',{en:'cerato',ar:['سيراتو']}],['tahoe',{en:'tahoe',ar:['تاهو']}],['territory',{en:'territory',ar:['تيريتوري','تيريتوري']}]
]);
const MODEL_BRAND=new Map([['corolla','toyota'],['camry','toyota'],['land-cruiser','toyota'],['prado','toyota'],['yaris','toyota'],['fortuner','toyota'],['patrol','nissan'],['sunny','nissan'],['wrangler','jeep'],['grand-cherokee','jeep'],['tucson','hyundai'],['elantra','hyundai'],['sonata','hyundai'],['accent','hyundai'],['sportage','kia'],['sorento','kia'],['cerato','kia'],['tahoe','chevrolet'],['territory','ford']]);
function identity(query=''){
  const q=norm(query);
  let brand=null,model=null;
  for(const[k,a]of BRAND_ALIAS){if(q.includes(norm(a.en))||q.includes(norm(a.ar))){brand=k;break}}
  for(const[k,a]of MODEL_ALIAS){if(q.includes(norm(a.en))||a.ar.some(x=>q.includes(norm(x)))){model=k;break}}
  if(!brand&&model)brand=MODEL_BRAND.get(model)||null;
  return{brand,model};
}
function exactYear(body={}){
  const f=body.filters||{};
  if(Number(f.minYear)&&Number(f.maxYear)&&Number(f.minYear)===Number(f.maxYear))return Number(f.minYear);
  const q=digits(String(body.query||''));
  const ys=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  if(ys.length!==1)return null;
  if(/\+|وفوق|واكثر|أكثر|\b(?:from|since|after|newer|above|over)\b|(?:20\d{2})\s*(?:-|to|الى|إلى)\s*20\d{2}/i.test(q))return null;
  return ys[0];
}
function directHaraj(url=''){const u=safeUrl(url);return!!u&&(u.hostname==='haraj.com.sa'||u.hostname.endsWith('.haraj.com.sa'))&&/^\/\d{8,}(?:\/[^/?#]+)?\/?$/i.test(u.pathname)}
function titleHasModel(title,model){if(!model)return true;const a=MODEL_ALIAS.get(model);if(!a)return true;const t=norm(title);return t.includes(norm(a.en))||a.ar.some(x=>t.includes(norm(x)))}
function titleHasBrand(title,brand){if(!brand)return true;const a=BRAND_ALIAS.get(brand);if(!a)return true;const t=norm(title);return t.includes(norm(a.en))||t.includes(norm(a.ar))||Boolean(MODEL_ALIAS.size)}
const PARTS_RE=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|قشرة\s*تابلون|تحكم\s*مكيف|كمبروسر|دينمو|رديتر|صدام|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|باب\s*(?:يمين|يسار|امامي|خلفي)|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب)/i;
const CONVERSION_RE=/(?:محول|تحويل|تشليح|للتشليح)/i;
function acceptableTitle(title,body){
  const id=identity(body.query),y=exactYear(body),t=digits(String(title||''));
  if(!titleHasModel(t,id.model)||!titleHasBrand(t,id.brand))return false;
  if(PARTS_RE.test(t)||CONVERSION_RE.test(t))return false;
  const ys=[...t.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  if(y&&(!ys.includes(y)||ys.some(v=>v!==y)))return false;
  return true;
}
const CITIES=[['الرياض','Riyadh'],['جده','Jeddah'],['جدة','Jeddah'],['الدمام','Dammam'],['الخبر','Khobar'],['مكه','Makkah'],['مكة','Makkah'],['المدينه','Madinah'],['المدينة','Madinah'],['بريدة','Buraidah'],['القطيف','Qatif'],['حائل','Hail'],['جيزان','Jazan'],['جازان','Jazan'],['الهفوف','Hofuf'],['رابغ','Rabigh'],['تاروت','Tarout'],['الظهران','Dhahran'],['العقيق','Al Aqiq'],['صبياء','Sabya']];
function cityOf(text=''){const t=norm(text);for(const[a,b]of CITIES)if(t.includes(norm(a)))return b;return null}
function imageFrom(seg='',base=''){
  for(const m of String(seg).matchAll(/<(?:img|source)\b[^>]*>/gi)){
    const tag=m[0];
    for(const k of['src','data-src','data-lazy-src','data-original']){const v=new RegExp(`${k}=["']([^"']+)["']`,'i').exec(tag)?.[1],u=absolute(v,base);if(u&&imageOkay(u))return u}
  }
  return null;
}
function priceFrom(text='',year=null){
  const t=digits(text);
  const nums=[...t.matchAll(/\b([1-9][0-9]{3,6})\b/g)].map(x=>Number(x[1])).filter(n=>n!==year&&n>=5000&&n<=500000);
  return nums.length?nums[nums.length-1]:null;
}
async function fetchHaraj(url){
  const key=canonical(url),hit=pageCache.get(key);if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.d;
  const r=await fetch(key,{redirect:'follow',signal:AbortSignal.timeout(FETCH_TIMEOUT),headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','Accept':'text/html,application/xhtml+xml','Accept-Language':'ar-SA,ar;q=0.9,en;q=0.7'}});
  if(!r.ok)throw new Error(`Haraj HTTP ${r.status}`);
  const d={html:(await r.text()).slice(0,4_000_000),url:r.url||key};pageCache.set(key,{at:Date.now(),d});return d;
}
function harajQuery(body){
  const id=identity(body.query),y=exactYear(body),brand=BRAND_ALIAS.get(id.brand),model=MODEL_ALIAS.get(id.model);
  const parts=[];
  if(brand?.ar)parts.push(brand.ar);
  if(model?.ar?.[0])parts.push(model.ar[0]);else if(model?.en)parts.push(model.en);
  if(y)parts.push(String(y));
  return parts.join(' ').trim()||String(body.query||'').trim();
}
function parseHaraj(html='',base='',body={}){
  const raw=[];
  for(const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/href=["']([^"']+)["']/i.exec(m[1])?.[1],url=canonical(absolute(href,base));
    if(url&&directHaraj(url))raw.push({m,url,index:m.index||0,title:strip(m[2])});
  }
  const out=[],seen=new Set(),y=exactYear(body),id=identity(body.query);
  for(let i=0;i<raw.length;i++){
    const r=raw[i];if(seen.has(r.url)||!acceptableTitle(r.title,body))continue;seen.add(r.url);
    const next=raw[i+1]?.index||Math.min(String(html).length,r.index+7000),seg=String(html).slice(r.index,Math.min(next,r.index+7000)),text=strip(seg),city=cityOf(text),image=imageFrom(seg,base),price=priceFrom(text,y);
    const f=body.filters||{};
    if(f.city&&norm(city||'')!==norm(f.city))continue;
    if(f.maxPrice&&price!=null&&price>Number(f.maxPrice))continue;
    if(f.seller&&norm(f.seller)!==norm('Haraj'))continue;
    if(f.sourceType&&f.sourceType!=='marketplace')continue;
    out.push({source:'Haraj',sourceType:'marketplace',seller:'Haraj',sourceStrict:true,title:r.title,snippet:text.slice(0,650),url:r.url,brand:id.brand?BRAND_ALIAS.get(id.brand)?.en||id.brand:null,model:id.model?MODEL_ALIAS.get(id.model)?.en||id.model:null,year:y||null,mileage:null,city,price:price||null,priceVerified:false,priceSource:price?'haraj_search_card_unverified':null,condition:'used',saleVerified:true,saleEvidence:['haraj_direct_ad_url','haraj_native_search_page'],image:image||null,displayImage:image||null,imageVerified:Boolean(image),imageSource:image?'haraj_native_search_page':null,score:90,discovery:'haraj_source_native_search',harajNativeVerified:true});
  }
  return out.slice(0,80);
}
async function scanHaraj(body={}){
  if(body.condition==='new')return[];
  const id=identity(body.query);if(!id.brand&&!id.model)return[];
  const q=harajQuery(body);if(!q)return[];
  const url=`https://haraj.com.sa/search/${encodeURIComponent(q)}/`;
  const d=await fetchHaraj(url);
  return parseHaraj(d.html,d.url,body);
}
function bodyFromSearchId(id=''){
  if(!String(id).startsWith('d15.'))return null;
  try{const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));if(p?.v!==1||!p.q)return null;return{query:p.q,condition:p.c==='new'?'new':'used',filters:p.f&&typeof p.f==='object'?p.f:{}}}catch{return null}
}
function ensureJob(searchId,body){
  let j=jobs.get(searchId);if(j)return j;
  j={id:searchId,body,createdAt:Date.now(),complete:false,listings:[],error:null,query:null};jobs.set(searchId,j);
  j.query=harajQuery(body);
  scanHaraj(body).then(xs=>j.listings=xs).catch(e=>j.error=e?.message||String(e)).finally(()=>{j.complete=true;j.finishedAt=Date.now()});
  return j;
}
function mergeListings(a=[],b=[]){const map=new Map();for(const c of[...a,...b]){if(!c?.url)continue;const k=canonical(c.url),o=map.get(k);map.set(k,o?{...c,...o,image:o.image||c.image,displayImage:o.displayImage||c.displayImage,price:o.price??c.price??null,imageVerified:Boolean(o.imageVerified||c.imageVerified),priceVerified:Boolean(o.priceVerified||c.priceVerified)}:c)}return[...map.values()]}
const counts=xs=>xs.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});
function combine(d={},j=null){
  if(!j)return d;
  const listings=mergeListings(d.listings||[],j.listings||[]),upstreamComplete=d.complete===true||d.marketScanComplete===true,complete=upstreamComplete&&j.complete;
  return{...d,listings,counts:counts(listings),complete,marketScanComplete:complete,harajNativeSearch:true,harajNativeComplete:j.complete,harajNativeListings:j.listings.length,harajNativeError:j.error||null,harajNativeQuery:j.query||null,answer:complete?`${listings.length} verified listings found across the completed accessible-source scan.`:`${listings.length} verified listings found so far. Dalelah is still scanning connected Saudi sources.`};
}
async function core(pathname,opts={}){const r=await fetch(`http://127.0.0.1:${marketPort}${pathname}`,{...opts,signal:opts.signal||AbortSignal.timeout(40000)}),text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,400)}};return{r,d,text}}

app.get('/api/health',async(req,res)=>{try{const{r,d}=await core('/api/health',{signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(r.status).json(d);return res.json({...d,edge:'dalelah-v15-haraj',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||d.renderGitCommit||null,harajNativeSearch:true})}catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15-haraj',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,harajNativeSearch:true,error:e?.message||'health unavailable'})}});
app.post('/api/search',async(req,res)=>{const body=req.body||{};try{const{r,d}=await core('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});if(!r.ok)return res.status(r.status).json(d);const j=d.searchId?ensureJob(String(d.searchId),body):null;return res.json(combine(d,j))}catch(e){return res.status(502).json({error:e?.message||'Dalelah Haraj search unavailable'})}});
app.get('/api/search/progress/:id',async(req,res)=>{const id=String(req.params.id);let j=jobs.get(id);if(!j){const body=bodyFromSearchId(id);if(body)j=ensureJob(id,body)}try{const{r,d}=await core(`/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)return res.status(r.status).json(d);return res.json(combine(d,j))}catch(e){return res.status(502).json({error:e?.message||'Search progress unavailable'})}});
app.get('/api/source-plugins',async(req,res)=>{try{const{r,d}=await core('/api/source-plugins',{signal:AbortSignal.timeout(8000)});if(!r.ok)return res.status(r.status).json(d);const plugins=Array.isArray(d.plugins)?d.plugins.map(p=>p.name==='Haraj'?{...p,status:'active-source-native+indexed'}:p):[];return res.json({...d,plugins,edge:'dalelah-v15-haraj',harajNativeSearch:true})}catch(e){return res.status(502).json({error:e?.message||'Plugin registry unavailable'})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${marketPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(40000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch(e){return res.status(502).json({error:e?.message||'Dalelah market core unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of pageCache)if(now-v.at>CACHE_TTL*2)pageCache.delete(k);for(const[k,v]of jobs)if(now-v.createdAt>JOB_TTL)jobs.delete(k)},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah 1.5 Haraj-native edge running at http://localhost:${externalPort} -> market ${marketPort}`));
