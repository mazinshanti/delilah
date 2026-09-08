import express from "express";

const externalPort=Number(process.env.PORT||3000);
const v26Port=Number(process.env.DELILAH_V26_PORT||5100);
process.env.PORT=String(v26Port);
await import("./server-v26.js");
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:"1mb"}));
const searchBodies=new Map();

const AR_MODEL={
  'رانجلر':'Wrangler','كومباس':'Compass','شيروكي':'Cherokee','جراند شيروكي':'Grand Cherokee','باترول':'Patrol','صني':'Sunny','التيما':'Altima','اكس تريل':'X-Trail',
  'لاند كروزر':'Land Cruiser','لاندكروزر':'Land Cruiser','برادو':'Prado','كامري':'Camry','كورولا':'Corolla','يارس':'Yaris','فورتشنر':'Fortuner','هايلوكس':'Hilux','راف فور':'RAV4',
  'توسان':'Tucson','سنتافي':'Santa Fe','سوناتا':'Sonata','اكسنت':'Accent','النترا':'Elantra','سبورتاج':'Sportage','سورينتو':'Sorento','سيراتو':'Cerato','بيجاس':'Pegas','سيلتوس':'Seltos',
  'تيريتوري':'Territory','اكسبلورر':'Explorer','اكسبديشن':'Expedition','تاهو':'Tahoe','اكورد':'Accord','سيفيك':'Civic','سيتي':'City','كولراي':'Coolray','امجراند':'Emgrand','جوليون':'Jolion','داشينج':'Dashing'
};
function localizeArabic(q=''){let out=String(q);for(const[a,b]of Object.entries(AR_MODEL).sort((x,y)=>y[0].length-x[0].length))out=out.split(a).join(b);return out}
function compactHyphenModels(q=''){return String(q).replace(/\b([A-Za-z]{1,5})[-–—](\d{1,4}[A-Za-z]?)\b/g,'$1$2')}
function variants(q=''){const a=localizeArabic(q),b=compactHyphenModels(a),xs=[String(q),a,b];return[...new Set(xs.filter(Boolean))]}
async function upstream(path,opts={}){const r=await fetch(`http://127.0.0.1:${v26Port}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(50000)}),text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,500)}}return{r,d}}
function patch(d,original,normalized){if(!d||typeof d!=='object')return d;const u=d.understanding&&typeof d.understanding==='object'?{...d.understanding,query:original,normalizedQuery:normalized}:d.understanding;return{...d,understanding:u,universalVehicleIdentity:true,queryExpansion:true,identityNormalization:true,product:{...(d.product||{}),version:'v27'}}}
async function runSearch(body){const qs=variants(body.query||'');let best=null,bestBody=null;for(let i=0;i<qs.length;i++){const b={...body,query:qs[i]},opts={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b),signal:AbortSignal.timeout(body.phase==='fast'?25000:48000)};const{r,d}=await upstream('/api/search',opts);if(!r.ok){if(!best)best={r,d};continue}const score=Array.isArray(d.listings)?d.listings.length:0;if(!best||!best.r?.ok||score>(Array.isArray(best.d?.listings)?best.d.listings.length:0)){best={r,d,normalized:qs[i]};bestBody=b}if(score>0)break}return{...best,bestBody:bestBody||body}}

app.post('/api/search',async(req,res)=>{const original=req.body||{};try{const out=await runSearch(original);if(!out?.r?.ok)return res.status(out?.r?.status||502).json(out?.d||{error:'Search unavailable'});const d=patch(out.d,String(original.query||''),out.normalized||String(original.query||''));if(d.searchId)searchBodies.set(d.searchId,{body:out.bestBody,original:String(original.query||''),normalized:out.normalized||String(original.query||''),at:Date.now()});return res.json(d)}catch(e){return res.status(502).json({error:e?.message||'Delilah normalized search unavailable'})}});
app.get('/api/search/progress/:id',async(req,res)=>{try{const{r,d}=await upstream(`/api/search/progress/${encodeURIComponent(req.params.id)}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)return res.status(r.status).json(d);const m=searchBodies.get(req.params.id);return res.json(patch(d,m?.original||d?.understanding?.query||'',m?.normalized||d?.understanding?.query||''))}catch(e){return res.status(502).json({error:e?.message||'Search progress unavailable'})}});
app.post('/api/understand',async(req,res)=>{const original=String(req.body?.query||''),q=localizeArabic(original);try{const{r,d}=await upstream('/api/understand',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...req.body,query:q}),signal:AbortSignal.timeout(12000)});if(!r.ok)return res.status(r.status).json(d);return res.json(patch(d,original,q))}catch(e){return res.status(502).json({error:e?.message||'Understanding unavailable'})}});
app.get('/api/health',async(req,res)=>{try{const{r,d}=await upstream('/api/health',{signal:AbortSignal.timeout(9000)});if(!r.ok)throw new Error('health');return res.json({...d,edge:'product-v27',logic:'universal-identity-normalization-v27',universalVehicleIdentity:true,unknownMakeFallback:true,queryExpansion:true,identityNormalization:true})}catch{return res.status(503).json({ok:false,edge:'product-v27'})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${v26Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch{return res.status(502).json({error:'Delilah upstream unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of searchBodies)if(now-v.at>60*60_000)searchBodies.delete(k)},10*60_000).unref();
app.listen(externalPort,()=>console.log(`Delilah universal normalized product-v27 running at http://localhost:${externalPort}`));
