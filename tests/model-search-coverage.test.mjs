import test from 'node:test';
import assert from 'node:assert/strict';
import {modelSearchPageUrls,mergeDirectListings,strictDirectListings} from '../lib/direct-search.js';

test('model search expands to separate bounded source pages',()=>{
 const urls=modelSearchPageUrls('https://sa.opensooq.com/en/cars/cars-for-sale/toyota/corolla',3);
 assert.deepEqual(urls,[
  'https://sa.opensooq.com/en/cars/cars-for-sale/toyota/corolla',
  'https://sa.opensooq.com/en/cars/cars-for-sale/toyota/corolla?page=2',
  'https://sa.opensooq.com/en/cars/cars-for-sale/toyota/corolla?page=3'
 ]);
 assert.equal(modelSearchPageUrls(urls[0],200).length,4);
});

test('repeated source listing URLs across pages are merged',()=>{
 const cars=mergeDirectListings([
 {url:'https://example.com/listing/1?utm_source=a',source:'OpenSooq',title:'Toyota Corolla'},
 {url:'https://example.com/listing/2',source:'OpenSooq',title:'Toyota Corolla'}
 ],[{url:'https://example.com/listing/1?utm_source=b',source:'OpenSooq',title:'Toyota Corolla'}]);
 assert.equal(cars.length,2);
});

test('model results exclude a different model even if the make is the same',()=>{
 const cars=[
 {url:'https://example.com/listing/1',source:'Test',title:'Toyota Corolla 2022',make:'Toyota',model:'Corolla',year:2022,condition:'used'},
 {url:'https://example.com/listing/2',source:'Test',title:'Toyota Camry 2022',make:'Toyota',model:'Camry',year:2022,condition:'used'}
 ];
 const result=strictDirectListings(cars,{query:'Toyota Corolla',condition:'all'});
 assert.equal(result.length,1);
 assert.equal(result[0].model,'Corolla');
});
