const base=String(process.env.DALELAH_SITE||'https://www.dalelah.co').replace(/\/$/,'');
const cases=['Toyota Corolla','Nissan Patrol','Jeep Wrangler'];
const timeout=15000;
const outputs=[];
for(const query of cases){
 const started=Date.now();
 const urls=new Map();
 let firstResponseMs=null,errors=[],last={},directHaraj=null;
 try{
  const r=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({query,condition:'used',filters:{seller:'Haraj'}}),signal:AbortSignal.timeout(timeout)});
  firstResponseMs=Date.now()-started;
  if(!r.ok)throw Error('HTTP '+r.status);
  let data=await r.json();
  const consume=d=>{
   for(const c of Array.isArray(d.listings)?d.listings:[]){
    if(c.url&&c.source==='Haraj')urls.set(c.url,c);
   }
   const source=(d.directCoreSources||[]).find(x=>x.name==='Haraj');
   if(source)directHaraj={count:source.count,error:source.error||null,requestedLimit:source.requestedLimit||null};
   last=d;
  };
  consume(data);
  for(let attempt=0;attempt<3&&data.searchId&&data.complete!==true;attempt++){
   await new Promise(resolve=>setTimeout(resolve,850));
   try{
    const next=await fetch(base+'/api/search/progress/'+encodeURIComponent(data.searchId),{signal:AbortSignal.timeout(timeout)});
    if(!next.ok){errors.push('progress '+next.status);break;}
    data=await next.json();
    consume(data);
   }catch(error){errors.push(String(error?.message||error).slice(0,90));break;}
  }
  outputs.push({query,firstResponseMs,totalMs:Date.now()-started,
   harajUrlCount:urls.size,harajDirect:directHaraj,
   complete:last.complete===true,sourceErrors:last.sourceErrors?.slice(0,3)||[],errors});
 }catch(error){
  outputs.push({query,firstResponseMs,elapsedMs:Date.now()-started,error:String(error?.message||error)});
 }
}
console.log('MODEL_REACH_BENCHMARK '+JSON.stringify({base,at:new Date().toISOString(),outputs}));
if(outputs.every(x=>x.error))process.exitCode=1;
