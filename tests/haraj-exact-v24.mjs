const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const body={query:'Jeep Wrangler 2022 Riyadh',condition:'used',filters:{seller:'Haraj'},phase:'full'};
async function j(url,opts={},ms=25000){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(ms)});if(!r.ok)throw new Error(`${url} HTTP ${r.status}: ${(await r.text()).slice(0,250)}`);return r.json()}
const h=await j(`${base}/api/health`,{},10000);if(h.edge!=='product-v24'||h.harajExactPages!==true)throw new Error(`Haraj exact-page guard not live: ${JSON.stringify(h)}`);
let d=await j(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},35000);
for(let i=0;i<35&&d.searchId&&!d.complete;i++){await sleep(1500);d=await j(`${base}/api/search/progress/${encodeURIComponent(d.searchId)}`,{},20000)}
const cars=(d.listings||[]).filter(c=>c.source==='Haraj');
if(!cars.length)throw new Error(`No verified Haraj Wrangler listings; diagnostics=${JSON.stringify([...(d.diagnostics||[]),...(d.indexedFallbackDiagnostics||[])])}`);
let exact=0;
for(const c of cars){
 if(c.saleVerified!==true||c.condition!=='used')throw new Error(`Invalid Haraj listing ${c.url}`);
 const u=new URL(c.url);if(!(u.hostname==='haraj.com.sa'||u.hostname.endsWith('.haraj.com.sa'))||!/^\/(?:en\/)?\d{8,}(?:\/[^/?#]+)?\/?$/i.test(u.pathname))throw new Error(`Non-direct Haraj URL ${c.url}`);
 if(c.harajExactVerified){
   exact++;
   if(c.price!=null&&(c.priceVerified!==true||c.priceSource!=='haraj_exact_listing_price'))throw new Error(`Unverified exact Haraj price ${c.price} ${c.url}`);
   if(c.image!=null&&(c.imageVerified!==true||c.imageSource!=='haraj_exact_listing_page'))throw new Error(`Unverified exact Haraj image ${c.url}`);
 }
 if(/^(?:sold|تم البيع|مباع)(?:\b|\s|$)/i.test(String(c.title||'').trim()))throw new Error(`Sold Haraj listing leaked ${c.url}`);
}
if(exact<1)throw new Error(`Haraj returned ${cars.length} direct listings but none could be verified against the exact page`);
console.log(`PASS Haraj exact pages: ${exact}/${cars.length} direct listings verified from their individual page`);
