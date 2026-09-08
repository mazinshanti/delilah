const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let s=null;
for(let i=0;i<60;i++){
 try{const r=await fetch(`${base}/api/jetour/stats`,{signal:AbortSignal.timeout(10000)});if(r.ok){s=await r.json();if(Number(s.indexed)>=5)break}}catch{}
 await sleep(2000);
}
if(!s||Number(s.indexed)<5)throw new Error(`Jetour stock index too small: ${s?.indexed||0}; error=${s?.lastRefreshError||'none'}`);
if(Number(s.withPrices)<1)throw new Error('Jetour index has no exact stock prices');
if(Number(s.withImages)<1)throw new Error('Jetour index has no exact-page stock images');
const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Jetour X70 2026 Riyadh',condition:'new',filters:{},phase:'full'}),signal:AbortSignal.timeout(300000)});
if(!r.ok)throw new Error(`Jetour search HTTP ${r.status}: ${(await r.text()).slice(0,400)}`);
const d=await r.json(),cars=(d.listings||[]).filter(c=>c.source==='Jetour KSA');
if(cars.length<1)throw new Error(`No Jetour X70 2026 exact stock returned; indexed=${s.indexed}; counts=${JSON.stringify(d.counts||{})}`);
let priced=0,imaged=0;
for(const c of cars){
 if(c.condition!=='new'||c.saleVerified!==true)throw new Error(`Invalid Jetour condition/sale ${c.url}`);
 if(!/^https:\/\/(?:www\.)?jetourksa\.com\/en\/inventory\/new-cars\/[a-z0-9.-]+_\d+\/?$/i.test(c.url||''))throw new Error(`Non-unit Jetour URL ${c.url}`);
 if(!c.stockNumber)throw new Error(`Jetour unit missing stock number ${c.url}`);
 if(c.price!=null){priced++;if(c.priceVerified!==true||c.priceSource!=='jetour_exact_stock_price')throw new Error(`Unverified Jetour price ${c.url}`)}
 if(c.image!=null){imaged++;if(c.imageVerified!==true||c.imageSource!=='listing_page')throw new Error(`Unverified Jetour image ${c.url}`)}
}
if(priced<1)throw new Error('Returned Jetour X70 stock has no verified prices');
if(imaged<1)throw new Error('Returned Jetour X70 stock has no verified exact-page images');
console.log(`PASS Jetour KSA: ${cars.length} X70 2026 units; index ${s.indexed}; price ${priced}; image ${imaged}`);
