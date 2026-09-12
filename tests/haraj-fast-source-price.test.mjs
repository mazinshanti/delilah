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
