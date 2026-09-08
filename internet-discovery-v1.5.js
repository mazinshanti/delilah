import { internetResearchRules, SAUDI_POPULAR_MODELS } from "./saudi-auto-knowledge-v1.5.js";

const BLOCK_PATH=/(?:^|\/)(?:search|cars?$|vehicles?$|used-cars?$|new-cars?$|price|prices|specs?|specifications?|reviews?|news|blog|compare|comparison|calculator|valuation|sell-car|car-value|parts?|accessories?)(?:\/|$)/i;
const CATEGORY_PATH=/(?:^|\/)(?:car-classes|car-models|makes|brands|categories)(?:\/|$)|\/(?:listings?|used-cars?|new-cars?|cars?|vehicles?)\/?$/i;
const SALE_WORDS=/for sale|used car|new car|سيارة للبيع|سياره للبيع|للبيع|مستعمل|جديد|pre-owned|certified/i;
const PART_WORDS=/spare part|parts|accessor|bumper|engine|gearbox|tyre|tire|rim|wheel|headlight|door|قطع غيار|تشليح|صدام|مكينه|مكينة|قير|كفر|كفرات|جنوط|جنط/i;
const WANTED=/wanted|want to buy|looking for|مطلوب|ابي اشتري|ابغى اشتري|ارغب شراء/i;

const knownDirect=[
  u=>/haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{7,}(?:\/|$)/.test(u.pathname),
  u=>/syarah\.com$/i.test(u.hostname)&&/\/cardetail\/[^/]+/i.test(u.pathname),
  u=>/saudisale\.com$/i.test(u.hostname)&&/\/listings\/[^/]+/i.test(u.pathname),
  u=>/arabwheels\.sa$/i.test(u.hostname)&&/\/used-cars\/[^/]*\d{3,}[^/]*\/?$/i.test(u.pathname),
  u=>/carswitch\.com$/i.test(u.hostname)&&/\/used-cars\/.+(?:19|20)\d{2}.+/i.test(u.pathname)&&!/-price(?:\/|$)/i.test(u.pathname),
  u=>/motory\.com$/i.test(u.hostname)&&/\/used-cars\/.+(?:19|20)\d{2}.+/i.test(u.pathname)
];

function decode(s=""){return String(s).replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");}
function strip(s=""){return decode(String(s)).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function first(re,s=""){return re.exec(String(s))?.[1]||null;}
function abs(v,base){try{return new URL(decode(v),base).href}catch{return null}}
function safeUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u:null}catch{return null}}
function sourceName(url){try{const h=new URL(url).hostname.replace(/^www\./,"");return h.split(".").slice(-2).join(".")}catch{return"Web"}}
function titleFrom(html,url){return strip(first(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,html)||first(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,html)||first(/<title[^>]*>([\s\S]*?)<\/title>/i,html)||"")||sourceName(url)+" car";}
function imageFrom(html,url){const x=first(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,html)||first(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,html);return x?abs(x,url):null;}
function yearFrom(text=""){const y=[...String(text).matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).find(x=>x>=1980&&x<=2030);return y||null;}
function number(v){const n=Number(String(v||"").replace(/[^0-9]/g,""));return Number.isFinite(n)?n:null;}
function priceFrom(text=""){for(const r of [/(?:SAR|ريال|ر\.?س)\s*([0-9][\d,]{3,})/i,/([0-9][\d,]{3,})\s*(?:SAR|ريال|ر\.?س)/i,/(?:price|السعر)[^0-9]{0,30}([0-9][\d,]{3,})/i]){const m=r.exec(text);if(m){const n=number(m[1]);if(n>=1000&&n<=5_000_000)return n}}return null;}
function mileageFrom(text=""){const m=/(?:mileage|odometer|ممشى|الممشى)[^0-9]{0,20}([0-9][\d,.]{0,8})\s*(?:km|كيلو|كم)?/i.exec(text)||/([0-9][\d,.]{0,8})\s*(?:km|kilometers?|كيلو|كم)\b/i.exec(text);if(!m)return null;const n=number(m[1]);return n>=0&&n<=1_500_000?n:null;}
function cityFrom(text=""){const x=String(text).toLowerCase();if(/riyadh|الرياض/.test(x))return"Riyadh";if(/jeddah|جده|جدة/.test(x))return"Jeddah";if(/dammam|الدمام/.test(x))return"Dammam";if(/khobar|الخبر/.test(x))return"Khobar";if(/makkah|mecca|مكه|مكة/.test(x))return"Makkah";if(/madinah|medina|المدينه|المدينة/.test(x))return"Madinah";if(/abha|ابها|أبها/.test(x))return"Abha";if(/tabuk|تبوك/.test(x))return"Tabuk";return null;}
function conditionFrom(text=""){if(/\bnew\b|جديد|زيرو|اصفار|أصفار/i.test(text))return"new";if(/\bused\b|pre-owned|مستعمل|ممشى/i.test(text))return"used";return"unknown";}
function modelIdentity(text=""){const low=String(text).toLowerCase();for(const full of [...SAUDI_POPULAR_MODELS].sort((a,b)=>b.length-a.length)){if(low.includes(full.toLowerCase())){const [brand,...rest]=full.split(" ");return{brand,model:rest.join(" ")}}}return{brand:null,model:null};}
function directEnough(u,title,text){
  if(BLOCK_PATH.test(u.pathname)||CATEGORY_PATH.test(u.pathname)||u.searchParams.has("page"))return false;
  if(WANTED.test(`${title} ${text}`)||PART_WORDS.test(`${title} ${text}`))return false;
  if(knownDirect.some(fn=>fn(u)))return true;
  const seg=u.pathname.split("/").filter(Boolean),hasListingId=/(?:^|[-_/])\d{4,}(?:[-_/]|$)/.test(u.pathname),hasYear=/(?:19|20)\d{2}/.test(u.pathname);
  return seg.length>=3&&(hasListingId||hasYear)&&SALE_WORDS.test(`${title} ${text}`)&&Boolean(yearFrom(`${title} ${text}`)||priceFrom(`${title} ${text}`));
}

