import {catalogIntent,catalogModelMatches} from '../public/catalog.js';
import {detectRequestedBrand,listingMatchesBrand} from './search-relevance.js';
import {exactYearIntent} from './search-intent.js';
import {normalizeBodyType,resolveBodyType} from './vehicle-body-type.js';

const DAY=86_400_000;
const finite=v=>Number.isFinite(Number(v));
const present=v=>v!==null&&v!==undefined&&String(v).trim()!=='';

export function listingCompleteness(car={}){
 return ['make','model','year','condition','price','mileage','city','image','trim','fuelType','transmission','bodyType']
  .reduce((n,key)=>n+(present(car[key]??car.vehicle?.[key])?1:0),0);
}

export function relevanceScore(car={},body={}){
 const query=String(body.query||''),filters=body.filters||{},catalog=catalogIntent(query);
 const brand=detectRequestedBrand(query),year=exactYearIntent(query);
 let score=0;
 if(brand&&listingMatchesBrand(car,brand))score+=1000;
 if(catalog.modelKey&&catalogModelMatches(car,catalog.modelKey))score+=900;
 if(year&&Number(car.year)===year)score+=500;
 const requestedBody=normalizeBodyType(filters.category);if(requestedBody&&resolveBodyType(car)===requestedBody)score+=400;
 if(body.condition&&body.condition!=='all'&&car.condition===body.condition)score+=300;
 if(filters.maxPrice&&car.priceVerified&&finite(car.price)&&Number(car.price)<=Number(filters.maxPrice))score+=180;
 if(filters.maxMileage&&finite(car.mileage)&&Number(car.mileage)<=Number(filters.maxMileage))score+=120;
 score+=listingCompleteness(car)*12;
 if(car.imageVerified&&car.image)score+=90;else if(car.image)score+=35;
 const age=Date.now()-Date.parse(car.lastSeenAt||car.updatedAt||car.updated_at||'');
 if(Number.isFinite(age)&&age>=0)score+=Math.max(0,80-Math.floor(age/DAY)*4);
 return score;
}

export function rankListings(listings=[],body={}){
 return listings.map((car,index)=>({car,index,score:relevanceScore(car,body)}))
  .sort((a,b)=>b.score-a.score||a.index-b.index)
  .map(({car,score})=>({...car,relevanceScore:score}));
}
