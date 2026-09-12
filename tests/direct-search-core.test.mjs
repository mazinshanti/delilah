import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeDirectListings,strictDirectListings} from '../lib/direct-search.js';

test('direct core rejects cross-brand progressive contamination',()=>{
  const input=[
    {source:'OpenSooq',title:'Bentley Continental GT 2020',url:'https://example.com/bentley',year:2020,condition:'used'},
    {source:'OpenSooq',title:'BMW X6 2020',url:'https://example.com/bmw',year:2020,condition:'used'},
    {source:'Haraj',title:'بنتلي كونتيننتال 2020',url:'https://example.com/bentley-ar',year:2020,condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'Bentley 2020',condition:'used',filters:{}});
  assert.equal(out.length,2);
  assert.ok(out.every(x=>/bentley|بنتلي/i.test(`${x.title} ${x.url}`)));
});

test('direct core keeps model-only Haraj titles when there is no conflicting brand',()=>{
  const input=[
    {source:'Haraj',title:'باترول 2020 بلاتينيوم',url:'https://example.com/patrol',year:2020,condition:'used'},
    {source:'Haraj',title:'تويوتا باترول 2020',url:'https://example.com/fake-conflict',year:2020,condition:'used'},
    {source:'Haraj',title:'BMW X6 2020',url:'https://example.com/bmw',year:2020,condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'Nissan Patrol 2020',condition:'used',filters:{}});
  assert.equal(out.length,1);
  assert.equal(out[0].url,'https://example.com/patrol');
});

test('direct core preserves exact-year protection',()=>{
  const input=[
    {source:'Haraj',title:'تويوتا كورولا 2013',url:'https://example.com/c13',year:2013,condition:'used'},
    {source:'Haraj',title:'تويوتا كورولا 2015',url:'https://example.com/c15',year:2015,condition:'used'},
    {source:'Haraj',title:'تويوتا كورولا للبيع',url:'https://example.com/cu',year:null,condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'Toyota Corolla 2013',condition:'used',filters:{}});
  assert.deepEqual(out.map(x=>x.year),[2013]);
});

test('direct core enforces new/used separation and verified price filters',()=>{
  const input=[
    {source:'Saleh Cars',title:'Toyota Corolla 2026',url:'https://example.com/new',year:2026,condition:'new',price:76000,priceVerified:true},
    {source:'Market',title:'Toyota Corolla 2026 used',url:'https://example.com/used',year:2026,condition:'used',price:70000,priceVerified:true},
    {source:'Market',title:'Toyota Corolla 2026',url:'https://example.com/unverified',year:2026,condition:'new',price:50000,priceVerified:false}
  ];
  const out=strictDirectListings(input,{query:'Toyota Corolla 2026',condition:'new',filters:{maxPrice:80000}});
  assert.equal(out.length,1);
  assert.equal(out[0].url,'https://example.com/new');
});

test('direct merge deduplicates canonical URLs and preserves richer fields',()=>{
  const out=mergeDirectListings(
    [{source:'Haraj',title:'Corolla',url:'https://example.com/car?utm_source=x',image:null,price:null}],
    [{source:'Haraj',title:'Corolla',url:'https://example.com/car',image:'https://img.example/car.jpg',price:22000}]
  );
  assert.equal(out.length,1);
  assert.equal(out[0].image,'https://img.example/car.jpg');
  assert.equal(out[0].price,22000);
});
