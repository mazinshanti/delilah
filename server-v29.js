import express from 'express';

const externalPort = Number(process.env.PORT || 3000);
const v27Port = Number(process.env.DELILAH_V27_PORT || 5200);
process.env.PORT = String(v27Port);
await import('./server-v27.js');
process.env.PORT = String(externalPort);

const app = express();
app.use(express.json({ limit: '1mb' }));

const searchMeta = new Map();

const HISTORY_PROVIDERS = [
  {
    id: 'mojaz',
    name: 'Mojaz',
    url: 'https://mojaz.com.sa/mojaz/',
    scope: 'Saudi vehicle history',
    note: 'Saudi history reports including accidents, odometer history, ownership and maintenance data when available.'
  },
  {
    id: 'opensooq-reports',
    name: 'OpenSooq Car Reports',
    url: 'https://sa.opensooq.com/en/car-reports',
    scope: 'Mojaz / Carfax report access',
    note: 'VIN-based reports with provider coverage depending on the vehicle.'
  },
  {
    id: 'ua',
    name: 'United Assurance',
    url: 'https://ua.sa/',
    scope: 'US / Canada imports',
    note: 'VIN history for imported vehicles, including accident, salvage, flood, fire and odometer data when available.'
  }
];

const SOURCE_ALIASES = new Map([
  ['Haraj', ['haraj', 'حراج']],
  ['Syarah', ['syarah', 'موقع سيارة', 'موقع سياره']],
  ['OpenSooq', ['opensooq', 'open sooq', 'السوق المفتوح']],
  ['Saudi Sale', ['saudi sale', 'سعودي سيل', 'سعودي سيلز']],
  ['ArabWheels', ['arabwheels', 'arab wheels', 'عرب ويلز']],
  ['YallaMotor', ['yallamotor', 'yalla motor', 'يلا موتور']],
  ['CarSwitch Saudi', ['carswitch', 'car switch', 'كار سويتش']],
  ['Motory', ['motory', 'موتري']],
  ['Mstaml', ['mstaml', 'مستعمل']],
  ['Carly', ['carly', 'كارلي']]
]);

