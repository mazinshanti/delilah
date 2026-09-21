import test from 'node:test';import assert from 'node:assert/strict';
import {runSearch,candidatePriority} from '../lib/on-demand/core.mjs';import {emptyIntent} from '../lib/ai-search-intent.js';
const intent={...emptyIntent(),make:'Toyota',model:'Corolla',condition:'used',confidence:1};
test('small detail budgets check recognized matches before unknown cards',async()=>{
 const unknown={source:'Kayishha',url:'https://buy.kayishha.com/cars/details/unknown-12345',title:'Vehicle offer'},known={source:'Kayishha',url:'https://buy.kayishha.com/cars/details/toyota-corolla-2024-12346',title:'Toyota Corolla 2024'};
 const checked=[];await runSearch(intent,{discover:async(i,o)=>o.onBatch([unknown,known]),verify:async c=>{checked.push(c.url);return [];},maxDetails:1});assert.deepEqual(checked,[known.url]);assert.ok(candidatePriority(known,intent)>candidatePriority(unknown,intent));
});
test('candidate ranking does not admit a wrong make or manufacture evidence',async()=>{
 const checked=[];const result=await runSearch(intent,{discover:async(i,o)=>o.onBatch([{source:'Kayishha',url:'https://buy.kayishha.com/cars/details/honda-accord-12345',title:'Honda Accord 2024'}]),verify:async c=>{checked.push(c);return [];}});assert.equal(checked.length,0);assert.equal(result.matches.length,0);
});
