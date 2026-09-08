import assert from 'node:assert/strict';

const base = String(process.env.DELILAH_URL || 'https://delilah-pm5f.onrender.com').replace(/\/$/, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(url, options = {}) {
  const r = await fetch(url, {...options, signal: AbortSignal.timeout(35_000)});
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {error: text.slice(0, 300)}; }
  assert.ok(r.ok, `${url} returned HTTP ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

const health = await json(`${base}/api/health`);
assert.equal(typeof health, 'object', 'health response must be JSON');
assert.ok(!health.error, `health returned an error: ${health.error}`);

const first = await json(`${base}/api/search`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({query: 'Toyota Corolla 2013', condition: 'used', filters: {}})
});

assert.equal(first.exactYearIntent, 2013, `production did not enforce exact-year intent: ${JSON.stringify({exactYearIntent:first.exactYearIntent, edge:health.edge})}`);

let latest = first;
if (first.searchId && first.complete !== true && first.marketScanComplete !== true) {
  for (let i = 0; i < 12; i++) {
    await sleep(i === 0 ? 800 : 1500);
    latest = await json(`${base}/api/search/progress/${encodeURIComponent(first.searchId)}`);
    if (latest.complete === true || latest.marketScanComplete === true) break;
  }
}

const listings = Array.isArray(latest.listings) ? latest.listings : [];
const wrong = listings.filter(car => Number(car?.year) !== 2013);
assert.equal(wrong.length, 0, `exact-year leakage detected: ${JSON.stringify(wrong.slice(0, 5).map(x => ({title:x.title, year:x.year, source:x.source, url:x.url})))}`);

console.log(JSON.stringify({
  ok: true,
  healthEdge: health.edge || null,
  exactYearIntent: latest.exactYearIntent || first.exactYearIntent,
  listings: listings.length,
  sources: Object.keys(latest.counts || {}).length,
  complete: latest.complete ?? latest.marketScanComplete ?? null
}, null, 2));
