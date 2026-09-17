import {naturalSearch} from './public/natural-search.js';
import {createIntentEngine,intentSearchBody,applyIntentConstraints,needsAI} from './lib/ai-search-intent.js';
import express from 'express';
import {installSellerRoutes} from './lib/seller-routes.js';
import {VEHICLE_CATALOG,catalogIntent} from './public/catalog.js';
import {discoverListingGallery} from './lib/listing-gallery.js';
import {browseLiveSources} from './lib/browse-sources.js';
import {extractMileage} from './lib/vehicle-mileage.js';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {searchDirectFirst,mergeDirectListings,strictDirectListings} from './lib/direct-search.js';
import {exactYearIntent,enforceExactYear} from './lib/search-intent.js';
import {extractHarajPrice} from './lib/haraj-price.js';
import {enrichHarajListingPrices} from './lib/haraj-price-enrichment.js';
import {extractSyarahCashPrice} from './lib/syarah-price.js';
import {enrichSyarahListingPrices,isSyarahDetailUrl} from './lib/syarah-price-enrichment.js';
import {filterVehicleSaleListings} from './lib/listing-quality.js';
import {canonicalizeVehicleQuery} from './lib/search-relevance.js';
import {InventoryIndex,paginateInventory,deduplicateVehicles} from './lib/inventory-index.js';
import {publicSourceRegistry} from './lib/source-registry.js';
import {installApiGuard,validateFilters} from './lib/api-guard.js';

const externalPort=Number(process.env.PORT||3000);
const legacyBase=String(process.env.DALELAH_LEGACY_BASE_URL||'https://delilah-live-search.onrender.com').replace(/\/$/,'');
const DIRECT_BUDGET_MS=Number(process.env.DALELAH_DIRECT_BUDGET_MS||1800);
const FULL_HEAD_START_MS=Number(process.env.DALELAH_FULL_HEAD_START_MS||900);
const JOB_TTL=10*60_000;
const COALESCE_TTL=5*60_000;
const MAX_ACTIVE_JOBS=100;
const MAX_QUERY_LENGTH=180;

