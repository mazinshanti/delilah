import {catalogIntent,catalogMake,catalogText} from '../public/catalog.js';
import {ORIGINS} from './ai-search-intent.js';
import {resolveBodyType,normalizeBodyType} from './vehicle-body-type.js';
import {isInactiveListing} from './listing-lifecycle.js';

// Historical index records are used ONLY to choose which original-market search
// pages to visit. They are never treated as currently observed listings.
export function planSemanticSourceQueries(records=[],intent={},options={}){
 const maxQueries=Math.max(1,Math.min(20,Number(options.maxQueries)||12));
 const condition=intent.condition||options.condition||'used';
 const allowedOrigin=intent.originPreference?
   new Set(ORIGINS[intent.originPreference]||[]):null;
 const rejected=new Set((intent.excludedMakes||[]).map(catalogText));
 const bodyType=normalizeBodyType(intent.bodyType);
 const pricesBound=Number(intent.maxPrice);
 const byMake=new Map();

 for(const car of records){
  if(!car||isInactiveListing(car))continue;
  if(condition==='used'&&car.condition!=='used')continue;
  if(condition==='new'&&car.condition!=='new')continue;
  const declared=catalogMake(car.make||car.brand||'');
  const make=declared?.name;
  if(!make||intent.make&&make!==intent.make)continue;
  if(allowedOrigin&&!allowedOrigin.has(make))continue;
  if(rejected.has(catalogText(make)))continue;
  if(bodyType&&resolveBodyType(car)!==bodyType)continue;
  if(intent.year&&Number(car.year)!==Number(intent.year))continue;
  if(Number.isFinite(pricesBound)&&pricesBound>0){
   if(car.priceVerified!==true||!(Number(car.price)>0)||Number(car.price)>pricesBound)continue;
  }
  const model=car.model;
  if(!model)continue;
  const known=catalogIntent(make+' '+model);
  if(known.make!==make||!known.model)continue;
  if(intent.model&&known.model!==intent.model)continue;
  const group=byMake.get(make)||new Map();
  group.set(known.model,(group.get(known.model)||0)+1);
  byMake.set(make,group);
 }
 const makes=[...byMake.entries()]
  .map(([name,models])=>({name,models:[...models].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),total:[...models.values()].reduce((a,b)=>a+b,0)}))
  .sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
 const out=[];
 // Round robin: avoid letting one large indexed brand monopolize all live
 // searches when user asks for a vehicle category rather than a specific make.
 for(let rank=0;out.length<maxQueries;rank++){
  let added=false;
  for(const make of makes){
   const hit=make.models[rank];
   if(!hit)continue;
   out.push(make.name+' '+hit[0]);added=true;
   if(out.length>=maxQueries)break;
  }
  if(!added)break;
 }
 return out;
}
