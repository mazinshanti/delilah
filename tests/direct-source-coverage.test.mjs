import test from 'node:test';
import assert from 'node:assert/strict';
import {searchDirectFirst} from '../lib/direct-search.js';

test('first response queries both marketplaces even when Haraj has a valid match',async t=>{
 const called=[];
 t.mock.method(globalThis,'fetch',async url=>{
  called.push(new URL(url).hostname);
  const html=String(url).includes('haraj.com.sa')
   ? '<a href="https://haraj.com.sa/123456789/toyota">تويوتا كامري 2023 للبيع</a><p>الممشى 40000 كم السعر 90000 ريال الرياض</p>'
   : '<script type="application/ld+json">'+JSON.stringify({'@type':'ItemList',itemListElement:[{item:{'@type':'Vehicle',name:'Toyota Camry 2023',url:'https://sa.opensooq.com/en/search/123456789',description:'Used Toyota Camry for sale, mileage 40000 km',itemCondition:'https://schema.org/UsedCondition',offers:{price:90000}}}]})+'</script>';
  return new Response(html,{status:200});
 });
 const result=await searchDirectFirst({query:'Toyota Camry 2023',condition:'used'});
 assert.deepEqual(new Set(called),new Set(['haraj.com.sa','sa.opensooq.com']));
 assert.ok(result.listings.some(c=>c.source==='Haraj'));
 assert.ok(result.listings.some(c=>c.source==='OpenSooq'));
});

test('explicit source filter does not fetch other marketplaces',async t=>{
 const called=[];
 t.mock.method(globalThis,'fetch',async url=>{called.push(new URL(url).hostname);return new Response('',{status:200});});
 await searchDirectFirst({query:'Toyota',condition:'used',filters:{seller:'OpenSooq'}});
 assert.deepEqual(called,['sa.opensooq.com']);
});

test('one unavailable marketplace does not discard the other source response',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).includes('haraj.com.sa'))throw new Error('source unavailable');
  return new Response('',{status:200});
 });
 const result=await searchDirectFirst({query:'Toyota',condition:'used'});
 assert.equal(result.sources.length,2);
 assert.match(result.errors[0],/Haraj: source unavailable/);
 assert.equal(result.sources.find(s=>s.name==='OpenSooq').error,null);
});
