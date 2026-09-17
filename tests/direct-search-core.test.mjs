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

test('direct core accepts common Saudi Corolla spelling variants',()=>{
  const input=[
    {source:'Haraj',title:'كورلا 2026 2.0',url:'https://example.com/korla',year:2026,condition:'new',sourceCondition:'new'},
    {source:'Haraj',title:'كوريلا 2026 سعودي',url:'https://example.com/korela',year:2026,condition:'new',sourceCondition:'new'},
    {source:'Haraj',title:'كامري 2026',url:'https://example.com/camry',year:2026,condition:'new',sourceCondition:'new'}
  ];
  const out=strictDirectListings(input,{query:'Toyota Corolla 2026',condition:'new',filters:{}});
  assert.deepEqual(out.map(x=>x.url).sort(),['https://example.com/korela','https://example.com/korla']);
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

test('direct core rejects accessories, parts, wanted ads and service listings',()=>{
  const input=[
    {source:'Haraj',title:'تويوتا كورولا 2013',url:'https://example.com/car',year:2013,condition:'used'},
    {source:'Haraj',title:'عداد كورولا 2013',url:'https://example.com/odometer',year:2013,condition:'used'},
    {source:'Haraj',title:'مسجل تويوتا كورولا 2013 الأصلي وكالة',url:'https://example.com/stereo',year:2013,condition:'used'},
    {source:'Haraj',title:'مطلوب كورولا 2013',url:'https://example.com/wanted',year:2013,condition:'used'},
    {source:'Haraj',title:'صيانة كورولا 2013',url:'https://example.com/service',year:2013,condition:'used'},
    {source:'Haraj',title:'مساعدات بنتلي فلاينج سبير 2020',url:'https://example.com/suspension',year:2020,condition:'used'},
    {source:'Haraj',title:'بودي كت بنتلي مولسان تعديل الى 2020 مع التركيب',url:'https://example.com/body-kit',year:2020,condition:'used'},
    {source:'Haraj',title:'تخصص لي قطع الغيار السيارات بنتلي 2020',url:'https://example.com/spare-parts',year:2020,condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'Toyota Corolla 2013',condition:'used',filters:{}});
  assert.deepEqual(out.map(x=>x.url),['https://example.com/car']);
});

test('vehicle descriptions may mention mileage or mechanical condition',()=>{
  const input=[
    {source:'Haraj',title:'كورولا 2013 للبيع ممشى 220 ألف مكينة وقير على الشرط',url:'https://example.com/full-car',year:2013,condition:'used'},
    {source:'Haraj',title:'كورولا 2013 كفرات جديدة',url:'https://example.com/car-new-tires',year:2013,condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'Toyota Corolla 2013',condition:'used',filters:{}});
  assert.equal(out.length,2);
});

test('Bentley results reject suspension, body-kit and spare-parts ads',()=>{
  const input=[
    {source:'Haraj',title:'بنتلي بنتايجا 2020 نظيف جدا',url:'https://example.com/bentley-car',year:2020,condition:'used'},
    {source:'Haraj',title:'مساعدات بنتلي فلاينج سبير 2020',url:'https://example.com/suspension',year:2020,condition:'used'},
    {source:'Haraj',title:'بودي كت بنتلي مولسان تعديل الى 2020 مع التركيب',url:'https://example.com/body-kit',year:2020,condition:'used'},
    {source:'Haraj',title:'تخصص لي قطع الغيار السيارات بنتلي 2020',url:'https://example.com/spare-parts',year:2020,condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'Bentley 2020',condition:'used',filters:{}});
  assert.deepEqual(out.map(x=>x.url),['https://example.com/bentley-car']);
});

test('misspelled Bentley search keeps cars and rejects unrelated products',()=>{
  const input=[
    {source:'Haraj',title:'بنتلي بنتايجا 2021 BENTLY V8',url:'https://example.com/bentley-car',year:2021,condition:'used'},
    {source:'Haraj',title:'عوده بنتلي فوحان وثبات بيور',url:'https://example.com/perfume',condition:'used'},
    {source:'Haraj',title:'ساعة بنتلي bently جديدة',url:'https://example.com/watch',condition:'used'},
    {source:'Haraj',title:'حساب ببجي نادر للبيع',url:'https://example.com/game',condition:'used'},
    {source:'Haraj',title:'كت تحويل بنتلي بنتياقا',url:'https://example.com/kit',condition:'used'}
  ];
  const out=strictDirectListings(input,{query:'bently',condition:'used',filters:{}});
  assert.deepEqual(out.map(x=>x.url),['https://example.com/bentley-car']);
});
