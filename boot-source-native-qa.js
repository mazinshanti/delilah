import './server-v24.js';

const port=Number(process.env.PORT||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function probe(query,condition='used',filters={}){
  const started=Date.now();
  try{
    const r=await fetch(`http://127.0.0.1:${port}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters,phase:'full'}),signal:AbortSignal.timeout(40000)});
    const text=await r.text();
    let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,200)}}
    const listings=Array.isArray(d.listings)?d.listings:[];
    console.log('DALELAH_QA',JSON.stringify({query,condition,status:r.status,count:listings.length,sources:d.counts||{},elapsedMs:Date.now()-started,error:d.error||null,sample:listings.slice(0,3).map(x=>({source:x.source,year:x.year,title:x.title,url:x.url}))}));
  }catch(e){
    console.log('DALELAH_QA',JSON.stringify({query,condition,status:0,count:0,elapsedMs:Date.now()-started,error:e?.message||String(e)}));
  }
}

await sleep(9000);
for(const q of ['Toyota','used cars Riyadh','SUV','Patrol','Corolla 2013']) await probe(q,'used',{});
