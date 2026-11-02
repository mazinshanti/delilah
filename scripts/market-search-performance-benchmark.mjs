import {performance} from 'node:perf_hooks';
import {detectRequestedModel,listingMatchesModel} from '../lib/search-model-relevance.js';
import {exactYearIntent} from '../lib/search-intent.js';
import {resolveBodyType} from '../lib/vehicle-body-type.js';

const base=(process.env.DALELAH_BENCHMARK_URL||'https://www.dalelah.co').replace(/\/$/,'');
const maxPolls=Math.min(5,Math.max(0,Number(process.env.DALELAH_BENCHMARK_POLLS||3)));
const timeoutMs=Math.min(55000,Math.max(2000,Number(process.env.DALELAH_BENCHMARK_TIMEOUT_MS||25000)));
const delayMs=700;
const cases=[
  {id:'corolla',query:'Toyota Corolla',condition:'used'},
  {id:'camry',query:'Toyota Camry',condition:'used'},
  {id:'patrol',query:'Nissan Patrol',condition:'used'},
  {id:'wrangler',query:'Jeep Wrangler',condition:'used'},
  {id:'tucson',query:'Hyundai Tucson',condition:'used'},
  {id:'sportage',query:'Kia Sportage',condition:'used'},
  {id:'lexus-rx',query:'Lexus RX',condition:'used'},
  {id:'bmw-x5',query:'BMW X5',condition:'used'},
  {id:'cayenne-2018',query:'Porsche Cayenne 2018',condition:'used'},
  {id:'corolla-2013',query:'Toyota Corolla 2013',condition:'used'},
  {id:'corolla-arabic',query:'تويوتا كورولا ٢٠١٣',condition:'used'},
  {id:'peugeot-model',query:'Peugeot 2008',condition:'used'},
  {id:'new-corolla',query:'Toyota Corolla',condition:'new'},
  {id:'camry-budget',query:'Toyota Camry',condition:'used',filters:{maxPrice:100000}},
  {id:'patrol-riyadh',query:'Nissan Patrol',condition:'used',filters:{city:'Riyadh'}},
  {id:'lexus-mileage',query:'Lexus RX',condition:'used',filters:{maxMileage:80000}},
  {id:'arabic-ai-suv',query:'أبي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة',condition:'used'}
];

const clock=()=>performance.now();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const num=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const pct=(a,b)=>b?Math.round(a/b*100):null;
const quantile=(values,p)=>{
  const xs=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length)return null;
  const i=Math.ceil(xs.length*p)-1;
  return Math.round(xs[Math.max(0,i)]);
};
async function api(path,options={}){
 const started=clock();
 const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(timeoutMs)});
 const body=await response.text();
 let data;
 try{data=JSON.parse(body)}catch{throw new Error('non-JSON HTTP '+response.status+' '+body.slice(0,75))}
 if(!response.ok)throw new Error('HTTP '+response.status+' '+JSON.stringify(data).slice(0,130));
 return {data,ms:Math.round(clock()-started)};
}

