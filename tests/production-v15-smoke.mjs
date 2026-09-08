import assert from 'node:assert/strict';

const base = String(process.env.DELILAH_URL || 'https://delilah-pm5f.onrender.com').replace(/\/$/, '');
const expectedCommit = String(process.env.EXPECTED_GIT_COMMIT || '').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(url, options = {}) {
  const r = await fetch(url, {...options, signal: AbortSignal.timeout(35_000), headers:{...(options.headers||{}),'cache-control':'no-cache'}});
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {error: text.slice(0, 300)}; }
  assert.ok(r.ok, `${url} returned HTTP ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

const health = await json(`${base}/api/health`);
assert.equal(typeof health, 'object', 'health response must be JSON');
assert.ok(!health.error, `health returned an error: ${health.error}`);
assert.equal(health.productVersion, '1.5', `unexpected product version: ${JSON.stringify(health)}`);
assert.equal(health.restartSafeSearchIds, true, `restart-safe search IDs are not enabled: ${JSON.stringify(health)}`);
assert.equal(health.motoryNativeCatalog, true, `Motory native catalogue is not enabled: ${JSON.stringify(health)}`);
if (expectedCommit) assert.equal(health.renderGitCommit, expectedCommit, `production is not running the commit under test: expected ${expectedCommit}, got ${health.renderGitCommit}`);

function diagnostics(query, first, latest, listings) {
  return {
    query,
    searchId:first.searchId||null,
    firstListings:Array.isArray(first.listings)?first.listings.length:null,
    latestListings:listings.length,
    counts:latest.counts||{},
    complete:latest.complete??latest.marketScanComplete??null,
    exactYearIntent:latest.exactYearIntent??first.exactYearIntent??null,
    searchRecoveryCount:latest.searchRecoveryCount??null,
    searchStateReconstructed:Boolean(latest.searchStateReconstructed),
    motoryNativeCatalog:latest.motoryNativeCatalog??first.motoryNativeCatalog??null,
    motoryNativeComplete:latest.motoryNativeComplete??first.motoryNativeComplete??null,
    motoryNativeListings:latest.motoryNativeListings??first.motoryNativeListings??null,
    motoryNativeError:latest.motoryNativeError??first.motoryNativeError??null,
    indexedFallbackComplete:latest.indexedFallbackComplete??null,
    indexedFallbackDiagnostics:latest.indexedFallbackDiagnostics??null,
    recoveryFanout:latest.recoveryFanout??null,
    sample:listings.slice(0,3).map(x=>({source:x.source,title:x.title,year:x.year,url:x.url}))
  };
}

async function exactYearCase({query, year, requireResults = true}) {
  const first = await json(`${base}/api/search`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({query, condition: 'used', filters: {}})
  });

  assert.equal(first.exactYearIntent, year, `${query}: production did not enforce exact-year intent: ${JSON.stringify({exactYearIntent:first.exactYearIntent, edge:health.edge, renderGitCommit:health.renderGitCommit})}`);
  if (first.searchId) assert.ok(String(first.searchId).startsWith('d15.'), `${query}: production did not emit a restart-safe Dalelah 1.5 search ID: ${first.searchId}`);

  let latest = first;
  if (first.searchId && first.complete !== true && first.marketScanComplete !== true) {
    let lastProgressError = null;
    for (let i = 0; i < 16; i++) {
      await sleep(i === 0 ? 800 : 1500);
      try {
        latest = await json(`${base}/api/search/progress/${encodeURIComponent(first.searchId)}`);
        lastProgressError = null;
      } catch (error) {
        lastProgressError = error;
        if (!/HTTP 404:.*Search expired/i.test(String(error?.message || ''))) throw error;
        if (i < 3) continue;
        throw error;
      }
      if (latest.complete === true || latest.marketScanComplete === true) break;
    }
    if (lastProgressError) throw lastProgressError;
  }

  const listings = Array.isArray(latest.listings) ? latest.listings : [];
  const diag=diagnostics(query,first,latest,listings);
  console.log('CASE_DIAGNOSTIC '+JSON.stringify(diag));
  const wrong = listings.filter(car => Number(car?.year) !== year);
  assert.equal(wrong.length, 0, `${query}: exact-year leakage detected: ${JSON.stringify({...diag,wrong:wrong.slice(0,5).map(x=>({title:x.title,year:x.year,source:x.source,url:x.url}))})}`);
  if (requireResults) assert.ok(listings.length > 0, `${query}: no verified ${year} listings were returned from the live Saudi-market scan: ${JSON.stringify(diag)}`);

  return {
    query,
    year,
    listings:listings.length,
    sources:Object.keys(latest.counts || {}).length,
    sourceCounts:latest.counts || {},
    complete:latest.complete ?? latest.marketScanComplete ?? null,
    searchRecoveryCount:latest.searchRecoveryCount ?? null,
    reconstructed:Boolean(latest.searchStateReconstructed),
    motoryNativeListings:latest.motoryNativeListings??null
  };
}

const cases = [
  {query:'Toyota Corolla 2013', year:2013, requireResults:true},
  {query:'Nissan Patrol 2020', year:2020, requireResults:true},
  {query:'Jeep Wrangler 2021', year:2021, requireResults:true},
  {query:'كورولا ٢٠١٣', year:2013, requireResults:true}
];

const results=[];
for (const c of cases) results.push(await exactYearCase(c));

console.log(JSON.stringify({
  ok:true,
  healthEdge:health.edge || null,
  renderGitCommit:health.renderGitCommit || null,
  cases:results
}, null, 2));
