import express from 'express';
import path from 'path';
import { norm, exactYear, yearBounds, identityMatches } from './lib/search-semantics-v26.js';

const externalPort = Number(process.env.PORT || 3000);
const primaryPort = Number(process.env.DALELAH_V25_PORT || 6200);
const widePort = Number(process.env.DALELAH_WIDE_PORT || 6400);

// Keep the current production-compatible recovery stack intact on an internal port.
process.env.PORT = String(primaryPort);
await import('./server-recovery-v25.js');

// Also boot the broader standalone market scanner, but disable its AI intent call.
// The outer edge owns intent/filter semantics and uses this scanner only source-by-source.
const savedOpenAI = process.env.OPENAI_API_KEY;
process.env.PORT = String(widePort);
process.env.OPENAI_API_KEY = '';
await import('./server-v1.2.js');
if (savedOpenAI == null) delete process.env.OPENAI_API_KEY;
else process.env.OPENAI_API_KEY = savedOpenAI;
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

const canonical = v => {
  try {
    const u = new URL(v); u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
    return u.href.replace(/\/$/, '');
  } catch { return String(v || '').replace(/\/$/, ''); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function normalizedBody(body = {}) {
  const q = String(body.query || '').trim(), f = body.filters && typeof body.filters === 'object' ? { ...body.filters } : {};
  const b = yearBounds(q);
  if (b.exactYear) { f.minYear = String(b.exactYear); f.maxYear = String(b.exactYear); }
  else {
    if (!f.minYear && b.minYear) f.minYear = String(b.minYear);
    if (!f.maxYear && b.maxYear) f.maxYear = String(b.maxYear);
  }
  return { ...body, query: q, condition: body.condition === 'new' ? 'new' : 'used', filters: f };
}

function hardFinalMatch(c, body, y) {
  if (!c?.url || c.saleVerified === false) return false;
  const condition = body.condition === 'new' ? 'new' : 'used';
  if (c.condition && c.condition !== condition) return false;
  if (y && Number(c.year) !== y) return false;
  const f = body.filters || {};
  if (f.minYear && c.year != null && Number(c.year) < Number(f.minYear)) return false;
  if (f.maxYear && c.year != null && Number(c.year) > Number(f.maxYear)) return false;
  if (f.maxPrice && c.price != null && Number(c.price) > Number(f.maxPrice)) return false;
  if (f.maxMileage && c.mileage != null && Number(c.mileage) > Number(f.maxMileage)) return false;
  if (f.city && c.city && norm(c.city) !== norm(f.city)) return false;
  const requestedSource = String(f.source || f.seller || '').trim();
  if (requestedSource && norm(c.source || c.seller || '') !== norm(requestedSource) && !norm(c.source || '').includes(norm(requestedSource))) return false;
  if (!identityMatches(c, body.query)) return false;
  return true;
}
function quality(c = {}) {
  return Number(c.aiScore || c.score || 0) + (c.imageVerified ? 4 : 0) + (c.priceVerified ? 4 : 0) + (c.year ? 2 : 0) + (c.mileage != null ? 1 : 0);
}
function merge(groups = []) {
  const map = new Map();
  for (const group of groups) for (const raw of group || []) {
    if (!raw?.url) continue;
    const c = { ...raw, url: canonical(raw.url) }, k = c.url, old = map.get(k);
    if (!old || quality(c) > quality(old)) map.set(k, old ? { ...old, ...c, image: c.image || old.image || null, displayImage: c.displayImage || old.displayImage || null, price: c.price ?? old.price ?? null, imageVerified: Boolean(c.imageVerified || old.imageVerified), priceVerified: Boolean(c.priceVerified || old.priceVerified) } : c);
  }
  return [...map.values()];
}
function counts(xs = []) { return xs.reduce((a, c) => (a[c.source || 'Unknown'] = (a[c.source || 'Unknown'] || 0) + 1, a), {}); }

async function jsonGet(port, pathname, timeout = 12000) {
  const r = await fetch(`http://127.0.0.1:${port}${pathname}`, { signal: AbortSignal.timeout(timeout) });
  const text = await r.text(); let d; try { d = JSON.parse(text); } catch { d = { error: text.slice(0, 500) }; }
  return { r, d };
}
async function jsonPost(port, pathname, body, timeout = 45000) {
  const r = await fetch(`http://127.0.0.1:${port}${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  const text = await r.text(); let d; try { d = JSON.parse(text); } catch { d = { error: text.slice(0, 500) }; }
  return { r, d };
}

const USED_COVERAGE = ['YallaMotor', 'Saudi Sale', 'Mstaml', 'Dubizzle KSA', 'Kayishha', 'ArabWheels'];
const NEW_COVERAGE = ['Saudi Sale', 'Mstaml', 'Dubizzle KSA', 'Saleh Cars', 'ArabWheels', 'CARTAL'];
async function supplementalScan(body) {
  const requested = String(body.filters?.source || body.filters?.seller || '').trim();
  const sources = requested ? [requested] : (body.condition === 'new' ? NEW_COVERAGE : USED_COVERAGE);
  const results = [], diagnostics = [];
  await Promise.all(sources.map(async (source, i) => {
    // server-v1.2 has no internal Brave throttle, so stagger discovery starts.
    await sleep(i * 1250);
    const b = { ...body, filters: { ...(body.filters || {}), source }, phase: 'full' };
    try {
      const { r, d } = await jsonPost(widePort, '/api/search', b, 30000);
      const xs = r.ok && Array.isArray(d.listings) ? d.listings : [];
      results.push(...xs);
      diagnostics.push({ source, ok: r.ok, returned: xs.length, error: r.ok ? null : d.error || `HTTP ${r.status}` });
    } catch (e) { diagnostics.push({ source, ok: false, returned: 0, error: e?.message || String(e) }); }
  }));
  return { listings: results, diagnostics, attempted: sources };
}

app.post('/api/search', async (req, res) => {
  const body = normalizedBody(req.body || {}), y = exactYear(body.query);
  if (!body.query) return res.status(400).json({ error: 'Query is required' });
  const primaryPromise = jsonPost(primaryPort, '/api/search', body, 50000).catch(e => ({ r: null, d: { error: e?.message || String(e) } }));
  const widePromise = supplementalScan(body).catch(e => ({ listings: [], diagnostics: [{ source: 'coverage', ok: false, returned: 0, error: e?.message || String(e) }], attempted: [] }));
  const [primary, wide] = await Promise.all([primaryPromise, widePromise]);
  const primaryListings = primary?.r?.ok && Array.isArray(primary.d?.listings) ? primary.d.listings : [];
  let listings = merge([primaryListings, wide.listings]).filter(c => hardFinalMatch(c, body, y));
  listings.sort((a, b) => quality(b) - quality(a));
  listings = listings.slice(0, 1000);
  if (!primary?.r?.ok && !listings.length) return res.status(primary?.r?.status || 502).json({ error: primary?.d?.error || 'Saudi market search unavailable', coverageDiagnostics: wide.diagnostics });
  const primaryData = primary?.r?.ok ? primary.d : {};
  const sourceCounts = counts(listings);
  return res.json({
    ...primaryData,
    query: body.query,
    condition: body.condition,
    listings,
    counts: sourceCounts,
    exactYear: y,
    exactYearSemantics: Boolean(y),
    answer: `${listings.length} matching ${body.condition} listings found across ${Object.keys(sourceCounts).length} Saudi sources.`,
    marketCoverage: {
      version: 'v26',
      mode: 'primary recovery stack + source-targeted wide overlay',
      primaryReturned: primaryListings.length,
      supplementalReturned: wide.listings.length,
      finalUnique: listings.length,
      attemptedSupplementalSources: wide.attempted,
      diagnostics: wide.diagnostics
    },
    product: { ...(primaryData.product || {}), recovery: 'v26-market-coverage', exactYearGlobal: true, supplementalMarketScanner: true }
  });
});

app.get('/api/health', async (_req, res) => {
  const [p, w] = await Promise.all([
    jsonGet(primaryPort, '/api/health', 9000).catch(() => null),
    jsonGet(widePort, '/api/health', 9000).catch(() => null)
  ]);
  const ok = Boolean(p?.r?.ok || w?.r?.ok);
  res.status(ok ? 200 : 503).json({
    ...(p?.d || {}), ok,
    edge: 'market-coverage-v26',
    exactYearGlobal: true,
    primaryRecovery: Boolean(p?.r?.ok),
    wideScanner: Boolean(w?.r?.ok),
    wideSources: w?.d?.sources || [],
    coverageSources: { used: USED_COVERAGE, new: NEW_COVERAGE }
  });
});

app.get('/api/sources', async (_req, res) => {
  const [p, w] = await Promise.all([
    jsonGet(primaryPort, '/api/sources', 9000).catch(() => null),
    jsonGet(widePort, '/api/sources', 9000).catch(() => null)
  ]);
  const names = new Map();
  for (const s of p?.d?.sources || p?.d?.active || []) names.set(s.name || s.source, s);
  for (const s of w?.d?.active || w?.d?.sources || []) names.set(s.name || s.source, s);
  res.json({ ok: true, total: names.size, sources: [...names.values()], primary: p?.r?.ok || false, wide: w?.r?.ok || false });
});

async function proxy(req, res) {
  try {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!['host', 'content-length', 'connection'].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(',') : String(v);
    let body;
    if (!['GET', 'HEAD'].includes(req.method)) { body = JSON.stringify(req.body || {}); headers['content-type'] = 'application/json'; }
    const r = await fetch(`http://127.0.0.1:${primaryPort}${req.originalUrl}`, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(45000) });
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!['content-length', 'transfer-encoding', 'connection'].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch (e) { return res.status(502).json({ error: e?.message || 'Primary Delilah upstream unavailable' }); }
}
app.use(proxy);
app.listen(externalPort, () => console.log(`Dalelah market-coverage-v26 running at http://localhost:${externalPort} -> primary ${primaryPort}, wide ${widePort}`));
