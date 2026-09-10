import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {buildMarketValuation} from './lib/market-valuation.js';
import {createSellerSubmission,sellerStoreStatus,validateSellerSubmission} from './lib/saudi-seller-store.js';
import {detectRequestedBrand,filterBrandRelevance} from './lib/search-relevance.js';

const externalPort = Number(process.env.PORT || 3000);
const innerPort = Number(process.env.DALELAH_MARKETPLACE_INNER_PORT || 7400);
process.env.PORT = String(innerPort);
await import('./server-v15-opensooq.js');
process.env.PORT = String(externalPort);

const app = express();
const MOBILE_PREVIEW_ORIGINS = new Set([
  'https://dalelah-mobile-preview.onrender.com',
  'http://localhost:8081',
  'http://localhost:19006'
]);
app.use((req,res,next) => {
  const origin = req.headers.origin;
  if (origin && MOBILE_PREVIEW_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({limit:'256kb'}));
const root = dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const SEARCH_QUERY_TTL = 20 * 60_000;
const searchQueryById = new Map();

async function inner(path, opts={}) {
  const response = await fetch(`http://127.0.0.1:${innerPort}${path}`, {
    ...opts,
    signal: opts.signal || AbortSignal.timeout(55_000)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {error:text.slice(0,1000)}; }
  return {response,data,text};
}

function counts(listings=[]) {
  return (Array.isArray(listings)?listings:[]).reduce((out,car)=>{
    const key=car?.source||car?.seller||'Other';
    out[key]=(out[key]||0)+1;
    return out;
  },{});
}

function decodeSearchQuery(id='') {
  const known=searchQueryById.get(String(id));
  if(known && Date.now()-known.at<SEARCH_QUERY_TTL) return known.query;
  try {
    const raw=String(id);
    if(raw.startsWith('d15.')) {
      const p=JSON.parse(Buffer.from(raw.slice(4),'base64url').toString('utf8'));
      return String(p?.q||'');
    }
    if(raw.startsWith('vol.')) {
      const p=JSON.parse(Buffer.from(raw.slice(4),'base64url').toString('utf8'));
      return String(p?.q||'');
    }
  } catch {}
  return '';
}

function rememberSearchQuery(id,query) {
  if(!id) return;
  searchQueryById.set(String(id),{query:String(query||''),at:Date.now()});
}

function applyMarketplaceBrandBoundary(data={},query='') {
  if(!Array.isArray(data.listings)) return data;
  const before=data.listings.length;
  const listings=filterBrandRelevance(data.listings,String(query||''));
  const detectedBrand=detectRequestedBrand(String(query||''));
  return {
    ...data,
    listings,
    counts:counts(listings),
    marketplaceBrandBoundaryGate:true,
    marketplaceBrandRejected:(Number(data.marketplaceBrandRejected)||0)+(before-listings.length),
    detectedBrand:data.detectedBrand||detectedBrand||null
  };
}

function patchWebUi(html='') {
  let out=String(html);
  out=out.replace(
    '<option>Haraj</option><option>Saleh Cars</option><option>YallaMotor</option>',
    '<option>Haraj</option><option>OpenSooq</option><option>Syarah</option><option>Saleh Cars</option>'
  );
  out=out.replace(
    '<div class="live"><span class="dot"></span>Saudi market live</div>',
    '<div style="margin-left:auto;display:flex;align-items:center;gap:8px"><a href="/mobile" style="color:#d8ff5a;text-decoration:none;border:1px solid #30353c;border-radius:999px;padding:9px 11px;font-size:11px;font-weight:900">Mobile</a><a href="/sell" style="color:#f7f6f1;text-decoration:none;border:1px solid #30353c;border-radius:999px;padding:9px 11px;font-size:11px;font-weight:900">Sell my car</a><div class="live" style="margin-left:0"><span class="dot"></span>Saudi market live</div></div>'
  );
  return out;
}

function patchMobileHtml(html='') {
  return String(html).replace(
    '<title>Dalelah Mobile Preview</title>',
    '<title>Dalelah — Saudi Car Search</title><meta name="theme-color" content="#090a0b"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Dalelah"><link rel="manifest" href="/mobile-manifest.webmanifest">'
  );
}

async function searchComparables(vehicle={}) {
  const query = [vehicle.make,vehicle.model,vehicle.year].filter(Boolean).join(' ');
  const body = {query,condition:'used',filters:{}};
  const first = await inner('/api/search', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(55_000)
  });
  if (!first.response.ok) throw new Error(first.data?.error || 'market-search-failed');
  let data = first.data;
  const byUrl = new Map();
  const merge = listings => {
    for (const listing of Array.isArray(listings)?listings:[]) {
      const key = listing.url || listing.originalUrl || `${listing.title}:${listing.price}`;
      if (key) byUrl.set(key, listing);
    }
  };
  merge(data.listings);
  if (data.searchId) {
    for (let i=0;i<6 && data.complete!==true;i++) {
      await sleep(900);
      const next = await inner(`/api/search/progress/${encodeURIComponent(data.searchId)}`, {signal:AbortSignal.timeout(50_000)});
      if (!next.response.ok) break;
      data = next.data;
      merge(data.listings);
    }
  }
  return filterBrandRelevance([...byUrl.values()],query);
}

app.get('/', async (_req,res) => {
  try {
    const {response,text} = await inner('/', {signal:AbortSignal.timeout(12_000)});
    if (!response.ok) return res.status(response.status).send(text);
    return res.type('html').send(patchWebUi(text));
  } catch (error) {
    return res.status(502).send(`Dalelah web unavailable: ${error?.message || error}`);
  }
});

app.get('/sell', async (_req,res) => {
  try {
    const html = await readFile(join(root,'public','sell.html'),'utf8');
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send('Dalelah Sell unavailable');
  }
});

app.get(['/mobile','/app'], async (_req,res) => {
  try {
    const html = await readFile(join(root,'public','mobile-preview.html'),'utf8');
    res.type('html').send(patchMobileHtml(html));
  } catch (error) {
    res.status(500).send('Dalelah mobile unavailable');
  }
});

app.get('/mobile-manifest.webmanifest', (_req,res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name:'Dalelah — Saudi Car Search',
    short_name:'Dalelah',
    start_url:'/mobile',
    scope:'/',
    display:'standalone',
    background_color:'#090a0b',
    theme_color:'#090a0b',
    description:'Search Saudi car marketplaces and dealers in one place.'
  }));
});

