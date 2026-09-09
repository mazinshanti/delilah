import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_SALEH_INNER_PORT||6600);
const JOB_TTL=20*60_000;
const FETCH_TIMEOUT=10_000;
const CACHE_TTL=10*60_000;
process.env.PORT=String(innerPort);
await import('./server-v15-quality.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
const jobs=new Map();
const cache=new Map();
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const strip=s=>decode(String(s||'')).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const MODELS={corolla:['corolla','كورولا','كرولا','كورلا'],camry:['camry','كامري'],yaris:['yaris','يارس'],patrol:['patrol','باترول'],sunny:['sunny','صني'],wrangler:['wrangler','رانجلر'],tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],accent:['accent','اكسنت','أكسنت'],sportage:['sportage','سبورتاج'],sorento:['sorento','سورينتو'],cerato:['cerato','سيراتو'],tahoe:['tahoe','تاهو'],'land cruiser':['land cruiser','لاند كروزر','لاندكروزر'],prado:['prado','برادو'],fortuner:['fortuner','فورتشنر'],rav4:['rav4','rav 4','راف 4','راف4'],veloz:['veloz','فيلوز']};
const BRANDS={toyota:['toyota','تويوتا'],nissan:['nissan','نيسان'],jeep:['jeep','جيب'],hyundai:['hyundai','هيونداي'],kia:['kia','كيا'],ford:['ford','فورد'],chevrolet:['chevrolet','شفروليه'],lexus:['lexus','لكزس'],bmw:['bmw','بي ام دبليو'],mercedes:['mercedes','مرسيدس'],honda:['honda','هوندا'],mazda:['mazda','مازدا'],geely:['geely','جيلي'],changan:['changan','شانجان'],haval:['haval','هافال'],jetour:['jetour','جيتور'],byd:['byd','بي واي دي'],mg:['mg','ام جي'],gmc:['gmc','جي ام سي'],genesis:['genesis','جينيسيس'],volkswagen:['volkswagen','فولكس فاجن']};
const MODEL_BRAND={corolla:'toyota',camry:'toyota',yaris:'toyota','land cruiser':'toyota',prado:'toyota',fortuner:'toyota',rav4:'toyota',veloz:'toyota',patrol:'nissan',sunny:'nissan',wrangler:'jeep',tucson:'hyundai',elantra:'hyundai',sonata:'hyundai',accent:'hyundai',sportage:'kia',sorento:'kia',cerato:'kia',tahoe:'chevrolet'};
const VERIFIED_SEEDS=[
  'https://www.salehcars.com/en/cars/692d6d3f7763c76ddaf33a88/toyota-corolla-xli-2-0l-2026',
  'https://www.salehcars.com/en/cars/69b0a1b7845f71b9054ca65e/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7-%D9%83%D9%88%D8%B1%D9%88%D9%84%D8%A7-xli-1-5-%D9%85%D8%B7%D9%88%D8%B1-2026',
  'https://www.salehcars.com/en/cars/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026',
  'https://www.salehcars.com/en/cars/69a971ec6c4a6fc01fc27229/toyota-yaris-y-plus-2026',
  'https://www.salehcars.com/en/cars/69cbaefb2e54b13e4a815605/toyota-rav4-new-design-le-2026',
  'https://www.salehcars.com/en/cars/6921cfd9789a0d415dfc73b8/toyota-urban-cruiser-gl-2026',
  'https://www.salehcars.com/en/cars/6a3a6554822b69eda62c07f2/toyota-veloz-glx-2026'
];
function detect(q=''){const t=norm(q);let model=null,brand=null;for(const[k,a]of Object.entries(MODELS))if(a.some(x=>t.includes(norm(x)))){model=k;break}for(const[k,a]of Object.entries(BRANDS))if(a.some(x=>t.includes(norm(x)))){brand=k;break}if(!brand&&model)brand=MODEL_BRAND[model]||null;const ys=[...digits(q).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));const exact=ys.length===1&&!/\+|وفوق|واكثر|أكثر|\b(?:from|since|after|newer|above|over)\b|(?:20\d{2})\s*(?:-|to|الى|إلى)\s*20\d{2}/i.test(digits(q))?ys[0]:null;return{model,brand,exact}}
function bodyFromId(id=''){if(!String(id).startsWith('d15.'))return null;try{const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));if(p?.v!==1||!p.q)return null;return{query:p.q,condition:p.c==='new'?'new':'used',filters:p.f&&typeof p.f==='object'?p.f:{}}}catch{return null}}
function directSaleh(url=''){try{const u=new URL(url);return /(^|\.)salehcars\.com$/i.test(u.hostname)&&/^\/(?:en\/)?cars\/[a-f0-9]{24}(?:\/[^?#]*)?\/?$/i.test(u.pathname)}catch{return false}}
function hasAny(text,arr=[]){const t=norm(text);return arr.some(x=>t.includes(norm(x)))}
function priceFrom(text=''){const t=digits(text).replace(/,/g,'');const vals=[...t.matchAll(/\b([1-9][0-9]{3,6})\s*(?:SAR|ر\.?س|ريال)\b/gi)].map(x=>Number(x[1])).filter(n=>n>=5000&&n<=2_000_000);return vals.length?Math.min(...vals):null}
function imageFrom(html='',base=''){for(const m of String(html).matchAll(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)){try{const u=new URL(m[1].replace(/&amp;/g,'&'),base).href;if(!/(logo|icon|avatar|placeholder|banner)/i.test(u))return u}catch{}}return null}
async function fetchPage(url){const hit=cache.get(url);if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.data;const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(FETCH_TIMEOUT),headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','Accept':'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5','Accept-Language':'en-US,en;q=0.9,ar;q=0.7'}});if(!r.ok)throw new Error(`Saleh HTTP ${r.status}`);const data={html:(await r.text()).slice(0,12_000_000),url:r.url||url};cache.set(url,{at:Date.now(),data});return data}
function inventoryLinks(html='',base=''){const out=[],seen=new Set();for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){let url=null;try{url=new URL(m[1].replace(/&amp;/g,'&'),base).href}catch{}if(!url||!directSaleh(url)||seen.has(url))continue;seen.add(url);out.push({url,title:strip(m[2])})}return out}
function sitemapLocs(xml=''){return[...String(xml).matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map(m=>decode(strip(m[1])).trim()).filter(Boolean)}
function robotSitemaps(text=''){return String(text).split(/\r?\n/).map(x=>/^\s*Sitemap:\s*(\S+)/i.exec(x)?.[1]).filter(Boolean)}
async function discoverSalehProducts(){
  const products=new Map(),errors=[],queue=[],seenSitemaps=new Set();
  try{const r=await fetchPage('https://www.salehcars.com/robots.txt');for(const u of robotSitemaps(r.html))queue.push(u)}catch(e){errors.push(`robots:${e.message}`)}
  for(const u of ['https://www.salehcars.com/sitemap.xml','https://www.salehcars.com/sitemap_index.xml','https://www.salehcars.com/sitemap-index.xml','https://www.salehcars.com/sitemaps.xml'])queue.push(u);
  while(queue.length&&seenSitemaps.size<30&&products.size<2500){
    const u=queue.shift();if(seenSitemaps.has(u))continue;seenSitemaps.add(u);
    try{const r=await fetchPage(u);for(const x of sitemapLocs(r.html)){if(directSaleh(x)){products.set(x,{url:x,title:''});continue}if(/sitemap/i.test(x)&&/^https?:\/\//i.test(x)&&!seenSitemaps.has(x))queue.push(x)}}catch(e){if(errors.length<8)errors.push(`sitemap:${e.message}`)}
  }
  try{const inventory=await fetchPage('https://www.salehcars.com/en/cars/all');for(const x of inventoryLinks(inventory.html,inventory.url))products.set(x.url,x)}catch(e){if(errors.length<8)errors.push(`inventory:${e.message}`)}
  const discoveredBeforeSeeds=products.size;
  for(const u of VERIFIED_SEEDS)if(!products.has(u))products.set(u,{url:u,title:''});
  return{links:[...products.values()],discoveredBeforeSeeds,sitemapCount:seenSitemaps.size,seedCount:VERIFIED_SEEDS.length,errors};
}
async function scanSaleh(body={}){
  if(body.condition!=='new')return[];
  const d=detect(body.query);if(!d.brand&&!d.model)return[];
  const discovery=await discoverSalehProducts();
  let links=discovery.links.filter(x=>(!d.model||hasAny(x.title||decodeURIComponent(x.url),MODELS[d.model]))&&(!d.brand||hasAny(x.title||decodeURIComponent(x.url),BRANDS[d.brand]))&&(!d.exact||digits(x.title||decodeURIComponent(x.url)).includes(String(d.exact))));
  if(!links.length)links=discovery.links;
  links=links.slice(0,80);
  const out=[];
  for(let i=0;i<links.length;i+=8){
    const batch=await Promise.all(links.slice(i,i+8).map(async item=>{
      let p;try{p=await fetchPage(item.url)}catch{return null}
      const text=strip(p.html),h1=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(p.html)?.[1],title=h1?strip(h1):(item.title||text.slice(0,160));
      const ys=[...digits(title+' '+text.slice(0,1800)).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));const year=ys.find(y=>y>=2000&&y<=2035)||null;
      if(d.model&&!hasAny(title,MODELS[d.model]))return null;if(d.brand&&!hasAny(title,BRANDS[d.brand]))return null;if(d.exact&&year!==d.exact)return null;
      const price=priceFrom(text.slice(0,3500)),f=body.filters||{};if(f.maxPrice&&price!=null&&price>Number(f.maxPrice))return null;if(f.seller&&norm(f.seller)!==norm('Saleh Cars'))return null;if(f.sourceType&&f.sourceType!=='dealer')return null;
      if(/not available|غير متوفر|نفدت الكمية/i.test(text)&&!/available upon request|متوفر عند الطلب/i.test(text))return null;
      const image=imageFrom(p.html,p.url);
      return{source:'Saleh Cars',sourceType:'dealer',seller:'Saleh Cars',sourceStrict:true,title,snippet:text.slice(0,650),url:p.url,brand:d.brand,model:d.model,year,price,mileage:0,city:null,condition:'new',saleVerified:true,saleEvidence:['saleh_direct_car_url','saleh_public_product_index'],image:image||null,displayImage:image||null,imageVerified:Boolean(image),priceVerified:Boolean(price),priceSource:price?'saleh_direct_car_page':null,score:96,discovery:'saleh_source_native_inventory',salehNativeVerified:true};
    }));
    for(const c of batch)if(c)out.push(c);if(out.length>=50)break;
  }
  out.discoveryMeta={discoveredBeforeSeeds:discovery.discoveredBeforeSeeds,sitemapCount:discovery.sitemapCount,seedCount:discovery.seedCount,errors:discovery.errors};
  return out;
}
function ensureJob(id,body){let j=jobs.get(id);if(j)return j;j={createdAt:Date.now(),complete:false,listings:[],error:null,url:'saleh robots/sitemaps + direct product verification',meta:null};jobs.set(id,j);scanSaleh(body).then(xs=>{j.meta=xs.discoveryMeta||null;j.listings=Array.from(xs)}).catch(e=>j.error=e?.message||String(e)).finally(()=>{j.complete=true;j.finishedAt=Date.now()});return j}
function merge(a=[],b=[]){const map=new Map();for(const c of[...a,...b]){if(!c?.url)continue;const k=String(c.url).replace(/[?#].*$/,'').replace(/\/$/,'');if(!map.has(k))map.set(k,c)}return[...map.values()]}
function attach(data,j){if(!data||typeof data!=='object')return data;const listings=merge(Array.isArray(data.listings)?data.listings:[],j?.listings||[]);const counts={};for(const c of listings){const k=c.source||c.seller||'Other';counts[k]=(counts[k]||0)+1}return{...data,listings,counts,salehNativeInventory:true,salehNativeComplete:Boolean(j?.complete),salehNativeListings:j?.listings?.length||0,salehNativeError:j?.error||null,salehNativeUrl:j?.url||null,salehDiscoveryMeta:j?.meta||null}}
async function inner(path,options={}){const r=await fetch(`http://127.0.0.1:${innerPort}${path}`,{...options,signal:AbortSignal.timeout(40_000)});const ct=r.headers.get('content-type')||'';const body=Buffer.from(await r.arrayBuffer());return{status:r.status,ct,body}}
async function jinner(path,options={}){const r=await inner(path,options);let data={};try{data=JSON.parse(r.body.toString('utf8'))}catch{data={error:r.body.toString('utf8').slice(0,300)}}return{...r,data}}
app.get('/api/health',async(req,res)=>{try{const r=await jinner('/api/health');res.status(r.status).json({...r.data,edge:'dalelah-v15-saleh',salehNativeInventory:true,salehPublicProductIndex:true,productVersion:'1.5'})}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.post('/api/search',async(req,res)=>{try{const body=req.body||{},r=await jinner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),id=r.data?.searchId,j=id?ensureJob(id,body):null;res.status(r.status).json(attach(r.data,j))}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.get('/api/search/progress/:id',async(req,res)=>{try{const id=String(req.params.id||''),body=bodyFromId(id),r=await jinner(`/api/search/progress/${encodeURIComponent(id)}`),j=body?ensureJob(id,body):null;res.status(r.status).json(attach(r.data,j))}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.use(async(req,res)=>{try{const r=await inner(req.originalUrl,{method:req.method,headers:{accept:req.headers.accept||'*/*'}});res.status(r.status);if(r.ct)res.set('content-type',r.ct);res.send(r.body)}catch(e){res.status(502).send(e?.message||String(e))}});
setInterval(()=>{const now=Date.now();for(const[k,v]of jobs)if(now-v.createdAt>JOB_TTL)jobs.delete(k)},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah 1.5 Saleh product-index edge on ${externalPort}, quality edge ${innerPort}`));
