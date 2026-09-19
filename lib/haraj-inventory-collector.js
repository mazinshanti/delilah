import {VEHICLE_CATALOG} from '../public/catalog.js';
import {parseHarajFastPage} from './haraj-fast-source.js';
import {harajListingEvidence} from './haraj-listing-evidence.js';
import {extractListingGallery} from './listing-gallery.js';
import {classifyVehicle} from './vehicle-classification.js';
import {isVehicleSaleListing} from './listing-quality.js';
import {normalizeInventoryListing} from './inventory-normalizer.js';
import {robotsPolicy} from './robots-policy.js';

const ORIGIN='https://haraj.com.sa';
const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
// Round-robin by model position: a large manufacturer's catalog cannot starve
// smaller manufacturers. Computed once, never on the customer search path.
export function harajDiscoveryQueries(catalog=VEHICLE_CATALOG){
 const queries=catalog.makes.map(make=>make.ar||make.name);
 const count=Math.max(0,...catalog.makes.map(make=>make.models.length));
 for(let i=0;i<count;i++)for(const make of catalog.makes){
  const model=make.models[i];if(!model)continue;
  const alias=model.aliases?.find(x=>/[\u0600-\u06ff]/.test(x))||model.name;
  queries.push(`${make.ar||make.name} ${alias}`);
 }
 return [...new Set(queries)];
}
const QUERIES=harajDiscoveryQueries();
const limit=(n,fallback,max)=>Math.max(1,Math.min(max,Math.floor(Number(n)||fallback)));
const adKey=url=>{try{const u=new URL(url);return u.origin===ORIGIN&&/^\/\d{8,}(?:\/|$)/.test(u.pathname)?u.pathname.split('/')[1]:null;}catch{return null;}};

export function harajDetailRecord(candidate,html,now=new Date().toISOString(),onReject=()=>{}){
 const reject=reason=>{onReject(reason);return null;};
 const evidence=harajListingEvidence(html,candidate.url);
 if(!evidence?.title)return reject('missing_exact_ad_metadata');
 if(/تم\s*(?:البيع|بيعها)|\bsold\b|no longer available/i.test(`${evidence.title} ${evidence.description}`))return reject('sold');
 // The exact ad's metadata wins. Do not carry search-card price, mileage or
 // requested-tab condition forward as evidence for a sparse detail response.
 const images=extractListingGallery(html,candidate.url);
 const p=evidence.priceHit;
 const titleDigits=evidence.title.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
 const year=Number(titleDigits.match(/\b((?:19|20)\d{2})\b/)?.[1]);
 const raw={source:'Haraj',sourceType:'marketplace',seller:'Haraj',url:candidate.url,
  title:evidence.title,description:evidence.description,year:year||null,
  sourceCondition:evidence.sourceCondition,condition:evidence.condition,
  mileage:evidence.mileage,price:p?.price??null,priceVerified:Boolean(p),
  price_type:evidence.priceType,priceSource:p?.source||null,priceEvidence:p?.evidence||null,
  city:candidate.city||null,images,image:images[0]||null,galleryVerified:images.length>0,
  imageVerified:images.length>0,saleVerified:false,listingVerified:true,
  discovery:'haraj_public_detail_index',lastSeenAt:now,lastDetailAt:now};
 if(!year)return reject('missing_title_year');
 if(year<1980||year>new Date().getFullYear()+1)return reject('outside_existing_index_year_range');
 if(!['new','used'].includes(raw.condition))return reject('unknown_condition');
 if(!isVehicleSaleListing(raw))return reject('vehicle_boundary');
 const record=normalizeInventoryListing(raw);
 if(!record.make||!record.model)return reject('unresolved_identity');
 record.missingFields=['trim','price','mileage','city','image'].filter(k=>record[k]==null||record[k]==='');
 record.dataComplete=record.missingFields.length===0;
 return record;
}

