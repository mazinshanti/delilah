import express from 'express';

const externalPort = Number(process.env.PORT || 3000);
const upstreamPort = Number(process.env.DALELAH_V33_PORT || 5800);
process.env.PORT = String(upstreamPort);
await import('./server-v33.js');
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: '1mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const intentCache = new Map();
const searchContext = new Map();
const CACHE_TTL = 10 * 60_000;

const INTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    make: { type: ['string','null'] },
    model: { type: ['string','null'] },
    condition: { type: ['string','null'], enum: ['new','used',null] },
    city: { type: ['string','null'] },
    minYear: { type: ['integer','null'] },
    maxYear: { type: ['integer','null'] },
    minPrice: { type: ['integer','null'] },
    maxPrice: { type: ['integer','null'] },
    maxMileage: { type: ['integer','null'] },
    bodyType: { type: ['string','null'] },
    fuel: { type: ['string','null'] },
    transmission: { type: ['string','null'] },
    color: { type: ['string','null'] },
    source: { type: ['string','null'] },
    sellerType: { type: ['string','null'] },
    sort: { type: ['string','null'] },
    priorities: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    excluded: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    goal: { type: 'string' },
    retrievalQuery: { type: 'string' }
  },
  required: ['make','model','condition','city','minYear','maxYear','minPrice','maxPrice','maxMileage','bodyType','fuel','transmission','color','source','sellerType','sort','priorities','excluded','goal','retrievalQuery']
};

const RANK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ranking: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          reason: { type: 'string' }
        },
        required: ['index','score','reason']
      }
    }
  },
  required: ['ranking']
};

function outputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  for (const item of data?.output || []) {
    for (const part of item?.content || []) if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
  }
  return '';
}

async function openaiJSON({ instructions, input, schema, name, timeout = 9000 }) {
  if (!OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      reasoning: { effort: 'none' },
      instructions,
      input,
      text: { format: { type: 'json_schema', name, strict: true, schema } }
    }),
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`AI ${response.status}`);
  const data = await response.json();
  const text = outputText(data);
  return text ? JSON.parse(text) : null;
}

function normalizeKey(query, context) {
  return `${String(query || '').trim().toLowerCase()}|${JSON.stringify(context || {})}`;
}

async function understandAI(query, previousIntent = null) {
  const key = normalizeKey(query, previousIntent);
  const cached = intentCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value;

  const fallback = {
    make: null, model: null, condition: null, city: null, minYear: null, maxYear: null,
    minPrice: null, maxPrice: null, maxMileage: null, bodyType: null, fuel: null,
    transmission: null, color: null, source: null, sellerType: null, sort: null,
    priorities: [], excluded: [], goal: String(query || ''), retrievalQuery: String(query || '')
  };
  if (!OPENAI_API_KEY || !String(query || '').trim()) return fallback;

  try {
    const value = await openaiJSON({
      name: 'dalelah_vehicle_intent',
      schema: INTENT_SCHEMA,
      instructions: `You are the intent engine for Dalelah, a Saudi car search engine. Convert Arabic, English, Saudi dialect, transliteration and conversational car requests into search intent. Preserve exact make/model constraints. Infer only soft preferences when the user implies them (for example family SUV or economical), never invent a hard budget, year, city, condition or mileage. Convert k/ألف to full integers. For follow-up queries, use previous intent only when supplied. retrievalQuery should be concise and optimized for finding actual vehicle listings, normally make + model when known, otherwise the user's useful automotive terms.`,
      input: JSON.stringify({ query, previousIntent })
    });
    const result = value || fallback;
    intentCache.set(key, { at: Date.now(), value: result });
    return result;
  } catch {
    return fallback;
  }
}

function mergeFilters(filters = {}, intent = {}) {
  const out = { ...filters };
  const pairs = [
    ['condition','condition'], ['city','city'], ['minYear','minYear'], ['maxYear','maxYear'],
    ['minPrice','minPrice'], ['maxPrice','maxPrice'], ['maxMileage','maxMileage'],
    ['bodyType','bodyType'], ['fuel','fuel'], ['transmission','transmission'], ['color','color'],
    ['source','source'], ['sellerType','sellerType'], ['sort','sort']
  ];
  for (const [to, from] of pairs) if ((out[to] === undefined || out[to] === null || out[to] === '') && intent[from] !== null && intent[from] !== undefined && intent[from] !== '') out[to] = intent[from];
  return out;
}

