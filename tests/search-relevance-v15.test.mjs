import test from 'node:test';
import assert from 'node:assert/strict';
import {detectRequestedBrand,filterBrandRelevance,listingMatchesBrand} from '../lib/search-relevance.js';

test('detects Bentley in English and Arabic',()=>{
  assert.equal(detectRequestedBrand('Bentley'),'Bentley');
  assert.equal(detectRequestedBrand('بنتلي'),'Bentley');
});

test('Bentley search rejects unrelated BMW inventory',()=>{
  const listings=[
    {brand:'Bentley',title:'Continental GT 2022',url:'https://example.com/bentley/1'},
    {brand:'BMW',title:'BMW X5 2022',url:'https://example.com/bmw/2'}
  ];
  const out=filterBrandRelevance(listings,'Bentley');
  assert.equal(out.length,1);
  assert.equal(out[0].brand,'Bentley');
});

test('brand evidence may come from make, title or URL',()=>{
  assert.equal(listingMatchesBrand({make:'Bentley',title:'Continental GT'},'Bentley'),true);
  assert.equal(listingMatchesBrand({title:'بنتلي بنتايجا 2021'},'Bentley'),true);
  assert.equal(listingMatchesBrand({title:'Continental GT',url:'https://cars.example/bentley/continental-gt'},'Bentley'),true);
  assert.equal(listingMatchesBrand({brand:'BMW',title:'X7'},'Bentley'),false);
});

test('queries without a recognized brand do not suppress inventory',()=>{
  const listings=[{brand:'BMW'},{brand:'Bentley'}];
  assert.deepEqual(filterBrandRelevance(listings,'SUV under 200000'),listings);
});

test('Toyota request rejects Lexus',()=>{
  const listings=[{brand:'Toyota',title:'Toyota Corolla 2019'},{brand:'Lexus',title:'Lexus ES 2019'}];
  assert.deepEqual(filterBrandRelevance(listings,'Toyota Corolla 2019').map(x=>x.brand),['Toyota']);
});
