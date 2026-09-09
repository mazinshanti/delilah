import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {buildMarketValuation} from './lib/market-valuation.js';
import {createSellerSubmission,sellerStoreStatus,validateSellerSubmission} from './lib/saudi-seller-store.js';

const externalPort = Number(process.env.PORT || 3000);
const innerPort = Number(process.env.DALELAH_MARKETPLACE_INNER_PORT || 7400);
process.env.PORT = String(innerPort);
await import('./server-v15-opensooq.js');
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({limit:'256kb'}));
const root = dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));

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
  return [...byUrl.values()];
}

app.get('/sell', async (_req,res) => {
  try {
    const html = await readFile(join(root,'public','sell.html'),'utf8');
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send('Dalelah Sell unavailable');
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
      sellPreview:true,
      sellerDataResidency:'Saudi Arabia',
      sellerStoreWritable:store.writable,
      sellerDataRegion:store.region
    });
  } catch (error) {
    return res.status(503).json({ok:false,marketplaceFoundation:true,error:error?.message || String(error)});
  }
});

async function proxy(req,res) {
  try {
    const headers = {};
    for (const [key,value] of Object.entries(req.headers)) {
      if (!['host','content-length','connection'].includes(key.toLowerCase()) && value != null) {
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
      if (!['content-length','transfer-encoding','connection'].includes(key.toLowerCase())) res.setHeader(key,value);
    }
    return res.status(response.status).send(buffer);
  } catch (error) {
    return res.status(502).json({error:error?.message || 'Dalelah unavailable'});
  }
}

app.use(proxy);
app.listen(externalPort,()=>console.log(`Dalelah marketplace edge on ${externalPort}; search core ${innerPort}`));
