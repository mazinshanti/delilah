import {extractSyarahCashPrice} from './syarah-price.js';

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

export function isSyarahDetailUrl(url=''){
  try{
    const u=new URL(url);
    return /(^|\.)syarah\.com$/i.test(u.hostname)&&/^\/(?:(?:en|ar)\/)?cardetail\//i.test(u.pathname);
  }catch{return false;}
}

async function detailPrice(car,timeout){
  const key=String(car?.url||'');
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.at<CACHE_TTL)return cached.value;
  if(!isSyarahDetailUrl(key))return null;
  try{
    const r=await fetch(key,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-SA,en;q=0.9,ar;q=0.8'}});
    if(!r.ok)return null;
    const html=(await r.text()).slice(0,2_500_000);
    const text=strip(html).slice(0,140_000);
    const value=extractSyarahCashPrice(text);
    cache.set(key,{at:Date.now(),value});
    return value;
  }catch{return null;}
}

export async function enrichSyarahListingPrices(listings=[],options={}){
  const max=Math.max(0,Math.min(30,Number(options.max||16)));
  const concurrency=Math.max(1,Math.min(8,Number(options.concurrency||4)));
  const timeout=Math.max(700,Math.min(6500,Number(options.timeout||3000)));
  const xs=(Array.isArray(listings)?listings:[]).map(x=>({...x}));
  const targets=xs.map((car,index)=>({car,index})).filter(({car})=>car?.source==='Syarah'&&car?.priceVerified!==true&&isSyarahDetailUrl(car?.url)).slice(0,max);
  let cursor=0,enriched=0;
  async function worker(){
    while(cursor<targets.length){
      const current=targets[cursor++];
      const hit=await detailPrice(current.car,timeout);
      if(!hit)continue;
      xs[current.index]={...current.car,price:hit.price,priceVerified:true,priceSource:hit.source,priceEvidence:hit.evidence,priceDiscovery:'syarah_detail_page',syarahPriceMatrix:true};
      enriched++;
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,targets.length)},()=>worker()));
  return{listings:xs,enriched,attempted:targets.length};
}
