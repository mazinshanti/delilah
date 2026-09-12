import {extractSalehVehicleImage} from './saleh-image.js';

const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const SITEMAP_URL='https://www.salehcars.com/sitemap.xml';
const SITEMAP_TTL=5*60_000;
let sitemapCache={at:0,urls:[]};

const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const strip=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

const MODELS={
  corolla:{aliases:['corolla','كورولا','كرولا','كورلا','كوريلا'],brand:['toyota','تويوتا']},
  camry:{aliases:['camry','كامري'],brand:['toyota','تويوتا']},
  yaris:{aliases:['yaris','يارس'],brand:['toyota','تويوتا']},
  rav4:{aliases:['rav4','rav 4','راف4','راف 4'],brand:['toyota','تويوتا']},
  veloz:{aliases:['veloz','فيلوز'],brand:['toyota','تويوتا']},
  fortuner:{aliases:['fortuner','فورتشنر'],brand:['toyota','تويوتا']},
  prado:{aliases:['prado','برادو'],brand:['toyota','تويوتا']},
  'land cruiser':{aliases:['land cruiser','landcruiser','لاند كروزر','لاندكروزر'],brand:['toyota','تويوتا']},
  sunny:{aliases:['sunny','صني'],brand:['nissan','نيسان']},
  patrol:{aliases:['patrol','باترول'],brand:['nissan','نيسان']},
  tucson:{aliases:['tucson','توسان'],brand:['hyundai','هيونداي']},
  elantra:{aliases:['elantra','النترا','إلنترا'],brand:['hyundai','هيونداي']},
  sonata:{aliases:['sonata','سوناتا'],brand:['hyundai','هيونداي']},
  accent:{aliases:['accent','اكسنت','أكسنت'],brand:['hyundai','هيونداي']},
  sportage:{aliases:['sportage','سبورتاج'],brand:['kia','كيا']},
  sorento:{aliases:['sorento','سورينتو'],brand:['kia','كيا']},
  wrangler:{aliases:['wrangler','رانجلر'],brand:['jeep','جيب']},
  tahoe:{aliases:['tahoe','تاهو'],brand:['chevrolet','شفروليه']},
  preface:{aliases:['preface','بريفيس','بريفايس'],brand:['geely','جيلي']},
  coolray:{aliases:['coolray','كولراي'],brand:['geely','جيلي']},
  monjaro:{aliases:['monjaro','مونجارو'],brand:['geely','جيلي']},
  emgrand:{aliases:['emgrand','امجراند','إمجراند'],brand:['geely','جيلي']},
  eado:{aliases:['eado','ايدو','إيدو'],brand:['changan','شانجان']},
  cs35:{aliases:['cs35','سي اس 35'],brand:['changan','شانجان']},
  cs55:{aliases:['cs55','سي اس 55'],brand:['changan','شانجان']},
  cs75:{aliases:['cs75','سي اس 75'],brand:['changan','شانجان']}
};

