import test from 'node:test';
import assert from 'node:assert/strict';
import {searchDirectFirst} from '../lib/direct-search.js';

test('live Haraj search checks localized and original-language queries, deduplicating listings',async()=>{
 const originalFetch=globalThis.fetch;
 const seen=[];
 globalThis.fetch=async url=>{
  seen.push(String(url));
  const isArabic=decodeURIComponent(String(url)).includes('تويوتا');
  const id=isArabic?'11188360059':'11188360060';
  const title=isArabic?'تويوتا كورولا 2013':'Toyota Corolla 2013';
  const html='<div><a href="/'+id+'/">'+title+'</a><p>الرياض 24,998</p></div>';
  return {ok:true,url:String(url),text:async()=>html};
 };
 try{
  const result=await searchDirectFirst({query:'Toyota Corolla 2013',condition:'used',filters:{seller:'Haraj'}},{timeoutMs:1800});
  assert.equal(seen.length,2);
  assert.ok(seen.some(url=>decodeURIComponent(url).includes('تويوتا')));
  assert.ok(seen.some(url=>decodeURIComponent(url).includes('Toyota')));
  assert.equal(result.sources[0].name,'Haraj');
  assert.equal(result.sources[0].variants.length,2);
  assert.equal(result.errors.length,0);
  assert.deepEqual(result.listings.map(car=>car.url).sort(),[
   'https://haraj.com.sa/11188360059',
   'https://haraj.com.sa/11188360060'
  ]);
 }finally{globalThis.fetch=originalFetch}
});

test('Arabic-only query does not double-fetch the same Haraj term',async()=>{
 const originalFetch=globalThis.fetch;
 let count=0;
 globalThis.fetch=async url=>{
  count++;
  return {ok:true,url:String(url),text:async()=>'<div><a href="/11188360059/">تويوتا كورولا 2013</a><p>الرياض</p></div>'};
 };
 try{
  const result=await searchDirectFirst({query:'تويوتا كورولا 2013',condition:'used',filters:{seller:'Haraj'}},{timeoutMs:1800});
  assert.equal(count,1);
  assert.equal(result.sources[0].variants.length,1);
 }finally{globalThis.fetch=originalFetch}
});
