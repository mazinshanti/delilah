import express from 'express';

const externalPort = Number(process.env.PORT || 3000);
const v27Port = Number(process.env.DELILAH_V27_PORT || 5200);
process.env.PORT = String(v27Port);
await import('./server-v27.js');
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: '1mb' }));
const searchMeta = new Map();

const HISTORY_PROVIDERS = [
  { id: 'mojaz', name: 'Mojaz', url: 'https://mojaz.com.sa/mojaz/', scope: 'Saudi vehicle history', note: 'Saudi history reports including accidents, odometer history, ownership and maintenance data when available.' },
  { id: 'opensooq-reports', name: 'OpenSooq Car Reports', url: 'https://sa.opensooq.com/en/car-reports', scope: 'Mojaz / Carfax report access', note: 'VIN-based reports with provider coverage depending on the vehicle.' },
  { id: 'ua', name: 'United Assurance', url: 'https://ua.sa/', scope: 'US / Canada imports', note: 'VIN history for imported vehicles, including accident, salvage, flood, fire and odometer data when available.' }
];

const SOURCE_ALIASES = new Map([
  ['Haraj', ['haraj', 'حراج']], ['Syarah', ['syarah', 'موقع سيارة', 'موقع سياره']],
  ['OpenSooq', ['opensooq', 'open sooq', 'السوق المفتوح']], ['Saudi Sale', ['saudi sale', 'سعودي سيل', 'سعودي سيلز']],
  ['ArabWheels', ['arabwheels', 'arab wheels', 'عرب ويلز']], ['YallaMotor', ['yallamotor', 'yalla motor', 'يلا موتور']],
  ['CarSwitch Saudi', ['carswitch', 'car switch', 'كار سويتش']], ['Motory', ['motory', 'موتري']],
  ['Mstaml', ['mstaml', 'مستعمل']], ['Carly', ['carly', 'كارلي']]
]);
const UPSTREAM_SELLER_SAFE = new Set(['Haraj', 'Syarah']);

const TERMS = [
  ['Toyota',['toyota','تويوتا']],['Nissan',['nissan','نيسان']],['Jeep',['jeep','جيب']],['Lexus',['lexus','لكزس']],['BMW',['bmw','بي ام دبليو','بي ام']],['Mercedes',['mercedes','mercedes benz','مرسيدس']],['Hyundai',['hyundai','هيونداي']],['Kia',['kia','كيا']],['Ford',['ford','فورد']],['Chevrolet',['chevrolet','chevy','شفروليه']],['GMC',['gmc','جي ام سي']],['Mazda',['mazda','مازدا']],['Honda',['honda','هوندا']],['Mitsubishi',['mitsubishi','ميتسوبيشي']],['Chrysler',['chrysler','كرايسلر','كلزلر']],['Dodge',['dodge','دودج']],['RAM',['ram','رام']],['Cadillac',['cadillac','كاديلاك']],['Lincoln',['lincoln','لينكون']],['Porsche',['porsche','بورش']],['Audi',['audi','اودي']],['Volkswagen',['volkswagen','vw','فولكس واجن']],['Volvo',['volvo','فولفو']],['Land Rover',['land rover','لاند روفر']],['Range Rover',['range rover','رينج روفر']],['Genesis',['genesis','جينيسيس','جينيسس']],['Geely',['geely','جيلي']],['Changan',['changan','شانجان']],['Haval',['haval','هافال']],['GAC',['gac','جي ايه سي']],['MG',['mg','ام جي']],['BYD',['byd','بي واي دي']],['Jetour',['jetour','جيتور']],['Chery',['chery','شيري']],['Hongqi',['hongqi','هونشي']],['Exeed',['exeed','اكسيد']],['Jaecoo',['jaecoo','جايكو']],['Omoda',['omoda','اومودا']],['Tank',['tank','تانك']],['Zeekr',['zeekr','زيكر']],['Tesla',['tesla','تسلا']],['Lucid',['lucid','لوسيد']],['Polestar',['polestar','بولستار']],['Peugeot',['peugeot','بيجو']],['Renault',['renault','رينو']],['Suzuki',['suzuki','سوزوكي']],['Isuzu',['isuzu','ايسوزو']],['Subaru',['subaru','سوبارو']],['Infiniti',['infiniti','انفينيتي']],['Ferrari',['ferrari','فيراري']],['Lamborghini',['lamborghini','لامبورغيني']],['Bentley',['bentley','بنتلي']],['Rolls Royce',['rolls royce','رولز رويس']],['Aston Martin',['aston martin','استون مارتن']],['Maserati',['maserati','مازيراتي']],['McLaren',['mclaren','ماكلارين']],['Mini',['mini','ميني']],
  ['Camry',['camry','كامري']],['Corolla',['corolla','كورولا']],['Land Cruiser',['land cruiser','landcruiser','لاند كروزر','لاندكروزر']],['Prado',['prado','برادو']],['Yaris',['yaris','يارس']],['Fortuner',['fortuner','فورتشنر']],['Hilux',['hilux','هايلوكس']],['RAV4',['rav4','راف فور']],['Patrol',['patrol','باترول']],['Sunny',['sunny','صني']],['Altima',['altima','التيما']],['X-Trail',['x trail','xtrail','اكس تريل']],['Wrangler',['wrangler','رانجلر']],['Compass',['compass','كومباس']],['Cherokee',['cherokee','شيروكي']],['Grand Cherokee',['grand cherokee','جراند شيروكي']],['Accord',['accord','اكورد']],['Civic',['civic','سيفيك']],['Tucson',['tucson','توسان']],['Santa Fe',['santa fe','سنتافي']],['Sonata',['sonata','سوناتا']],['Accent',['accent','اكسنت']],['Elantra',['elantra','النترا']],['Sportage',['sportage','سبورتاج']],['Sorento',['sorento','سورينتو']],['Cerato',['cerato','سيراتو']],['Territory',['territory','تيريتوري']],['Explorer',['explorer','اكسبلورر']],['Expedition',['expedition','اكسبديشن']],['Tahoe',['tahoe','تاهو']],['Sierra',['sierra','سييرا']],['Coolray',['coolray','كولراي']],['Emgrand',['emgrand','امجراند']],['Jolion',['jolion','جوليون']],['CS75 Plus',['cs75 plus','cs 75 plus']],['CS35',['cs35','cs 35']],['RX5',['rx5','rx 5']],['Song Plus',['song plus']],['Dashing',['dashing','داشينج']],['VXR',['vxr','v x r','في اكس ار','فيكس ار','فكسر']],['GXR',['gxr','g x r','جي اكس ار']],['F-150',['f150','f-150','f 150']],['CX-5',['cx5','cx-5','cx 5']],['Model 3',['model 3']],['Model Y',['model y']]
];