const TERM_GROUPS = [
  ['Toyota', ['toyota', 'تويوتا']], ['Nissan', ['nissan', 'نيسان']], ['Jeep', ['jeep', 'جيب']],
  ['Lexus', ['lexus', 'لكزس']], ['BMW', ['bmw', 'بي ام دبليو', 'بي ام']],
  ['Mercedes', ['mercedes', 'mercedes benz', 'مرسيدس']], ['Hyundai', ['hyundai', 'هيونداي']],
  ['Kia', ['kia', 'كيا']], ['Ford', ['ford', 'فورد']], ['Chevrolet', ['chevrolet', 'chevy', 'شفروليه']],
  ['GMC', ['gmc', 'جي ام سي']], ['Mazda', ['mazda', 'مازدا']], ['Honda', ['honda', 'هوندا']],
  ['Mitsubishi', ['mitsubishi', 'ميتسوبيشي']], ['Chrysler', ['chrysler', 'كرايسلر', 'كلزلر']],
  ['Dodge', ['dodge', 'دودج']], ['RAM', ['ram', 'رام']], ['Cadillac', ['cadillac', 'كاديلاك']],
  ['Lincoln', ['lincoln', 'لينكون']], ['Porsche', ['porsche', 'بورش']], ['Audi', ['audi', 'اودي']],
  ['Volkswagen', ['volkswagen', 'vw', 'فولكس واجن']], ['Volvo', ['volvo', 'فولفو']],
  ['Land Rover', ['land rover', 'لاند روفر']], ['Range Rover', ['range rover', 'رينج روفر']],
  ['Genesis', ['genesis', 'جينيسيس', 'جينيسس']], ['Geely', ['geely', 'جيلي']],
  ['Changan', ['changan', 'شانجان']], ['Haval', ['haval', 'هافال']], ['GAC', ['gac', 'جي ايه سي']],
  ['MG', ['mg', 'ام جي']], ['BYD', ['byd', 'بي واي دي']], ['Jetour', ['jetour', 'جيتور']],
  ['Chery', ['chery', 'شيري']], ['Hongqi', ['hongqi', 'هونشي']], ['Exeed', ['exeed', 'اكسيد']],
  ['Jaecoo', ['jaecoo', 'جايكو']], ['Omoda', ['omoda', 'اومودا']], ['Tank', ['tank', 'تانك']],
  ['Zeekr', ['zeekr', 'زيكر']], ['Tesla', ['tesla', 'تسلا']], ['Lucid', ['lucid', 'لوسيد']],
  ['Polestar', ['polestar', 'بولستار']], ['Peugeot', ['peugeot', 'بيجو']], ['Renault', ['renault', 'رينو']],
  ['Suzuki', ['suzuki', 'سوزوكي']], ['Isuzu', ['isuzu', 'ايسوزو']], ['Subaru', ['subaru', 'سوبارو']],
  ['Infiniti', ['infiniti', 'انفينيتي']], ['Ferrari', ['ferrari', 'فيراري']],
  ['Lamborghini', ['lamborghini', 'لامبورغيني']], ['Bentley', ['bentley', 'بنتلي']],
  ['Rolls Royce', ['rolls royce', 'رولز رويس']], ['Aston Martin', ['aston martin', 'استون مارتن']],
  ['Maserati', ['maserati', 'مازيراتي']], ['McLaren', ['mclaren', 'ماكلارين']], ['Mini', ['mini', 'ميني']],
  ['Camry', ['camry', 'كامري']], ['Corolla', ['corolla', 'كورولا']],
  ['Land Cruiser', ['land cruiser', 'landcruiser', 'لاند كروزر', 'لاندكروزر']], ['Prado', ['prado', 'برادو']],
  ['Yaris', ['yaris', 'يارس']], ['Fortuner', ['fortuner', 'فورتشنر']], ['Hilux', ['hilux', 'هايلوكس']],
  ['RAV4', ['rav4', 'راف فور']], ['Patrol', ['patrol', 'باترول']], ['Sunny', ['sunny', 'صني']],
  ['Altima', ['altima', 'التيما']], ['X-Trail', ['x trail', 'xtrail', 'اكس تريل']],
  ['Wrangler', ['wrangler', 'رانجلر']], ['Compass', ['compass', 'كومباس']], ['Cherokee', ['cherokee', 'شيروكي']],
  ['Grand Cherokee', ['grand cherokee', 'جراند شيروكي']], ['Accord', ['accord', 'اكورد']], ['Civic', ['civic', 'سيفيك']],
  ['Tucson', ['tucson', 'توسان']], ['Santa Fe', ['santa fe', 'سنتافي']], ['Sonata', ['sonata', 'سوناتا']],
  ['Accent', ['accent', 'اكسنت']], ['Elantra', ['elantra', 'النترا']], ['Sportage', ['sportage', 'سبورتاج']],
  ['Sorento', ['sorento', 'سورينتو']], ['Cerato', ['cerato', 'سيراتو']], ['Territory', ['territory', 'تيريتوري']],
  ['Explorer', ['explorer', 'اكسبلورر']], ['Expedition', ['expedition', 'اكسبديشن']], ['Tahoe', ['tahoe', 'تاهو']],
  ['Sierra', ['sierra', 'سييرا']], ['Coolray', ['coolray', 'كولراي']], ['Emgrand', ['emgrand', 'امجراند']],
  ['Jolion', ['jolion', 'جوليون']], ['CS75 Plus', ['cs75 plus', 'cs 75 plus']], ['CS35', ['cs35', 'cs 35']],
  ['RX5', ['rx5', 'rx 5']], ['Song Plus', ['song plus']], ['Dashing', ['dashing', 'داشينج']],
  ['VXR', ['vxr', 'v x r', 'في اكس ار', 'فيكس ار', 'فكسر']], ['GXR', ['gxr', 'g x r', 'جي اكس ار']],
  ['F-150', ['f150', 'f-150', 'f 150']], ['CX-5', ['cx5', 'cx-5', 'cx 5']],
  ['Model 3', ['model 3']], ['Model Y', ['model y']]
];

const FILLER = new Set(`show me show all all results result cars car vehicle vehicles used new find search looking want need from only please on in
ابي ابغى اريد ورني عطني دور لي سيارات سيارة سياره كل جميع النتائج نتايج من فقط على في`.split(/\s+/));

