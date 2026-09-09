const base='https://www.salehcars.com';
const url=`${base}/en/cars/all`;
const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9,ar;q=0.7'}});
const html=await r.text();
console.log(JSON.stringify({status:r.status,url:r.url,length:html.length},null,2));
const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const targets=scripts.filter(x=>/cars\/all|2210-|5485-|8529-|6998-|2094-|8159-|110-|4377-|3405-|1405-/.test(x));
console.log('TARGETS',JSON.stringify(targets,null,2));
for(const src of targets){
  const u=new URL(src,base).href;
  try{
    const rr=await fetch(u,{signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 probe'}});
    const js=await rr.text();
    console.log(`CHUNK ${src} status=${rr.status} length=${js.length}`);
    const publicRoutes=[...new Set([...js.matchAll(/["'`]([^"'`]*\/public\/[^"'`]{1,260})["'`]/gi)].map(m=>m[1]))].slice(0,250);
    if(publicRoutes.length) console.log('PUBLIC_ROUTES',JSON.stringify(publicRoutes,null,2));
    const modelRoutes=[...new Set([...js.matchAll(/["'`]([^"'`]*(?:CarModel|CarBrand|Car|Vehicle|Product|Inventory)[^"'`]{0,260})["'`]/gi)].map(m=>m[1]))].filter(x=>x.length<320).slice(0,250);
    if(modelRoutes.length) console.log('MODEL_ROUTES',JSON.stringify(modelRoutes,null,2));
    for(const term of ['/public/','CarModel','CarBrand','pageSize=','brandId=','modelId=','carsPage','ClientCars']){
      let from=0,count=0;
      while(count<6){const i=js.indexOf(term,from);if(i<0)break;console.log(`AROUND_${term.replace(/[^a-z0-9]/gi,'_')}_${count+1}`,js.slice(Math.max(0,i-900),i+2000));from=i+term.length;count++}
    }
  }catch(e){console.log('CHUNK_ERROR',src,e.message)}
}
