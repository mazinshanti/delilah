import {exactYearIntent,enforceExactYear} from './search-intent.js';
import {filterBrandRelevance} from './search-relevance.js';
import {fetchHarajFast} from './haraj-fast-source.js';
import {fetchSalehFast} from './saleh-fast-source.js';
import {fetchOpenSooqPage,openSooqSearchUrl,parseOpenSooqPage} from './opensooq-source.js';

const norm=value=>String(value??'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const canonical=value=>{try{const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(value||'')}};

export function mergeDirectListings(...groups){
  const map=new Map();
  for(const group of groups){
    for(const car of Array.isArray(group)?group:[]){
      const key=canonical(car?.url||car?.originalUrl||'');
      if(!key)continue;
      const old=map.get(key);
      map.set(key,old?{
        ...old,...car,url:key,
        image:car.image||old.image||null,
        displayImage:car.displayImage||old.displayImage||null,
        price:car.price??old.price??null,
        mileage:car.mileage??old.mileage??null,
        city:car.city||old.city||null
      }:{...car,url:key});
    }
  }
  return [...map.values()];
}

export function strictDirectListings(listings=[],body={}){
  const query=String(body.query||'');
  const condition=body.condition==='new'?'new':'used';
  const filters=body.filters||{};
  const exact=exactYearIntent(query);
  let xs=(Array.isArray(listings)?listings:[]).filter(car=>!car?.condition||car.condition===condition);
  if(exact)xs=enforceExactYear(xs,exact,{requireEvidence:true});
  xs=filterBrandRelevance(xs,query);
  if(filters.seller)xs=xs.filter(car=>norm(car.seller||car.source||'')===norm(filters.seller));
  if(filters.sourceType)xs=xs.filter(car=>String(car.sourceType||'')===String(filters.sourceType));
  if(filters.city)xs=xs.filter(car=>car.city&&norm(car.city)===norm(filters.city));
  if(filters.maxPrice)xs=xs.filter(car=>car.priceVerified===true&&Number.isFinite(Number(car.price))&&Number(car.price)<=Number(filters.maxPrice));
  if(filters.maxMileage)xs=xs.filter(car=>car.mileage!=null&&Number(car.mileage)<=Number(filters.maxMileage));
  return mergeDirectListings(xs);
}

async function fetchOpenSooqFast({query,filters,timeout}){
  const url=openSooqSearchUrl({query,filters});
  try{
    const page=await fetchOpenSooqPage(url,{timeout});
    return {listings:parseOpenSooqPage(page.html,{condition:'used',query,filters}),error:null,url:page.url||url};
  }catch(error){
    return {listings:[],error:error?.message||String(error),url};
  }
}

export async function searchDirectFirst(body={},options={}){
  const query=String(body.query||'').trim();
  const condition=body.condition==='new'?'new':'used';
  const filters=body.filters||{};
  const timeout=Math.max(500,Number(options.timeoutMs||2200));
  if(!query)return {listings:[],counts:{},sources:[],errors:['query-required'],durationMs:0};

  const started=Date.now();
  const sourceResults=[];
  if(condition==='new'){
    const saleh=await fetchSalehFast({query,filters,timeout}).catch(error=>({listings:[],error:error?.message||String(error)}));
    sourceResults.push(['Saleh Cars',saleh]);
  }else{
    const seller=norm(filters.seller||'');
    const tasks=[];
    if(!seller||seller===norm('Haraj'))tasks.push(Promise.resolve(fetchHarajFast({query,filters,timeout})).then(result=>['Haraj',result]));
    if(!seller||seller===norm('OpenSooq'))tasks.push(Promise.resolve(fetchOpenSooqFast({query,filters,timeout})).then(result=>['OpenSooq',result]));
    sourceResults.push(...await Promise.all(tasks));
  }

  const listings=strictDirectListings(mergeDirectListings(...sourceResults.map(([,r])=>r?.listings||[])),{query,condition,filters});
  const counts=listings.reduce((out,car)=>{const key=car.source||car.seller||'Other';out[key]=(out[key]||0)+1;return out;},{});
  return {
    listings,
    counts,
    sources:sourceResults.map(([name,r])=>({name,count:Array.isArray(r?.listings)?r.listings.length:0,error:r?.error||null,url:r?.url||null,sourceQuery:r?.sourceQuery||null})),
    errors:sourceResults.map(([name,r])=>r?.error?`${name}: ${r.error}`:null).filter(Boolean),
    durationMs:Date.now()-started,
    directSearch:true,
    exactYear:exactYearIntent(query),
    complete:false
  };
}
