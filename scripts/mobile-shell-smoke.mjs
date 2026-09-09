const base=process.env.MOBILE_URL||'https://dalelah-mobile-preview.onrender.com';
const expectedApi=process.env.EXPECTED_MOBILE_API||'https://dalelah-sell-preview.onrender.com';
const abs=(u)=>new URL(u,base).href;
const r=await fetch(base,{signal:AbortSignal.timeout(30000)});
const html=await r.text();
console.log('ROOT',r.status,r.url,html.length,r.headers.get('content-type'));
if(!r.ok)throw new Error(`root HTTP ${r.status}`);
const refs=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]).filter(x=>!x.startsWith('data:')&&!x.startsWith('#'));
console.log('ASSETS',refs);
let bundleText='';
let failures=[];
for(const ref of refs){
  const url=abs(ref);
  try{
    const a=await fetch(url,{signal:AbortSignal.timeout(30000)});
    const text=await a.text();
    const ct=a.headers.get('content-type')||'';
    console.log('ASSET',a.status,ct,text.length,url);
    if(!a.ok)failures.push(`${a.status} ${url}`);
    if(/\.js(?:\?|$)/.test(url)||ct.includes('javascript'))bundleText+=`\n${text}`;
  }catch(e){failures.push(`${url} ${e.message}`)}
}
console.log('BUNDLE_BYTES',bundleText.length);
console.log('HAS_EXPECTED_API',bundleText.includes(expectedApi));
console.log('HAS_OLD_PROD_API',bundleText.includes('https://delilah-pm5f.onrender.com'));
console.log('HAS_MARKETPLACE_API',bundleText.includes('https://dalelah-sell-preview.onrender.com'));
const patterns=['Load failed','Search unavailable','Network request failed','seller-submissions-not-open'];
for(const p of patterns)console.log('BUNDLE_PATTERN',JSON.stringify(p),bundleText.includes(p));
if(failures.length)throw new Error(`asset failures: ${failures.join('; ')}`);
if(!bundleText)throw new Error('no JS bundle resolved from shell');
if(!bundleText.includes(expectedApi))throw new Error(`bundle does not contain expected API ${expectedApi}`);
console.log('PASS mobile shell assets and API binding');
