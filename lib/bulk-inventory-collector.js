import {robotsPolicy} from './robots-policy.js';
// Keep the existing bulk parsers and page routes; persist where each bounded pass stopped.
export async function collectBulkInventory({source,get,parse,previous={},state={},maxPages=500,maxDurationMs=30*60000,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,onRecords=()=>{},onProgress=()=>{}}){
 const started=now(),seen=new Set(),errors=[];
 const initial=state.nextPage||previous.nextPage||((previous.pages===previous.successfulPages&&previous.records>0&&!(previous.errors||[]).length)?previous.pages+1:1);
 let nextPage=source.id==='mercedes'?1:Math.max(1,Math.min(10000,initial)),attempted=0,successfulPages=0,duplicates=0,robots='',ended=false;
 try{
  robots=await get(new URL('/robots.txt',source.url).href);
  for(let n=0;n<(source.id==='mercedes'?1:maxPages)&&now()-started<maxDurationMs;n++){
   const page=n===0?1:nextPage,url=new URL(source.path,source.url);if(page>1)url.searchParams.set('page',String(page));attempted++;
   try{
    const policy=robotsPolicy(robots,url.href);if(!policy.allowed||policy.delayMs>30000)throw Error('robots-disallowed');await wait(policy.delayMs);
    const html=await get(url.href,{permit:target=>robotsPolicy(robots,target).allowed}),records=parse(html,source);successfulPages++;const added=[];
    for(const r of records){if(seen.has(r.url)){duplicates++;continue;}seen.add(r.url);added.push(r);}onRecords(added);onProgress({source:source.name,page,records:records.length,added:added.length,total:seen.size});
    if(!added.length){if(!records.length){errors.push({page,error:'no-parseable-records-or-source-blocked'});nextPage=page;break;}nextPage=1;ended=true;break;}
    if(page!==1||nextPage===1)nextPage=page+1;
   }catch(e){errors.push({page,error:e.message.slice(0,180)});break;}
   // The robots delay is already applied before every request.
  }
 }catch(e){errors.push({error:'robots-unavailable: '+e.message});}
 const completedAt=new Date(now()).toISOString();return {state:{nextPage,completedAt},diagnostics:{source:source.name,nextPage,continuationExhausted:ended,pages:attempted,successfulPages,completedAt,records:seen.size,duplicateCards:duplicates,errors,durationMs:now()-started}};
}
