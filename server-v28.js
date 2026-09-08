import express from "express";

const externalPort=Number(process.env.PORT||3000);
const v27Port=Number(process.env.DELILAH_V27_PORT||5200);
process.env.PORT=String(v27Port);
await import("./server-v27.js");
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:"1mb"}));
const searchMeta=new Map();

const HISTORY_PROVIDERS=[
  {id:'mojaz',name:'Mojaz',url:'https://mojaz.com.sa/mojaz/',scope:'Saudi vehicle history',vin:true,note:'Saudi history reports including accidents, odometer history, ownership and maintenance data when available.'},
  {id:'opensooq-reports',name:'OpenSooq Car Reports',url:'https://sa.opensooq.com/en/car-reports',scope:'Mojaz / Carfax report access',vin:true,note:'VIN-based car reports with provider coverage depending on the vehicle.'},
  {id:'ua',name:'United Assurance',url:'https://ua.sa/',scope:'US / Canada imports',vin:true,note:'VIN history for imported vehicles, including accident, salvage, flood, fire and odometer data when available.'}
];

const SOURCE_ALIASES={
  Haraj:['haraj','حراج'],
  Syarah:['syarah','موقع سيارة','موقع سياره'],
  OpenSooq:['opensooq','open sooq','السوق المفتوح'],
  'Saudi Sale':['saudi sale','سعودي سيل','سعودي سيلز'],
  ArabWheels:['arabwheels','arab wheels','عرب ويلز'],
  YallaMotor:['yallamotor','yalla motor','يلا موتور'],
  CarSwitch:['carswitch','car switch','كار سويتش'],
  Motory:['motory','موتري'],
  Mstaml:['mstaml','مستعمل'],
  Carly:['carly','كارلي']
};

