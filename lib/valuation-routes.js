import {matchValuationTrims} from './valuation-trim-assist.js';
import {validateValuationInput,valueVehicle} from './vehicle-valuation.js';
import {searchDirectFirst,mergeDirectListings} from './direct-search.js';
import {enrichHarajListingPrices} from './haraj-price-enrichment.js';
import {extractMileage} from './vehicle-mileage.js';

const TARGET_COMPARABLES=5;
const LIVE_SEARCH_TIMEOUT_MS=3200;
const HARAJ_DETAIL_TIMEOUT_MS=1800;

function normalizeLiveListings(listings,vehicle,now){
 const seenAt=new Date(now).toISOString();
 return (Array.isArray(listings)?listings:[]).map(car=>{
  const parsedYear=car?.year!=null&&car.year!==''?Number(car.year):NaN;
  const year=Number.isInteger(parsedYear)&&parsedYear>=1980&&parsedYear<=new Date(now).getFullYear()+1?parsedYear:null;
  const rawMileage=car?.mileage;
  const mileage=rawMileage!=null&&rawMileage!==''&&Number.isFinite(Number(rawMileage))?Number(rawMileage):extractMileage(`${car?.title||''} ${car?.snippet||''}`);
  const url=car?.originalUrl||car?.url||null;
  return {
   ...car,
   make:vehicle.make,
   brand:vehicle.make,
   model:vehicle.model,
   year,
   yearVerified:Boolean(year),
   mileage:Number.isFinite(mileage)?mileage:null,
   condition:'used',
   availability:'listed',
   url,
   originalUrl:url,
   lastSeenAt:seenAt,
   liveValuationComparable:true
  };
 }).filter(car=>car.url&&car.yearVerified&&car.priceVerified===true&&Number.isFinite(Number(car.price))&&Number(car.price)>0);
}

async function searchSellerYear(searchMarket,vehicle,year,seller,now){
 const body={query:`${vehicle.make} ${vehicle.model} ${year}`,condition:'used',filters:{minYear:year,maxYear:year,seller}};
 try{
  const raw=await searchMarket(body,{timeoutMs:LIVE_SEARCH_TIMEOUT_MS});
  let listings=Array.isArray(raw?.listings)?raw.listings:[];
  if(seller==='Haraj'&&listings.length){
   const enriched=await enrichHarajListingPrices(listings,{max:8,concurrency:4,timeout:HARAJ_DETAIL_TIMEOUT_MS});
   listings=enriched.listings;
  }
  return {seller,year,listings:normalizeLiveListings(listings,vehicle,now),error:null};
 }catch(error){
  return {seller,year,listings:[],error:error?.message||String(error)};
 }
}

async function searchStage(searchMarket,vehicle,years,now){
 const started=Date.now();
 const results=await Promise.all(years.flatMap(year=>['Haraj','OpenSooq'].map(seller=>searchSellerYear(searchMarket,vehicle,year,seller,now))));
 const listings=mergeDirectListings(...results.map(result=>result.listings));
 const counts={};
 for(const result of results)counts[`${result.seller}:${result.year}`]=result.listings.length;
 return {
  years,
  listings,
  counts,
  errors:results.filter(result=>result.error).map(result=>({source:result.seller,year:result.year,error:result.error})),
  durationMs:Date.now()-started
 };
}

async function collectValuationRecords(cached,vehicle,{snapshotAt,searchMarket,now=Date.now()}={}){
 let records=Array.isArray(cached)?cached:[];
 let probe=valueVehicle(records,vehicle,{snapshotAt,now});
 const started=Date.now(),stages=[];
 if(probe.comparableCount>=TARGET_COMPARABLES)return {records,marketSearch:{attempted:false,mode:'cache-only',targetComparableCount:TARGET_COMPARABLES,stages,durationMs:0}};
 const plans=[
  {name:'exact-year',years:[vehicle.year]},
  {name:'adjacent-years',years:[vehicle.year-1,vehicle.year+1]},
  {name:'nearby-years',years:[vehicle.year-2,vehicle.year+2]}
 ];
 for(const plan of plans){
  const stage=await searchStage(searchMarket,vehicle,plan.years,now);
  stages.push({name:plan.name,years:stage.years,counts:stage.counts,errors:stage.errors,durationMs:stage.durationMs});
  records=mergeDirectListings(records,stage.listings);
  probe=valueVehicle(records,vehicle,{snapshotAt,now});
  if(probe.comparableCount>=TARGET_COMPARABLES)break;
 }
 return {records,marketSearch:{attempted:true,mode:'cache+live',targetComparableCount:TARGET_COMPARABLES,stages,durationMs:Date.now()-started}};
}

export function installValuationRoutes(app,{inventoryIndex,searchMarket=searchDirectFirst}){
 app.post('/api/car-valuation',async(req,res)=>{
  const started=performance.now(),v=validateValuationInput(req.body);if(!v.ok)return res.status(400).json({error:'invalid-vehicle',fields:v.fields});
  try{
   const cached=inventoryIndex.fresh();
   const market=await collectValuationRecords(cached,v.value,{snapshotAt:inventoryIndex.generatedAt,searchMarket});
   const assist=await matchValuationTrims(v.value,market.records);
   const result=valueVehicle(market.records,v.value,{snapshotAt:inventoryIndex.generatedAt,...assist});
   res.setHeader('Server-Timing',`valuation;dur=${(performance.now()-started).toFixed(1)}`);
   res.json({...result,marketSearch:market.marketSearch});
  }catch{res.status(503).json({error:'valuation-unavailable'});}
 });
}
