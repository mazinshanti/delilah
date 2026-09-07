const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const models=[
'Toyota Camry','Toyota Corolla','Toyota Yaris','Toyota Prado','Toyota Fortuner','Toyota Land Cruiser',
'Nissan Sunny','Nissan Patrol',
'Hyundai Accent','Hyundai Elantra','Hyundai Sonata','Hyundai Tucson',
'Kia Pegas','Kia Sportage','Kia Cerato','Kia Sorento','Kia K5',
'Honda Accord','Honda Civic','Honda City',
'Mazda 6','Mazda CX-5',
'Haval H6','Haval Jolion',
'Changan Alsvin','Changan CS35','Changan CS75',
'Jeep Wrangler','Jeep Grand Cherokee',
'Geely Coolray','Geely Emgrand'
];
const timeout=ms=>AbortSignal.timeout(ms);
const all=new Map();let totalReturned=0,totalImages=0,okQueries=0,failed=[];
async function one(q){
 const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,condition:'used',filters:{seller:'Syarah'}}),signal:timeout(150000)});
 if(!r.ok)throw new Error(`HTTP ${r.status}`);
 const d=await r.json();
 if(!Array.isArray(d.listings))throw new Error('listings missing');
 let imgs=0;
 for(const c of d.listings){
   if(c.source!=='Syarah')throw new Error(`wrong source ${c.source}`);
   if(c.condition!=='used')throw new Error(`condition leak ${c.condition}`);
   if(c.saleVerified!==true)throw new Error(`unverified sale ${c.url}`);
   if(!/^https:\/\/(?:www\.)?syarah\.com\/(?:en\/|ar\/)?cardetail\/[^/]+-\d+\/?$/i.test(c.url))throw new Error(`not direct ad ${c.url}`);
   if(c.image){if(c.imageVerified!==true)throw new Error(`unverified image ${c.url}`);imgs++;}
   all.set(c.url,c);
 }
 totalReturned+=d.listings.length;totalImages+=imgs;
 if(d.listings.length)okQueries++;
 console.log(`${q.padEnd(24)} ${String(d.listings.length).padStart(3)} cars | ${String(imgs).padStart(3)} images | raw ${d.rawCandidates||0}`);
}
for(let i=0;i<models.length;i+=3){
 const batch=models.slice(i,i+3);
 const rs=await Promise.allSettled(batch.map(one));
 rs.forEach((r,j)=>{if(r.status==='rejected'){failed.push(`${batch[j]}: ${r.reason?.message||r.reason}`);console.error(`FAIL ${batch[j]}: ${r.reason?.message||r.reason}`)}});
}
const unique=[...all.values()],uniqueImages=unique.filter(x=>x.imageVerified).length;
console.log(`SCALE TOTAL: ${totalReturned} returned; ${unique.length} UNIQUE cars; ${uniqueImages} verified images; ${okQueries}/${models.length} queries with inventory; ${failed.length} request failures`);
if(failed.length>3)throw new Error(`too many query failures: ${failed.length}`);
if(unique.length<200)throw new Error(`inventory target not reached: ${unique.length}/200 unique verified cars`);
if(uniqueImages<Math.floor(unique.length*.75))throw new Error(`image coverage too low: ${uniqueImages}/${unique.length}`);
console.log('PASS inventory scale target: 200+ unique verified cars');
