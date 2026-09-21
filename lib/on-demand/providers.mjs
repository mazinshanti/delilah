import {identity} from './core.mjs';
const names={'haraj.com.sa':'Haraj','ksa.carswitch.com':'CarSwitch Saudi','syarah.com':'Syarah','www.salehcars.com':'Saleh Cars','cars.saudisale.com':'Saudi Sale','ksa.motory.com':'Motory','www.samaco.com.sa':'SAMACO Automotive','www.arabwheels.sa':'ArabWheels Saudi'};
export function leads(rows){const seen=new Set();return rows.flatMap(r=>{const id=identity(r.url);if(!id||seen.has(id))return [];seen.add(id);return [{url:r.url,source:names[new URL(r.url).hostname],title:String(r.title||'').slice(0,250),price:null,condition:null,discovery:'hosted-index'}];});}
export function provider(name,{env=process.env,fetchImpl=fetch,metrics=[]}={}){
 const key=env[name==='brave'?'BRAVE_API_KEY':'TAVILY_API_KEY'];if(!key)return null;
 if(!['brave','tavily'].includes(name))throw Error('unsupported-provider');
 return async(i,{signal}={})=>{
  const query=[i.query||[i.make,i.model].filter(Boolean).join(' '),'Saudi Arabia cars for sale'].join(' '),started=Date.now();
  const bounded=signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000);
  let response;
  if(name==='brave'){const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',query);url.searchParams.set('count','20');response=await fetchImpl(url,{signal:bounded,headers:{'X-Subscription-Token':key}});}
  else response=await fetchImpl('https://api.tavily.com/search',{method:'POST',signal:bounded,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({query,search_depth:'fast',max_results:20,include_domains:Object.keys(names),include_answer:false,include_images:false,include_raw_content:false,include_usage:true})});
  metrics.push({provider:name,ms:Date.now()-started,status:response.status});if(!response.ok)throw Error('provider-http-'+response.status);
  const data=await response.json();metrics.at(-1).credits=data.usage?.credits??null;return leads(name==='brave'?data.web?.results||[]:data.results||[]);
 };
}
