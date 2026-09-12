import {exactYearIntent,enforceExactYear} from './search-intent.js';
import {BRAND_GROUPS,detectRequestedBrand,listingMatchesBrand} from './search-relevance.js';
import {detectRequestedModel,listingMatchesModel} from './search-model-relevance.js';
import {fetchHarajFast} from './haraj-fast-source.js';
import {fetchSalehFast} from './saleh-fast-source.js';
import {isSalehUiImage} from './saleh-image.js';
import {fetchOpenSooqPage,openSooqSearchUrl,parseOpenSooqPage} from './opensooq-source.js';

const norm=value=>String(value??'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const canonical=value=>{try{const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(value||'')}};

function mergedImage(old={},car={}){
  const newImage=car.image||car.displayImage||null;
  const oldImage=old.image||old.displayImage||null;
  const saleh=norm(car.source||car.seller||old.source||old.seller||'')===norm('Saleh Cars');
  if(saleh&&newImage&&isSalehUiImage(newImage,car.title||old.title||''))return oldImage||null;
  return newImage||oldImage||null;
}

export function mergeDirectListings(...groups){
  const map=new Map();
  for(const group of groups){
    for(const car of Array.isArray(group)?group:[]){
      const key=canonical(car?.url||car?.originalUrl||'');
      if(!key)continue;
      const old=map.get(key);
      if(!old){map.set(key,{...car,url:key});continue}
      const oldPriceVerified=old?.priceVerified===true&&Number.isFinite(Number(old?.price));
      const newPriceVerified=car?.priceVerified===true&&Number.isFinite(Number(car?.price));
      const price=newPriceVerified?car.price:oldPriceVerified?old.price:(car.price??old.price??null);
      const image=mergedImage(old,car);
      map.set(key,{
        ...old,...car,url:key,
        image,
        displayImage:image,
        imageVerified:Boolean(image&&(old.imageVerified===true||car.imageVerified===true)),
        price,
        priceVerified:Boolean(newPriceVerified||oldPriceVerified),
        priceSource:newPriceVerified?(car.priceSource||null):oldPriceVerified?(old.priceSource||null):(car.priceSource||old.priceSource||null),
        priceEvidence:newPriceVerified?(car.priceEvidence||null):oldPriceVerified?(old.priceEvidence||null):(car.priceEvidence||old.priceEvidence||null),
        mileage:car.mileage??old.mileage??null,
        city:car.city||old.city||null
      });
    }
  }
  return [...map.values()];
}

function listingHasConflictingBrand(car={},requestedBrand=null){
  if(!requestedBrand)return false;
  return Object.keys(BRAND_GROUPS).some(brand=>brand!==requestedBrand&&listingMatchesBrand(car,brand));
}

function matchesRequestedVehicle(car={},query=''){
  const brand=detectRequestedBrand(query);
  const model=detectRequestedModel(query);
  if(model&&!listingMatchesModel(car,model))return false;
  if(!brand)return true;
  if(listingMatchesBrand(car,brand))return true;
  return Boolean(model&&listingMatchesModel(car,model)&&!listingHasConflictingBrand(car,brand));
}

export function strictDirectListings(listings=[],body={}){
  const query=String(body.query||'');
  const condition=body.condition==='new'?'new':'used';
  const filters=body.filters||{};
  const exact=exactYearIntent(query);
  let xs=(Array.isArray(listings)?listings:[]).filter(car=>!car?.condition||car.condition===condition);
  if(exact)xs=enforceExactYear(xs,exact,{requireEvidence:true});
  xs=xs.filter(car=>matchesRequestedVehicle(car,query));
  if(filters.seller)xs=xs.filter(car=>norm(car.seller||car.source||'')===norm(filters.seller));
  if(filters.sourceType)xs=xs.filter(car=>String(car.sourceType||'')===String(filters.sourceType));
  if(filters.city)xs=xs.filter(car=>car.city&&norm(car.city)===norm(filters.city));
  if(filters.minPrice)xs=xs.filter(car=>car.priceVerified===true&&Number.isFinite(Number(car.price))&&Number(car.price)>=Number(filters.minPrice));
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

function responseFrom(sourceResults,body,started){
  const listings=strictDirectListings(mergeDirectListings(...sourceResults.map(([,r])=>r?.listings||[])),body);
  const counts=listings.reduce((out,car)=>{const key=car.source||car.seller||'Other';out[key]=(out[key]||0)+1;return out;},{});
  return {
    listings,
    counts,
    sources:sourceResults.map(([name,r])=>({name,count:Array.isArray(r?.listings)?r.listings.length:0,error:r?.error||null,url:r?.url||null,sourceQuery:r?.sourceQuery||null})),
    errors:sourceResults.map(([name,r])=>r?.error?`${name}: ${r.error}`:null).filter(Boolean),
    durationMs:Date.now()-started,
    directSearch:true,
    exactYear:exactYearIntent(String(body.query||'')),
    complete:false
  };
}

export async function searchDirectFirst(body={},options={}){
  const query=String(body.query||'').trim();
  const condition=body.condition==='new'?'new':'used';
  const filters=body.filters||{};
  const timeout=Math.max(500,Number(options.timeoutMs||1800));
  if(!query)return {listings:[],counts:{},sources:[],errors:['query-required'],durationMs:0};

  const started=Date.now();
  const sourceResults=[];
  const normalizedBody={query,condition,filters};

  if(condition==='new'){
    const saleh=await fetchSalehFast({query,filters,timeout}).catch(error=>({listings:[],error:error?.message||String(error)}));
    sourceResults.push(['Saleh Cars',saleh]);
    return responseFrom(sourceResults,normalizedBody,started);
  }

  const seller=norm(filters.seller||'');
  const allowHaraj=!seller||seller===norm('Haraj');
  const allowOpen=!seller||seller===norm('OpenSooq');

  if(allowHaraj){
    const harajBudget=Math.min(timeout,900);
    const haraj=await fetchHarajFast({query,filters,timeout:harajBudget}).catch(error=>({listings:[],error:error?.message||String(error)}));
    sourceResults.push(['Haraj',haraj]);
    const fast=responseFrom(sourceResults,normalizedBody,started);
    if(fast.listings.length)return fast;
  }

  const elapsed=Date.now()-started;
  const remaining=Math.max(300,timeout-elapsed);
  if(allowOpen&&remaining>=300){
    const open=await fetchOpenSooqFast({query,filters,timeout:remaining}).catch(error=>({listings:[],error:error?.message||String(error)}));
    sourceResults.push(['OpenSooq',open]);
  }

  return responseFrom(sourceResults,normalizedBody,started);
}