export async function fetchHarajInventoryHtml(url,{timeout=30000,rules='',fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let current=url,r;const signal=AbortSignal.timeout(timeout);
 for(let hop=0;hop<3;hop++){
  r=await fetchImpl(current,{redirect:'manual',signal,headers:{'User-Agent':UA,'Accept':'text/html'}});
  if(r.status<300||r.status>=400)break;
  const location=r.headers.get('location');await r.body?.cancel();
  if(!location)throw Error('missing-source-redirect');
  const next=new URL(location,current),original=new URL(url);
  const sameResource=adKey(url)?adKey(next.href)===adKey(url):next.pathname===original.pathname;
  if(next.origin!==ORIGIN||next.username||next.password||!sameResource)throw Error('unsafe-source-redirect');
  const policy=robotsPolicy(rules,next.href);if(!policy.allowed)throw Error('robots-disallowed');
  if(policy.delayMs>30000)throw Error('source-delay-exceeds-collection-budget');
  await sleep(policy.delayMs);current=next.href;
 }
 if(!r.ok){await r.body?.cancel();throw Error(`HTTP ${r.status}`);}
 const reader=r.body.getReader(),chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5_000_000){await reader.cancel();throw Error('source-too-large');}chunks.push(Buffer.from(value));}
 return Buffer.concat(chunks).toString('utf8');
}

export async function collectHarajInventory(options={}){
 const get=options.get||fetchHarajInventoryHtml,sleep=options.sleep||(ms=>new Promise(r=>setTimeout(r,ms)));
 const queries=options.queries||QUERIES,maxQueries=limit(options.maxQueries,120,1000),maxDetails=limit(options.maxDetails,600,3000);
 const started=Date.now(),now=new Date().toISOString(),listings=[],seen=new Set(),errors=[];
 const deadline=started+limit(options.maxDurationMs,12*60_000,60*60_000);
 const start=((Math.floor(Number(options.cursor)||0)%queries.length)+queries.length)%queries.length||0;
 const diag={source:'Haraj',pages:0,successfulPages:0,discovered:0,detailAttempts:0,detailSuccess:0,records:0,rejected:0,rejectedReasons:{},duplicateCards:0,errors,queryPool:queries.length,cursor:start,nextCursor:start,coverageComplete:false};
 let rules;
 try{rules=await get(`${ORIGIN}/robots.txt`);}catch(e){errors.push({error:`robots-unavailable: ${e.message}`});return {listings,diagnostics:diag};}
 async function read(url){
  const policy=robotsPolicy(rules,url);if(!policy.allowed)throw Error('robots-disallowed');
  if(policy.delayMs>30000)throw Error('source-delay-exceeds-collection-budget');
  await sleep(policy.delayMs);return get(url,{rules,sleep});
 }
 let stop=false;
 for(let i=0;i<Math.min(maxQueries,queries.length)&&!stop&&Date.now()<deadline;i++){
  const index=(start+i)%queries.length,query=queries[index],url=`${ORIGIN}/search/${encodeURIComponent(query)}/`;
  diag.pages++;
  try{
   const html=await read(url);diag.successfulPages++;
   // Identity is established from each ad, never from the discovery query.
   const candidates=parseHarajFastPage(html,url,{limit:120});
   for(const candidate of candidates){
    const key=adKey(candidate.url);if(!key)continue;
    if(seen.has(key)){diag.duplicateCards++;continue;}seen.add(key);diag.discovered++;
    const verdict=classifyVehicle(candidate);
    if(verdict.classification!=='VEHICLE_FOR_SALE'&&!(verdict.classification==='UNKNOWN'&&verdict.reason==='insufficient_vehicle_evidence'&&verdict.identity.model)){diag.rejected++;continue;}
    if(diag.detailAttempts>=maxDetails||Date.now()>=deadline){stop=true;break;}
    diag.detailAttempts++;
    try{
     const detail=await read(candidate.url);diag.detailSuccess++;
     const record=harajDetailRecord(candidate,detail,now,reason=>{diag.rejectedReasons[reason]=(diag.rejectedReasons[reason]||0)+1;});
     if(record)listings.push(record);else diag.rejected++;
    }catch(e){errors.push({stage:'detail',query,error:e.message});if(/HTTP (401|403|429)|robots-disallowed|unsafe-source-redirect/.test(e.message)){stop=true;break;}}
   }
  }catch(e){errors.push({stage:'discovery',query,error:e.message});if(/HTTP (401|403|429)|robots-disallowed|unsafe-source-redirect/.test(e.message))stop=true;}
  diag.nextCursor=(index+1)%queries.length;
  options.onProgress?.({...diag,records:listings.length});
 }
 diag.records=listings.length;diag.completedAt=new Date().toISOString();diag.durationMs=Date.now()-started;
 diag.budgetExhausted=diag.detailAttempts>=maxDetails||Date.now()>=deadline;
 diag.acceptanceRate=diag.discovered?listings.length/diag.discovered:null;
 return {listings,diagnostics:diag};
}