async function one(test){
 const start=clock();
 const filters=test.filters||{};
 const result={id:test.id,query:test.query,condition:test.condition,filters,firstResponseMs:null,
   firstResultsMs:null,totalElapsedMs:null,uniqueUrlListings:0,complete:false,
   pagesPolled:0,sources:{},error:null};
 try{
  const first=await api('/api/search',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({query:test.query,condition:test.condition,filters})
  });
  result.firstResponseMs=first.ms;
  let data=first.data;
  let all=new Map();
  let bestCount=0;
  let firstResultsAt=null;
  function collect(d){
   for(const car of Array.isArray(d.listings)?d.listings:[]){
    const url=String(car?.url||car?.originalUrl||'').trim();
    if(url)all.set(url,car);
   }
   if(all.size&&!firstResultsAt)firstResultsAt=Math.round(clock()-start);
   bestCount=Math.max(bestCount,all.size);
  }
  collect(data);
  result.initialListings=all.size;
  for(let i=0;i<maxPolls&&data.searchId&&data.complete!==true;i++){
   await sleep(delayMs);
   const progress=await api('/api/search/progress/'+encodeURIComponent(data.searchId));
   data=progress.data;result.pagesPolled++;
   collect(data);
  }
  result.complete=data.complete===true||data.marketScanComplete===true;
  const cars=[...all.values()];
  const model=detectRequestedModel(test.query);
  const year=exactYearIntent(test.query);
  const priceCap=num(filters.maxPrice);
  const mileageCap=num(filters.maxMileage);
  const city=filters.city;
  let mismatchModel=0,mismatchYear=0,mismatchCondition=0,mismatchPrice=0,mismatchMileage=0,mismatchCity=0;
  let validPrice=0,withImage=0,withMileage=0,vehicleTypeUnknown=0;
  for(const car of cars){
   if(model&&!listingMatchesModel(car,model))mismatchModel++;
   if(year!=null&&num(car.year)!==year)mismatchYear++;
   if(test.condition&&car.condition&&car.condition!==test.condition)mismatchCondition++;
   if(priceCap!=null&&!(car.priceVerified===true&&num(car.price)!=null&&num(car.price)<=priceCap))mismatchPrice++;
   const mileage=num(car.mileageKm??car.mileage);
   if(mileageCap!=null&&!(mileage!=null&&mileage<=mileageCap))mismatchMileage++;
   if(city&&!String(car.city||'').toLowerCase().includes(city.toLowerCase()))mismatchCity++;
   if(car.priceVerified===true&&num(car.price)!=null&&num(car.price)>0)validPrice++;
   if(car.image||car.displayImage||car.primary_image)withImage++;
   if(mileage!=null&&mileage>=0)withMileage++;
   if(test.id==='arabic-ai-suv'&&!resolveBodyType(car))vehicleTypeUnknown++;
   const name=car.source||car.seller||'Unknown';
   result.sources[name]=(result.sources[name]||0)+1;
  }
  result.firstResultsMs=firstResultsAt;
  result.totalElapsedMs=Math.round(clock()-start);
  result.uniqueUrlListings=cars.length;
  result.mismatches={model:mismatchModel,exactYear:mismatchYear,condition:mismatchCondition,price:mismatchPrice,mileage:mismatchMileage,city:mismatchCity};
  result.quality={verifiedPricePct:pct(validPrice,cars.length),imagePct:pct(withImage,cars.length),
    mileagePct:pct(withMileage,cars.length),unknownBodyCount:vehicleTypeUnknown};
  result.ai={intentMode:data.intentMode||null,providerAttempted:data.aiProviderAttempted??null,
    interpretationUnavailable:data.interpretationUnavailable??null,parsedIntent:data.parsedIntent||null,
    aiFallbackReason:data.ai?.fallbackReason||null};
  result.scanStatus=data.scanStatus||null;
  result.partial=data.partial??null;
  result.sourceErrors=data.sourceErrors?.slice(0,3)||[];
  result.observation='URL count is not guaranteed physically distinct cars or full market coverage';
 }catch(err){
  result.error=String(err.message||err).slice(0,250);
  result.totalElapsedMs=Math.round(clock()-start);
 }
 console.log('BENCHMARK_CASE '+JSON.stringify(result));
 return result;
}
const summary={timestamp:new Date().toISOString(),base,mode:'production-public-api',
  pollLimit:maxPolls,requestTimeoutMs:timeoutMs,results:[],error:null};
try{
 const health=await api('/healthz'); summary.health=health.data.ok===true;
 if(!summary.health)throw Error('unhealthy API');
 for(const test of cases)summary.results.push(await one(test));
 const good=summary.results.filter(x=>!x.error);
 const metric=key=>({p50:quantile(good.map(x=>x[key]),0.5),p95:quantile(good.map(x=>x[key]),0.95)});
 summary.stats={
  queries:cases.length,success:good.length,errors:cases.length-good.length,
  firstResponseMs:metric('firstResponseMs'),firstResultsMs:metric('firstResultsMs'),
  elapsedMs:metric('totalElapsedMs'),completed:good.filter(x=>x.complete).length,
  zeroResults:good.filter(x=>x.uniqueUrlListings===0).map(x=>x.id),
  withConstraintViolations:good.filter(x=>Object.values(x.mismatches||{}).some(v=>v>0)).map(x=>x.id)
 };
}catch(err){summary.error=String(err.message||err)}
console.log('BENCHMARK_SUMMARY '+JSON.stringify(summary));
if(summary.error||summary.stats?.errors)process.exitCode=1;
