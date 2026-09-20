import {marketListingKey,marketCandidate} from './ai-market-discovery-trial.js';
import {strictDirectListings} from './direct-search.js';
import {applyIntentConstraints} from './ai-search-intent.js';
// Short-lived, validated results only. Query-specific constraints are reapplied on every read.
export function createMarketSessionCache({clock=Date.now,ttlMs=600000,maxEntries=1000}={}){
 const entries=new Map();
 const valid=e=>e&&Number.isFinite(e.checkedAt)&&e.checkedAt<=clock()&&clock()-e.checkedAt<ttlMs&&marketCandidate(e.car?.url)&&e.car?.listingVerified===true;
 return {
  restore(rows){for(const e of Array.isArray(rows)?rows:[]){if(valid(e))entries.set(marketListingKey(e.car.url),e);if(entries.size>=maxEntries)break;}},
  put(cars){for(const car of cars){const key=marketListingKey(car?.url);if(!key||car.listingVerified!==true)continue;entries.delete(key);entries.set(key,{checkedAt:clock(),car});while(entries.size>maxEntries)entries.delete(entries.keys().next().value);}},
  get(body,intent){for(const [key,e]of entries)if(!valid(e))entries.delete(key);return applyIntentConstraints(strictDirectListings([...entries.values()].map(e=>e.car),body),intent);},
  snapshot(){return [...entries.values()].filter(valid);}
 };
}