function listingSummary(car, index) {
  return {
    index,
    title: car?.title || null,
    make: car?.make || null,
    model: car?.model || null,
    year: car?.year || null,
    price: car?.price || null,
    mileage: car?.mileage || null,
    city: car?.city || null,
    condition: car?.condition || null,
    source: car?.source || null,
    seller: car?.seller || null,
    priceVerified: Boolean(car?.priceVerified),
    imageVerified: Boolean(car?.imageVerified)
  };
}

function deterministicScore(car, intent) {
  let score = 70;
  if (intent.make && String(car?.make || car?.title || '').toLowerCase().includes(intent.make.toLowerCase())) score += 8;
  if (intent.model && String(car?.model || car?.title || '').toLowerCase().includes(intent.model.toLowerCase())) score += 10;
  if (intent.city && String(car?.city || '').toLowerCase().includes(intent.city.toLowerCase())) score += 4;
  if (intent.maxPrice && Number(car?.price) <= intent.maxPrice) score += 3;
  if (intent.minYear && Number(car?.year) >= intent.minYear) score += 2;
  if (intent.maxMileage && Number(car?.mileage) <= intent.maxMileage) score += 2;
  if (car?.priceVerified) score += 1;
  return Math.max(0, Math.min(100, score));
}

async function rankListings(intent, listings = [], phase = 'full') {
  if (!Array.isArray(listings) || !listings.length) return listings;
  const base = listings.map(car => ({ ...car, aiScore: deterministicScore(car, intent), aiReason: null }));
  if (!OPENAI_API_KEY || phase === 'fast') return base.sort((a,b) => (b.aiScore || 0) - (a.aiScore || 0));

  const sample = base.slice(0, 24).map(listingSummary);
  try {
    const result = await openaiJSON({
      name: 'dalelah_listing_rank',
      schema: RANK_SCHEMA,
      timeout: 8000,
      instructions: `Rank Saudi vehicle listings against the supplied intent. Use only the listing facts provided. A hard user constraint must dominate ranking; do not reward a listing for facts that are missing. Give each listing a 0-100 match score and a short reason in the user's likely language. Never claim mechanical quality, accident history, warranty, or value versus market unless the provided facts establish it.`,
      input: JSON.stringify({ intent, listings: sample })
    });
    const byIndex = new Map((result?.ranking || []).map(x => [x.index, x]));
    return base.map((car, index) => {
      const r = byIndex.get(index);
      return r ? { ...car, aiScore: r.score, aiReason: r.reason } : car;
    }).sort((a,b) => (b.aiScore || 0) - (a.aiScore || 0));
  } catch {
    return base.sort((a,b) => (b.aiScore || 0) - (a.aiScore || 0));
  }
}

async function callUpstream(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${upstreamPort}${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(50000)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 1000) }; }
  return { response, data };
}

async function enrich(data, intent, phase) {
  if (!data || typeof data !== 'object') return data;
  const listings = await rankListings(intent, data.listings || [], phase);
  return {
    ...data,
    listings,
    ai: {
      enabled: Boolean(OPENAI_API_KEY),
      model: OPENAI_API_KEY ? OPENAI_MODEL : null,
      intent,
      ranked: listings.length,
      mode: OPENAI_API_KEY ? 'ai-native-hybrid' : 'deterministic-fallback'
    },
    understanding: { ...(data.understanding || {}), aiIntent: intent },
    product: { ...(data.product || {}), version: 'v34', aiNativeSearch: Boolean(OPENAI_API_KEY) }
  };
}

app.post('/api/ai/understand', async (req, res) => {
  const query = String(req.body?.query || '');
  const intent = await understandAI(query, req.body?.previousIntent || null);
  res.json({ ok: true, ai: Boolean(OPENAI_API_KEY), model: OPENAI_API_KEY ? OPENAI_MODEL : null, intent });
});

