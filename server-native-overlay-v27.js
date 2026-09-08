import express from 'express';
import path from 'path';
import { exactYear, identityMatches, norm, queryTerms } from './lib/search-semantics-v26.js';
import { nativeHaraj, nativeYallaFromSeed, nativeMotoryFromSeed, nativeSyarah, yallaInfo, motoryInfo, canonical } from './lib/native-marketplaces-v27.js';

const externalPort = Number(process.env.PORT || 3000);
const basePort = Number(process.env.DALELAH_V26_PORT || 6500);
process.env.PORT = String(basePort);
await import('./server-recovery-v26.js');
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(process.cwd(),'public')));

const MODEL_BRAND = new Map([
  ['corolla','toyota'],['camry','toyota'],['yaris','toyota'],['land cruiser','toyota'],['prado','toyota'],['fortuner','toyota'],['hilux','toyota'],['rav4','toyota'],
  ['patrol','nissan'],['sunny','nissan'],['altima','nissan'],['x trail','nissan'],['pathfinder','nissan'],['xterra','nissan'],
  ['wrangler','jeep'],['grand cherokee','jeep'],['cherokee','jeep'],
  ['elantra','hyundai'],['sonata','hyundai'],['accent','hyundai'],['tucson','hyundai'],['santa fe','hyundai'],
  ['sportage','kia'],['sorento','kia'],['cerato','kia'],['pegas','kia'],['k5','kia'],
  ['tahoe','chevrolet'],['suburban','chevrolet'],['captiva','chevrolet'],['traverse','chevrolet'],
  ['explorer','ford'],['expedition','ford'],['territory','ford'],['taurus','ford'],['f 150','ford'],
  ['cx 5','mazda'],['cx 30','mazda'],['cx 50','mazda'],['mazda 6','mazda'],['mazda 3','mazda'],
  ['t2','jetour'],['x70','jetour'],['x90','jetour'],['dashing','jetour'],
  ['cs35','changan'],['cs75','changan'],['cs95','changan'],['uni k','changan'],['uni v','changan'],
  ['coolray','geely'],['monjaro','geely'],['emgrand','geely'],['azkarra','geely'],
  ['h6','haval'],['jolion','haval'],['dargo','haval'],
  ['x5','bmw'],['x3','bmw'],['x7','bmw'],['5 series','bmw'],['3 series','bmw']
]);
const BRAND = new Set(['toyota','nissan','jeep','hyundai','kia','ford','chevrolet','gmc','lexus','honda','mazda','mitsubishi','bmw','mercedes','porsche','audi','volkswagen','geely','changan','jetour','haval','chery','byd','genesis','tesla','lucid','renault','peugeot','suzuki','isuzu','land','range']);
const PART_PREFIX = /^(?:للبيع\s+)?(?:قطع(?:\s+غيار|\s+داخلية)?|تشليح|مكين[هة]|ماكين[هة]|محرك|قير|باب|بيبان|صدام|رفرف|مراي[اة]|مرايات|ايرباق|ارباق|قشر[هة]\s+تابلون|تابلون|فلتر|تحكم\s+مكيف|شمع[هة]|قزاز|spare\s+parts?|engine|gearbox|door|bumper|fender|mirror|airbag|headlight|taillight)\b/i;

