import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHarajFastPage} from '../lib/haraj-fast-source.js';

const base='https://haraj.com.sa/search/test/';

function card(id,title,meta){
  return `<div class="post"><a href="/${id}/${encodeURIComponent(title)}/">${title}</a><div>${meta}</div></div>`;
}

test('imports formatted Haraj card price',()=>{
  const html=card('11188360059','تويوتا كورولا 2013','الرياض أمس عضو 4 24,998');
  const xs=parseHarajFastPage(html,base,{query:'Toyota Corolla 2013',filters:{}});
  assert.equal(xs.length,1);
  assert.equal(xs[0].price,24998);
  assert.equal(xs[0].priceVerified,true);
  assert.equal(xs[0].priceSource,'haraj_search_card_formatted_price');
});

test('rejects odometer/parts listing with matching car model',()=>{
  const html=card('11131911111','عداد نيسان باترول 2020-2024 اصلي NISSAN وكاله','الرياض 5,500');
  const xs=parseHarajFastPage(html,base,{query:'Nissan Patrol 2020',filters:{}});
  assert.equal(xs.length,0);
});

test('exact-year fast lane rejects a year range',()=>{
  const html=card('11131911112','نيسان باترول 2020-2024','الرياض 138,000');
  const xs=parseHarajFastPage(html,base,{query:'Nissan Patrol 2020',filters:{}});
  assert.equal(xs.length,0);
});

test('maxPrice uses verified Haraj price',()=>{
  const html=card('11188360060','تويوتا كورولا 2013','الرياض 24,998');
  const under=parseHarajFastPage(html,base,{query:'Toyota Corolla 2013',filters:{maxPrice:25000}});
  const over=parseHarajFastPage(html,base,{query:'Toyota Corolla 2013',filters:{maxPrice:20000}});
  assert.equal(under.length,1);
  assert.equal(over.length,0);
});


test('specific-model search can retain more matching ads from one response without extra page requests',()=>{
 const valid=Array.from({length:48},(_,i)=>card(
   String(11188361000+i),'تويوتا كورولا 2018','جدة 49,900'
 ));
 const irrelevant=[card('11188361990','BMW X5 2018','الرياض 95,000'),
  card('11188361991','عداد كورولا اصلي','الرياض 5,000')];
 const html=[...valid.slice(0,24),...irrelevant,...valid.slice(24),
  valid[0]].join('');
 const old=parseHarajFastPage(html,base,{query:'Toyota Corolla 2018',filters:{}});
 const expanded=parseHarajFastPage(html,base,{query:'Toyota Corolla 2018',filters:{},limit:120});
 assert.equal(old.length,24);
 assert.equal(expanded.length,48);
 assert.equal(new Set(expanded.map(x=>x.url)).size,48);
 assert.ok(expanded.every(x=>x.year===2018));
 assert.ok(expanded.every(x=>x.source==='Haraj'));
});

test('higher per-page cap cannot exceed 120 or bypass an exact year constraint',()=>{
 const html=Array.from({length:135},(_,i)=>card(String(11188362000+i),
  i%2?'تويوتا كورولا 2016':'تويوتا كورولا 2018','جدة 49,900')).join('');
 const out=parseHarajFastPage(html,base,{query:'Toyota Corolla 2018',limit:9999,filters:{}});
 assert.equal(out.length,68);
 assert.ok(out.every(x=>x.year===2018));
});