const SOURCE_BROWSE_QUERIES = [
  'Toyota', 'Nissan', 'Hyundai', 'Kia', 'Jeep', 'Ford', 'Chevrolet', 'Lexus', 'BMW', 'Mercedes', 'Mazda', 'Honda'
];

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(text = '') {
  return normalize(text).replace(/\s+/g, '');
}

function distance(a, b) {
  a = String(a); b = String(b);
  const d = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function similarity(a, b) {
  a = compact(a); b = compact(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

function sameScript(a, b) {
  const arabic = value => /[\u0600-\u06ff]/.test(value);
  return arabic(a) === arabic(b);
}

const termEntries = TERM_GROUPS.flatMap(([canonical, aliases]) =>
  aliases.map(alias => ({ canonical, alias, normalized: normalize(alias) }))
);

function detectSource(query = '', filters = {}) {
  if (filters.source) return { source: String(filters.source), query: String(query) };
  const nq = ` ${normalize(query)} `;
  for (const [source, aliases] of SOURCE_ALIASES) {
    for (const alias of aliases) {
      const na = normalize(alias);
      if (!nq.includes(` ${na} `)) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stripped = String(query)
        .replace(new RegExp(`(?:only\\s+from|from|on|من|على|في)?\\s*${escaped}`, 'ig'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { source, query: stripped };
    }
  }
  return { source: null, query: String(query) };
}

function correctTypos(query = '') {
  let q = String(query);
  const corrections = [];

  for (const entry of [...termEntries].sort((a, b) => b.normalized.length - a.normalized.length)) {
    const escaped = entry.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-zA-Z0-9\\u0600-\\u06ff])${escaped}($|[^a-zA-Z0-9\\u0600-\\u06ff])`, 'i');
    if (!re.test(q) || normalize(entry.alias) === normalize(entry.canonical)) continue;
    q = q.replace(re, (_m, before, after) => `${before}${entry.canonical}${after}`);
    corrections.push({ from: entry.alias, to: entry.canonical, confidence: 1, type: 'alias' });
  }

  const tokens = q.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const token = normalize(raw);
    if (!token || token.length < 4 || FILLER.has(token) || /^\d+$/.test(token)) continue;
    let best = null;
    let second = 0;
    for (const entry of termEntries) {
      if (entry.normalized.includes(' ') || !sameScript(token, entry.normalized)) continue;
      const score = similarity(token, entry.normalized);
      if (!best || score > best.score) {
        second = best?.score || 0;
        best = { ...entry, score };
      } else if (score > second) {
        second = score;
      }
    }
    if (best && best.score >= 0.74 && best.score - second >= 0.08 && best.normalized !== token) {
      tokens[i] = best.canonical;
      corrections.push({ from: raw, to: best.canonical, confidence: Number(best.score.toFixed(2)), type: 'fuzzy' });
    }
  }

  q = tokens.join(' ').replace(/\s+/g, ' ').trim();
  return {
    query: q,
    corrections: [...new Map(corrections.map(item => [`${item.from}|${item.to}`, item])).values()]
  };
}

function hasVehicleIntent(query = '') {
  const tokens = normalize(query).split(' ').filter(Boolean).filter(token => !FILLER.has(token));
  return tokens.length > 0;
}

function prepare(body = {}) {
  const original = String(body.query || '');
  const sourceHit = detectSource(original, body.filters || {});
  const corrected = correctTypos(sourceHit.query);
  const sourceOnly = Boolean(sourceHit.source && !hasVehicleIntent(corrected.query));
  const filters = { ...(body.filters || {}) };
  delete filters.source;
  return {
    original,
    source: sourceHit.source,
    corrections: corrected.corrections,
    normalizedQuery: corrected.query,
    sourceOnly,
    body: { ...body, query: corrected.query, filters }
  };
}

async function upstream(path, options = {}) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${v27Port}${path}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(50000)
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 500) }; }
      last = { response, data };
      if (response.ok || ![502, 503, 504].includes(response.status)) return last;
    } catch (error) {
      last = { error };
      if (options.signal?.aborted) throw error;
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (last?.response) return last;
  throw last?.error || new Error('upstream unavailable');
}

function sourceMatches(car, source) {
  if (!source) return true;
  return normalize(car?.source || '') === normalize(source);
}

function postFilter(data = {}, source = null) {
  if (!Array.isArray(data.listings)) return data;
  const listings = source ? data.listings.filter(car => sourceMatches(car, source)) : data.listings;
  const counts = listings.reduce((acc, car) => {
    const key = car.source || 'Source';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    ...data,
    listings,
    counts,
    product: {
      ...(data.product || {}),
      verifiedListings: listings.length,
      verifiedPrices: listings.filter(car => car.priceVerified).length,
      verifiedImages: listings.filter(car => car.imageVerified).length,
      sources: Object.keys(counts).length
    }
  };
}

function mergeListings(groups = []) {
  const byUrl = new Map();
  for (const group of groups) {
    for (const car of group || []) {
      if (!car?.url) continue;
      const key = String(car.url).replace(/\/$/, '');
      if (!byUrl.has(key)) byUrl.set(key, car);
    }
  }
  return [...byUrl.values()];
}

async function runOneSearch(body) {
  const { response, data } = await upstream('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(body.phase === 'fast' ? 9000 : 48000)
  });
  if (!response.ok) return { response, data };
  return { response, data };
}

async function browseSource(prepared) {
  const phase = prepared.body.phase === 'full' ? 'full' : 'fast';
  const queries = phase === 'full' ? SOURCE_BROWSE_QUERIES : SOURCE_BROWSE_QUERIES.slice(0, 6);
  const results = await Promise.allSettled(queries.map(query =>
    runOneSearch({ ...prepared.body, query, phase: 'fast', filters: prepared.body.filters || {} })
  ));
  const successful = results
    .filter(result => result.status === 'fulfilled' && result.value.response.ok)
    .map(result => result.value.data);
  const listings = mergeListings(successful.map(item => item.listings)).filter(car => sourceMatches(car, prepared.source));
  const base = successful[0] || { listings: [], counts: {}, complete: true, phase: 'fast', partial: false };
  return {
    ...base,
    listings,
    complete: true,
    partial: false,
    phase,
    answer: `${listings.length} accessible verified ${prepared.source} listings found across a broad brand scan.`
  };
}

function patch(data = {}, meta = {}) {
  const understanding = data.understanding && typeof data.understanding === 'object'
    ? {
        ...data.understanding,
        query: meta.original || data.understanding.query,
        normalizedQuery: meta.normalizedQuery || data.understanding.normalizedQuery,
        source: meta.source || null,
        sourceOnly: Boolean(meta.sourceOnly),
        typoCorrections: meta.corrections || []
      }
    : {
        query: meta.original || '',
        normalizedQuery: meta.normalizedQuery || '',
        source: meta.source || null,
        sourceOnly: Boolean(meta.sourceOnly),
        typoCorrections: meta.corrections || []
      };
  return {
    ...data,
    understanding,
    sourceFilter: meta.source || null,
    typoCorrections: meta.corrections || [],
    smartSearchBar: true,
    sourceAwareSearch: true,
    sourceBrowse: true,
    universalTypoCorrection: true,
    similarOfferings: true,
    vehicleHistoryIntegration: true,
    product: { ...(data.product || {}), version: 'v29' }
  };
}

app.post('/api/search', async (req, res) => {
  const prepared = prepare(req.body || {});
  try {
    let data;
    if (prepared.sourceOnly) {
      data = await browseSource(prepared);
    } else {
      const result = await runOneSearch(prepared.body);
      if (!result.response.ok) return res.status(result.response.status).json(result.data);
      data = postFilter(result.data, prepared.source);
    }
    const output = patch(data, prepared);
    if (output.searchId && !prepared.sourceOnly) searchMeta.set(output.searchId, { ...prepared, at: Date.now() });
    return res.json(output);
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Smart search unavailable' });
  }
});

app.get('/api/search/progress/:id', async (req, res) => {
  try {
    const { response, data } = await upstream(`/api/search/progress/${encodeURIComponent(req.params.id)}`, {
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) return res.status(response.status).json(data);
    const meta = searchMeta.get(req.params.id) || {};
    return res.json(patch(postFilter(data, meta.source), meta));
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Search progress unavailable' });
  }
});

app.post('/api/understand', async (req, res) => {
  const prepared = prepare(req.body || {});
  if (prepared.sourceOnly) {
    return res.json(patch({ ok: true, understanding: {} }, prepared));
  }
  try {
    const { response, data } = await upstream('/api/understand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(prepared.body),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return res.status(response.status).json(data);
    return res.json(patch(data, prepared));
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Understanding unavailable' });
  }
});

app.post('/api/similar', async (req, res) => {
  const understanding = req.body?.understanding || {};
  const condition = req.body?.condition === 'new' ? 'new' : 'used';
  const exclude = new Set((req.body?.excludeUrls || []).map(String));
  const source = String(req.body?.source || '').trim() || null;
  const make = understanding.make || understanding.brand;
  if (!make) return res.json({ listings: [], similar: true });
  const query = [make, understanding.model].filter(Boolean).join(' ');
  try {
    const result = await runOneSearch({ query, condition, filters: {}, phase: 'fast' });
    if (!result.response.ok) return res.status(result.response.status).json(result.data);
    let listings = (result.data.listings || []).filter(car => !exclude.has(String(car.url)));
    if (source) listings = listings.filter(car => sourceMatches(car, source));
    const refYear = Number(req.body?.year || 0);
    const refPrice = Number(req.body?.price || 0);
    const score = car => {
      let value = 0;
      if (understanding.model && normalize(`${car.title || ''} ${car.url || ''}`).includes(normalize(understanding.model))) value += 100;
      if (refYear && car.year) value -= Math.abs(refYear - Number(car.year)) * 4;
      if (refPrice && car.price) value -= Math.min(25, Math.abs(refPrice - Number(car.price)) / Math.max(refPrice, 1) * 30);
      return value;
    };
    listings.sort((a, b) => score(b) - score(a));
    return res.json({ listings: listings.slice(0, 8), query, source, similar: true });
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Similar offerings unavailable' });
  }
});

app.get('/api/history-providers', (_req, res) => {
  res.json({
    providers: HISTORY_PROVIDERS,
    mode: 'external_provider_links',
    note: 'Delilah does not fabricate vehicle history. Reports are requested directly from the provider using VIN or serial details.'
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    const { response, data } = await upstream('/api/health', { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error('health');
    return res.json({
      ...data,
      edge: 'product-v29',
      logic: 'smart-search-source-fuzzy-similar-history-v29',
      smartSearchBar: true,
      sourceAwareSearch: true,
      sourceBrowse: true,
      universalTypoCorrection: true,
      similarOfferings: true,
      vehicleHistoryIntegration: true
    });
  } catch {
    return res.status(503).json({ ok: false, edge: 'product-v29' });
  }
});

app.get('/', async (_req, res) => {
  try {
    const response = await fetch(`http://127.0.0.1:${v27Port}/`, { signal: AbortSignal.timeout(10000) });
    const html = await response.text();
    res.setHeader('cache-control', 'no-store');
    return res.type('html').send(html.replace('</body>', '<script src="/hotfix-v28.js"></script></body>'));
  } catch {
    return res.status(502).send('Delilah frontend unavailable');
  }
});

async function proxy(req, res) {
  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (['host', 'content-length', 'connection'].includes(key.toLowerCase()) || value == null) continue;
      headers[key] = Array.isArray(value) ? value.join(',') : String(value);
    }
    let body;
    if (!['GET', 'HEAD'].includes(req.method) && req.is('application/json')) {
      body = JSON.stringify(req.body || {});
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`http://127.0.0.1:${v27Port}${req.originalUrl}`, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(50000)
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    for (const [key, value] of response.headers.entries()) {
      if (!['content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) res.setHeader(key, value);
    }
    return res.status(response.status).send(buffer);
  } catch {
    return res.status(502).json({ error: 'Delilah upstream unavailable' });
  }
}

app.use(proxy);

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of searchMeta) if (now - value.at > 60 * 60_000) searchMeta.delete(key);
}, 10 * 60_000).unref();

app.listen(externalPort, () => console.log(`Delilah smart product-v29 running at http://localhost:${externalPort}`));
