import {createSourceLearning} from './source-learning.mjs';
import {createSources} from './sources.mjs';
export const allSources=['CarSwitch Saudi','Syarah','Motory','Haraj','ArabWheels Saudi','Saudi Sale','SAMACO Automotive','Saleh Cars','OpenSooq','Mercedes-Benz Saudi','Kayishha','Mstaml'];
export function prioritySources(i){return i.condition==='new'?['Motory','Syarah','Saleh Cars']:['CarSwitch Saudi','Syarah',i.make==='Audi'?'ArabWheels Saudi':'Motory'];}
export function scheduledSources(transport,{webDiscovery=null}={}){
 const base=createSources(transport),learning=createSourceLearning();
 return {observe:learning.observe,verify:base.verify,discover:async(i,options)=>{
  if(options.signal?.aborted)return;
  const first=learning.order(i,prioritySources(i),allSources).slice(0,3);
  // Reserve discovery capacity for productive sources; all others remain fallback.
  const fast=createSources(transport,{selectedSources:first});
  const slow=createSources(transport,{selectedSources:allSources.filter(s=>!first.includes(s))});
  const fallback=new Promise(resolve=>{const timer=setTimeout(done,4000);function done(){clearTimeout(timer);options.signal?.removeEventListener('abort',done);resolve();}options.signal?.addEventListener('abort',done,{once:true});}).then(()=>options.signal?.aborted?null:slow.discover(i,options));
  const hosted=webDiscovery?webDiscovery(i,{signal:options.signal}).then(rows=>options.onBatch(rows,'hosted-index')).catch(e=>options.diagnostics.push({stage:'hosted',error:e.message})):Promise.resolve();
  await Promise.all([fast.discover(i,options),fallback,hosted]);
 }};
}
