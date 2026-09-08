const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){const r=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`${path} HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}
async function search(body){const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`search HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()}
let p=null;for(let i=0;i<8;i++){p=await get('/api/source-plugins');if(Number(p.genesisIndexed)>0)break;await sleep(5000)}
if(!p||Number(p.total)<30)throw new Error(`Seller-plugin registry too small: ${p?.total}`);
if(Number(p.genesisIndexed)<1)throw new Error(`Genesis inventory did not index: ${p?.genesisLastRefreshError||'no error reported'}`);
const d=await search({query:'Genesis G80',condition:'used',filters:{seller:'Genesis Wallan Certified'}});
if(!Array.isArray(d.listings)||d.listings.length<1)throw new Error(`Genesis G80 returned no cars; indexed=${p.genesisIndexed}`);
for(const c of d.listings){
 if(c.source!=='Genesis Wallan Certified')throw new Error(`Wrong source ${c.source}`);
 if(c.condition!=='used'||c.saleVerified!==true)throw new Error(`Invalid certified-used result ${c.url}`);
 if(!/^https:\/\/genesiswallan\.com\/en\/inventory\/20\d{2}-[a-z0-9-]+$/i.test(c.url||''))throw new Error(`Not a direct Genesis inventory URL: ${c.url}`);
 if(c.brand!=='Genesis')throw new Error(`Wrong brand ${c.brand}`);
 if(c.price!=null&&(!c.priceVerified||c.priceSource!=='genesis_total_purchase_price'||Number(c.price)<50000))throw new Error(`Invalid Genesis price ${c.price} ${c.url}`);
 if(c.image!=null||c.imageVerified===true)throw new Error(`Genesis generic/non-actual gallery image must not be exposed: ${c.url}`);
}
console.log(`PASS Genesis Wallan: ${d.listings.length} G80 cars; ${p.genesisIndexed} certified vehicles indexed; ${p.total} seller plugins tracked`);
