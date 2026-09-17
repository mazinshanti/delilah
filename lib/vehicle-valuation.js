import {catalogMake,catalogIntent,catalogText} from '../public/catalog.js';
import {deduplicateVehicles} from './inventory-index.js';

const cities={Riyadh:['الرياض'],Jeddah:['جدة','جده'],Dammam:['الدمام'],Khobar:['الخبر'],Makkah:['مكة','مكه'],Madinah:['المدينة','المدينه'],Abha:['أبها','ابها'],Tabuk:['تبوك'],Taif:['الطائف'],Jazan:['جازان','جيزان'],Hail:['حائل'],Buraidah:['بريدة'],Jubail:['الجبيل'],Hofuf:['الهفوف'],Najran:['نجران'],Yanbu:['ينبع'],Qatif:['القطيف'],AlAhsa:['الأحساء','الاحساء']};
export const VALUATION_CITIES=Object.keys(cities);
const clean=v=>typeof v==='string'?v.trim():'';
const number=v=>{const s=String(v??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[,٬]/g,'').trim();return /^\d+$/.test(s)?Number(s):NaN;};
const cityName=v=>Object.entries(cities).find(([k,a])=>[k,...a].some(x=>catalogText(x)===catalogText(v)))?.[0]||null;
const optional=['trim','engine','transmission','driveType','exteriorColor','specification','owners','accidentHistory','serviceHistory','vehicleCondition'];
export function validateValuationInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return{ok:false,fields:['vehicle']};
 const fields=[],make=catalogMake(clean(input.make)),model=make?.models.find(x=>[x.name,...x.aliases].some(a=>catalogText(a)===catalogText(clean(input.model))));
 const v={make:make?.name,model:model?.name,year:number(input.year),mileageKm:number(input.mileageKm),city:cityName(input.city)};
 if(!make||clean(input.make).length>80)fields.push('make');if(!model)fields.push('model');
 if(!Number.isInteger(v.year)||v.year<1900||v.year>new Date().getFullYear()+1)fields.push('year');
 if(!Number.isInteger(v.mileageKm)||v.mileageKm<0||v.mileageKm>3000000)fields.push('mileageKm');if(!v.city)fields.push('city');
 for(const k of optional){if(input[k]!=null&&input[k]!==''){if(typeof input[k]!=='string'||input[k].length>100||/[\x00-\x1f]/.test(input[k]))fields.push(k);else v[k]=input[k].trim();}}
 if(v.vehicleCondition&&!['excellent','very-good','good','fair'].includes(v.vehicleCondition))fields.push('vehicleCondition');
 if(v.owners&&!/^[1-9]\d?$/.test(v.owners))fields.push('owners');
 for(const k of ['accidentHistory','serviceHistory'])if(v[k]&&!['yes','no','unknown'].includes(v[k]))fields.push(k);
 return{ok:!fields.length,fields:[...new Set(fields)],value:v};
}
const median=xs=>quantile(xs,.5);
function quantile(xs,p){const a=[...xs].sort((a,b)=>a-b);if(!a.length)return null;const n=(a.length-1)*p,i=Math.floor(n);return a[i]+(a[Math.ceil(n)]-a[i])*(n-i);}
function weightedQuantile(rows,p){const a=[...rows].sort((a,b)=>a.value-b.value),target=a.reduce((n,x)=>n+x.weight,0)*p;let total=0;for(const x of a){total+=x.weight;if(total>=target)return x.value;}return a.at(-1)?.value??null;}
const round=v=>Math.round(v/500)*500;
const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const same=(a,b)=>Boolean(a&&b&&catalogText(a)===catalogText(b));
const badSale=car=>/(?:\bsalvage\b|\bscrap\b|\bnon[ -]?running\b|\bmonthly payment\b|\bdown payment\b|تشليح|مصدوم|غرقان|دفعة اولى|قسط شهري)/i.test(`${car.title||''} ${car.snippet||''}`);
function removeOutliers(rows){if(rows.length<5)return rows;const prices=rows.map(x=>x.price),m=median(prices),mad=median(prices.map(p=>Math.abs(p-m))),spread=Math.max(m*.3,3*1.4826*mad);return rows.filter(x=>Math.abs(x.price-m)<=spread);}

