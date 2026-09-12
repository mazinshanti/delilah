import {extractHarajPrice} from './haraj-price.js';

const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const CACHE_TTL=10*60_000;
const cache=new Map();

function strip(html=''){
  return String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&rlm;|&lrm;/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function isHarajUrl(url=''){
  try{const u=new URL(url);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{8,}/.test(u.pathname)}catch{return false}
}

async function detailPrice(car,timeout){
  const key=String(car?.url||'');
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.value;
  if(!isHarajUrl(key))return null;
  try{
    const r=await fetch(key,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'ar-SA,ar;q=0.9,en;q=0.7'}});
    if(!r.ok)return null;
    const html=(await r.text()).slice(0,2_000_000);
    const text=strip(html).slice(0,80_000);
    const value=extractHarajPrice(text,{year:car?.year});
    cache.set(key,{at:Date.now(),value});
    return value;
  }catch{return null}
}

export async function enrichHarajListingPrices(listings=[],options={}){
  const max=Math.max(0,Math.min(20,Number(options.max||12)));
  const concurrency=Math.max(1,Math.min(6,Number(options.concurrency||3)));
  const timeout=Math.max(700,Math.min(6000,Number(options.timeout||2600)));
  const xs=(Array.isArray(listings)?listings:[]).map(x=>({...x}));
  const targets=xs.map((car,index)=>({car,index})).filter(({car})=>car?.source==='Haraj'&&car?.priceVerified!==true&&isHarajUrl(car?.url)).slice(0,max);
  let cursor=0,enriched=0;
  async function worker(){
    while(cursor<targets.length){
      const current=targets[cursor++];
      const hit=await detailPrice(current.car,timeout);
      if(!hit)continue;
      xs[current.index]={...current.car,price:hit.price,priceVerified:true,priceSource:hit.source,priceEvidence:hit.evidence,priceDiscovery:'haraj_detail_page',harajPriceMatrix:true};
      enriched++;
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,targets.length)},()=>worker()));
  return{listings:xs,enriched,attempted:targets.length};
}
