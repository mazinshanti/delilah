import {harajListingEvidence} from './haraj-listing-evidence.js';
import {resolveCondition} from './vehicle-condition.js';
import {extractListingGallery,publicListingHtml} from './listing-gallery.js';
import {withGallery,vehicleImages} from '../public/vehicle-media.js';

const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const CACHE_TTL=10*60_000;
const cache=new Map();

function isHarajUrl(url=''){
  try{const u=new URL(url);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{8,}/.test(u.pathname)}catch{return false}
}

async function detailPrice(car,timeout){
  const key=String(car?.url||'');
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.at<CACHE_TTL)return hit.value;
  if(!isHarajUrl(key))return null;
  try{
    const html=await publicListingHtml(key,timeout);
    const evidence=harajListingEvidence(html,key);
    const value={...evidence,hasEvidence:Boolean(evidence),images:extractListingGallery(html,key)};
    if(cache.size>1000)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),value});
    return value;
  }catch{return null}
}

export async function enrichHarajListingPrices(listings=[],options={}){
  const max=Math.max(0,Math.min(20,Number(options.max||12)));
  const concurrency=Math.max(1,Math.min(6,Number(options.concurrency||3)));
  const timeout=Math.max(700,Math.min(6000,Number(options.timeout||2600)));
  const xs=(Array.isArray(listings)?listings:[]).map(x=>({...x}));
  const targets=xs.map((car,index)=>({car,index})).filter(({car})=>car?.source==='Haraj'&&(car?.priceVerified!==true||!car?.galleryVerified||car?.mileage==null)&&isHarajUrl(car?.url)).slice(0,max);
  let cursor=0,enriched=0;
  async function worker(){
    while(cursor<targets.length){
      const current=targets[cursor++];
      const hit=await detailPrice(current.car,timeout);
      if(!hit)continue;
      let car={...current.car,mileage:hit.mileage??current.car.mileage??null};
      if(hit.hasEvidence)car={...car,description:hit.description,sourceCondition:hit.sourceCondition,condition:hit.condition==='unknown'?resolveCondition(car):hit.condition,price_type:hit.priceType};
      if(hit.images.length)car={...withGallery(car,hit.images),galleryVerified:true,gallerySource:'public_listing_jsonld',imageVerified:true};
      if(hit.priceHit){const p=hit.priceHit;car={...car,price:p.price,price_sar:p.price,price_type:'cash',price_confidence:p.confidence,source_price_raw:p.evidence,priceVerified:true,priceSource:p.source,priceEvidence:p.evidence,priceDiscovery:'haraj_detail_page',harajPriceMatrix:true};enriched++;}
      xs[current.index]=car;
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,targets.length)},()=>worker()));
  return{listings:xs,enriched,attempted:targets.length};
}
