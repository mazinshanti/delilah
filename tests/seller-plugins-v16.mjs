const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const j=async(url,opts={})=>{const r=await fetch(url,{...opts,signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`${url} HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json()};
const p=await j(`${base}/api/source-plugins`);
for(const name of ['Saudi Sale','YallaMotor','ArabWheels','Hatla2ee'])if(!p.strictSearchPlugins?.some(x=>x.name===name))throw new Error(`Missing strict source plugin ${name}`);
if(p.boundaries?.antiBotBypass!==false||p.boundaries?.exactIndividualUrlsOnly!==true)throw new Error('Source plugin safety boundaries missing');
console.log(`PASS source registry: ${p.strictSearchPlugins.map(x=>x.name).join(', ')}`);
const r=await j(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Hyundai Tucson 2019 Riyadh',condition:'used',filters:{seller:'ArabWheels'}})});
const cars=(r.listings||[]).filter(c=>c.source==='ArabWheels');
if(cars.length<1)throw new Error(`ArabWheels plugin returned no cars; counts=${JSON.stringify(r.counts||{})}`);
for(const c of cars){
 if(c.condition!=='used'||c.saleVerified!==true)throw new Error(`Invalid ArabWheels sale ${c.url}`);
 if(!/^https:\/\/(?:www\.)?arabwheels\.sa\/en\/used-cars\/[^/]+-for-sale-in-[^/]+-\d+\/?$/i.test(c.url||''))throw new Error(`Non-direct ArabWheels URL ${c.url}`);
 if(c.image&&!c.imageVerified)throw new Error(`Unverified ArabWheels image ${c.url}`);
}
console.log(`PASS ArabWheels strict live plugin: ${cars.length} real cars`);