// Optional mileage adjustment is learned only from enough same-year, same-trim observations.
// No fixed depreciation, city premiums, maintenance claims or AI-generated prices.
function mileageAdjustment(rows,vehicle){
 const a=rows.filter(c=>c.year===vehicle.year&&Number.isFinite(c.mileage)&&c.mileage>=0&&(!vehicle.trim||same(c.trim,vehicle.trim)));
 if(a.length<10)return null;
 const trims=new Set(a.map(c=>catalogText(c.trim||'')));if(trims.size!==1||!a[0].trim)return null;
 const min=Math.min(...a.map(c=>c.mileage)),max=Math.max(...a.map(c=>c.mileage));if(max-min<40000||vehicle.mileageKm<min||vehicle.mileageKm>max)return null;
 const mx=a.reduce((s,c)=>s+c.mileage,0)/a.length,my=a.reduce((s,c)=>s+c.price,0)/a.length;
 let xx=0,yy=0,xy=0;for(const c of a){xx+=(c.mileage-mx)**2;yy+=(c.price-my)**2;xy+=(c.mileage-mx)*(c.price-my);}
 const slope=xy/xx,r2=xy*xy/(xx*yy);if(!Number.isFinite(r2)||r2<.35||slope>=0||Math.abs(slope)*10000>my*.1)return null;
 return{slope,sampleSize:a.length,r2,trim:a[0].trim};
}
export function valueVehicle(records,vehicle,{snapshotAt=null,now=Date.now(),maxAgeMs=36*3600000,matchingTrims=[],aiMode='deterministic'}={}){
 const identity=`${vehicle.make}::${vehicle.model}`;
 let candidates=deduplicateVehicles(records).filter(c=>{
  if(c.condition!=='used'||c.availability&&c.availability!=='listed'||c.priceVerified!==true||!Number.isFinite(c.price)||c.price<=0||!c.yearVerified||!Number.isInteger(c.year)||!safeURL(c.originalUrl||c.url)||!c.source||badSale(c))return false;
  const seen=Date.parse(c.lastSeenAt||snapshotAt);if(!Number.isFinite(seen)||now-seen>maxAgeMs||seen-now>60000)return false;
  const match=catalogIntent(`${c.make||c.brand||''} ${c.model||''}`);
  return match.modelKey===identity&&Math.abs(c.year-vehicle.year)<=2;
 });
 let distance=0;while(distance<2&&candidates.filter(c=>Math.abs(c.year-vehicle.year)<=distance).length<5)distance++;
 candidates=candidates.filter(c=>Math.abs(c.year-vehicle.year)<=distance);
 // All expansions stay inside the exact catalog model. Never substitute a different car.
 let rows=removeOutliers(candidates);const outlierCount=candidates.length-rows.length;
 const trimMatch=c=>same(c.trim,vehicle.trim)||matchingTrims.some(t=>same(t,c.trim));
 const trimRows=vehicle.trim?rows.filter(trimMatch):[];if(trimRows.length>=5)rows=trimRows;
 const preservesYear=next=>next.filter(c=>c.year===vehicle.year).length>=Math.min(3,rows.filter(c=>c.year===vehicle.year).length);
 const localRows=rows.filter(c=>cityName(c.city)===vehicle.city);if(localRows.length>=5&&preservesYear(localRows))rows=localRows;
 const mileageRows=rows.filter(c=>Number.isFinite(c.mileage)&&Math.abs(c.mileage-vehicle.mileageKm)<=Math.max(30000,vehicle.mileageKm*.35));if(mileageRows.length>=5&&preservesYear(mileageRows))rows=mileageRows;
 const exactCount=rows.filter(c=>c.year===vehicle.year).length;
 const sources=Object.fromEntries([...new Set(rows.map(c=>c.source))].map(s=>[s,rows.filter(c=>c.source===s).length]));
 const base={available:false,vehicle,snapshotAt,calculatedAt:new Date(now).toISOString(),priceBasis:'asking-prices',methodologyVersion:'evidence-v1',aiMode,comparableCount:rows.length,exactYearCount:exactCount,confidence:'limited',estimatedMarketValue:null,valuationLow:null,valuationHigh:null,quickSaleValue:null,recommendedListingPrice:null,medianComparablePrice:null,adjustmentFactors:[],sourcesUsed:sources,comparableListings:[],limitations:['asking-not-sold-prices']};
 if(distance&&rows.some(c=>c.year!==vehicle.year))base.limitations.push('nearby-years');
 if(rows.some(c=>cityName(c.city)!==vehicle.city))base.limitations.push('other-cities');
 if(!rows.length||rows.some(c=>!Number.isFinite(c.mileage)))base.limitations.push('missing-mileage');
 for(const k of optional)if(vehicle[k]&&!(k==='trim'&&trimRows.length>=5))base.limitations.push(`unadjusted-${k}`);
 if(rows.length<3)return{...base,reason:'insufficient-comparables'};
 const learned=mileageAdjustment(candidates,vehicle);
 const weighted=rows.map(car=>{const mileageFit=Number.isFinite(car.mileage)?1/(1+Math.abs(car.mileage-vehicle.mileageKm)/50000):.35;
 const weight=(car.year===vehicle.year?4:1/Math.abs(car.year-vehicle.year))*(cityName(car.city)===vehicle.city?1.35:1)*mileageFit*(vehicle.trim?(trimMatch(car)?1.6:car.trim ? .5 : .8):1);
 const adjustment=learned&&car.year===vehicle.year&&same(car.trim,learned.trim)&&Number.isFinite(car.mileage)?Math.max(-car.price*.1,Math.min(car.price*.1,learned.slope*(vehicle.mileageKm-car.mileage))):0;
 return{car,value:car.price+adjustment,weight};});
 const value=weightedQuantile(weighted,.5),low=weightedQuantile(weighted,.1),high=weightedQuantile(weighted,.9);
 const knownMileage=rows.filter(c=>Number.isFinite(c.mileage));
 const spread=(high-low)/value;
 const confidence=vehicle.accidentHistory==='yes'||vehicle.vehicleCondition==='fair'?'limited':rows.length>=20&&exactCount/rows.length>=.8&&knownMileage.length/rows.length>=.8&&Object.keys(sources).length>=2&&spread<=.35?'high':rows.length>=7&&exactCount>=3&&spread<=.6?'medium':'limited';
 const factors=[{attribute:'year',method:'comparable-weighting'},{attribute:'city',method:'comparable-weighting'},{attribute:'mileage',method:learned?'observed-same-trim-regression':'comparable-weighting'}];
 if(vehicle.trim)factors.push({attribute:'trim',method:trimRows.length?'comparable-weighting':'unavailable'});
 const representatives=[...weighted].sort((a,b)=>b.weight-a.weight).slice(0,6).map(({car})=>({url:car.url,originalUrl:car.originalUrl||car.url,title:car.title,make:car.make||car.brand,model:car.model,year:car.year,price:car.price,mileage:car.mileage??null,city:car.city,trim:car.trim||null,source:car.source,seller:car.seller||car.source,image:safeURL(car.image),lastSeenAt:car.lastSeenAt||snapshotAt}));
 return{...base,available:true,reason:null,confidence,estimatedMarketValue:round(value),valuationLow:round(low),valuationHigh:round(high),quickSaleValue:round(weightedQuantile(weighted,.2)),recommendedListingPrice:round(weightedQuantile(weighted,.75)),medianComparablePrice:median(rows.map(c=>c.price)),lowestComparablePrice:Math.min(...rows.map(c=>c.price)),highestComparablePrice:Math.max(...rows.map(c=>c.price)),averageMileage:knownMileage.length?Math.round(knownMileage.reduce((s,c)=>s+c.mileage,0)/knownMileage.length):null,geographicCoverage:[...new Set(rows.map(c=>c.city).filter(Boolean))],adjustmentFactors:factors,outlierCount,comparableListings:representatives};
}
