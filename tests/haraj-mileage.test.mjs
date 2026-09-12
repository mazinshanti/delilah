import test from 'node:test';
import assert from 'node:assert/strict';
import {extractHarajMileage} from '../lib/haraj-mileage.js';

const cases=[
  ['كورولا 2013 ممشى 322 الف السعر 26000',322000,'haraj_text_mileage_label'],
  ['الممشى : 180,000 كم',180000,'haraj_text_mileage_label'],
  ['العداد 95.000 كيلو',95000,'haraj_text_mileage_label'],
  ['ماشي ١٢٠ ألف',120000,'haraj_text_mileage_label'],
  ['ماشية 87 الف كم',87000,'haraj_text_mileage_label'],
  ['ممشاها ٤٥٬٥٠٠',45500,'haraj_text_mileage_label'],
  ['السيارة نظيفة 73,000 km',73000,'haraj_text_distance_unit'],
  ['استخدام شخصي 65 ألف كم',65000,'haraj_text_distance_unit'],
  ['الممشى 1,250,000 كم',1250000,'haraj_text_mileage_label']
];

for(const [text,expected,source] of cases){
  test(`Haraj mileage: ${text}`,()=>{
    const result=extractHarajMileage(text,{year:2013});
    assert.ok(result);
    assert.equal(result.mileage,expected);
    assert.equal(result.source,source);
    assert.equal(result.confidence,'high');
  });
}

test('does not turn asking price into mileage',()=>{
  assert.equal(extractHarajMileage('السعر 120000 ريال',{year:2020}),null);
});

test('does not turn phone number into mileage',()=>{
  assert.equal(extractHarajMileage('للتواصل 0551234567',{year:2020}),null);
});

test('does not turn model year into mileage',()=>{
  assert.equal(extractHarajMileage('جيب رانجلر 2021 للبيع',{year:2021}),null);
});

test('does not accept implausible odometer amount',()=>{
  assert.equal(extractHarajMileage('الممشى 3500000 كم',{year:2018}),null);
});