const FILLER = new Set(`show me all results result cars car vehicle vehicles used new find search looking want need from only please on in
ابي ابغى اريد ورني عطني دور لي سيارات سيارة سياره كل جميع النتائج نتايج من فقط على في`.split(/\s+/));
const BROWSE_QUERIES = ['Toyota','Nissan','Hyundai','Kia','Jeep','Ford','Chevrolet','Lexus','BMW','Mercedes','Mazda','Honda'];

function norm(value='') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
}
function compact(value='') { return norm(value).replace(/\s+/g,''); }
function digitsOf(value='') { return (String(value).match(/\d+/g) || []).join('|'); }
function distance(a,b) {
  a=String(a); b=String(b);
  const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) d[i][0]=i;
  for(let j=0;j<=b.length;j++) d[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    const cost=a[i-1]===b[j-1]?0:1;
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
function similarity(a,b) {
  a=compact(a); b=compact(b); if(!a||!b) return 0; if(a===b) return 1;
  return 1-distance(a,b)/Math.max(a.length,b.length);
}
function sameScript(a,b) { const ar=x=>/[\u0600-\u06ff]/.test(x); return ar(a)===ar(b); }
const entries=TERMS.flatMap(([canonical,aliases])=>aliases.map(alias=>({canonical,alias,n: norm(alias)})));

function sourceIntent(query='',filters={}) {
  if(filters.source) return {source:String(filters.source),query:String(query)};
  const nq=` ${norm(query)} `;
  for(const [source,aliases] of SOURCE_ALIASES) for(const alias of aliases) {
    if(!nq.includes(` ${norm(alias)} `)) continue;
    const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const stripped=String(query).replace(new RegExp(`(?:only\\s+from|from|on|من|على|في)?\\s*${escaped}`,'ig'),' ').replace(/\s+/g,' ').trim();
    return {source,query:stripped};
  }
  return {source:null,query:String(query)};
}

function correct(query='') {
  let q=String(query); const corrections=[];
  for(const e of [...entries].sort((a,b)=>b.n.length-a.n.length)) {
    const escaped=e.alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp(`(^|[^a-zA-Z0-9\\u0600-\\u06ff])${escaped}($|[^a-zA-Z0-9\\u0600-\\u06ff])`,'i');
    if(!re.test(q)||norm(e.alias)===norm(e.canonical)) continue;
    q=q.replace(re,(_m,before,after)=>`${before}${e.canonical}${after}`);
    corrections.push({from:e.alias,to:e.canonical,confidence:1,type:'alias'});
  }
  const tokens=q.split(/\s+/);
  for(let i=0;i<tokens.length;i++) {
    const raw=tokens[i], token=norm(raw); if(!token||token.length<4||FILLER.has(token)||/^\d+$/.test(token)) continue;
    const numeric=digitsOf(token); let best=null, second=0;
    for(const e of entries) {
      if(e.n.includes(' ')||!sameScript(token,e.n)) continue;
      if(numeric && digitsOf(e.n)!==numeric) continue;
      const score=similarity(token,e.n);
      if(!best||score>best.score){second=best?.score||0;best={...e,score};} else if(score>second) second=score;
    }
    if(best&&best.score>=0.74&&best.score-second>=0.08&&best.n!==token) {
      tokens[i]=best.canonical;
      corrections.push({from:raw,to:best.canonical,confidence:Number(best.score.toFixed(2)),type:'fuzzy'});
    }
  }
  return {query:tokens.join(' ').replace(/\s+/g,' ').trim(),corrections:[...new Map(corrections.map(c=>[`${c.from}|${c.to}`,c])).values()]};
}
function hasVehicleIntent(query='') { return norm(query).split(' ').filter(Boolean).some(t=>!FILLER.has(t)); }
function prepare(body={}) {
  const original=String(body.query||''), hit=sourceIntent(original,body.filters||{}), fixed=correct(hit.query), sourceOnly=Boolean(hit.source&&!hasVehicleIntent(fixed.query));
  const filters={...(body.filters||{})}; delete filters.source;
  if(hit.source&&UPSTREAM_SELLER_SAFE.has(hit.source)&&!sourceOnly&&!filters.seller) filters.seller=hit.source;
  return {original,source:hit.source,sourceOnly,corrections:fixed.corrections,normalizedQuery:fixed.query,body:{...body,query:fixed.query,filters}};
}

async function upstream(path,opts={}) {
  let last;
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const response=await fetch(`http://127.0.0.1:${v27Port}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(50000)});
      const text=await response.text(); let data; try{data=JSON.parse(text)}catch{data={error:text.slice(0,500)}}; last={response,data};
      if(response.ok||![502,503,504].includes(response.status)) return last;
    } catch(error) { last={error}; if(opts.signal?.aborted) throw error; }
    if(attempt===0) await new Promise(r=>setTimeout(r,120));
  }
  if(last?.response) return last; throw last?.error||new Error('upstream unavailable');
}
async function run(body,timeoutMs=15000) {
  return upstream('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
}
function sourceMatches(car,source) { return !source||norm(car?.source||'')===norm(source); }
function filterSource(data={},source) {
  if(!Array.isArray(data.listings)) return data;
  const listings=source?data.listings.filter(c=>sourceMatches(c,source)):data.listings;
  const counts=listings.reduce((a,c)=>{const k=c.source||'Source';a[k]=(a[k]||0)+1;return a;},{});
  return {...data,listings,counts,product:{...(data.product||{}),verifiedListings:listings.length,verifiedPrices:listings.filter(c=>c.priceVerified).length,verifiedImages:listings.filter(c=>c.imageVerified).length,sources:Object.keys(counts).length}};
}
function unique(groups=[]) { const m=new Map(); for(const g of groups) for(const c of g||[]) if(c?.url&&!m.has(String(c.url).replace(/\/$/,''))) m.set(String(c.url).replace(/\/$/,''),c); return [...m.values()]; }
async function browse(prepared) {
  const qs=BROWSE_QUERIES.slice(0,prepared.body.phase==='full'?12:6);
  const filters={...(prepared.body.filters||{})}; if(UPSTREAM_SELLER_SAFE.has(prepared.source)) filters.seller=prepared.source;
  const settled=await Promise.allSettled(qs.map(query=>run({...prepared.body,query,filters,phase:'fast'},12000)));
  const data=settled.filter(x=>x.status==='fulfilled'&&x.value.response.ok).map(x=>x.value.data);
  const listings=unique(data.map(d=>d.listings)).filter(c=>sourceMatches(c,prepared.source));
  return {...(data[0]||{}),listings,counts:{[prepared.source]:listings.length},complete:true,partial:false,phase:'fast',answer:`${listings.length} accessible verified ${prepared.source} listings found across a broad brand scan.`};
}
function patch(data={},meta={}) {
  const understanding={...(data.understanding||{}),query:meta.original||data.understanding?.query||'',normalizedQuery:meta.normalizedQuery||'',source:meta.source||null,sourceOnly:Boolean(meta.sourceOnly),typoCorrections:meta.corrections||[]};
  return {...data,understanding,sourceFilter:meta.source||null,typoCorrections:meta.corrections||[],smartSearchBar:true,sourceAwareSearch:true,sourceBrowse:true,universalTypoCorrection:true,numericModelProtection:true,similarOfferings:true,vehicleHistoryIntegration:true,product:{...(data.product||{}),version:'v30'}};
}

app.post('/api/search',async(req,res)=>{
  const p=prepare(req.body||{});
  try {
    let data;
    if(p.sourceOnly) data=await browse(p);
    else {
      const result=await run(p.body,p.body.phase==='fast'?15000:48000);
      if(!result.response.ok) return res.status(result.response.status).json(result.data);
      data=filterSource(result.data,p.source);
    }
    const out=patch(data,p); if(out.searchId&&!p.sourceOnly) searchMeta.set(out.searchId,{...p,at:Date.now()}); return res.json(out);
  } catch(error) { return res.status(502).json({error:error?.message||'Smart search unavailable'}); }
});
app.get('/api/search/progress/:id',async(req,res)=>{
  try { const {response,data}=await upstream(`/api/search/progress/${encodeURIComponent(req.params.id)}`,{signal:AbortSignal.timeout(30000)}); if(!response.ok)return res.status(response.status).json(data); const m=searchMeta.get(req.params.id)||{}; return res.json(patch(filterSource(data,m.source),m)); }
  catch(error){return res.status(502).json({error:error?.message||'Search progress unavailable'});}
});
app.post('/api/understand',async(req,res)=>{
  const p=prepare(req.body||{}); if(p.sourceOnly)return res.json(patch({ok:true,understanding:{}},p));
  try { const {response,data}=await upstream('/api/understand',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p.body),signal:AbortSignal.timeout(12000)}); if(!response.ok)return res.status(response.status).json(data); return res.json(patch(data,p)); }
  catch(error){return res.status(502).json({error:error?.message||'Understanding unavailable'});}
});
app.post('/api/similar',async(req,res)=>{
  const u=req.body?.understanding||{},make=u.make||u.brand,condition=req.body?.condition==='new'?'new':'used',source=String(req.body?.source||'').trim()||null,exclude=new Set((req.body?.excludeUrls||[]).map(String));
  if(!make)return res.json({listings:[],similar:true});
  const filters={}; if(source&&UPSTREAM_SELLER_SAFE.has(source))filters.seller=source;
  try { const result=await run({query:[make,u.model].filter(Boolean).join(' '),condition,filters,phase:'fast'},15000); if(!result.response.ok)return res.status(result.response.status).json(result.data); let listings=(result.data.listings||[]).filter(c=>!exclude.has(String(c.url))&&sourceMatches(c,source)); const y=Number(req.body?.year||0),p=Number(req.body?.price||0); const score=c=>(u.model&&norm(`${c.title||''} ${c.url||''}`).includes(norm(u.model))?100:0)-(y&&c.year?Math.abs(y-Number(c.year))*4:0)-(p&&c.price?Math.min(25,Math.abs(p-Number(c.price))/Math.max(p,1)*30):0); listings.sort((a,b)=>score(b)-score(a)); return res.json({listings:listings.slice(0,8),source,similar:true}); }
  catch(error){return res.status(502).json({error:error?.message||'Similar offerings unavailable'});}
});
app.get('/api/history-providers',(_req,res)=>res.json({providers:HISTORY_PROVIDERS,mode:'external_provider_links',note:'Delilah does not fabricate vehicle history. Reports are requested directly from the provider using VIN or serial details.'}));
app.get('/api/health',async(_req,res)=>{
  try { const {response,data}=await upstream('/api/health',{signal:AbortSignal.timeout(9000)}); if(!response.ok)throw new Error('health'); return res.json({...data,edge:'product-v30',logic:'smart-source-fuzzy-numeric-safe-v30',smartSearchBar:true,sourceAwareSearch:true,sourceBrowse:true,universalTypoCorrection:true,numericModelProtection:true,similarOfferings:true,vehicleHistoryIntegration:true}); }
  catch{return res.status(503).json({ok:false,edge:'product-v30'});}
});
app.get('/',async(_req,res)=>{try{const r=await fetch(`http://127.0.0.1:${v27Port}/`,{signal:AbortSignal.timeout(10000)}),html=await r.text();res.setHeader('cache-control','no-store');return res.type('html').send(html.replace('</body>','<script src="/hotfix-v28.js"></script></body>'));}catch{return res.status(502).send('Delilah frontend unavailable');}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers)){if(['host','content-length','connection'].includes(k.toLowerCase())||v==null)continue;headers[k]=Array.isArray(v)?v.join(','):String(v);}let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json';}const r=await fetch(`http://127.0.0.1:${v27Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf);}catch{return res.status(502).json({error:'Delilah upstream unavailable'});}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of searchMeta)if(now-v.at>60*60_000)searchMeta.delete(k);},10*60_000).unref();
app.listen(externalPort,()=>console.log(`Delilah smart product-v30 running at http://localhost:${externalPort}`));
