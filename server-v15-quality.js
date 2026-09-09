import express from 'express';

const externalPort=Number(process.env.PORT||3000);
const innerPort=Number(process.env.DALELAH_QUALITY_INNER_PORT||6500);
process.env.PORT=String(innerPort);
await import('./server-v15-haraj.js');
process.env.PORT=String(externalPort);

const app=express();
app.use(express.json({limit:'1mb'}));

const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const PARTS_RE=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|قشرة\s*تابلون|طبلون|تحكم\s*مكيف|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|باب\s*(?:يمين|يسار|امامي|أمامي|خلفي)|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|كشافات|مراي[هة]|مرآة|ديكور|زجاج|مساعدات)/i;
const NON_SALE_RE=/(?:للايجار|للإيجار|تاجير|تأجير|مطلوب|شراء\s*سيارة|سطح[هة]|نقل\s*سيارات|فحص\s*سيارات|ورشة|صيانة|تصليح|برمجة|تلميع)/i;
const CONVERSION_RE=/(?:محول|تحويل|تشليح|للتشليح)/i;

const MODEL_GROUPS={
  corolla:['corolla','كورولا','كرولا','كورلا','كوريلا'],camry:['camry','كامري'],patrol:['patrol','باترول'],wrangler:['wrangler','رانجلر'],
  'land cruiser':['land cruiser','لاند كروزر','لاندكروزر'],prado:['prado','برادو'],yaris:['yaris','يارس'],fortuner:['fortuner','فورتشنر'],
  sunny:['sunny','صني'],tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],accent:['accent','اكسنت','أكسنت'],
  sportage:['sportage','سبورتاج'],sorento:['sorento','سورينتو'],cerato:['cerato','سيراتو'],tahoe:['tahoe','تاهو']
};
const BRAND_GROUPS={
  toyota:['toyota','تويوتا'],nissan:['nissan','نيسان'],jeep:['jeep','جيب'],hyundai:['hyundai','هيونداي'],kia:['kia','كيا'],ford:['ford','فورد'],
  chevrolet:['chevrolet','شفروليه'],lexus:['lexus','لكزس'],mercedes:['mercedes','مرسيدس'],bmw:['bmw','بي ام دبليو'],mazda:['mazda','مازدا'],honda:['honda','هوندا']
};
const MODEL_BRAND={corolla:'toyota',camry:'toyota','land cruiser':'toyota',prado:'toyota',yaris:'toyota',fortuner:'toyota',patrol:'nissan',sunny:'nissan',wrangler:'jeep',tucson:'hyundai',elantra:'hyundai',sonata:'hyundai',accent:'hyundai',sportage:'kia',sorento:'kia',cerato:'kia',tahoe:'chevrolet'};
function detect(query=''){
  const q=norm(query);let model=null,brand=null;
  for(const[k,a]of Object.entries(MODEL_GROUPS))if(a.some(x=>q.includes(norm(x)))){model=k;break}
  for(const[k,a]of Object.entries(BRAND_GROUPS))if(a.some(x=>q.includes(norm(x)))){brand=k;break}
  if(!brand&&model)brand=MODEL_BRAND[model]||null;
  const ys=[...digits(query).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));
  const exact=ys.length===1&&!/\+|وفوق|واكثر|أكثر|\b(?:from|since|after|newer|above|over)\b|(?:20\d{2})\s*(?:-|to|الى|إلى)\s*20\d{2}/i.test(digits(query))?ys[0]:null;
  return{model,brand,exact};
}
function queryFromSearchId(id=''){
  if(!String(id).startsWith('d15.'))return'';
  try{return JSON.parse(Buffer.from(String(id).slice(4),'base64url').toString('utf8'))?.q||''}catch{return''}
}
function hasAny(text,arr=[]){const t=norm(text);return arr.some(x=>t.includes(norm(x)))}
function acceptable(car,query){
  const title=String(car?.title||'');if(!title)return false;
  if(PARTS_RE.test(title)||NON_SALE_RE.test(title)||CONVERSION_RE.test(title))return false;
  const d=detect(query);
  if(d.model&&!hasAny(title,MODEL_GROUPS[d.model]))return false;
  if(d.brand&&!d.model&&!hasAny(title,BRAND_GROUPS[d.brand]))return false;
  if(d.exact&&Number(car?.year)!==d.exact)return false;
  return true;
}
function quality(data,query=''){
  if(!data||typeof data!=='object')return data;
  const before=Array.isArray(data.listings)?data.listings:[];
  const listings=before.filter(x=>acceptable(x,query));
  const rejected=before.length-listings.length;
  const counts={};for(const c of listings){const k=c.source||c.seller||'Other';counts[k]=(counts[k]||0)+1}
  return{...data,listings,counts,qualityGate:true,qualityRejected:(data.qualityRejected||0)+rejected};
}
async function inner(path,options={}){
  const r=await fetch(`http://127.0.0.1:${innerPort}${path}`,{...options,signal:AbortSignal.timeout(40_000)});
  const ct=r.headers.get('content-type')||'';const body=await r.arrayBuffer();
  return{status:r.status,headers:{'content-type':ct},body:Buffer.from(body)};
}
async function jsonInner(path,options={}){
  const r=await inner(path,options);let d={};try{d=JSON.parse(r.body.toString('utf8'))}catch{d={error:r.body.toString('utf8').slice(0,300)}}return{...r,data:d};
}
app.get('/api/health',async(req,res)=>{try{const r=await jsonInner('/api/health');res.status(r.status).json({...r.data,edge:'dalelah-v15-quality',qualityGate:true,productVersion:'1.5'})}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.post('/api/search',async(req,res)=>{try{const r=await jsonInner('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(req.body||{})});res.status(r.status).json(quality(r.data,String(req.body?.query||'')))}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.get('/api/search/progress/:id',async(req,res)=>{try{const id=String(req.params.id||'');const r=await jsonInner(`/api/search/progress/${encodeURIComponent(id)}`);res.status(r.status).json(quality(r.data,queryFromSearchId(id)))}catch(e){res.status(502).json({error:e?.message||String(e)})}});
app.use(async(req,res)=>{try{const r=await inner(req.originalUrl,{method:req.method,headers:{accept:req.headers.accept||'*/*'}});res.status(r.status);if(r.headers['content-type'])res.set('content-type',r.headers['content-type']);res.send(r.body)}catch(e){res.status(502).send(e?.message||String(e))}});
app.listen(externalPort,()=>console.log(`Dalelah 1.5 quality edge on ${externalPort}, Haraj edge ${innerPort}`));
