import {discoverMarketWithAI} from '../../lib/ai-market-discovery-trial.js';
// A hosted index supplies URLs only. Snippets never become verified car facts.
import {identity} from './core.mjs';
import {planQueries} from './sources.mjs';
const names={'haraj.com.sa':'Haraj','ksa.carswitch.com':'CarSwitch Saudi','syarah.com':'Syarah','www.salehcars.com':'Saleh Cars'};
export function createWebDiscovery({key=process.env.TAVILY_API_KEY,fetchImpl=fetch}={}){
 if(!key)return null;
 return async (intent,{signal})=>{
  const queries=planQueries(intent).slice(0,2).map(q=>[q,intent.condition,intent.city||'Saudi Arabia','for sale'].filter(Boolean).join(' '));
  const result=await Promise.all(queries.map(async query=>{
   const response=await fetchImpl('https://api.tavily.com/search',{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({query,topic:'general',search_depth:'basic',max_results:10,include_domains:Object.keys(names),include_answer:false,include_raw_content:false,include_images:false})});
   if(!response.ok)throw Error('discovery-provider-http-'+response.status);
   const data=await response.json();return (data.results||[]).flatMap(r=>{let u;try{u=new URL(r.url);}catch{return [];}if(!names[u.hostname]||!identity(r.url))return [];return [{source:names[u.hostname],url:r.url,title:String(r.title||'').slice(0,250),discovery:'hosted-index',price:null,condition:null}];});
  }));return result.flat();
 };
}

// Prefer the project's existing hosted web-search integration when its key is available.
export function configuredWebDiscovery({env=process.env,fetchImpl=fetch}={}){
 if(!env.OPENAI_API_KEY)return createWebDiscovery({key:env.TAVILY_API_KEY||'',fetchImpl});
 return async(intent,{signal})=>{
  const query=[intent.query].filter(Boolean).join(' ');
  const fetchBounded=(url,options)=>fetchImpl(url,{...options,signal:signal?AbortSignal.any([signal,options.signal].filter(Boolean)):options.signal});
  const result=await discoverMarketWithAI(query,[],{env,fetchImpl:fetchBounded,sourceIds:['haraj','carswitch','syarah']});
  if(result.status!=='completed')throw Error('hosted-discovery-'+result.status);
  return (result.urls||[]).flatMap(url=>{let u;try{u=new URL(url);}catch{return [];}if(!identity(url)||!names[u.hostname])return [];return [{source:names[u.hostname],url,title:'',price:null,condition:null,discovery:'existing-hosted-web-search'}];});
 };
}
