import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchText, detectRequestedBrand } from '../lib/search-relevance.js';
import { exactYearIntent } from '../lib/search-intent.js';
import { strictDirectListings, searchDirectFirst } from '../lib/direct-search.js';

test('Arabic and Persian digits are searchable as Western digits', () => {
  assert.equal(normalizeSearchText('كامري ٢٠٢٢'), 'كامري 2022');
  assert.equal(normalizeSearchText('كامري ۲۰۲۲'), 'كامري 2022');
  assert.equal(exactYearIntent('تويوتا كامري ۲۰۲۲'), 2022);
  assert.equal(detectRequestedBrand('تويوتا كامري ۲۰۲۲'), 'Toyota');
});

test('search intent does not force model-year matching for a year range', () => {
  assert.equal(exactYearIntent('كامري من ٢٠٢٠ إلى ٢٠٢٣'), null);
});

test('strict direct listing search retains both new and used when condition is all', () => {
  const cars = [
    { source:'Sample', listingId:'used-1', url:'https://cars.example/used-1', make:'Toyota', model:'Camry', year:2022, condition:'used', price:80000, title:'Toyota Camry 2022 used' },
    { source:'Sample', listingId:'new-1', url:'https://cars.example/new-1', make:'Toyota', model:'Camry', year:2025, condition:'new', price:110000, title:'Toyota Camry 2025 new' }
  ];
  const result = strictDirectListings(cars,{query:'Toyota Camry',condition:'all'});
  assert.equal(result.length,2);
});

test('a missing query does not dispatch external source requests', async () => {
  const result = await searchDirectFirst({query:'',condition:'all'});
  assert.deepEqual(result.listings,[]);
});