const LEXICON=[
  ['Toyota',['toyota','تويوتا']],['Jeep',['jeep','جيب']],['Nissan',['nissan','نيسان']],['Lexus',['lexus','لكزس']],['BMW',['bmw','بي ام دبليو','بي ام']],['Mercedes',['mercedes','mercedes benz','مرسيدس']],['Hyundai',['hyundai','هيونداي']],['Kia',['kia','كيا']],['Ford',['ford','فورد']],['Chevrolet',['chevrolet','chevy','شفروليه']],['GMC',['gmc','جي ام سي']],['Mazda',['mazda','مازدا']],['Honda',['honda','هوندا']],['Mitsubishi',['mitsubishi','ميتسوبيشي']],['Chrysler',['chrysler','كرايسلر','كلزلر']],['Dodge',['dodge','دودج']],['RAM',['ram','رام']],['Cadillac',['cadillac','كاديلاك']],['Lincoln',['lincoln','لينكون']],['Porsche',['porsche','بورش']],['Audi',['audi','اودي']],['Volkswagen',['volkswagen','vw','فولكس واجن']],['Volvo',['volvo','فولفو']],['Land Rover',['land rover','لاند روفر']],['Range Rover',['range rover','رينج روفر']],['Genesis',['genesis','جينيسيس','جينيسس']],['Geely',['geely','جيلي']],['Changan',['changan','شانجان']],['Haval',['haval','هافال']],['GAC',['gac','جي ايه سي']],['MG',['mg','ام جي']],['BYD',['byd','بي واي دي']],['Jetour',['jetour','جيتور']],['Chery',['chery','شيري']],['Hongqi',['hongqi','هونشي']],['Exeed',['exeed','اكسيد']],['Jaecoo',['jaecoo','جايكو']],['Omoda',['omoda','اومودا']],['Tank',['tank','تانك']],['Zeekr',['zeekr','زيكر']],['Tesla',['tesla','تسلا']],['Lucid',['lucid','لوسيد']],['Polestar',['polestar','بولستار']],['Peugeot',['peugeot','بيجو']],['Renault',['renault','رينو']],['Suzuki',['suzuki','سوزوكي']],['Isuzu',['isuzu','ايسوزو']],['Subaru',['subaru','سوبارو']],['Infiniti',['infiniti','انفينيتي']],['Ferrari',['ferrari','فيراري']],['Lamborghini',['lamborghini','لامبورغيني']],['Bentley',['bentley','بنتلي']],['Rolls Royce',['rolls royce','رولز رويس']],['Aston Martin',['aston martin','استون مارتن']],['Maserati',['maserati','مازيراتي']],['McLaren',['mclaren','ماكلارين']],['Mini',['mini','ميني']],['Fiat',['fiat','فيات']],
  ['Camry',['camry','كامري']],['Corolla',['corolla','كورولا']],['Land Cruiser',['land cruiser','landcruiser','لاند كروزر','لاندكروزر']],['Prado',['prado','برادو']],['Yaris',['yaris','يارس']],['Fortuner',['fortuner','فورتشنر']],['Hilux',['hilux','هايلوكس']],['RAV4',['rav4','راف فور']],['Patrol',['patrol','باترول']],['Sunny',['sunny','صني']],['Altima',['altima','التيما']],['X-Trail',['x trail','xtrail','اكس تريل']],['Wrangler',['wrangler','رانجلر']],['Compass',['compass','كومباس']],['Cherokee',['cherokee','شيروكي']],['Grand Cherokee',['grand cherokee','جراند شيروكي']],['Accord',['accord','اكورد']],['Civic',['civic','سيفيك']],['Tucson',['tucson','توسان']],['Santa Fe',['santa fe','سنتافي']],['Sonata',['sonata','سوناتا']],['Accent',['accent','اكسنت']],['Elantra',['elantra','النترا']],['Sportage',['sportage','سبورتاج']],['Sorento',['sorento','سورينتو']],['Cerato',['cerato','سيراتو']],['Territory',['territory','تيريتوري']],['Explorer',['explorer','اكسبلورر']],['Expedition',['expedition','اكسبديشن']],['Tahoe',['tahoe','تاهو']],['Suburban',['suburban','سوبربان']],['Sierra',['sierra','سييرا']],['Coolray',['coolray','كولراي']],['Emgrand',['emgrand','امجراند']],['Jolion',['jolion','جوليون']],['CS75 Plus',['cs75 plus','cs 75 plus']],['CS35',['cs35','cs 35']],['RX5',['rx5','rx 5']],['Song Plus',['song plus']],['Dashing',['dashing','داشينج']],['VXR',['vxr','v x r','في اكس ار','فيكس ار','فكسر']],['GXR',['gxr','g x r','جي اكس ار']],['TXL',['txl','تي اكس ال']],['F-150',['f150','f-150','f 150']],['CX-5',['cx5','cx-5','cx 5']],['Model 3',['model 3']],['Model Y',['model y']]
];

