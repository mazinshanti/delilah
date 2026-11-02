import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHarajFastPage,fetchHarajModelBreadth,harajModelQueryVariants} from '../lib/haraj-fast-source.js';

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


test('can retain more than the default 24 Haraj results for a named model',()=>{
  const html=Array.from({length:36},(_,i)=>card(
    String(11188360100+i),'تويوتا كورولا 2013','الرياض 24,998'
  )).join('');
  const capped=parseHarajFastPage(html,base,{query:'Toyota Corolla 2013',filters:{}});
  const expanded=parseHarajFastPage(html,base,{query:'Toyota Corolla 2013',filters:{},limit:120});
  assert.equal(capped.length,24);
  assert.equal(expanded.length,36);
  assert.equal(new Set(expanded.map(x=>x.url)).size,36);
});

test('model breadth creates a canonical and a model-only Arabic query',()=>{
  assert.deepEqual(harajModelQueryVariants('Jeep Wrangler 2021'),['جيب رانجلر 2021','رانجلر 2021']);
  assert.equal(harajModelQueryVariants('Toyota Corolla').length,2);
});

test('model breadth deduplicates two bounded source-query variants',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    const second=decodeURIComponent(String(url)).includes('/search/كورولا/');
    const html=second
      ? card('11188360501','تويوتا كورولا 2013','الرياض 25,000')+card('11188360502','كورولا 2014','الرياض 28,000')
      : card('11188360501','تويوتا كورولا 2013','الرياض 25,000');
    return {ok:true,url:String(url),text:async()=>html};
  };
  try {
    const result=await fetchHarajModelBreadth({query:'Toyota Corolla',delayMs:0,timeout:1200});
    assert.equal(result.queriesAttempted,2);
    assert.equal(result.queriesSucceeded,2);
    assert.equal(result.listings.length,2);
    assert.equal(calls.length,2);
  } finally {globalThis.fetch=original;}
});

test('model breadth stops after source denies access',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));return {ok:false,status:429};};
  try {
    const result=await fetchHarajModelBreadth({query:'Toyota Corolla',delayMs:0,timeout:1200});
    assert.equal(result.queriesAttempted,1);
    assert.equal(calls.length,1);
    assert.match(result.error,/429/);
  } finally {globalThis.fetch=original;}
});
