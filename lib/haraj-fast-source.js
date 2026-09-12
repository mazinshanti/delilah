import {extractHarajPrice} from './haraj-price.js';

const BASE='https://haraj.com.sa';
const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const BAD=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|طبلون|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|مراي[هة]|مرآة|تشليح|للتشليح|للايجار|للإيجار|تاجير|تأجير|ورشة|صيانة|مطلوب|شراء سيارات|عداد.{0,60}(?:اصلي|أصلي|وكاله|وكالة|يركب|تركيب))/i;
const MODEL_ALIASES={corolla:['corolla','كورولا','كرولا'],camry:['camry','كامري','كامرى'],yaris:['yaris','يارس'],patrol:['patrol','باترول'],sunny:['sunny','صني'],wrangler:['wrangler','رانجلر'],tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],sportage:['sportage','سبورتاج'],tahoe:['tahoe','تاهو'],'land-cruiser':['land cruiser','لاند كروزر','لاندكروزر'],prado:['prado','برادو'],fortuner:['fortuner','فورتشنر'],accent:['accent','اكسنت','أكسنت'],altima:['altima','التيما','ألتيما'],territory:['territory','تيريتوري'],k5:['k5','كي 5']};
const HARAJ_ARABIC={corolla:'تويوتا كورولا',camry:'تويوتا كامري',yaris:'تويوتا يارس',patrol:'نيسان باترول',sunny:'نيسان صني',wrangler:'جيب رانجلر',tucson:'هيونداي توسان',elantra:'هيونداي النترا',sonata:'هيونداي سوناتا',sportage:'كيا سبورتاج',tahoe:'شفروليه تاهو','land-cruiser':'تويوتا لاندكروزر',prado:'تويوتا برادو',fortuner:'تويوتا فورتشنر',accent:'هيونداي اكسنت',altima:'نيسان التيما',territory:'فورد تيريتوري',k5:'كيا K5'};
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const strip=s=>decode(String(s||'')).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const CITIES=[['الرياض','Riyadh'],['جدة','Jeddah'],['جده','Jeddah'],['الدمام','Dammam'],['الخبر','Khobar'],['مكة','Makkah'],['مكه','Makkah'],['المدينة','Madinah'],['المدينه','Madinah'],['الطائف','Taif'],['تبوك','Tabuk'],['حائل','Hail'],['بريدة','Buraidah']];
function direct(url=''){try{const u=new URL(url);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{8,}(?:\/[^/?#]+)?\/?$/i.test(u.pathname)}catch{return false}}
function canonical(url=''){try{const u=new URL(url);u.hash='';for(const k of[...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(url||'')}}
function yearsOf(s=''){return [...digits(s).matchAll(/\b((?:19|20)\d{2})\b/g)].map(x=>Number(x[1])).filter(y=>y>=1980&&y<=2035)}
function cityOf(s=''){for(const[a,b]of CITIES)if(String(s).includes(a))return b;return null}
function imageOf(seg='',base=''){for(const m of String(seg).matchAll(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)){try{const u=new URL(m[1].replace(/&amp;/g,'&'),base).href;if(!/(logo|icon|avatar|placeholder|banner|badge)/i.test(u))return u}catch{}}return null}
function intent(query=''){const q=norm(query);const model=Object.entries(MODEL_ALIASES).find(([,a])=>a.some(x=>q.includes(norm(x))))?.[0]||null;const years=[...digits(query).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));const exact=years.length===1&&!/(?:\bfrom\b|\bsince\b|\bafter\b|\bnewer\b|\bto\b|\+|من|بعد|فوق|قبل|بين|الى|إلى)/i.test(digits(query))?years[0]:null;return{q,model,exact}}
function localizedQuery(query=''){const d=intent(query),base=d.model?HARAJ_ARABIC[d.model]:String(query).trim();return [base,d.exact].filter(Boolean).join(' ').trim()}
export function parseHarajFastPage(html='',base='',opts={}){
  const d=intent(opts.query||''),f=opts.filters||{},raw=[];
  for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let url;try{url=canonical(new URL(m[1].replace(/&amp;/g,'&'),base).href)}catch{continue}
    if(!direct(url))continue;
    const title=strip(m[2]);if(!title||title.length<5||BAD.test(title))continue;
    raw.push({url,title,index:m.index||0});
  }
  const out=[],seen=new Set();
  for(let i=0;i<raw.length;i++){
    const x=raw[i];if(seen.has(x.url))continue;seen.add(x.url);
    const next=raw[i+1]?.index||Math.min(String(html).length,x.index+6500),seg=String(html).slice(x.index,Math.min(next,x.index+6500)),text=strip(seg),nt=norm(`${x.title} ${text.slice(0,500)}`);
    if(BAD.test(text.slice(0,250)))continue;
    if(d.model&&!MODEL_ALIASES[d.model].some(a=>nt.includes(norm(a))))continue;
    const years=yearsOf(`${x.title} ${text.slice(0,500)}`),year=years[0]||null;
    if(d.exact&&(years.length!==1||year!==d.exact))continue;
    if(f.minYear&&(!year||year<Number(f.minYear)))continue;
    if(f.maxYear&&(!year||year>Number(f.maxYear)))continue;
    const city=cityOf(text.slice(0,1400));if(f.city&&norm(city||'')!==norm(f.city))continue;
    const priceHit=extractHarajPrice(`${x.title} ${text.slice(0,2600)}`,{year});
    const price=priceHit?.price??null;
    if(f.minPrice&&(!price||price<Number(f.minPrice)))continue;
    if(f.maxPrice&&(!price||price>Number(f.maxPrice)))continue;
    const image=imageOf(seg,base);
    out.push({source:'Haraj',sourceType:'marketplace',seller:'Haraj',sourceStrict:true,title:x.title,snippet:text.slice(0,500),url:x.url,year,price,mileage:null,city,condition:'used',image:image||null,displayImage:image||null,imageVerified:Boolean(image),priceVerified:Boolean(priceHit),priceSource:priceHit?.source||null,priceEvidence:priceHit?.evidence||null,saleVerified:true,saleEvidence:['haraj_direct_ad_url','haraj_fast_search_page'],score:86,discovery:'haraj_fast_search_page',fastSource:true});
    if(out.length>=24)break;
  }
  return out;
}
export async function fetchHarajFast({query='',filters={},timeout=2400}={}){
  if(!String(query).trim())return{listings:[],error:'query-required'};
  if(filters?.seller&&norm(filters.seller)!==norm('Haraj'))return{listings:[],error:null};
  if(filters?.sourceType&&String(filters.sourceType)!=='marketplace')return{listings:[],error:null};
  if(filters?.maxMileage)return{listings:[],error:'strict-filter-skip'};
  const sourceQuery=localizedQuery(query),url=`${BASE}/search/${encodeURIComponent(sourceQuery)}/`;
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'ar-SA,ar;q=0.9,en;q=0.7'}});
    if(!r.ok)throw new Error(`Haraj HTTP ${r.status}`);
    const html=(await r.text()).slice(0,5_000_000);
    return{listings:parseHarajFastPage(html,r.url||url,{query,filters}),error:null,url:r.url||url,sourceQuery};
  }catch(e){return{listings:[],error:e?.message||String(e),url,sourceQuery}}
}