const GENERIC=new Set('show me show all all results results cars car vehicle vehicles used new find search looking want need from only please ابي ابغى اريد ورني عطني دور لي سيارات سيارة سياره كل جميع النتائج نتايج من فقط'.split(/\s+/));
function norm(s=''){return String(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function compact(s=''){return norm(s).replace(/\s+/g,'')}
function lev(a,b){a=String(a);b=String(b);const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}return d[a.length][b.length]}
function similarity(a,b){a=compact(a);b=compact(b);if(!a||!b)return 0;if(a===b)return 1;return 1-lev(a,b)/Math.max(a.length,b.length)}
function sameScript(a,b){const ar=x=>/[\u0600-\u06ff]/.test(x);return ar(a)===ar(b)}

function detectSource(query='',filters={}){
  if(filters?.source)return {source:String(filters.source),query:String(query)};
  const nq=` ${norm(query)} `;
  for(const[source,aliases]of Object.entries(SOURCE_ALIASES))for(const alias of aliases){const na=norm(alias);if(nq.includes(` ${na} `)){let q=String(query);const esc=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');q=q.replace(new RegExp(`(?:from|on|only\\s+from|من|على|في)?\\s*${esc}`,'ig'),' ');return{source,query:q.replace(/\s+/g,' ').trim()}}}
  return{source:null,query:String(query)};
}

function correctTypos(query=''){
  let q=String(query),corrections=[];
  const entries=[];
  for(const[canonical,aliases]of LEXICON)for(const alias of aliases)entries.push({canonical,alias,norm:norm(alias)});
  for(const e of entries.sort((a,b)=>b.norm.length-a.norm.length)){
    const re=new RegExp(`(^|[^a-zA-Z0-9\\u0600-\\u06ff])${e.alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-zA-Z0-9\\u0600-\\u06ff])`,'i');
    if(re.test(q)&&norm(e.alias)!==norm(e.canonical)){q=q.replace(re,(m,a,b)=>`${a}${e.canonical}${b}`);corrections.push({from:e.alias,to:e.canonical,confidence:1,type:'alias'})}
  }
  const tokens=q.split(/\s+/);for(let i=0;i<tokens.length;i++){
    const raw=tokens[i],n=norm(raw);if(!n||n.length<4||GENERIC.has(n)||/^\d+$/.test(n))continue;
    let best=null,second=0;
    for(const e of entries){if(e.norm.includes(' ')||!sameScript(n,e.norm))continue;const s=similarity(n,e.norm);if(!best||s>best.score){second=best?.score||0;best={...e,score:s}}else if(s>second)second=s}
    if(best&&best.score>=0.74&&best.score-second>=0.08&&best.norm!==n){tokens[i]=best.canonical;corrections.push({from:raw,to:best.canonical,confidence:Number(best.score.toFixed(2)),type:'fuzzy'})}
  }
  q=tokens.join(' ').replace(/\s+/g,' ').trim();
  return{query:q,corrections:[...new Map(corrections.map(c=>[`${c.from}|${c.to}`,c])).values()]};
}
function usefulQuery(q=''){const t=norm(q).split(' ').filter(x=>x&&!GENERIC.has(x));return t.length?q:'cars'}
function prepare(body={}){const original=String(body.query||''),sourceHit=detectSource(original,body.filters||{}),corrected=correctTypos(sourceHit.query),query=usefulQuery(corrected.query),filters={...(body.filters||{})};delete filters.source;return{body:{...body,query,filters},original,source:sourceHit.source,corrections:corrected.corrections,normalizedQuery:query}}

async function upstream(path,opts={}){let last;for(let i=0;i<2;i++){try{const r=await fetch(`http://127.0.0.1:${v27Port}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(50000)}),text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,500)}}last={r,d};if(r.ok||![502,503,504].includes(r.status))return last}catch(e){last={error:e};if(opts.signal?.aborted)throw e}if(i===0)await new Promise(r=>setTimeout(r,150))}if(last?.r)return last;throw last?.error||new Error('upstream unavailable')}
function filterSource(d={},source){if(!source||!Array.isArray(d.listings))return d;const listings=d.listings.filter(c=>norm(c.source||'')===norm(source));const counts=listings.reduce((a,c)=>(a[c.source]=(a[c.source]||0)+1,a),{});return{...d,listings,counts,product:{...(d.product||{}),verifiedListings:listings.length,verifiedPrices:listings.filter(x=>x.priceVerified).length,verifiedImages:listings.filter(x=>x.imageVerified).length,sources:Object.keys(counts).length}}
function patch(d={},meta={}){const u=d.understanding&&typeof d.understanding==='object'?{...d.understanding,query:meta.original||d.understanding.query,normalizedQuery:meta.normalizedQuery||d.understanding.normalizedQuery,source:meta.source||null,typoCorrections:meta.corrections||[]}:d.understanding;return{...d,understanding:u,sourceFilter:meta.source||null,typoCorrections:meta.corrections||[],smartSearchBar:true,sourceAwareSearch:true,universalTypoCorrection:true,similarOfferings:true,vehicleHistoryIntegration:true,product:{...(d.product||{}),version:'v28'}}}

app.post('/api/search',async(req,res)=>{const p=prepare(req.body||{});try{const{r,d}=await upstream('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p.body),signal:AbortSignal.timeout(p.body.phase==='fast'?9000:48000)});if(!r.ok)return res.status(r.status).json(d);let out=patch(filterSource(d,p.source),p);if(out.searchId)searchMeta.set(out.searchId,{...p,at:Date.now()});return res.json(out)}catch(e){return res.status(502).json({error:e?.message||'Smart search unavailable'})}});
app.get('/api/search/progress/:id',async(req,res)=>{try{const{r,d}=await upstream(`/api/search/progress/${encodeURIComponent(req.params.id)}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)return res.status(r.status).json(d);const m=searchMeta.get(req.params.id)||{};return res.json(patch(filterSource(d,m.source),m))}catch(e){return res.status(502).json({error:e?.message||'Search progress unavailable'})}});
app.post('/api/understand',async(req,res)=>{const p=prepare(req.body||{});try{const{r,d}=await upstream('/api/understand',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p.body),signal:AbortSignal.timeout(12000)});if(!r.ok)return res.status(r.status).json(d);return res.json(patch(d,p))}catch(e){return res.status(502).json({error:e?.message||'Understanding unavailable'})}});
app.post('/api/similar',async(req,res)=>{const u=req.body?.understanding||{},condition=req.body?.condition==='new'?'new':'used',exclude=new Set((req.body?.excludeUrls||[]).map(String)),source=String(req.body?.source||'').trim()||null;if(!u.make&&!u.brand)return res.json({listings:[]});const query=[u.make||u.brand,u.model].filter(Boolean).join(' ');const body={query,condition,filters:{},phase:'fast'};try{const{r,d}=await upstream('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok)return res.status(r.status).json(d);let cars=(d.listings||[]).filter(c=>!exclude.has(String(c.url)));if(source)cars=cars.filter(c=>norm(c.source||'')===norm(source));const refYear=Number(req.body?.year||0),refPrice=Number(req.body?.price||0);cars.sort((a,b)=>{const score=c=>(u.model&&norm(`${c.title||''} ${c.url||''}`).includes(norm(u.model))?100:0)-(refYear&&c.year?Math.abs(refYear-Number(c.year))*4:0)-(refPrice&&c.price?Math.min(25,Math.abs(refPrice-Number(c.price))/Math.max(refPrice,1)*30):0);return score(b)-score(a)});return res.json({listings:cars.slice(0,8),query,source,similar:true})}catch(e){return res.status(502).json({error:e?.message||'Similar offerings unavailable'})}});
app.get('/api/history-providers',(req,res)=>res.json({providers:HISTORY_PROVIDERS,mode:'external_provider_links',note:'Delilah does not fabricate vehicle history. Reports are requested directly from the provider using VIN/serial details.'}));
app.get('/api/health',async(req,res)=>{try{const{r,d}=await upstream('/api/health',{signal:AbortSignal.timeout(9000)});if(!r.ok)throw new Error('health');return res.json({...d,edge:'product-v28',logic:'smart-search-source-fuzzy-similar-history-v28',smartSearchBar:true,sourceAwareSearch:true,universalTypoCorrection:true,similarOfferings:true,vehicleHistoryIntegration:true})}catch{return res.status(503).json({ok:false,edge:'product-v28'})}});
app.get('/',async(req,res)=>{try{const r=await fetch(`http://127.0.0.1:${v27Port}/`,{signal:AbortSignal.timeout(10000)}),html=await r.text();res.setHeader('cache-control','no-store');return res.type('html').send(html.replace('</body>','<script src="/hotfix-v28.js"></script></body>'))}catch{return res.status(502).send('Delilah frontend unavailable')}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${v27Port}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(50000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch{return res.status(502).json({error:'Delilah upstream unavailable'})}}
app.use(proxy);
setInterval(()=>{const now=Date.now();for(const[k,v]of searchMeta)if(now-v.at>60*60_000)searchMeta.delete(k)},10*60_000).unref();
app.listen(externalPort,()=>console.log(`Delilah smart product-v28 running at http://localhost:${externalPort}`));
