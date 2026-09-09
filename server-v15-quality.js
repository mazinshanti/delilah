import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_QUALITY_INNER_PORT||6500);
const NATIVE_TTL=20*60_000;
const FETCH_TIMEOUT=9000;
process.env.PORT=String(innerPort);
await import('./server-v15-haraj.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

const nativeJobs=new Map();
const syarahCache=new Map();
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const strip=s=>decode(String(s||'')).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const PARTS_RE=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|قشرة\s*تابلون|طبلون|تحكم\s*مكيف|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|باب\s*(?:يمين|يسار|امامي|أمامي|خلفي)|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|كشافات|مراي[هة]|مرآة|ديكور|زجاج|مساعدات)/i;
const NON_SALE_RE=/(?:للايجار|للإيجار|تاجير|تأجير|مطلوب|شراء\s*سيارة|سطح[هة]|نقل\s*سيارات|فحص\s*سيارات|ورشة|صيانة|تصليح|برمجة|تلميع)/i;
const CONVERSION_RE=/(?:محول|تحويل|تشليح|للتشليح)/i;

const MODEL_GROUPS={
  corolla:['corolla','كورولا','كرولا','كورلا','كوريلا'],camry:['camry','كامري'],patrol:['patrol','باترول'],wrangler:['wrangler','رانجلر'],
  'land cruiser':['land cruiser','لاند كروزر','لاندكروزر'],prado:['prado','برادو'],yaris:['yaris','يارس'],fortuner:['fortuner','فورتشنر'],
  sunny:['sunny','صني'],tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],accent:['accent','اكسنت','أكسنت'],
  sportage:['sportage','سبورتاج'],sorento:['sorento','سورينتو'],cerato:['cerato','سيراتو'],tahoe:['tahoe','تاهو']
};
const BRAND_GROUPS={
  toyota:['toyota','تويوتا'],nissan:['nissan','نيسان'],jeep:['jeep','جيب'],hyundai:['hyundai','هيونداي'],kia:['kia','كيا'],ford:['ford','فورد'],
  chevrolet:['chevrolet','شفروليه'],lexus:['lexus','لكزس'],mercedes:['mercedes','مرسيدس'],bmw:['bmw','بي ام دبليو'],mazda:['mazda','مازدا'],honda:['honda','هوندا']
};
const MODEL_BRAND={corolla:'toyota',camry:'toyota','land cruiser':'toyota',prado:'toyota',yaris:'toyota',fortuner:'toyota',patrol:'nissan',sunny:'nissan',wrangler:'jeep',tucson:'hyundai',elantra:'hyundai',sonata:'hyundai',accent:'hyundai',sportage:'kia',sorento:'kia',cerato:'kia',tahoe:'chevrolet'};
const SYARAH_BRAND_SLUG={toyota:'toyota',nissan:'nissan',jeep:'jeep',hyundai:'hyundai',kia:'kia',ford:'ford',chevrolet:'chevrolet',lexus:'lexus',mercedes:'mercedes-benz',bmw:'bmw',mazda:'mazda',honda:'honda'};
const SYARAH_MODEL_SLUG={corolla:'corolla',camry:'camry',patrol:'patrol',wrangler:'wrangler','land cruiser':'land-cruiser',prado:'prado',yaris:'yaris',fortuner:'fortuner',sunny:'sunny',tucson:'tucson',elantra:'elantra',sonata:'sonata',accent:'accent',sportage:'sportage',sorento:'sorento',cerato:'cerato',tahoe:'tahoe'};

