import test from 'node:test';
import assert from 'node:assert/strict';
import {exactYearIntent,enforceExactYear} from '../lib/search-intent.js';

test('bare English model year is exact',()=>{
  assert.equal(exactYearIntent('Toyota Corolla 2013'),2013);
  assert.equal(exactYearIntent('Wrangler 2021 Riyadh'),2021);
});

test('Arabic-Indic model year is exact',()=>{
  assert.equal(exactYearIntent('كورولا ٢٠١٣ الرياض'),2013);
});

test('range language is not treated as exact',()=>{
  assert.equal(exactYearIntent('Corolla from 2013'),null);
  assert.equal(exactYearIntent('Corolla 2013+'),null);
  assert.equal(exactYearIntent('Corolla 2013 and newer'),null);
  assert.equal(exactYearIntent('Corolla 2013 to 2015'),null);
  assert.equal(exactYearIntent('كورولا من 2013'),null);
  assert.equal(exactYearIntent('كورولا 2013 فما فوق'),null);
});

test('exact-year enforcement rejects wrong and unknown years',()=>{
  const cars=[
    {title:'Corolla 2013',year:2013},
    {title:'Corolla 2015',year:2015},
    {title:'Corolla unknown',year:null},
    {title:'Corolla string year',year:'2013'}
  ];
  assert.deepEqual(enforceExactYear(cars,2013).map(x=>x.title),['Corolla 2013','Corolla string year']);
});