app.post('/api/search', async (req, res) => {
  const original = req.body || {};
  try {
    const intent = await understandAI(String(original.query || ''), original.previousIntent || original.aiContext || null);
    const body = {
      ...original,
      query: intent.retrievalQuery || original.query,
      filters: mergeFilters(original.filters || {}, intent)
    };
    const { response, data } = await callUpstream('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(original.phase === 'fast' ? 18000 : 55000)
    });
    if (!response.ok) return res.status(response.status).json(data);
    const enriched = await enrich(data, intent, original.phase || 'full');
    if (enriched?.searchId) searchContext.set(enriched.searchId, { intent, at: Date.now() });
    return res.json(enriched);
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Dalelah AI search unavailable' });
  }
});

app.get('/api/search/progress/:id', async (req, res) => {
  try {
    const { response, data } = await callUpstream(`/api/search/progress/${encodeURIComponent(req.params.id)}`, { signal: AbortSignal.timeout(35000) });
    if (!response.ok) return res.status(response.status).json(data);
    const context = searchContext.get(req.params.id);
    return res.json(context ? await enrich(data, context.intent, 'full') : data);
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Dalelah AI progress unavailable' });
  }
});

app.post('/api/understand', async (req, res) => {
  try {
    const query = String(req.body?.query || '');
    const intent = await understandAI(query, req.body?.previousIntent || null);
    const { response, data } = await callUpstream('/api/understand', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...req.body, query: intent.retrievalQuery || query, filters: mergeFilters(req.body?.filters || {}, intent) }),
      signal: AbortSignal.timeout(18000)
    });
    if (!response.ok) return res.status(response.status).json(data);
    return res.json({ ...data, aiIntent: intent, ai: Boolean(OPENAI_API_KEY), aiModel: OPENAI_API_KEY ? OPENAI_MODEL : null });
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Dalelah understanding unavailable' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const { response, data } = await callUpstream('/api/health', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return res.status(response.status).json(data);
    return res.json({ ...data, edge: 'product-v34', aiNativeSearch: Boolean(OPENAI_API_KEY), aiModel: OPENAI_API_KEY ? OPENAI_MODEL : null, conversationalIntent: true, aiRanking: true });
  } catch {
    return res.status(503).json({ ok: false, edge: 'product-v34', aiNativeSearch: Boolean(OPENAI_API_KEY) });
  }
});

app.get('/', async (_req, res) => {
  try {
    const response = await fetch(`http://127.0.0.1:${upstreamPort}/`, { signal: AbortSignal.timeout(10000) });
    let html = await response.text();
    html = html.replace('</body>', '<script>window.DALELAH_AI_NATIVE=true;</script></body>');
    res.setHeader('cache-control', 'no-store');
    return res.type('html').send(html);
  } catch {
    return res.status(502).send('Dalelah frontend unavailable');
  }
});

async function proxy(req, res) {
  try {
    const headers = {};
    for (const [k,v] of Object.entries(req.headers)) if (!['host','content-length','connection'].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(',') : String(v);
    let body;
    if (!['GET','HEAD'].includes(req.method) && req.is('application/json')) { body = JSON.stringify(req.body || {}); headers['content-type'] = 'application/json'; }
    const response = await fetch(`http://127.0.0.1:${upstreamPort}${req.originalUrl}`, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(50000) });
    const buf = Buffer.from(await response.arrayBuffer());
    for (const [k,v] of response.headers.entries()) if (!['content-length','transfer-encoding','connection'].includes(k.toLowerCase())) res.setHeader(k,v);
    return res.status(response.status).send(buf);
  } catch {
    return res.status(502).json({ error: 'Dalelah upstream unavailable' });
  }
}

app.use(proxy);
setInterval(() => {
  const now = Date.now();
  for (const [k,v] of intentCache) if (now - v.at > CACHE_TTL) intentCache.delete(k);
  for (const [k,v] of searchContext) if (now - v.at > 60 * 60_000) searchContext.delete(k);
}, 10 * 60_000).unref();

app.listen(externalPort, () => console.log(`Dalelah AI-native product-v34 running at http://localhost:${externalPort}`));
