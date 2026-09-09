const urls=[
  'https://sa.opensooq.com/en/cars/cars-for-sale/used',
  'https://sa.opensooq.com/en/al-riyadh/cars/cars-for-sale/toyota/camry'
];
const headers={'User-Agent':'Dalelah/1.5 (+https://dalelah.co; market-coverage-probe)','Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'};
function abs(v,b){try{return new URL(String(v||'').replace(/&amp;/g,'&'),b).href}catch{return null}}
function clean(s=''){return String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
for(const url of urls){
  try{
    const r=await fetch(url,{redirect:'follow',headers,signal:AbortSignal.timeout(20000)});
    const html=await r.text();
    const links=[];
    for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
      const href=abs(m[1],r.url||url),text=clean(m[2]);if(!href)continue;
      if(/opensooq\.com/i.test(href))links.push({href,text:text.slice(0,160)});
    }
    const unique=[...new Map(links.map(x=>[x.href,x])).values()];
    const likely=unique.filter(x=>!/\/cars(?:\/|$)|cars-for-sale(?:\/|$)|\/en\/?$|\/autos(?:\/|$)/i.test(new URL(x.href).pathname));
    console.log('OPENSOOQ_PROBE '+JSON.stringify({url,status:r.status,finalUrl:r.url,bytes:html.length,totalLinks:unique.length,likelyListingLinks:likely.slice(0,80)},null,2));
  }catch(e){console.log('OPENSOOQ_PROBE_ERROR '+JSON.stringify({url,error:e?.message||String(e)}))}
}