app.post('/api/search', async (req,res) => {
  const body=req.body||{};
  const query=String(body.query||'');
  try {
    const {response,data}=await inner('/api/search',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55_000)
    });
    if(data?.searchId) rememberSearchQuery(data.searchId,query);
    return res.status(response.status).json(applyMarketplaceBrandBoundary(data,query));
  } catch(error) {
    return res.status(502).json({error:error?.message||'Dalelah search unavailable'});
  }
});

app.get('/api/search/progress/:id', async (req,res) => {
  const id=String(req.params.id||'');
  const query=decodeSearchQuery(id);
  try {
    const {response,data}=await inner(`/api/search/progress/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(50_000)});
    const out=applyMarketplaceBrandBoundary(data,query);
    if(out?.complete===true||out?.marketScanComplete===true) searchQueryById.delete(id);
    return res.status(response.status).json(out);
  } catch(error) {
    return res.status(502).json({error:error?.message||'Dalelah search progress unavailable'});
  }
});

app.post('/api/sell/estimate', async (req,res) => {
  const vehicle = req.body || {};
  if (!vehicle.make || !vehicle.model || !vehicle.year) {
    return res.status(400).json({error:'make-model-year-required'});
  }
  try {
    const listings = await searchComparables(vehicle);
    const valuation = buildMarketValuation(listings, vehicle);
    return res.json({
      ok:true,
      vehicle:{make:String(vehicle.make),model:String(vehicle.model),year:Number(vehicle.year)},
      valuation,
      methodology:'Dalelah market listings; exact make/model/year where evidence exists',
      generatedAt:new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({error:'valuation-temporarily-unavailable',detail:error?.message || String(error)});
  }
});

app.post('/api/sell/submit', async (req,res) => {
  const validation = validateSellerSubmission(req.body || {});
  if (!validation.ok) return res.status(400).json({error:'invalid-submission',fields:validation.errors});
  const store = sellerStoreStatus();
  if (!store.writable) {
    return res.status(503).json({
      error:'seller-submissions-not-open',
      reason:store.reason,
      message:'Dalelah Sell is in preview. Seller data will only be accepted after the Saudi-hosted database is connected.'
    });
  }
  try {
    const result = await createSellerSubmission(req.body);
    return res.status(201).json({
      ok:true,
      submissionId:result.id,
      status:result.status,
      createdAt:result.created_at,
      reference:result.public_token
    });
  } catch (error) {
    console.error('seller submission failed', error?.message || error);
    return res.status(500).json({error:'seller-submission-failed'});
  }
});

app.get('/api/marketplace/status', (_req,res) => {
  const store = sellerStoreStatus();
  res.json({
    ok:true,
    productVersion:'1.5',
    marketplaceFoundation:true,
    mobileSurface:true,
    sellPreview:true,
    sellerDataResidency:'Saudi Arabia',
    sellerStore:{configured:store.configured,writable:store.writable,region:store.region,reason:store.reason}
  });
});

app.get('/api/health', async (_req,res) => {
  try {
    const {response,data} = await inner('/api/health',{signal:AbortSignal.timeout(9000)});
    const store = sellerStoreStatus();
    return res.status(response.status).json({
      ...data,
      marketplaceFoundation:true,
      mobileSurface:true,
      sellPreview:true,
      sellerDataResidency:'Saudi Arabia',
      sellerStoreWritable:store.writable,
      sellerDataRegion:store.region,
      releaseRuntime:'marketplace-mobile',
      marketplaceBrandBoundaryGate:true
    });
  } catch (error) {
    return res.status(503).json({ok:false,marketplaceFoundation:true,mobileSurface:true,marketplaceBrandBoundaryGate:true,error:error?.message || String(error)});
  }
});

async function proxy(req,res) {
  try {
    const headers = {};
    for (const [key,value] of Object.entries(req.headers)) {
      if (!['host','content-length','connection','origin'].includes(key.toLowerCase()) && value != null) {
        headers[key] = Array.isArray(value) ? value.join(',') : String(value);
      }
    }
    let body;
    if (!['GET','HEAD'].includes(req.method) && req.is('application/json')) {
      body = JSON.stringify(req.body || {});
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`http://127.0.0.1:${innerPort}${req.originalUrl}`, {
      method:req.method,
      headers,
      body,
      redirect:'manual',
      signal:AbortSignal.timeout(55_000)
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    for (const [key,value] of response.headers.entries()) {
      if (!['content-length','transfer-encoding','connection','access-control-allow-origin','vary'].includes(key.toLowerCase())) res.setHeader(key,value);
    }
    return res.status(response.status).send(buffer);
  } catch (error) {
    return res.status(502).json({error:error?.message || 'Dalelah unavailable'});
  }
}

app.use(proxy);
setInterval(()=>{
  const now=Date.now();
  for(const [id,value] of searchQueryById) if(now-value.at>SEARCH_QUERY_TTL) searchQueryById.delete(id);
},60_000).unref();
app.listen(externalPort,()=>console.log(`Dalelah unified marketplace/mobile edge on ${externalPort}; search core ${innerPort}`));
