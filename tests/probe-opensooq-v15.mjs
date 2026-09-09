const urls=[
  'https://sa.opensooq.com/en/cars/cars-for-sale/used',
  'https://sa.opensooq.com/en/al-riyadh/cars/cars-for-sale/toyota/camry'
];
const headers={'User-Agent':'Dalelah/1.5 (+https://dalelah.co; market-coverage-probe)','Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'};
function abs(v,b){try{return new URL(String(v||'').replace(/&amp;/g,'&'),b).href}catch{return null}}
function clean(s=''){return String(s).replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function uniq(xs,key=x=>x){return[...new Map(xs.map(x=>[key(x),x])).values()]}
for(const url of urls){
  try{
    const r=await fetch(url,{redirect:'follow',headers,signal:AbortSignal.timeout(20000)});
    const html=await r.text(),base=r.url||url;
    const allHrefs=[];
    for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){const href=abs(m[1],base);if(href&&/opensooq\.com/i.test(href))allHrefs.push(href)}
    const numericHrefs=uniq(allHrefs.filter(h=>{const p=new URL(h).pathname;return /(?:^|[-_/])\d{5,}(?:[-_/]|$)/.test(p)||/\b(?:post|item|listing|ad|car)[-_]?\d{4,}/i.test(p)}));
    const vehicleHrefs=uniq(allHrefs.filter(h=>/\/(?:cars?|autos?|vehicles?)(?:\/|$)/i.test(new URL(h).pathname)&&!/cars-for-sale\/?$/i.test(new URL(h).pathname)));
    const contexts=[];
    for(const re of[/camry/ig,/كامري/g,/Toyota/ig]){
      let m;while((m=re.exec(html))&&contexts.length<40){const a=Math.max(0,m.index-900),b=Math.min(html.length,m.index+1600);contexts.push(clean(html.slice(a,b)).slice(0,2400));}
    }
    const scripts=[];
    for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      const attrs=m[1]||'',body=m[2]||'';if(/camry|كامري|listing|postId|post_id|itemId|adId|carId/i.test(body))scripts.push({attrs:clean(attrs).slice(0,220),sample:clean(body).slice(0,5000)});
      if(scripts.length>=12)break;
    }
    const jsonUrlStrings=uniq([...html.matchAll(/["'](https?:\\?\/\\?\/[^"']+opensooq[^"']+|\/[^"']*(?:camry|كامري)[^"']*)["']/gi)].map(m=>m[1].replace(/\\\//g,'/')).filter(Boolean));
    console.log('OPENSOOQ_DEEP_PROBE '+JSON.stringify({url,status:r.status,finalUrl:base,bytes:html.length,numericHrefs:numericHrefs.slice(0,100),vehicleHrefs:vehicleHrefs.slice(-100),jsonUrlStrings:jsonUrlStrings.slice(0,100),contexts:uniq(contexts).slice(0,12),scripts:scripts.slice(0,8)},null,2));
  }catch(e){console.log('OPENSOOQ_PROBE_ERROR '+JSON.stringify({url,error:e?.message||String(e)}))}
}
