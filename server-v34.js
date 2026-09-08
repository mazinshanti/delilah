import express from 'express';

const externalPort = Number(process.env.PORT || 3000);
const v33Port = Number(process.env.DELILAH_V33_PORT || 5800);
process.env.PORT = String(v33Port);
await import('./server-v33.js');
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: '1mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const AI_ENABLED = Boolean(OPENAI_API_KEY);

function n(v = '') {
  return String(v).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function num(v) {
  const x = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(x) ? x : null;
}

function textOfResponse(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  for (const item of data?.output || []) {
    for (const c of item?.content || []) if (typeof c?.text === 'string') return c.text;
  }
  return null;
}

const intentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    searchQuery: { type: 'string' },
    make: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
    minYear: { type: ['integer', 'null'] },
    maxYear: { type: ['integer', 'null'] },
    maxPrice: { type: ['number', 'null'] },
    minPrice: { type: ['number', 'null'] },
    maxMileage: { type: ['number', 'null'] },
    city: { type: ['string', 'null'] },
    condition: { type: ['string', 'null'], enum: ['new', 'used', null] },
    bodyType: { type: ['string', 'null'] },
    fuel: { type: ['string', 'null'] },
    color: { type: ['string', 'null'] },
    priorities: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    userGoal: { type: 'string' }
  },
  required: ['searchQuery','make','model','minYear','maxYear','maxPrice','minPrice','maxMileage','city','condition','bodyType','fuel','color','priorities','userGoal']
};

async function aiIntent(query, filters = {}) {
  if (!AI_ENABLED || !String(query || '').trim()) return null;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: 'You are Dalelah, a Saudi automotive search-intent parser. Convert natural language Arabic or English car requests into conservative structured search intent. Never invent constraints the user did not express. Keep searchQuery concise and optimized for vehicle retrieval. Convert ألف/k price or mileage expressions to full numbers. Interpret family, reliable, luxury, sporty, economical, low mileage and similar words as priorities rather than hard filters unless a concrete constraint is stated.' }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify({ query, existingFilters: filters }) }]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'vehicle_search_intent',
          strict: true,
          schema: intentSchema
        },
        verbosity: 'low'
      }
    }),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`OpenAI intent ${response.status}`);
  const data = await response.json();
  const text = textOfResponse(data);
  if (!text) throw new Error('OpenAI intent missing output');
  return JSON.parse(text);
}

function mergeFilters(existing = {}, intent) {
  const out = { ...existing };
  if (!intent) return out;
  const keys = ['minYear','maxYear','maxPrice','minPrice','maxMileage','city','condition','bodyType','fuel','color'];
  for (const key of keys) if ((out[key] === undefined || out[key] === null || out[key] === '') && intent[key] !== null && intent[key] !== undefined && intent[key] !== '') out[key] = intent[key];
  return out;
}

function listingText(car = {}) {
  return n([car.title, car.make, car.model, car.trim, car.city, car.location, car.condition, car.bodyType, car.fuel, car.color, car.description, car.source].filter(Boolean).join(' '));
}

function scoreListing(car = {}, intent) {
  if (!intent) return { score: 50, reasons: [] };
  const txt = listingText(car);
  let score = 40;
  const reasons = [];
  const add = (points, reason) => { score += points; if (reason) reasons.push(reason); };
  const sub = points => { score -= points; };

  if (intent.make) txt.includes(n(intent.make)) ? add(16, `${intent.make} match`) : sub(10);
  if (intent.model) txt.includes(n(intent.model)) ? add(18, `${intent.model} match`) : sub(12);

  const year = num(car.year);
  if (year && intent.minYear) year >= intent.minYear ? add(7, `Year ${year}`) : sub(15);
  if (year && intent.maxYear) year <= intent.maxYear ? add(4, `Within year range`) : sub(10);

  const price = num(car.price ?? car.priceSar ?? car.amount);
  if (price && intent.maxPrice) price <= intent.maxPrice ? add(10, 'Within budget') : sub(Math.min(25, 8 + ((price - intent.maxPrice) / Math.max(intent.maxPrice, 1)) * 30));
  if (price && intent.minPrice) price >= intent.minPrice ? add(2, 'Within price range') : sub(3);

  const mileage = num(car.mileage ?? car.km ?? car.odometer);
  if (mileage !== null && intent.maxMileage) mileage <= intent.maxMileage ? add(8, 'Low enough mileage') : sub(12);

  if (intent.city) txt.includes(n(intent.city)) ? add(6, `${intent.city} location`) : sub(2);
  if (intent.condition) txt.includes(n(intent.condition)) ? add(6, `${intent.condition} condition`) : sub(7);
  if (intent.bodyType && txt.includes(n(intent.bodyType))) add(4, `${intent.bodyType} body`);
  if (intent.fuel && txt.includes(n(intent.fuel))) add(3, `${intent.fuel} powertrain`);
  if (intent.color && txt.includes(n(intent.color))) add(2, `${intent.color} color`);

  const priorityMap = {
    family: ['suv','7 seat','7-seater','family','عائلي','عائلية'],
    reliable: ['toyota','lexus','honda','mazda','nissan','hyundai','kia'],
    luxury: ['lexus','mercedes','bmw','audi','porsche','cadillac','genesis','range rover'],
    sporty: ['sport','turbo','amg','m sport','gt','n line','rs'],
    economical: ['hybrid','electric','economy','fuel efficient','اقتصادي','هايبرد'],
    'low mileage': ['low mileage','ممشى قليل']
  };
  for (const p of intent.priorities || []) {
    const key = n(p);
    const terms = priorityMap[key] || [key];
    if (terms.some(t => txt.includes(n(t)))) add(2, p);
  }

  if (car.priceVerified) add(2, 'Verified price');
  if (car.imageVerified) add(1, 'Verified image');
  if (car.url) add(1, 'Direct source');

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons: [...new Set(reasons)].slice(0, 4) };
}

