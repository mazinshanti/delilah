const base='https://www.salehcars.com';
const url=`${base}/en/cars/all`;
const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9,ar;q=0.7'}});
const html=await r.text();
console.log(JSON.stringify({status:r.status,url:r.url,length:html.length},null,2));
const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
console.log('SCRIPT_COUNT',scripts.length);
for(const src of scripts){
  const u=new URL(src,base).href;
  try{
    const rr=await fetch(u,{signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 probe'}});
    const js=await rr.text();
    if(!rr.ok)continue;
    const needles=['94403:','/public/','pageSize','CarModel','CarBrand','ClientCars','cars/all','modelId','brandId','searchParams'];
    let interesting=false;
    for(const term of needles)if(js.includes(term))interesting=true;
    if(!interesting)continue;
    console.log(`CHUNK ${src} length=${js.length}`);
    const strings=[...new Set([...js.matchAll(/["'`]([^"'`]{2,260})["'`]/g)].map(m=>m[1]))]
      .filter(x=>/(public|Car|car|vehicle|inventory|pageSize|brandId|modelId|searchParams|api)/i.test(x))
      .slice(0,400);
    console.log('STRINGS',JSON.stringify(strings,null,2));
    for(const term of needles){
      let from=0,count=0;
      while(count<10){const i=js.indexOf(term,from);if(i<0)break;console.log(`AROUND_${term.replace(/[^a-z0-9]/gi,'_')}_${count+1}`,js.slice(Math.max(0,i-1400),i+3200));from=i+term.length;count++}
    }
    if(/cars\/all\/page/i.test(src))console.log('PAGE_CHUNK_FULL',js);
  }catch(e){console.log('CHUNK_ERROR',src,e.message)}
}