const app=express();
installApiGuard(app);
installSellerRoutes(app);
app.use(express.json({limit:'32kb'}));
const inventoryIndex=new InventoryIndex();
const intentEngine=createIntentEngine();
app.get('/api/search/ai-status',(_req,res)=>{const {stats,...status}=intentEngine.status();res.json(status);});
if(process.env.NODE_ENV==='development')app.get('/api/search/ai-metrics',(_req,res)=>res.json(intentEngine.status()));
app.get('/api/catalog',(_req,res)=>{res.setHeader('Cache-Control','public,max-age=3600');res.json(VEHICLE_CATALOG);});
await inventoryIndex.load();
app.get('/api/sources',(_req,res)=>{const stats=inventoryIndex.stats();res.json({generatedAt:stats.generatedAt,sources:publicSourceRegistry(stats.bySource,stats.diagnostics,stats.generatedAt)});});
app.get('/api/inventory/stats',(_req,res)=>res.json(inventoryIndex.stats()));
app.get('/api/inventory',(req,res)=>{
  if(req.query.condition!=null&&!['new','used'].includes(req.query.condition))return res.status(400).json({error:'invalid-condition'});
  const filters={};for(const k of ['minYear','maxYear','minPrice','maxPrice','maxMileage','city','seller','category','fuelType','trim'])if(req.query[k]!=null)filters[k]=req.query[k];
  const error=validateFilters(filters);if(error)return res.status(400).json({error});
  if(req.query.q!=null&&(typeof req.query.q!=='string'||req.query.q.length>180))return res.status(400).json({error:'invalid-query'});
  const parsed=naturalSearch(req.query.q||'');Object.assign(filters,parsed.filters);const parsedError=validateFilters(filters);if(parsedError)return res.status(400).json({error:parsedError});const query=canonicalizeVehicleQuery(parsed.query).query;
  // Conversational queries must go through POST /api/search; never flash unvalidated warm results.
  if(needsAI(req.query.q))return res.json({...paginateInventory([],req.query),intentPending:true,complete:false});
  const started=performance.now();
  const rows=inventoryIndex.search({query,condition:parsed.condition||(req.query.condition==='new'?'new':'used'),filters});
  res.setHeader('Server-Timing',`inventory;dur=${(performance.now()-started).toFixed(2)}`);
  res.setHeader('Cache-Control','public, max-age=30, stale-while-revalidate=60');
  return res.json({...paginateInventory(rows,req.query),understanding:catalogIntent(query),snapshotAt:inventoryIndex.generatedAt,complete:true});
});
const here=dirname(fileURLToPath(import.meta.url));
const publicDir=join(here,'public');
const indexTemplate=await readFile(join(publicDir,'index.html'),'utf8');
const landingPages=new Map([
  ['/cars/used/toyota/corolla/2013',{condition:'used',query:'Toyota Corolla 2013',title:'Used Toyota Corolla 2013 for sale in Saudi Arabia | Dalelah',description:'Compare live used Toyota Corolla 2013 listings from Saudi marketplaces and dealers in one search.',heading:'Used Toyota Corolla 2013'}],
  ['/cars/used/toyota/camry',{condition:'used',query:'Toyota Camry',title:'Used Toyota Camry for sale in Saudi Arabia | Dalelah',description:'Search live used Toyota Camry listings across Saudi marketplaces and dealers with direct seller links.',heading:'Used Toyota Camry'}],
  ['/cars/used/nissan/patrol',{condition:'used',query:'Nissan Patrol',title:'Used Nissan Patrol for sale in Saudi Arabia | Dalelah',description:'Compare live used Nissan Patrol listings across the Saudi car market in one place.',heading:'Used Nissan Patrol'}],
  ['/cars/used/jeep/wrangler',{condition:'used',query:'Jeep Wrangler',title:'Used Jeep Wrangler for sale in Saudi Arabia | Dalelah',description:'Search current used Jeep Wrangler listings from Saudi marketplaces and dealers.',heading:'Used Jeep Wrangler'}],
  ['/cars/used/chevrolet/tahoe',{condition:'used',query:'Chevrolet Tahoe',title:'Used Chevrolet Tahoe for sale in Saudi Arabia | Dalelah',description:'Compare live used Chevrolet Tahoe listings and open the original Saudi seller source.',heading:'Used Chevrolet Tahoe'}],
  ['/cars/new/toyota/corolla',{condition:'new',query:'Toyota Corolla',title:'New Toyota Corolla for sale in Saudi Arabia | Dalelah',description:'Search new Toyota Corolla listings from Saudi dealers and marketplaces in one place.',heading:'New Toyota Corolla'}],
  ['/cars/new/hyundai/elantra',{condition:'new',query:'Hyundai Elantra',title:'New Hyundai Elantra for sale in Saudi Arabia | Dalelah',description:'Compare new Hyundai Elantra listings from Saudi dealers and marketplaces.',heading:'New Hyundai Elantra'}],
  ['/cars/new/kia/sportage',{condition:'new',query:'Kia Sportage',title:'New Kia Sportage for sale in Saudi Arabia | Dalelah',description:'Search live new Kia Sportage listings across the Saudi car market.',heading:'New Kia Sportage'}]
]);
const htmlEscape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function renderLanding(pathname,page){
  const canonical=`https://www.dalelah.co${pathname}`;
  return indexTemplate
    .replace(/<title>[^<]*<\/title>/,`<title>${htmlEscape(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${htmlEscape(page.description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${canonical}">`)
    .replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${htmlEscape(page.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${htmlEscape(page.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${canonical}">`)
    .replace('<!--SEO_H1--><h1>Find your<br><span>next car.</span></h1>',`<!--SEO_H1--><h1>${htmlEscape(page.heading)}<br><span>Across Saudi Arabia.</span></h1>`)
    .replace('<!--LANDING_DATA-->',`<script>window.__DALELAH_LANDING__=${JSON.stringify(page)};<\/script>`);
}
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'dalelah-front',version:'1.5',renderGitCommit:process.env.RENDER_GIT_COMMIT||null,inventoryLoaded:inventoryIndex.records.length>0}));
app.get(/^\/cars\/(?:used|new)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?(?:\/\d{4})?\/?$/, (req,res,next)=>{
  const pathname=req.path.replace(/\/$/,'');
  const page=landingPages.get(pathname);
  if(!page)return next();
  res.setHeader('Cache-Control','public, max-age=300');
  return res.type('html').send(renderLanding(pathname,page));
});
app.use(express.static(publicDir,{extensions:['html'],maxAge:'1h',setHeaders(res,path){
  if(/\.(?:html|js|css)$/.test(path))res.setHeader('Cache-Control','no-cache');
}}));
const jobs=new Map();
app.get('/api/listing/gallery',async(req,res)=>{
 const url=String(req.query.url||'');if(url.length>1800)return res.status(400).json({error:'invalid-url'});
 const known=inventoryIndex.records.some(c=>c.url===url)||[...jobs.values()].some(j=>[...(j.directData?.listings||[]),...(j.fullData?.listings||[])].some(c=>c.url===url));
 if(!known)return res.status(404).json({error:'listing-not-in-current-inventory'});
 try{return res.json({url,images:await discoverListingGallery(url),provenance:'original-listing-public-metadata'});}catch{return res.status(502).json({error:'gallery-unavailable',images:[]});}
});
const inFlight=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=value=>String(value??'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const keyFor=body=>JSON.stringify({q:norm(body?.query||''),c:body?.condition==='new'?'new':'used',f:body?.filters||{},page:body.page,pageSize:body.pageSize,sort:body.sort,intent:body._intentKey});

function validateSearchBody(body={}){
  if(!body||typeof body!=='object'||Array.isArray(body))return 'invalid-search-body';
  if(typeof body.query!=='string')return 'query-must-be-text';
  if(body.query.length>MAX_QUERY_LENGTH)return 'query-too-long';
  if(body.filters!=null&&(typeof body.filters!=='object'||Array.isArray(body.filters)))return 'filters-must-be-an-object';
  if(body.condition!=null&&!['used','new'].includes(body.condition))return 'invalid-condition';
  return validateFilters(body.filters||{});
}

function pruneJobs(now=Date.now(),force=false){
  for(const[id,job]of jobs){
    if(now-job.createdAt>JOB_TTL){
      jobs.delete(id);
      if(inFlight.get(job.key)===job)inFlight.delete(job.key);
    }
  }
  if(force&&jobs.size>=MAX_ACTIVE_JOBS){
    const oldest=jobs.entries().next().value;
    if(oldest){const[id,job]=oldest;jobs.delete(id);if(inFlight.get(job.key)===job)inFlight.delete(job.key);}
  }
}

function counts(listings=[]){return listings.reduce((out,car)=>{const key=car?.source||car?.seller||'Other';out[key]=(out[key]||0)+1;return out;},{});}
function enforceVehicleBoundary(data={}){
  const listings=filterVehicleSaleListings(data?.listings);
  return {...data,listings,counts:counts(listings),vehicleSaleBoundary:true,qualityRejectedAtEdge:Math.max(0,(Array.isArray(data?.listings)?data.listings.length:0)-listings.length)};
}
function exactFor(body={}){const f=body.filters||{};if(Number(f.minYear)&&Number(f.maxYear)&&Number(f.minYear)===Number(f.maxYear))return Number(f.minYear);return exactYearIntent(String(body.query||''));}
function enrichSourcePrices(listings=[]){
  return (Array.isArray(listings)?listings:[]).map(car=>{
    const source=norm(car?.source||car?.seller||'');
    if(car.discovery!=='public_inventory_index'&&['haraj','opensooq'].includes(source))car={...car,mileage:extractMileage(`${car.title||''} ${car.snippet||''}`)};
    if(source===norm('Haraj')){
      const hit=extractHarajPrice(`${car?.title||''} ${car?.snippet||''}`,{year:car?.year});
      if(hit)return{...car,price:hit.price,priceVerified:true,priceSource:hit.source,priceEvidence:hit.evidence,harajPriceMatrix:true};
      if(car?.priceVerified===true)return car;
      return{...car,price:null,priceVerified:false,priceSource:null,priceEvidence:null,harajPriceMatrix:true};
    }
    if(source===norm('Syarah')){
      const hit=extractSyarahCashPrice(`${car?.title||''} ${car?.snippet||''}`);
      if(hit)return{...car,price:hit.price,priceVerified:true,priceSource:hit.source,priceEvidence:hit.evidence,syarahPriceMatrix:true};
      if(car?.priceVerified===true)return car;
      return{...car,price:null,priceVerified:false,priceSource:null,priceEvidence:null,syarahPriceMatrix:true};
    }
    return car;
  });
}
function strictMerged(listings=[],body={}){let xs=enrichSourcePrices(listings);const year=exactFor(body);if(year)xs=enforceExactYear(xs,year,{requireEvidence:true});return strictDirectListings(xs,body);}

async function legacy(path,opts={}){
  const response=await fetch(`${legacyBase}${path}`,{...opts,signal:opts.signal||AbortSignal.timeout(55_000)});
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={error:text.slice(0,1000)}}
  return{response,data,text};
}

function kickPriceEnrichment(job){
  if(job.priceEnrichmentPromise||!Array.isArray(job.directData?.listings)||!job.directData.listings.length)return job.priceEnrichmentPromise;
  job.priceEnrichmentComplete=false;
  job.priceEnrichmentPromise=enrichHarajListingPrices(job.directData.listings,{max:12,concurrency:3,timeout:2600})
    .then(result=>{
      job.directData={...job.directData,listings:result.listings};
      job.priceEnriched=result.enriched||0;
      job.priceAttempted=result.attempted||0;
      job.priceEnrichmentComplete=true;
      return result;
    })
    .catch(error=>{
      job.priceEnrichmentError=error?.message||String(error);
      job.priceEnrichmentComplete=true;
      return null;
    });
  return job.priceEnrichmentPromise;
}

function kickSyarahPriceEnrichment(job){
  if(job.syarahPriceEnrichmentPromise||!Array.isArray(job.fullData?.listings))return job.syarahPriceEnrichmentPromise;
  const candidates=job.fullData.listings.filter(car=>car?.source==='Syarah'&&car?.priceVerified!==true&&isSyarahDetailUrl(car?.url)&&!job.syarahPriceSeen.has(String(car.url))).slice(0,16);
  if(!candidates.length){job.syarahPriceEnrichmentComplete=true;return null;}
  for(const car of candidates)job.syarahPriceSeen.add(String(car.url));
  job.syarahPriceEnrichmentComplete=false;
  job.syarahPriceEnrichmentPromise=enrichSyarahListingPrices(candidates,{max:candidates.length,concurrency:4,timeout:3000})
    .then(result=>{
      const enrichedByUrl=new Map((result.listings||[]).filter(car=>car?.priceVerified===true).map(car=>[String(car.url),car]));
      const current=Array.isArray(job.fullData?.listings)?job.fullData.listings:[];
      job.fullData={...job.fullData,listings:current.map(car=>{
        const hit=enrichedByUrl.get(String(car?.url||''));
        return hit?{...car,price:hit.price,priceVerified:true,priceSource:hit.priceSource,priceEvidence:hit.priceEvidence,priceDiscovery:hit.priceDiscovery,syarahPriceMatrix:true}:car;
      })};
      job.syarahPriceEnriched+=(result.enriched||0);
      job.syarahPriceAttempted+=(result.attempted||0);
      job.syarahPriceEnrichmentComplete=true;
      return result;
    })
    .catch(error=>{
      job.syarahPriceEnrichmentError=error?.message||String(error);
      job.syarahPriceEnrichmentComplete=true;
      return null;
    })
    .finally(()=>{job.syarahPriceEnrichmentPromise=null;});
  return job.syarahPriceEnrichmentPromise;
}

function publicJob(job){
  const direct=job.directData||{};
  const full=job.fullData||{};
  let listings=deduplicateVehicles(strictMerged(mergeDirectListings(job.indexedListings,direct.listings,full.listings),job.body));
  listings=applyIntentConstraints(listings,job.intentResult?.intent);
  // If semantic interpretation fails, do not silently discard unknown requirements.
  const interpretationUnavailable=Boolean(job.intentResult?.fallbackReason&&!job.intentResult.safeFallback);
  if(interpretationUnavailable)listings=[];
  const fullComplete=Boolean(job.fullData&&(full.complete===true||full.marketScanComplete===true));
  const pricePending=Boolean(job.priceEnrichmentPromise&&!job.priceEnrichmentComplete);
  const syarahPricePending=Boolean(job.syarahPriceEnrichmentPromise&&!job.syarahPriceEnrichmentComplete);
  const scanTimedOut=!fullComplete&&Date.now()-job.createdAt>90_000;
  const complete=(fullComplete&&!pricePending&&!syarahPricePending)||scanTimedOut||Boolean(job.error&&job.fullDone);
  const base=job.fullData||job.directData||{};
  const out={...base,listings,counts:counts(listings),complete,marketScanComplete:complete,directCoreLane:true,directCoreFirstResultMs:job.firstResultMs??null,directCoreDurationMs:direct.durationMs??null,directCoreSources:direct.sources||[],directCoreErrors:direct.errors||[],deepScanStarted:Boolean(job.fullPromise),deepScanMode:'remote-legacy-fallback',deepZeroRetry:Boolean(job.deepZeroRetry),exactBrandQualityGate:true,queryCorrections:job.queryCorrections,understanding:{...(base.understanding||{}),query:job.originalQuery,normalizedQuery:job.body.query,typoCorrections:job.queryCorrections},harajPriceMatrix:true,harajDetailPriceEnrichment:true,harajPriceEnrichmentPending:pricePending,harajPriceEnrichmentComplete:Boolean(job.priceEnrichmentComplete),harajDetailPricesEnriched:job.priceEnriched||0,harajDetailPricesAttempted:job.priceAttempted||0,harajPriceEnrichmentError:job.priceEnrichmentError||null,syarahPriceMatrix:true,syarahDetailPriceEnrichment:true,syarahPriceEnrichmentPending:syarahPricePending,syarahPriceEnrichmentComplete:Boolean(job.syarahPriceEnrichmentComplete),syarahDetailPricesEnriched:job.syarahPriceEnriched||0,syarahDetailPricesAttempted:job.syarahPriceAttempted||0,syarahPriceEnrichmentError:job.syarahPriceEnrichmentError||null};
  if(!complete)out.searchId=job.id;else delete out.searchId;
  out.partial=Boolean(scanTimedOut||job.error||(direct.errors||[]).length);
  out.scanStatus=out.partial?'partial':complete?'complete':'scanning';
  out.indexedCount=job.indexedListings?.length||0;
  out.snapshotAt=inventoryIndex.generatedAt;
  out.sourceErrors=[...(scanTimedOut?['scan-deadline-reached']:[]),...(direct.errors||[]),...(job.error?['deep-search-unavailable']:[])];
  out.interpretationUnavailable=interpretationUnavailable;
  out.aiRequired=needsAI(job.originalQuery);
  out.parsedIntent=job.intentResult?.parsedIntent||null;
  out.aiProviderAttempted=Boolean(job.intentResult?.providerAttempted);
  if(job.intentResult){const r=job.intentResult;out.intentMode=r.intentMode;out.intent=r.intent;out.ai={model:r.intentMode==='ai'?r.model:null,latencyMs:r.aiLatencyMs,cacheHit:Boolean(r.cacheHit),fallbackReason:r.fallbackReason||null};out.understanding.normalizedIntent=r.intent;out.unverifiedPreferences=r.intent.priorities;out.resultCount=listings.length;
   if(complete&&!job.intentLogged){job.intentLogged=true;console.info(JSON.stringify({event:'search_intent_results',intentMode:r.intentMode,resultCount:listings.length,zeroResults:listings.length===0,sourcesUsed:Object.keys(counts(listings))}));}
   if(process.env.NODE_ENV==='development')out.intentDebug={originalQuery:job.originalQuery,normalizedIntent:r.intent,intentMode:r.intentMode,catalogMatch:catalogIntent(job.body.query),resultCount:listings.length,sourcesUsed:Object.keys(counts(listings))};
  }
  if(job.body.pageSize||job.body.page){const paged=paginateInventory(listings,job.body);out.listings=paged.listings;out.pagination=paged.pagination;}
  if(!out.answer)out.answer=listings.length?`${listings.length} matching listings found.`:'Dalelah is scanning the Saudi market…';
  return out;
}

async function fetchFullSearch(job){
  const request=()=>legacy('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(job.body),signal:AbortSignal.timeout(55_000)});
  const first=await request();
  if(!first.response.ok)return first;
  const firstListings=Array.isArray(first.data?.listings)?first.data.listings:[];
  const firstComplete=first.data?.complete===true||first.data?.marketScanComplete===true;
  const hasDirect=Array.isArray(job.directData?.listings)&&job.directData.listings.length>0;
  if(firstListings.length||!firstComplete||hasDirect)return first;
  job.deepZeroRetry=true;
  await sleep(180);
  const second=await request();
  return second.response.ok?second:first;
}

function kickFull(job){
  if(job.fullPromise)return job.fullPromise;
  if(isBroad(job.body)){job.fullPromise=job.directPromise.then(()=>{job.fullDone=true;job.fullData={complete:true,marketScanComplete:true,volumeBrowse:true};return job.fullData;});return job.fullPromise;}
  job.fullStartedAt=Date.now();
  job.fullPromise=fetchFullSearch(job)
    .then(({response,data})=>{
      job.fullDone=true;
      if(!response.ok){job.error=data?.error||`HTTP ${response.status}`;return null;}
      job.fullData=data;
      job.upstreamId=data?.searchId||job.upstreamId||null;
      if(Array.isArray(data?.listings)&&data.listings.length&&!job.firstResultMs)job.firstResultMs=Date.now()-job.createdAt;
      kickSyarahPriceEnrichment(job);
      return data;
    })
    .catch(error=>{job.fullDone=true;job.error=error?.message||String(error);return null;});
  return job.fullPromise;
}

function startJob(body={},meta={}){
  if(jobs.size>=MAX_ACTIVE_JOBS)pruneJobs(Date.now(),true);
  const key=keyFor(body),existing=inFlight.get(key);
  if(existing&&Date.now()-existing.createdAt<COALESCE_TTL)return existing;
  const job={id:`dc.${randomUUID()}`,key,body,originalQuery:meta.originalQuery||body.query,queryCorrections:meta.corrections||[],createdAt:Date.now(),directData:null,fullData:null,fullPromise:null,fullDone:false,upstreamId:null,error:null,firstResultMs:null,deepZeroRetry:false,priceEnrichmentPromise:null,priceEnrichmentComplete:false,priceEnriched:0,priceAttempted:0,priceEnrichmentError:null,syarahPriceEnrichmentPromise:null,syarahPriceEnrichmentComplete:false,syarahPriceEnriched:0,syarahPriceAttempted:0,syarahPriceEnrichmentError:null,syarahPriceSeen:new Set()};
  jobs.set(job.id,job);inFlight.set(key,job);
  job.intentResult=meta.intentResult;
  job.indexedListings=inventoryIndex.search(body);
  job.directPromise=(isBroad(body)?browseLiveSources(body):searchDirectFirst(body,{timeoutMs:DIRECT_BUDGET_MS}))
    .then(data=>{
      job.directData=data;
      if(data?.listings?.length&&!job.firstResultMs)job.firstResultMs=Date.now()-job.createdAt;
      kickPriceEnrichment(job);
      return data;
    })
    .catch(error=>{job.directData={listings:[],counts:{},sources:[],errors:[error?.message||String(error)],durationMs:Date.now()-job.createdAt};job.priceEnrichmentComplete=true;return job.directData;})
    .finally(()=>{kickFull(job);});
  const timer=setTimeout(()=>kickFull(job),FULL_HEAD_START_MS);timer.unref?.();
  return job;
}

async function advanceFull(job){
  if(!job.fullPromise)kickFull(job);
  if(!job.fullData&&!job.fullDone)await Promise.race([job.fullPromise,sleep(60)]);
  if(!job.fullData)return;
  if(job.fullData.complete===true||job.fullData.marketScanComplete===true){kickSyarahPriceEnrichment(job);return;}
  const upstream=job.upstreamId||job.fullData.searchId;
  if(!upstream)return;
  try{
    const {response,data}=await legacy(`/api/search/progress/${encodeURIComponent(upstream)}`,{signal:AbortSignal.timeout(7_000)});
    if(response.ok){job.fullData={...job.fullData,...data};job.upstreamId=data?.searchId||job.upstreamId||upstream;kickSyarahPriceEnrichment(job);}
  }catch(error){job.progressError=error?.message||String(error);}
}

function isBroad(body={}){const q=String(body.query||'').trim();return !q||q==='__all_cars__';}

app.post('/api/search',async(req,res)=>{
  const incoming=req.body||{};
  const validationError=validateSearchBody(incoming);
  if(validationError)return res.status(400).json({error:validationError});
  const intentResult=await intentEngine.understand(incoming.query);
  const body=intentSearchBody(incoming,intentResult),normalized=canonicalizeVehicleQuery(body.query);
  body.query=normalized.query;body._intentKey=JSON.stringify({mode:intentResult.intentMode,intent:intentResult.intent,fallback:intentResult.fallbackReason});
  const parsedError=validateSearchBody(body);if(parsedError)return res.status(400).json({error:parsedError});
  const started=Date.now(),job=startJob(body,{originalQuery:incoming.query,corrections:normalized.corrections,intentResult});
  if(!job.indexedListings.length)await Promise.race([job.directPromise,sleep(DIRECT_BUDGET_MS)]);
  if(!job.indexedListings.length&&!(job.directData?.listings?.length)&&!job.fullData){const left=Math.max(0,DIRECT_BUDGET_MS-(Date.now()-started));if(left)await Promise.race([job.fullPromise,sleep(left)]);}
  const out=publicJob(job);
  res.setHeader('Server-Timing',`dalelah-direct;dur=${Date.now()-started}`);
  res.setHeader('X-Dalelah-Core',out.listings.length?'direct-first':'scanning');
  return res.json(out);
});

app.get('/api/search/progress/:id',async(req,res)=>{
  const id=String(req.params.id||'');
  if(!id.startsWith('dc.')){
    try{const {response,data}=await legacy(`/api/search/progress/${encodeURIComponent(id)}`);return res.status(response.status).json(enforceVehicleBoundary(data));}catch(error){return res.status(502).json({error:error?.message||'Dalelah progress unavailable'});}
  }
  const job=jobs.get(id);if(!job)return res.status(404).json({error:'Search expired'});
  await advanceFull(job);
  const out=publicJob(job);
  if(job.error&&job.fullDone&&!out.listings.length)return res.status(502).json({...out,error:'A search source is temporarily unavailable. Please retry.'});
  return res.json(out);
});

app.get('/api/health',async(_req,res)=>{
  try{
    const {response,data}=await legacy('/api/health',{signal:AbortSignal.timeout(9000)});
    const frontRenderGitCommit=process.env.RENDER_GIT_COMMIT||process.env.RENDER_COMMIT||null;
    return res.status(response.status).json({...data,legacyRenderGitCommit:data?.renderGitCommit||null,renderGitCommit:frontRenderGitCommit||data?.renderGitCommit||null,frontRenderGitCommit,directCoreLane:true,directCoreStrategy:'direct-first-remote-deep-scan',directCoreBudgetMs:DIRECT_BUDGET_MS,directCoreFullHeadStartMs:FULL_HEAD_START_MS,directCoreJobs:jobs.size,legacyBase,harajPriceMatrix:true,harajDetailPriceEnrichment:true,syarahPriceMatrix:true,syarahDetailPriceEnrichment:true});
  }catch(error){return res.status(200).json({ok:true,degraded:true,legacyAvailable:false,service:'dalelah-front',renderGitCommit:process.env.RENDER_GIT_COMMIT||process.env.RENDER_COMMIT||null,directCoreLane:true,directCoreStrategy:'direct-first-remote-deep-scan',harajPriceMatrix:true,harajDetailPriceEnrichment:true,syarahPriceMatrix:true,syarahDetailPriceEnrichment:true,upstreamError:error?.message||String(error)});}
});

async function proxy(req,res){
  try{
    const headers={};for(const[k,v]of Object.entries(req.headers))if(!['host','content-length','connection'].includes(k.toLowerCase())&&v!=null)headers[k]=Array.isArray(v)?v.join(','):String(v);
    let body;if(!['GET','HEAD'].includes(req.method)&&req.is('application/json')){body=JSON.stringify(req.body||{});headers['content-type']='application/json';}
    const response=await fetch(`${legacyBase}${req.originalUrl}`,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(55_000)});
    const buf=Buffer.from(await response.arrayBuffer());for(const[k,v]of response.headers.entries())if(!['content-length','transfer-encoding','connection'].includes(k.toLowerCase()))res.setHeader(k,v);
    return res.status(response.status).send(buf);
  }catch(error){return res.status(502).json({error:'Dalelah unavailable'});}
}
app.use((req,res,next)=>{
  if(req.path.startsWith('/api/')&&!/^\/api\/(?:sell\/(?:estimate|submit)|marketplace\/status)$/.test(req.path))return res.status(404).json({error:'not-found'});
  return next();
});
app.use(proxy);
app.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status===413?413:400).json({error:error.status===413?'request-too-large':'invalid-request'});});

setInterval(()=>pruneJobs(),60_000).unref?.();
app.listen(externalPort,'0.0.0.0',()=>console.log(`Dalelah direct-core candidate on 0.0.0.0:${externalPort}; deep scan ${legacyBase}`));