function detect(query=''){
  const q=norm(query),years=[...digits(query).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  for(const [key,m] of Object.entries(MODELS)){
    if(m.aliases.some(a=>q.includes(norm(a)))&&m.brand.some(a=>q.includes(norm(a))))return{key,...m,year:years.length===1?years[0]:null};
  }
  return null;
}

function salehProductId(url=''){
  try{return /^\/(?:en\/)?cars\/([a-f0-9]{24})(?:\/|$)/i.exec(new URL(url).pathname)?.[1]?.toLowerCase()||null}catch{return null}
}

export function parseSalehSitemap(xml=''){
  const out=new Map();
  const raw=String(xml||'').replace(/&amp;/g,'&');
  const re=/https:\/\/www\.salehcars\.com\/en\/cars\/([a-f0-9]{24})\/([^\s<"']+)/gi;
  for(const m of raw.matchAll(re)){
    const id=String(m[1]).toLowerCase();
    let url=`https://www.salehcars.com/en/cars/${id}/${m[2]}`.replace(/[)>.,;]+$/,'');
    try{url=new URL(url).href}catch{continue}
    if(!out.has(id))out.set(id,url);
  }
  return [...out.values()];
}

function candidateMatches(url='',meta={}){
  let text='';
  try{text=norm(decodeURIComponent(new URL(url).pathname.replace(/[-_/]+/g,' ')))}catch{text=norm(url)}
  if(meta.year&&!text.includes(String(meta.year)))return false;
  if(!meta.aliases.some(a=>text.includes(norm(a))))return false;
  if(!meta.brand.some(a=>text.includes(norm(a))))return false;
  return true;
}

async function liveSalehUrls(timeout=1200){
  if(sitemapCache.urls.length&&Date.now()-sitemapCache.at<SITEMAP_TTL)return sitemapCache.urls;
  const r=await fetch(SITEMAP_URL,{redirect:'follow',signal:AbortSignal.timeout(Math.max(500,timeout)),headers:{'User-Agent':UA,'Accept':'application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5','Accept-Language':'en-US,en;q=0.9'}});
  if(!r.ok)throw new Error(`Saleh sitemap HTTP ${r.status}`);
  const urls=parseSalehSitemap((await r.text()).slice(0,4_000_000));
  if(!urls.length)throw new Error('Saleh sitemap returned no product URLs');
  sitemapCache={at:Date.now(),urls};
  return urls;
}

function priceFrom(text='',html=''){
  const vals=[];
  for(const m of digits(text).replace(/,/g,'').matchAll(/\b([1-9][0-9]{3,6})\s*(?:SAR|ر\.?س|ريال)\b/gi))vals.push(Number(m[1]));
  for(const m of digits(html).replace(/,/g,'').matchAll(/["'](?:price|cashPrice|salePrice|finalPrice|sellingPrice|discountedPrice)["']\s*:\s*["']?([1-9][0-9]{3,6})/gi))vals.push(Number(m[1]));
  const good=vals.filter(n=>n>=5000&&n<=2_000_000);
  return good.length?Math.min(...good):null;
}

async function fetchOne(url,meta,timeout){
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(Math.max(450,timeout)),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'}});
    if(!r.ok)return null;
    const html=(await r.text()).slice(0,8_000_000),text=strip(html),h1=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1],title=h1?strip(h1):text.slice(0,180),matchText=norm(`${title} ${decodeURIComponent(r.url||url)}`),years=[...digits(`${title} ${decodeURIComponent(r.url||url)}`).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1])),year=years.find(y=>y>=2000&&y<=2035)||null;
    if(meta.year&&year!==meta.year)return null;
    if(!meta.aliases.some(a=>matchText.includes(norm(a))))return null;
    if(!meta.brand.some(a=>matchText.includes(norm(a))))return null;
    if(/not available|غير متوفر|نفدت الكمية|out of stock|sold out/i.test(text)&&!/available upon request|متوفر عند الطلب/i.test(text))return null;
    const price=priceFrom(text.slice(0,7000),html),image=extractSalehVehicleImage(html,r.url||url,{title});
    return{source:'Saleh Cars',sourceType:'dealer',seller:'Saleh Cars',sourceStrict:true,title,snippet:text.slice(0,600),url:r.url||url,salehProductId:salehProductId(r.url||url),year,price,mileage:0,city:null,condition:'new',saleVerified:true,saleEvidence:['saleh_live_sitemap','saleh_verified_product_page'],image:image||null,displayImage:image||null,imageVerified:Boolean(image),priceVerified:Boolean(price),priceSource:price?'saleh_direct_car_page':null,score:99,discovery:'saleh_live_sitemap',fastSource:true,salehLiveInventory:true};
  }catch{return null}
}

export async function fetchSalehFast({query='',filters={},timeout=2200}={}){
  if(filters?.seller&&norm(filters.seller)!==norm('Saleh Cars'))return{listings:[],error:null};
  if(filters?.sourceType&&String(filters.sourceType)!=='dealer'&&String(filters.sourceType)!=='official_dealer')return{listings:[],error:null};
  const meta=detect(query);
  if(!meta)return{listings:[],error:'unsupported-fast-model'};
  const started=Date.now();
  let urls=[];
  try{
    urls=await liveSalehUrls(Math.min(1200,timeout));
  }catch(error){
    return{listings:[],error:error?.message||String(error),model:meta.key,liveInventory:false};
  }
  const candidates=urls.filter(url=>candidateMatches(url,meta)).slice(0,12);
  const elapsed=Date.now()-started;
  const remaining=Math.max(450,timeout-elapsed);
  const xs=(await Promise.all(candidates.map(url=>fetchOne(url,meta,remaining)))).filter(Boolean);
  return{listings:xs,error:null,model:meta.key,liveInventory:true,indexSize:urls.length,candidateCount:candidates.length,sitemap:SITEMAP_URL};
}
