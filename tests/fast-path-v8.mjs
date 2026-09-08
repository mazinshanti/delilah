const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const cases=[
  {query:'Toyota Camry',condition:'used'},
  {query:'Nissan Patrol 2022 Riyadh',condition:'used'},
  {query:'ابي رانجلر 2022 وفوق بالرياض تحت 130 ألف',condition:'used'}
];
let last=[];
for(const t of cases){
  const started=Date.now();
  try{
    const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...t,filters:{},phase:'fast'}),signal:AbortSignal.timeout(8000)});
    const elapsed=Date.now()-started;
    if(!r.ok){last.push(`${t.query}: HTTP ${r.status}`);continue}
    const d=await r.json();
    if(d.phase!=='fast'||d.partial!==true){last.push(`${t.query}: not fast partial`);continue}
    if(elapsed>5000){last.push(`${t.query}: ${elapsed}ms`);continue}
    const cars=Array.isArray(d.listings)?d.listings:[];
    if(!cars.length){last.push(`${t.query}: 0 cars in ${elapsed}ms`);continue}
    for(const c of cars){
      if(c.saleVerified!==true)throw new Error(`Unverified sale result: ${c.url}`);
      if(c.condition!==t.condition)throw new Error(`Condition leak: wanted ${t.condition}, got ${c.condition}`);
      if(!/^https?:\/\//.test(String(c.url||'')))throw new Error(`Bad listing URL: ${c.url}`);
      if(c.image!=null&&c.imageVerified!==true)throw new Error(`Unverified image exposed: ${c.url}`);
      if(c.price!=null&&(!Number.isFinite(Number(c.price))||Number(c.price)<=0))throw new Error(`Invalid price: ${c.price} ${c.url}`);
    }
    console.log(`PASS fast path: '${t.query}' returned ${cars.length} verified cars in ${elapsed}ms`);
    process.exit(0);
  }catch(e){last.push(`${t.query}: ${e.message}`)}
}
throw new Error(`No reliable fast user path passed: ${last.join(' | ')}`);