async function fetchPage(url,timeout=4500){const u=safeUrl(url);if(!u)return null;const r=await fetch(u,{redirect:"follow",signal:AbortSignal.timeout(timeout),headers:{"User-Agent":"Mozilla/5.0 (compatible; DalelahBot/1.5; +https://www.dalelah.co)","Accept":"text/html,application/xhtml+xml"}});if(!r.ok)return null;const ct=(r.headers.get("content-type")||"").toLowerCase();if(!ct.includes("text/html"))return null;const html=(await r.text()).slice(0,2_000_000),final=r.url||u.href,title=titleFrom(html,final),text=strip(html).slice(0,12000),fu=new URL(final);if(!directEnough(fu,title,text))return null;const id=modelIdentity(`${title} ${text.slice(0,2000)}`),price=priceFrom(`${title} ${text}`),mileage=mileageFrom(`${title} ${text}`),year=yearFrom(`${title} ${text}`),city=cityFrom(`${title} ${text}`),image=imageFrom(html,final);return{source:sourceName(final),sourceType:"web_discovery",channel:"public_web",title,url:final,image,displayImage:image,imageVerified:Boolean(image),price,priceVerified:Boolean(price),mileage,year,city,brand:id.brand,model:id.model,condition:conditionFrom(`${title} ${text}`),saleVerified:true,discoveredBy:"openai_web_search",fetchedAt:Date.now()};}

function responseText(d){if(typeof d?.output_text==="string")return d.output_text;for(const item of d?.output||[])for(const c of item?.content||[])if(c?.type==="output_text"&&typeof c.text==="string")return c.text;return null;}
function urlsFromResponse(d){const out=new Set();const walk=x=>{if(!x)return;if(typeof x==="string"){for(const m of x.matchAll(/https?:\/\/[^\s"'<>\])}]+/g))out.add(m[0].replace(/[.,;]+$/,""));return}if(Array.isArray(x)){for(const y of x)walk(y);return}if(typeof x==="object")for(const [k,v]of Object.entries(x)){if((k==="url"||k==="link")&&typeof v==="string"&&/^https?:\/\//.test(v))out.add(v);walk(v)}};walk(d?.output);walk(responseText(d));return [...out];}

export async function discoverPublicCarListings({query,intent,apiKey,model="gpt-5.6-luna",timeout=15000,maxCandidates=8}){
  if(!apiKey||!query||intent?.partsRequested)return[];
  const prompt=`Search the public web for current Saudi Arabia WHOLE CAR listings matching: ${query}. Find direct vehicle-for-sale pages only. Prioritize Haraj numeric posts, Syarah cardetail pages, Saudi Sale individual listings, ArabWheels direct used-car pages, YallaMotor, CarSwitch, Motory, official dealers and certified-used dealers. If make/model/year/city are given, search them literally. Exclude parts, wanted ads, model/category/search pages, reviews and price/spec pages. Never invent a URL. ${internetResearchRules()}`;
  const payload={model,reasoning:{effort:"none"},input:[{role:"user",content:[{type:"input_text",text:prompt}]}],tools:[{type:"web_search_preview",search_context_size:"low",user_location:{type:"approximate",country:"SA",city:intent?.city||"Riyadh",timezone:"Asia/Riyadh"}}],tool_choice:"auto",include:["web_search_call.action.sources"],max_output_tokens:320};
  try{
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${apiKey}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeout)});
    if(!r.ok){console.log("WEB_DISCOVERY_TRACE",JSON.stringify({query,status:r.status,urls:0,accepted:0}));return[]}
    const d=await r.json(),urls=urlsFromResponse(d).filter(u=>!/(openai\.com|bing\.com|google\.com)/i.test(u)).slice(0,maxCandidates*4),out=[],seenHosts={};
    for(const url of urls){try{const h=new URL(url).hostname;seenHosts[h]=(seenHosts[h]||0)+1}catch{}}
    for(const url of urls){if(out.length>=maxCandidates)break;try{const c=await fetchPage(url);if(c&&!out.some(x=>x.url===c.url))out.push(c)}catch{}}
    console.log("WEB_DISCOVERY_TRACE",JSON.stringify({query,status:r.status,urls:urls.length,hosts:seenHosts,accepted:out.length,acceptedUrls:out.map(x=>x.url).slice(0,8)}));
    return out;
  }catch(e){console.log("WEB_DISCOVERY_TRACE",JSON.stringify({query,error:e?.message||String(e),urls:0,accepted:0}));return[]}
}
