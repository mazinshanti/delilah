import test from 'node:test';
import assert from 'node:assert/strict';
import {extractHarajPrice} from '../lib/haraj-price.js';

const cases=[
  ['تويوتا كورولا موديل 2013 ممشى 322 الف السعر 26000',26000,'haraj_text_price_label','high'],
  ['من الآخر السعر :25000 . سبب البيع',25000,'haraj_text_price_label','high'],
  ['العداد:300 الف السعر:21.000 — جير مكينه',21000,'haraj_text_price_label','high'],
  ['السيارة جاهزة للاستخدام السعر : 29,000 ريال للتواصل',29000,'haraj_text_price_label','high'],
  ['السعر ٢٦٬٠٠٠ ريال',26000,'haraj_text_price_label','high'],
  ['السعر ٣٧ ألف ريال',37000,'haraj_text_price_label','high'],
  ['ابغى في السياره 19 الف لكن ابغى الفلوس',19000,'haraj_text_asking_phrase','high'],
  ['المطلوب 125 ألف',125000,'haraj_text_price_label','high'],
  ['السعر النهائي 1,250,000 ريال',1250000,'haraj_text_price_label','high'],
  ['للبيع 84,500 ريال فقط',84500,'haraj_text_currency_amount','high'],
  ['الرياض أمس عضو 4 24,998',24998,'haraj_search_card_formatted_price','medium-high'],
  ['خميس مشيط قبل 15 ساعة عضو 3 38,000',38000,'haraj_search_card_formatted_price','medium-high']
];

for(const [text,expected,source,confidence] of cases){
  test(`Haraj price: ${text}`,()=>{
    const hit=extractHarajPrice(text,{year:2013});
    assert.ok(hit);
    assert.equal(hit.price,expected);
    assert.equal(hit.source,source);
    assert.equal(hit.confidence,confidence);
  });
}

test('does not turn plain mileage into price',()=>{
  assert.equal(extractHarajPrice('كورولا 2013 الممشى 322000 كم',{year:2013}),null);
});

test('does not turn formatted mileage into card price',()=>{
  assert.equal(extractHarajPrice('كورولا 2013 الممشى 300,000 كم',{year:2013}),null);
});

test('does not turn phone number into price',()=>{
  assert.equal(extractHarajPrice('للتواصل 0561013738',{year:2013}),null);
});

test('does not import open-ended price text',()=>{
  assert.equal(extractHarajPrice('السعر على السوم والجاد يتواصل',{year:2020}),null);
});
