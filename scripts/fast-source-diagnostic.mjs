const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const targets=['https://www.salehcars.com/en/cars/all','https://www.salehcars.com/sitemap.xml','https://www.salehcars.com/robots.txt'];
for(const url of targets){
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(12000),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5','Accept-Language':'en-US,en;q=0.9,ar;q=0.7'}});
    const text=(await r.text()).slice(0,12_000_000);
    const productLinks=[...text.matchAll(/href=["']([^"']*\/cars\/[a-f0-9]{24}[^"']*)["']/gi)].map(m=>m[1]);
    const unique=[...new Set(productLinks)].slice(0,40);
    const yaris=[...text.matchAll(/.{0,160}yaris.{0,220}/gi)].slice(0,12).map(m=>m[0].replace(/\s+/g,' '));
    const apis=[...text.matchAll(/(?:https?:\\?\/\\?\/[^"'\s<]+|\/api\/[^"'\s<]+)/gi)].map(m=>m[0].replace(/\\u0026/g,'&').replace(/\\\//g,'/')).filter(x=>/(api|car|vehicle|inventory|product)/i.test(x));
    const next=[...text.matchAll(/<script[^>]+src=["']([^"']+_next[^"']+)["']/gi)].map(m=>m[1]).slice(-25);
    console.log('SALEH_LIVE_DISCOVERY '+JSON.stringify({url,status:r.status,length:text.length,productLinkCount:productLinks.length,uniqueProductLinks:unique.length,sampleLinks:unique.slice(0,12),hasYarisLimited:/yaris-y-limited-2026/i.test(text),yarisSnippets:yaris,apiCandidates:[...new Set(apis)].slice(0,30),nextScripts:next.slice(-12)}));
  }catch(error){console.log('SALEH_LIVE_DISCOVERY_ERROR '+JSON.stringify({url,error:error.message}));}
}