function sourceCounts(xs=[]){return xs.reduce((a,c)=>(a[c.source||'Unknown']=(a[c.source||'Unknown']||0)+1,a),{});}
function quality(c={}){return Number(c.aiScore||c.score||0)+(c.imageVerified?4:0)+(c.priceVerified?4:0)+(c.year?2:0)+(c.mileage!=null?1:0);}
function dedupe(groups=[]){const m=new Map();for(const g of groups)for(const raw of g||[]){if(!raw?.url)continue;const c={...raw,url:canonical(raw.url)},old=m.get(c.url);if(!old||quality(c)>quality(old))m.set(c.url,old?{...old,...c,image:c.image||old.image||null,displayImage:c.displayImage||old.displayImage||null,price:c.price??old.price??null}:c);}return[...m.values()];}
function vehicleTitle(c={}){const t=String(c.title||'').trim();return t&&!PART_PREFIX.test(t);}
function finalMatch(c,body,y){if(!c?.url||c.saleVerified===false||!vehicleTitle(c))return false;if(y&&Number(c.year)!==y)return false;if(!identityMatches(c,body.query))return false;const f=body.filters||{};if(f.minYear&&c.year!=null&&Number(c.year)<Number(f.minYear))return false;if(f.maxYear&&c.year!=null&&Number(c.year)>Number(f.maxYear))return false;if(f.maxPrice&&c.price!=null&&Number(c.price)>Number(f.maxPrice))return false;if(f.maxMileage&&c.mileage!=null&&Number(c.mileage)>Number(f.maxMileage))return false;if(f.city&&c.city&&norm(c.city)!==norm(f.city))return false;const requested=String(f.source||f.seller||'').trim();if(requested&&!norm(c.source||c.seller||'').includes(norm(requested)))return false;if(c.condition&&body.condition&&c.condition!==body.condition)return false;return true;}
async function postBase(body,timeout=75000){const r=await fetch(`http://127.0.0.1:${basePort}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,500)}}return{r,d};}
async function getBase(pathname,timeout=12000){const r=await fetch(`http://127.0.0.1:${basePort}${pathname}`,{signal:AbortSignal.timeout(timeout)});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,500)}}return{r,d};}
function slugGuess(baseListings,q){for(const c of baseListings||[]){const y=yallaInfo(c.url);if(y)return{brand:y.brandSlug,model:y.modelSlug,seedYalla:c.url};const m=motoryInfo(c.url);if(m)return{brand:m.brandSlug,model:m.modelSlug,seedMotory:c.url};}
  const ts=queryTerms(q),brand=ts.find(t=>BRAND.has(t));if(brand){const i=ts.indexOf(brand),model=ts.slice(i+1).filter(t=>!/^\d{4}$/.test(t)).join('-');if(model)return{brand,model};}
  const joined=ts.join(' ');for(const [model,b] of [...MODEL_BRAND.entries()].sort((a,b)=>b[0].length-a[0].length)){if(joined.includes(model))return{brand:b,model:model.replace(/\s+/g,'-')};}return{};
}
async function nativeExpansion(baseListings,body,y){const diagnostics=[],groups=[];const requested=String(body.filters?.source||body.filters?.seller||'').trim();
  if(body.condition!=='new'&&(!requested||norm(requested)==='haraj')){try{const h=await nativeHaraj(body.query,y,{maxLinks:100,concurrency:10});groups.push(h.listings);diagnostics.push({source:'Haraj native',ok:true,links:h.links,returned:h.listings.length});}catch(e){diagnostics.push({source:'Haraj native',ok:false,error:e?.message||String(e)});}}
  const guess=slugGuess(baseListings,body.query);let ySeed=(baseListings||[]).find(c=>yallaInfo(c.url))?.url||guess.seedYalla;let mSeed=(baseListings||[]).find(c=>motoryInfo(c.url))?.url||guess.seedMotory;
  const jobs=[];
  if(y&&body.condition!=='new'&&(!requested||norm(requested).includes('yallamotor'))&&ySeed)jobs.push(nativeYallaFromSeed(ySeed,y).then(x=>({name:'YallaMotor native',x})).catch(e=>({name:'YallaMotor native',error:e})));
  if(y&&body.condition!=='new'&&(!requested||norm(requested)==='motory')&&mSeed)jobs.push(nativeMotoryFromSeed(mSeed,y).then(x=>({name:'Motory native',x})).catch(e=>({name:'Motory native',error:e})));
  if(y&&guess.brand&&guess.model&&(!requested||norm(requested)==='syarah'))jobs.push(nativeSyarah(guess.brand,guess.model,y).then(x=>({name:'Syarah native',x})).catch(e=>({name:'Syarah native',error:e})));
  for(const j of await Promise.all(jobs)){if(j.error){diagnostics.push({source:j.name,ok:false,error:j.error?.message||String(j.error)});continue;}groups.push(j.x.listings);diagnostics.push({source:j.name,ok:true,links:j.x.links||0,pages:j.x.pages||undefined,returned:j.x.listings.length});}
  return{groups,diagnostics,guess};
}

app.post('/api/search',async(req,res)=>{const body={...(req.body||{}),query:String(req.body?.query||'').trim(),condition:req.body?.condition==='new'?'new':'used',filters:req.body?.filters&&typeof req.body.filters==='object'?{...req.body.filters}:{}};if(!body.query)return res.status(400).json({error:'Query is required'});const y=exactYear(body.query);
  try{const base=await postBase(body);const baseListings=base.r.ok&&Array.isArray(base.d.listings)?base.d.listings:[];const native=await nativeExpansion(baseListings,body,y);let listings=dedupe([baseListings,...native.groups]).filter(c=>finalMatch(c,body,y));listings.sort((a,b)=>quality(b)-quality(a));listings=listings.slice(0,1200);if(!base.r.ok&&!listings.length)return res.status(base.r.status||502).json({error:base.d.error||'Saudi market search unavailable',nativeDiagnostics:native.diagnostics});const counts=sourceCounts(listings);return res.json({...base.d,query:body.query,condition:body.condition,exactYear:y||base.d.exactYear||null,exactYearSemantics:Boolean(y),listings,counts,answer:`${listings.length} matching ${body.condition} listings found across ${Object.keys(counts).length} Saudi sources.`,marketCoverage:{...(base.d.marketCoverage||{}),version:'v27-native-overlay',nativeDiagnostics:native.diagnostics,slugGuess:native.guess,finalUnique:listings.length},product:{...(base.d.product||{}),recovery:'v27-native-marketplaces',nativeHaraj:true,nativeCatalogExpansion:true}});}catch(e){return res.status(502).json({error:e?.message||String(e)});}});

app.get('/api/health',async(_req,res)=>{try{const b=await getBase('/api/health');return res.status(b.r.ok?200:503).json({...b.d,ok:b.r.ok&&b.d.ok!==false,edge:'native-market-coverage-v27',nativeAdapters:['Haraj','YallaMotor','Motory','Syarah']});}catch(e){return res.status(503).json({ok:false,edge:'native-market-coverage-v27',error:e?.message||String(e)});}});
app.get('/api/sources',async(_req,res)=>{try{const b=await getBase('/api/sources');const base=Array.isArray(b.d.sources)?b.d.sources:[];const names=new Map(base.map(x=>[x.name||x.source,x]));for(const name of ['Haraj','YallaMotor','Motory','Syarah'])names.set(name,{...(names.get(name)||{}),name,native:true,status:'active'});return res.json({ok:true,total:names.size,sources:[...names.values()]});}catch(e){return res.status(502).json({error:e?.message||String(e)});}});

app.use(async(req,res)=>{try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)){body=JSON.stringify(req.body||{});headers['content-type']='application/json';}const r=await fetch(`http://127.0.0.1:${basePort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(60000)}),buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf);}catch(e){return res.status(502).json({error:e?.message||'Dalelah v26 upstream unavailable'});}});
app.listen(externalPort,()=>console.log(`Dalelah native marketplace overlay v27 on ${externalPort} -> v26 ${basePort}`));
