import express from 'express';
import {detectRequestedBrand,listingMatchesBrand} from './lib/search-relevance.js';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_VOLUME_QUALITY_INNER_PORT||7100);
process.env.PORT=String(innerPort);
await import('./server-v15-volume.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));
const BAD_TITLE=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|طبلون|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|باب\s*(?:يمين|يسار|امامي|خلفي)|جنط|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|كشافات|مراي[هة]|مرآة|تشليح|للتشليح|للايجار|للإيجار|تاجير|تأجير|سطح[هة]|نقل\s*سيارات|فحص\s*سيارات|ورشة|صيانة)/i;
const OBVIOUS_NEW=/(?:\bbrand\s*new\b|\bzero\s*km\b|جديد(?:ه|ة)?\s*(?:وكالة|بالوكالة)?|زيرو|غير\s*مستخدم)/i;
const MODEL_GROUPS={
  corolla:['corolla','كورولا','كرولا','كورلا','كوريلا'],camry:['camry','كامري'],patrol:['patrol','باترول'],wrangler:['wrangler','رانجلر'],
  'land cruiser':['land cruiser','لاند كروزر','لاندكروزر'],prado:['prado','برادو'],yaris:['yaris','يارس'],fortuner:['fortuner','فورتشنر'],sunny:['sunny','صني'],
  tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],accent:['accent','اكسنت','أكسنت'],sportage:['sportage','سبورتاج'],
  sorento:['sorento','سورينتو'],cerato:['cerato','سيراتو'],tahoe:['tahoe','تاهو'],x5:['bmw x5','x5'],rx:['lexus rx','rx'],es:['lexus es','es'],
  coolray:['coolray','كولراي'],cs75:['cs75','سي اس 75'],h6:['h6','هافال h6'],mg5:['mg5','mg 5','ام جي 5'],yukon:['yukon','يوكن'],cx5:['cx5','cx-5','مازدا cx5']
};
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
function detectModel(query=''){const q=norm(query);for(const[k,a]of Object.entries(MODEL_GROUPS))if(a.some(x=>q.includes(norm(x))))return k;return null}
function queryFromId(id=''){if(!String(id).startsWith('d15.'))return'';try{const p=JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'));return String(p?.q||'')}catch{return''}}
function hasModelTitle(title='',model=null){if(!model)return true;const t=norm(title);return MODEL_GROUPS[model].some(x=>t.includes(norm(x)))}
function canonical(v=''){try{const u=new URL(v);u.hash='';for(const k of[...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'')}catch{return String(v||'')}}
function cleanListings(xs=[],query=''){
  const out=[],seen=new Set();
  let rejected=0,modelRejected=0,brandRejected=0;
  const model=detectModel(query),brand=detectRequestedBrand(query);
  for(const x of xs||[]){
    const title=String(x?.title||''),url=canonical(x?.url||'');
    const badModel=model&&!hasModelTitle(title,model);
    const badBrand=brand&&!listingMatchesBrand(x,brand);
    if(!url||seen.has(url)||BAD_TITLE.test(title)||(x?.condition==='used'&&OBVIOUS_NEW.test(title))||badModel||badBrand){
      rejected++;
      if(badModel)modelRejected++;
      if(badBrand)brandRejected++;
      continue;
    }
    seen.add(url);
    out.push({...x,url});
  }
  return{listings:out,rejected,modelRejected,brandRejected,model,brand};
}
function counts(xs=[]){return xs.reduce((o,x)=>(o[x.source||x.seller||'Other']=(o[x.source||x.seller||'Other']||0)+1,o),{})}
function cleanPayload(d={},query=''){
  if(!Array.isArray(d.listings))return d;
  const c=cleanListings(d.listings,query);
  return{...d,listings:c.listings,counts:counts(c.listings),volumeQualityGate:true,exactModelQualityGate:true,exactBrandQualityGate:true,volumeQualityRejected:(Number(d.volumeQualityRejected)||0)+c.rejected,exactModelRejected:(Number(d.exactModelRejected)||0)+c.modelRejected,exactBrandRejected:(Number(d.exactBrandRejected)||0)+c.brandRejected,detectedModel:c.model||null,detectedBrand:c.brand||null,volumeBrowseListings:d.volumeBrowse?c.listings.length:d.volumeBrowseListings};
}
async function inner(path,opts={}){const r=await fetch(`http://127.0.0.1:${innerPort}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(55000)});const text=await r.text();let d;try{d=JSON.parse(text)}catch{d={error:text.slice(0,500)}};return{r,d,text}}

app.get('/api/health',async(req,res)=>{try{const{r,d}=await inner('/api/health',{signal:AbortSignal.timeout(9000)});return res.status(r.status).json({...d,edge:'dalelah-v15-volume',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||d.renderGitCommit||null,volumeQualityGate:true,exactModelQualityGate:true,exactBrandQualityGate:true})}catch(e){return res.status(503).json({ok:false,edge:'dalelah-v15-volume',productVersion:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,volumeQualityGate:true,exactModelQualityGate:true,exactBrandQualityGate:true,error:e?.message||'health unavailable'})}});
app.post('/api/search',async(req,res)=>{try{const body=req.body||{},query=String(body.query||''),{r,d}=await inner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});return res.status(r.status).json(cleanPayload(d,query))}catch(e){return res.status(502).json({error:e?.message||'Dalelah volume search unavailable'})}});
app.get('/api/search/progress/:id',async(req,res)=>{try{const id=String(req.params.id||''),query=queryFromId(id),{r,d}=await inner(`/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(50000)});return res.status(r.status).json(cleanPayload(d,query))}catch(e){return res.status(502).json({error:e?.message||'Dalelah volume progress unavailable'})}});
async function proxy(req,res){try{const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json'}const r=await fetch(`http://127.0.0.1:${innerPort}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(55000)});const buf=Buffer.from(await r.arrayBuffer());for(const[k,v]of r.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);return res.status(r.status).send(buf)}catch(e){return res.status(502).json({error:e?.message||'Dalelah unavailable'})}}
app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah 1.5 volume quality edge listening on ${externalPort}; volume core ${innerPort}`));
