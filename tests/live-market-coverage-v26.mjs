import assert from 'node:assert/strict';

const base = process.env.DALELAH_URL || process.env.DELILAH_URL || 'http://127.0.0.1:3000';
const post = async (query, condition='used', filters={}) => {
  const r = await fetch(`${base}/api/search`, {
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({query,condition,filters}), signal:AbortSignal.timeout(120000)
  });
  const d = await r.json();
  assert.equal(r.ok, true, `${query}: ${d.error || r.status}`);
  return d;
};

const corolla = await post('Toyota Corolla 2013');
assert.equal(corolla.exactYear, 2013, 'bare year must be exact');
assert.ok(corolla.listings.length >= 10, `suspiciously low Corolla 2013 recall: ${corolla.listings.length}`);
assert.ok(Object.keys(corolla.counts || {}).length >= 2, `expected multiple Saudi sources: ${JSON.stringify(corolla.counts)}`);
assert.equal(corolla.listings.filter(x => x.year && Number(x.year) !== 2013).length, 0, 'wrong-year Corolla leaked into exact-year search');
assert.equal(corolla.listings.filter(x => /قطع|تشليح|مكينة|مكينه|قير فقط|باب|صدام|رفرف|مراي|ايرباق|airbag|spare parts?/i.test(`${x.title||''} ${x.snippet||''}`)).length, 0, 'parts ads leaked into vehicle search');

const arabic = await post('تويوتا كورولا ٢٠١٣');
assert.equal(arabic.exactYear, 2013);
assert.equal(arabic.listings.filter(x => x.year && Number(x.year) !== 2013).length, 0);

const patrol = await post('Patrol under 170k in Riyadh');
assert.equal(patrol.listings.filter(x => x.price && Number(x.price) > 170000).length, 0, 'price ceiling leaked');
assert.equal(patrol.listings.filter(x => x.city && String(x.city).toLowerCase() !== 'riyadh').length, 0, 'city filter leaked');

const cx5 = await post('Mazda CX-5 2022');
assert.equal(cx5.listings.filter(x => /\bcx[ -]?50\b/i.test(`${x.model||''} ${x.title||''}`)).length, 0, 'CX-50 leaked into CX-5 search');

console.log('PASS live market coverage v26', {
  corolla2013: corolla.listings.length,
  corollaSources: corolla.counts,
  arabicCorolla2013: arabic.listings.length,
  patrol: patrol.listings.length,
  cx5: cx5.listings.length
});
