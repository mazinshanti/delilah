const url='https://www.salehcars.com/en/cars/all';
const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'user-agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.9,ar;q=0.7'}});
const html=await r.text();
console.log(JSON.stringify({status:r.status,url:r.url,length:html.length},null,2));
const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
console.log('SCRIPTS',JSON.stringify(scripts,null,2));
const carTokens=[...new Set([...html.matchAll(/(?:https?:\\?\/\\?\/(?:www\\?\.)?salehcars\\?\.com)?\\?\/(?:en\\?\/)?cars\\?\/[a-f0-9]{24}(?:\\?\/[^"'<>\\s}]*)?/gi)].map(m=>m[0]))].slice(0,50);
console.log('CAR_TOKENS',JSON.stringify(carTokens,null,2));
const urls=[...new Set([...html.matchAll(/https?:\\?\/\\?\/[^"'<>\\s}]+/gi)].map(m=>m[0]))].filter(x=>/(api|car|inventory|product|search|graphql)/i.test(x)).slice(0,100);
console.log('LIKELY_URLS',JSON.stringify(urls,null,2));
for(const term of ['api','graphql','cars/all','total','pagination','products','vehicles','inventory']){
 const i=html.toLowerCase().indexOf(term.toLowerCase());
 if(i>=0) console.log('AROUND_'+term.toUpperCase(),html.slice(Math.max(0,i-500),i+1500).replace(/\s+/g,' ').slice(0,2200));
}
