import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransport} from '../lib/on-demand/transport.mjs';
const url='https://buy.kayishha.com/cars/details/toyota-corolla-2024-92699';
test('transport shares a bounded dispatcher and forces manual redirects',async()=>{
 const seen=[],t=createTransport({fetchImpl:async(u,o)=>{seen.push(o);return new Response('vehicle');}});
 try{await t.get(url);await t.get(url);assert.equal(seen.length,2);assert.equal(seen[0].dispatcher,seen[1].dispatcher);assert.equal(seen[0].redirect,'manual');assert.equal(t.stats.length,2);}finally{await t.close();}
});
test('redirects preserve host, exact ad identity, and robots permission',async()=>{
 for(const [location,error]of [['https://evil.test/a','unsupported-target'],[url.replace('92699','92700'),'different-ad-redirect'],['/blocked','different-ad-redirect']]){
 let calls=0;const t=createTransport({fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location}});}});
 try{await assert.rejects(t.get(url),new RegExp(error));assert.equal(calls,1);}finally{await t.close();}
 }
 let calls=0;const t=createTransport({fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'/blocked'}});}});
 try{await assert.rejects(t.get('https://buy.kayishha.com/',{permit:u=>!u.endsWith('/blocked')}),/robots-disallowed/);assert.equal(calls,1);}finally{await t.close();}
});
test('decoded response byte cap rejects oversized bodies; HTTP blocks are not retried',async()=>{
 for(const [response,error]of [[new Response('x'.repeat(4000001)),'response-too-large'],[new Response('blocked',{status:403}),'http-403'],[new Response('slow down',{status:429}),'http-429']]){
 let calls=0;const t=createTransport({fetchImpl:async()=>{calls++;return response;}});
 try{await assert.rejects(t.get(url),new RegExp(error));assert.equal(calls,1);}finally{await t.close();}
 }
});
test('deadline covers response body and releases the concurrency slot',async()=>{
 let calls=0;const t=createTransport({requestMs:25,maxConcurrent:1,fetchImpl:async(_u,{signal})=>{
 calls++;if(calls>1)return new Response('ok');
 return new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true});}}));
 }});
 const keepAlive=setTimeout(()=>{},1000);
 try{await assert.rejects(t.get(url),/deadline/);assert.equal((await t.get(url)).text,'ok');}finally{clearTimeout(keepAlive);await t.close();}
});
test('per-host concurrency stays bounded and cancellation does not reuse another request signal',async()=>{
 let active=0,peak=0;const t=createTransport({maxConcurrent:3,maxPerHost:1,fetchImpl:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return new Response('ok');}});
 try{await Promise.all([t.get(url),t.get(url+'?a'),t.get(url+'?b')]);assert.equal(peak,1);const controller=new AbortController();controller.abort();await assert.rejects(t.get(url,{signal:controller.signal}),/deadline/);}finally{await t.close();}
});
