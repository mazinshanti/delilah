import {VEHICLE_CATALOG,catalogIntent} from '../public/catalog.js';

// Discovery variants broaden recall only. The original intent and filters must
// still be applied when admitting each fetched advertisement.
export function marketDiscoveryPlan(query,{cities=['الرياض','جدة','الدمام','مكة','المدينة','أبها','القصيم','تبوك']}={}){
 if(typeof query!=='string'||!query.trim()||query.length>180)throw Error('invalid-query');
 const intent=catalogIntent(query),make=VEHICLE_CATALOG.makes.find(x=>x.name===intent.make);
 const model=make?.models.find(x=>x.name===intent.model);
 const english=[make?.name,model?.name].filter(Boolean).join(' ');
 const arabic=[make?.ar,model?.aliases?.find(x=>/[\u0600-\u06ff]/.test(x))||model?.name].filter(Boolean).join(' ');
 const bases=[...new Set([query.trim(),english,arabic].filter(Boolean))];
 // No invented year range: a model-only search keeps all years discoverable.
 return [...new Set([...bases,...cities.flatMap(city=>bases.map(base=>`${base} ${city}`))])];
}

export async function runDiscoveryPlan(query,{discover,maxQueries=6,cursor=0,onProgress=()=>{}}={}){
 if(typeof discover!=='function')throw Error('discovery-provider-required');
 const plan=marketDiscoveryPlan(query);
 if(!Number.isInteger(cursor)||cursor<0||cursor>=plan.length)throw Error('invalid-cursor');
 if(!Number.isInteger(maxQueries)||maxQueries<1||maxQueries>30)throw Error('invalid-query-budget');
 const urls=new Set(),attempts=[];let nextCursor=cursor,webSearchCalls=0;
 for(let i=cursor;i<Math.min(plan.length,cursor+maxQueries);i++){
  const result=await discover(plan[i]);
  const attempt={query:plan[i],status:result.status,webSearchCalls:result.webSearchCalls||0,discovered:result.urls?.length||0,latencyMs:result.latencyMs??null,providerError:result.providerError??null};
  attempts.push(attempt);webSearchCalls+=attempt.webSearchCalls;
  if(result.status!=='completed'){await onProgress(attempt);break;}
  for(const url of result.urls||[])urls.add(url);
  nextCursor=i+1;await onProgress(attempt);
 }
 return {status:attempts.at(-1)?.status==='completed'?'completed':'partial-or-failed',urls:[...urls],webSearchCalls,attempts,queryPool:plan.length,nextCursor:nextCursor===plan.length?null:nextCursor,planComplete:nextCursor===plan.length,coverageComplete:false};
}