function rank(data, intent) {
  if (!Array.isArray(data?.listings)) return data;
  const listings = data.listings.map((car, index) => {
    const r = scoreListing(car, intent);
    return { ...car, aiMatchScore: r.score, aiMatchReasons: r.reasons, originalRank: index + 1 };
  }).sort((a, b) => (b.aiMatchScore || 0) - (a.aiMatchScore || 0));
  return {
    ...data,
    listings,
    ai: {
      enabled: Boolean(intent),
      mode: intent ? 'intent+retrieval+ranking' : 'retrieval+deterministic-ranking',
      intent: intent || null,
      ranked: Boolean(intent)
    },
    product: { ...(data.product || {}), aiSearch: Boolean(intent), aiRanking: Boolean(intent), version: 'v34' }
  };
}

async function proxyJson(path, body, timeout = 50000) {
  const r = await fetch(`http://127.0.0.1:${v33Port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout)
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 500) }; }
  return { r, data };
}

app.post('/api/search', async (req, res) => {
  const original = req.body || {};
  let intent = null;
  try { intent = await aiIntent(original.query || '', original.filters || {}); } catch (e) { console.warn('AI intent fallback:', e?.message || e); }
  const body = {
    ...original,
    query: intent?.searchQuery || original.query,
    filters: mergeFilters(original.filters || {}, intent)
  };
  try {
    const { r, data } = await proxyJson('/api/search', body, original.phase === 'fast' ? 15000 : 50000);
    if (!r.ok) return res.status(r.status).json(data);
    const ranked = rank(data, intent);
    if (ranked.understanding && typeof ranked.understanding === 'object') {
      ranked.understanding = { ...ranked.understanding, originalQuery: String(original.query || ''), aiIntent: intent || null };
    }
    return res.json(ranked);
  } catch (e) {
    return res.status(502).json({ error: e?.message || 'Dalelah AI search unavailable' });
  }
});

app.post('/api/understand', async (req, res) => {
  const original = req.body || {};
  let intent = null;
  try { intent = await aiIntent(original.query || '', original.filters || {}); } catch (e) { console.warn('AI understand fallback:', e?.message || e); }
  if (intent) return res.json({ query: original.query || '', normalizedQuery: intent.searchQuery, ai: true, intent });
  try {
    const { r, data } = await proxyJson('/api/understand', original, 15000);
    return res.status(r.status).json({ ...data, ai: false, fallback: true });
  } catch (e) {
    return res.status(502).json({ error: e?.message || 'Understanding unavailable' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const r = await fetch(`http://127.0.0.1:${v33Port}/api/health`, { signal: AbortSignal.timeout(9000) });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json(d);
    return res.json({ ...d, edge: 'product-v34', aiSearch: AI_ENABLED, aiModel: AI_ENABLED ? OPENAI_MODEL : null, aiArchitecture: 'intent+retrieval+ranking', brandName: 'Dalelah' });
  } catch {
    return res.status(503).json({ ok: false, edge: 'product-v34', aiSearch: AI_ENABLED });
  }
});

async function proxy(req, res) {
  try {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!['host','content-length','connection'].includes(k.toLowerCase()) && v != null) headers[k] = Array.isArray(v) ? v.join(',') : String(v);
    let body;
    if (!['GET','HEAD'].includes(req.method) && req.is('application/json')) { body = JSON.stringify(req.body || {}); headers['content-type'] = 'application/json'; }
    const r = await fetch(`http://127.0.0.1:${v33Port}${req.originalUrl}`, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(50000) });
    const buf = Buffer.from(await r.arrayBuffer());
    for (const [k, v] of r.headers.entries()) if (!['content-length','transfer-encoding','connection'].includes(k.toLowerCase())) res.setHeader(k, v);
    return res.status(r.status).send(buf);
  } catch {
    return res.status(502).json({ error: 'Dalelah upstream unavailable' });
  }
}

app.use(proxy);
app.listen(externalPort, () => console.log(`Dalelah AI search product-v34 running at http://localhost:${externalPort}`));