function detect(query=''){
  const q=norm(query);let model=null,brand=null;
  for(const[k,a]of Object.entries(MODEL_GROUPS))if(a.some(x=>q.includes(norm(x)))){model=k;break}
  for(const[k,a]of Object.entries(BRAND_GROUPS))if(a.some(x=>q.includes(norm(x)))){brand=k;break}
  if(!brand&&model)brand=MODEL_BRAND[model]||null;
  const ys=[...digits(query).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  const exact=ys.length===1&&!/\+|وفوق|واكثر|أكثر|\b(?:from|since|after|newer|above|over)\b|(?:20\d{2})\s*(?:-|to|الى|إلى)\s*20\d{2}/i.test(digits(query))?ys[0]:null;
  return{model,brand,exact};
}
function bodyFromSearchId(id=''){
  if(!String(id).startsWith('d15.'))return null;
  try{const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));if(p?.v!==1||!p.q)return null;return{query:p.q,condition:p.c==='new'?'new':'used',filters:p.f&&typeof p.f==='object'?p.f:{}}}catch{return null}
}
function queryFromSearchId(id=''){return bodyFromSearchId(id)?.query||''}
function hasAny(text,arr=[]){const t=norm(text);return arr.some(x=>t.includes(norm(x)))}
function acceptable(car,query){
  const title=String(car?.title||'');if(!title)return false;
  if(PARTS_RE.test(title)||NON_SALE_RE.test(title)||CONVERSION_RE.test(title))return false;
  const d=detect(query);
  if(d.model&&!hasAny(title,MODEL_GROUPS[d.model]))return false;
  if(d.brand&&!d.model&&!hasAny(title,BRAND_GROUPS[d.brand]))return false;
  if(d.exact&&Number(car?.year)!==d.exact)return false;
  return true;
}
function mergeListings(...groups){
  const map=new Map();for(const c of groups.flat()){if(!c?.url)continue;const key=String(c.url).replace(/[?#].*$/,'').replace(/\/$/,'');const prev=map.get(key);map.set(key,prev?{...prev,...c,score:Math.max(Number(prev.score)||0,Number(c.score)||0)}:c)}return[...map.values()]
}
function quality(data,query='',extra=[]){
  if(!data||typeof data!=='object')return data;
  const before=mergeListings(Array.isArray(data.listings)?data.listings:[],extra);
  const listings=before.filter(x=>acceptable(x,query));
  const rejected=before.length-listings.length;
  const counts={};for(const c of listings){const k=c.source||c.seller||'Other';counts[k]=(counts[k]||0)+1}
  return{...data,listings,counts,qualityGate:true,qualityRejected:(data.qualityRejected||0)+rejected};
}
function directSyarah(url=''){try{const u=new URL(url);return /(^|\.)syarah\.com$/i.test(u.hostname)&&/^\/(?:en\/)?cardetail\/[^/?#]+/i.test(u.pathname)}catch{return false}}
function syarahUrl(body={}){
  const d=detect(body.query),brand=SYARAH_BRAND_SLUG[d.brand],model=SYARAH_MODEL_SLUG[d.model];
  if(!brand||!model)return null;
  const year=d.exact?`/${d.exact}`:'';
  return`https://syarah.com/en/autos/${brand}/${model}${year}`;
}
function syarahNoResults(html=''){const t=strip(html);return /No Results Found|لا يوجد نتائج بحث مطابقة/i.test(t)}
function priceFrom(text=''){const t=digits(text).replace(/,/g,'');const ms=[...t.matchAll(/\b([1-9][0-9]{3,6})\s*(?:SAR|ريال)\b/gi)].map(x=>Number(x[1])).filter(n=>n>=5000&&n<=2_000_000);return ms.length?ms[0]:null}
function mileageFrom(text=''){const t=digits(text).replace(/,/g,'');const m=/\b([0-9]{1,7})\s*(?:KM|كم)\b/i.exec(t);return m?Number(m[1]):null}
async function fetchSyarah(url){
  const hit=syarahCache.get(url);if(hit&&Date.now()-hit.at<5*60_000)return hit.data;
  const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(FETCH_TIMEOUT),headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.7'}});
  if(!r.ok)throw new Error(`Syarah HTTP ${r.status}`);
  const data={html:(await r.text()).slice(0,5_000_000),url:r.url||url};syarahCache.set(url,{at:Date.now(),data});return data;
}
function parseSyarah(html='',base='',body={}){
  if(syarahNoResults(html))return[];
  const d=detect(body.query),out=[],seen=new Set();
  for(const m of String(html).matchAll(/<a\b([^>]*href=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/href=["']([^"']+)["']/i.exec(m[1])?.[1];let url=null;try{url=new URL(String(href||'').replace(/&amp;/g,'&'),base).href}catch{}
    if(!url||!directSyarah(url)||seen.has(url))continue;
    const title=strip(m[2]);if(title.length<8)continue;
    const ys=[...digits(title).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));const year=ys[0]||null;
    if(d.model&&!hasAny(title,MODEL_GROUPS[d.model]))continue;
    if(d.exact&&year!==d.exact)continue;
    const condition=/\bused\b|مستعمل|مستعملة/i.test(title)?'used':(/\bnew\b|جديد|جديدة/i.test(title)?'new':null);
    if(body.condition&&condition&&condition!==body.condition)continue;
    const price=priceFrom(title),mileage=mileageFrom(title),f=body.filters||{};
    if(f.maxPrice&&price!=null&&price>Number(f.maxPrice))continue;if(f.maxMileage&&mileage!=null&&mileage>Number(f.maxMileage))continue;
    if(f.seller&&norm(f.seller)!==norm('Syarah'))continue;if(f.sourceType&&f.sourceType!=='marketplace')continue;
    seen.add(url);out.push({source:'Syarah',sourceType:'marketplace',seller:'Syarah',sourceStrict:true,title,snippet:title.slice(0,650),url,brand:d.brand||null,model:d.model||null,year,price,mileage,city:null,condition:condition||body.condition||'used',saleVerified:true,saleEvidence:['syarah_direct_cardetail_url','syarah_native_inventory_page'],image:null,displayImage:null,imageVerified:false,priceVerified:Boolean(price),priceSource:price?'syarah_native_inventory_page':null,score:94,discovery:'syarah_source_native_inventory',syarahNativeVerified:true});
  }
  return out.slice(0,80);
}
async function scanSyarah(body={}){
  const url=syarahUrl(body);if(!url)return[];const d=await fetchSyarah(url);return parseSyarah(d.html,d.url,body);
}
function ensureNativeJob(searchId,body){
  let j=nativeJobs.get(searchId);if(j)return j;
  j={createdAt:Date.now(),complete:false,listings:[],error:null,url:syarahUrl(body)};nativeJobs.set(searchId,j);
  scanSyarah(body).then(xs=>j.listings=xs).catch(e=>j.error=e?.message||String(e)).finally(()=>{j.complete=true;j.finishedAt=Date.now()});return j;
}
function withNative(data,query,j){return{...quality(data,query,j?.listings||[]),syarahNativeInventory:true,syarahNativeComplete:Boolean(j?.complete),syarahNativeListings:j?.listings?.length||0,syarahNativeError:j?.error||null,syarahNativeUrl:j?.url||null}}
async function inner(path,options={}){
  const r=await fetch(`http://127.0.0.1:${innerPort}${path}`,{...options,signal:AbortSignal.timeout(40_000)});
  const ct=r.headers.get('content-type')||'';const body=await r.arrayBuffer();
  return{status:r.status,headers:{'content-type':ct},body:Buffer.from(body)};
}
async function jsonInner(path,options={}){
  const r=await inner(path,options);let d={};try{d=JSON.parse(r.body.toString('utf8'))}catch{d={error:r.body.toString('utf8').slice(0,300)}}return{...r,data:d};
}
app.get('/api/health',async(req,res)=>{try{const r=await jsonInner('/api/health');res.status(r.status).json({...r.data,edge:'dalelah-v15-quality',qualityGate:true,syarahNativeInventory:true,productVersion:'1.5'})}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.post('/api/search',async(req,res)=>{try{const body=req.body||{},r=await jsonInner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const id=r.data?.searchId,j=id?ensureNativeJob(id,body):null;res.status(r.status).json(withNative(r.data,String(body.query||''),j))}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.get('/api/search/progress/:id',async(req,res)=>{try{const id=String(req.params.id||''),body=bodyFromSearchId(id),r=await jsonInner(`/api/search/progress/${encodeURIComponent(id)}`),j=body?ensureNativeJob(id,body):null;res.status(r.status).json(withNative(r.data,queryFromSearchId(id),j))}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.use(async(req,res)=>{try{const r=await inner(req.originalUrl,{method:req.method,headers:{accept:req.headers.accept||'*/*'}});res.status(r.status);if(r.headers['content-type'])res.set('content-type',r.headers['content-type']);res.send(r.body)}catch(e){res.status(502).send(e?.message||String(e))}});
setInterval(()=>{const now=Date.now();for(const[k,v]of nativeJobs)if(now-v.createdAt>NATIVE_TTL)nativeJobs.delete(k)},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah 1.5 quality/native edge on ${externalPort}, Haraj edge ${innerPort}`));
