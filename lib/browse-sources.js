import {fetchHarajFast} from './haraj-fast-source.js';
import {fetchOpenSooqUsed} from './opensooq-source.js';
import {strictDirectListings,mergeDirectListings} from './direct-search.js';
const QUERIES=['Toyota Corolla','Toyota Camry','Toyota Yaris','Toyota Land Cruiser','Nissan Patrol','Nissan Sunny','Hyundai Elantra','Hyundai Sonata','Kia Sportage','Jeep Wrangler','Chevrolet Tahoe','Ford Taurus','Toyota Fortuner','Toyota Prado','Hyundai Tucson','Kia K5','Lexus ES','GMC Yukon'];
export async function browseLiveSources(body={}){
 if(body.condition==='new')return {listings:[],sources:[],errors:[]};
 const started=Date.now(),haraj=[],errors=[],filters=body.filters||{};
 const openPromise=(!filters.seller||filters.seller==='OpenSooq')?fetchOpenSooqUsed({pages:5,query:'',filters,nativeQuery:false}).catch(e=>({listings:[],errors:[{error:e.message}]})):Promise.resolve({listings:[],errors:[]});
 if(!filters.seller||filters.seller==='Haraj')for(let i=0;i<QUERIES.length;i+=2){
  const results=await Promise.all(QUERIES.slice(i,i+2).map(query=>fetchHarajFast({query,filters,timeout:5000})));
  for(const r of results){haraj.push(...r.listings);if(r.error)errors.push({source:'Haraj',error:r.error});}
  await new Promise(r=>setTimeout(r,500));
 }
 const open=await openPromise;errors.push(...(open.errors||[]).map(e=>({source:'OpenSooq',error:e.error||String(e)})));
 return {listings:strictDirectListings(mergeDirectListings(haraj,open.listings),{...body,query:''}),sources:['Haraj','OpenSooq'],errors,durationMs:Date.now()-started};
}
