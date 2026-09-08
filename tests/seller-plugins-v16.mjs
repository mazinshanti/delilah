const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const j=async(url,opts={})=>{const r=await fetch(url,{...opts,signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`${url} HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()};
const p=await j(`${base}/api/source-plugins`);
if(!Array.isArray(p.plugins))throw new Error('Missing source plugin registry');
for(const name of ['Saudi Sale','YallaMotor','ArabWheels','Hatla2ee','Genesis Wallan Certified']){
 const x=p.plugins.find(x=>x.name===name);
 if(!x||!String(x.status||'').startsWith('active'))throw new Error(`Missing active source plugin ${name}`);
}
console.log(`PASS source registry: ${p.active}/${p.total} active plugins`);
const r=await j(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Hyundai Tucson 2019 Riyadh',condition:'used',filters:{seller:'ArabWheels'},phase:'full'})});
const cars=(r.listings||[]).filter(c=>c.source==='ArabWheels');
if(cars.length<1)throw new Error(`ArabWheels plugin returned no cars; counts=${JSON.stringify(r.counts||{})}`);
for(const c of cars){
 if(c.condition!=='used'||c.saleVerified!==true)throw new Error(`Invalid ArabWheels sale ${c.url}`);
 if(!/^https:\/\/(?:www\.)?arabwheels\.sa\/en\/used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(c.url||''))throw new Error(`Non-direct ArabWheels URL ${c.url}`);
 if(c.image&&!c.imageVerified)throw new Error(`Unverified ArabWheels image ${c.url}`);
}
console.log(`PASS ArabWheels strict live plugin: ${cars.length} real cars`);
