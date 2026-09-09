const base='https://www.salehcars.com';
const url=`${base}/en/cars/all`;
const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9,ar;q=0.7'}});
const html=await r.text();
console.log(JSON.stringify({status:r.status,url:r.url,length:html.length},null,2));
const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
console.log('SCRIPTS',JSON.stringify(scripts,null,2));
const targets=scripts.filter(x=>/cars\/all|2210-|5485-|8529-|6998-|2094-|8159-|110-/.test(x));
console.log('TARGETS',JSON.stringify(targets,null,2));
for(const src of targets){
  const u=new URL(src,base).href;
  try{
    const rr=await fetch(u,{signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 probe'}});
    const js=await rr.text();
    console.log(`CHUNK ${src} status=${rr.status} length=${js.length}`);
    const abs=[...new Set([...js.matchAll(/https?:\\?\/\\?\/[^"'`<>\\s)]+/gi)].map(m=>m[0]))].filter(x=>/(api|car|vehicle|inventory|product|search|saleh)/i.test(x)).slice(0,100);
    if(abs.length)console.log('ABS_URLS',JSON.stringify(abs,null,2));
    const routes=[...new Set([...js.matchAll(/["'`]([^"'`]{1,180}(?:api|cars|vehicles|inventory|products|search)[^"'`]{0,180})["'`]/gi)].map(m=>m[1]))].filter(x=>x.length<260).slice(0,150);
    if(routes.length)console.log('ROUTES',JSON.stringify(routes,null,2));
    for(const term of ['axios','fetch(','baseURL','api/','cars?','cars/','pageSize','perPage','pagination','totalCount','searchParams']){
      const i=js.toLowerCase().indexOf(term.toLowerCase());
      if(i>=0)console.log(`AROUND_${term.replace(/[^a-z0-9]/gi,'_')}`,js.slice(Math.max(0,i-700),i+1700));
    }
  }catch(e){console.log('CHUNK_ERROR',src,e.message)}
}
