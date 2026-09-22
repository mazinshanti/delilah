import {cityKey} from './city-normalization.js';
import {isInactiveListing} from './listing-lifecycle.js';
import {normalizeInventoryListing} from './inventory-normalizer.js';
import {exactYearIntent,enforceExactYear} from './search-intent.js';
import {resolveBodyType,normalizeBodyType} from './vehicle-body-type.js';
import {BRAND_GROUPS,detectRequestedBrand,listingMatchesBrand} from './search-relevance.js';
import {detectRequestedModel,listingMatchesModel} from './search-model-relevance.js';
import {fetchHarajFast} from './haraj-fast-source.js';
import {fetchSalehFast} from './saleh-fast-source.js';
import {isSalehUiImage} from './saleh-image.js';
import {fetchOpenSooqPage,openSooqSearchUrl,parseOpenSooqPage} from './opensooq-source.js';
import {filterVehicleSaleListings} from './listing-quality.js';
import {catalogIntent,catalogModelMatches,catalogText} from '../public/catalog.js';
import {vehicleImages,imageUrls} from '../public/vehicle-media.js';
import {rankListings} from './result-ranking.js';

const norm=value=>String(value??'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const canonical=value=>{try{const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(value||'')}};

function mergedImage(old={},car={}){
  if(car.galleryVerified&&vehicleImages(car).length)return vehicleImages(car)[0];
  if(old.galleryVerified&&vehicleImages(old).length)return vehicleImages(old)[0];
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
      if(!old){map.set(key,{...car,url:key,images:vehicleImages(car)});continue}
      const oldPriceVerified=old?.priceVerified===true&&Number.isFinite(Number(old?.price));
      const newPriceVerified=car?.priceVerified===true&&Number.isFinite(Number(car?.price));
      const price=newPriceVerified?car.price:oldPriceVerified?old.price:(car.price??old.price??null);
      const image=mergedImage(old,car);
      map.set(key,{
        ...old,...car,url:key,
        image,
        displayImage:image,
        images:car.galleryVerified?vehicleImages(car):old.galleryVerified?vehicleImages(old):imageUrls(vehicleImages(old),vehicleImages(car)),
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
  const catalog=catalogIntent(query);
  if(catalog.make&&car.normalized_make!==catalogText(catalog.make).toUpperCase())return false;
  if(catalog.model&&car.normalized_model!==catalogText(catalog.model).toUpperCase())return false;
  if(catalog.modelKey&&!catalogModelMatches(car,catalog.modelKey))return false;
  const brand=detectRequestedBrand(query);
  const model=detectRequestedModel(query);
  const declaredBrand=detectRequestedBrand(String(car.make||car.brand||''));
  if(brand&&declaredBrand&&declaredBrand!==brand)return false;
  const declaredModel=detectRequestedModel(String(car.model||''));
  if(!catalog.modelKey&&model&&declaredModel&&declaredModel!==model)return false;
  if(model&&!listingMatchesModel(car,model))return false;
  if(!model){
    let remainder=norm(query);
    for(const alias of (BRAND_GROUPS[brand]||[]).slice().sort((a,b)=>b.length-a.length))remainder=remainder.replace(new RegExp('(^| )'+norm(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?= |$)','g'),' ');
    const budget=/under|above|below|sar|ريال|اقل|أقل/i.test(query);
    const tokens=remainder.split(' ').filter(t=>t.length>0&&!/^(?:cars?|used|new|saudi|under|above|below|in|for|sale|sar|km|ريال|سيارات|سياره|سيارة|للبيع|مستعمل|جديد|all|cars)$/.test(t)&&!(/^(?:19|20)\d{2}$/.test(t))&&!(budget&&/^\d+$/.test(t)));
    const haystack=` ${norm([car.title,car.brand,car.model,car.trim].filter(Boolean).join(' '))} `;
    if(tokens.some(t=>!haystack.includes(` ${t} `)))return false;
  }
  if(!brand)return true;
  if(listingMatchesBrand(car,brand))return true;
  return Boolean(model&&listingMatchesModel(car,model)&&!listingHasConflictingBrand(car,brand));
}

export function strictDirectListings(listings=[],body={}){
  const query=String(body.query||'');
  const condition=body.condition==='all'?'all':body.condition==='new'?'new':'used';
  const filters=body.filters||{};
  const exact=exactYearIntent(query);
  let xs=filterVehicleSaleListings(listings.map(car=>normalizeInventoryListing(car))).filter(car=>!isInactiveListing(car)&&(condition==='all'||car?.condition===condition));
  if(exact)xs=enforceExactYear(xs.filter(car=>!car.year||Number(car.year)===exact),exact,{requireEvidence:true});
  xs=xs.filter(car=>matchesRequestedVehicle(car,query));
  if(filters.minYear)xs=xs.filter(car=>car.year!=null&&Number(car.year)>=Number(filters.minYear));
  if(filters.maxYear)xs=xs.filter(car=>car.year!=null&&Number(car.year)<=Number(filters.maxYear));
  if(filters.make)xs=xs.filter(car=>matchesRequestedVehicle(car,String(filters.make)));
  if(filters.model)xs=xs.filter(car=>matchesRequestedVehicle(car,String(filters.model))&&listingMatchesModel(car,filters.model));
  if(filters.category)xs=xs.filter(car=>/^(electric|hybrid)$/i.test(filters.category)?norm(car.fuelType||car.vehicle?.fuelType||'')===norm(filters.category):Boolean(normalizeBodyType(filters.category))&&resolveBodyType(car)===normalizeBodyType(filters.category));
  if(filters.fuelType)xs=xs.filter(car=>norm(car.fuelType||'').replace('petrol','gasoline')===norm(filters.fuelType).replace('petrol','gasoline'));
  if(filters.trim)xs=xs.filter(car=>norm(car.trim||'')===norm(filters.trim));
  if(filters.seller)xs=xs.filter(car=>[car.seller,car.source].some(s=>norm(s)===norm(filters.seller)));
  if(filters.sourceType)xs=xs.filter(car=>String(car.sourceType||'')===String(filters.sourceType));
  if(filters.city)xs=xs.filter(car=>car.city&&cityKey(car.city)===cityKey(filters.city));
  if(filters.minPrice)xs=xs.filter(car=>car.priceVerified===true&&Number.isFinite(Number(car.price))&&Number(car.price)>=Number(filters.minPrice));
  if(filters.maxPrice)xs=xs.filter(car=>car.priceVerified===true&&Number.isFinite(Number(car.price))&&Number(car.price)<=Number(filters.maxPrice));
  if(filters.maxMileage)xs=xs.filter(car=>car.mileage!=null&&Number(car.mileage)<=Number(filters.maxMileage));
  return rankListings(mergeDirectListings(xs),body);
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
  // Query both accessible live marketplaces concurrently. Previously any Haraj
  // hit stopped the fast lane before OpenSooq was attempted, making the first
  // useful response look much smaller than the connected Saudi market.
  const tasks=[];
  if(allowHaraj)tasks.push(fetchHarajFast({query,filters,timeout:Math.min(timeout,1100)})
    .catch(error=>({listings:[],error:error?.message||String(error)}))
    .then(result=>['Haraj',result]));
  if(allowOpen)tasks.push(fetchOpenSooqFast({query,filters,timeout})
    .catch(error=>({listings:[],error:error?.message||String(error)}))
    .then(result=>['OpenSooq',result]));
  sourceResults.push(...await Promise.all(tasks));

  return responseFrom(sourceResults,normalizedBody,started);
}
