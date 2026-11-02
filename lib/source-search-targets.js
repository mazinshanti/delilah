import {detectRequestedModel} from './search-model-relevance.js';
import {localizedQuery} from './haraj-fast-source.js';
import {openSooqSearchUrl} from './opensooq-source.js';

// Build links only. This function NEVER performs source HTTP requests,
// indexes listings, or claims permission to copy another site's content.
export function originalMarketSearchTargets(body={}){
 const query=String(body.query||'').trim();
 if(!query||query.length>180||body.condition==='new'||!detectRequestedModel(query))return [];
 const seller=String(body.filters?.seller||'').trim().toLowerCase();
 const result=[];
 if(!seller||seller==='haraj'){
  const localized=localizedQuery(query);
  if(localized)result.push({name:'Haraj',url:'https://haraj.com.sa/search/'+encodeURIComponent(localized)+'/'});
 }
 if(!seller||seller==='opensooq'){
  result.push({name:'OpenSooq',url:openSooqSearchUrl({query,filters:body.filters||{}})});
 }
 return result;
}
