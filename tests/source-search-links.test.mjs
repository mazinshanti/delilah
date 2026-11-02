import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {externalSearchLinks} from '../public/source-search-links.js';
import {originalMarketSearchTargets} from '../lib/source-search-targets.js';

test('exposes only real supported source searches and preserves exact query path',()=>{
 const output=externalSearchLinks([
  {name:'Haraj',url:'https://haraj.com.sa/search/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7%20%D9%83%D9%88%D8%B1%D9%88%D9%84%D8%A7/'},
  {name:'OpenSooq',url:'https://sa.opensooq.com/en/cars/cars-for-sale/toyota/corolla'},
  {name:'Haraj',url:'https://haraj.com.sa/search/duplicate/'}
 ]);
 assert.deepEqual(output.map(x=>x.name),['Haraj','OpenSooq']);
 assert.match(output[0].url,/haraj\.com\.sa\/search\//);
 assert.match(output[1].url,/corolla/);
});

test('rejects spoofed brands, hostile domains, ad detail and unsafe URL protocols',()=>{
 const output=externalSearchLinks([
  {name:'Haraj',url:'https://haraj.com.sa.evil.test/search/corolla'},
  {name:'Haraj',url:'javascript:alert(1)'},
  {name:'OpenSooq',url:'https://sa.opensooq.com.evil.test/en/cars/cars-for-sale'},
  {name:'Haraj',url:'https://haraj.com.sa/11181921992'},
  {name:'Other',url:'https://www.example.com/search'},
  {name:'OpenSooq',url:'https://sa.opensooq.com/en/cars/cars-for-sale/toyota/corolla'}
 ]);
 assert.equal(output.length,1);
 assert.equal(output[0].name,'OpenSooq');
});

test('UI offers original market continuation without claiming comprehensive search',async()=>{
 const ui=await readFile(new URL('../public/market-ui.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/id="sourceSearchLinks"/);
 assert.match(ui,/externalSearchLinks\(lastResponse\.directCoreSources/);
 assert.match(ui,/Not seeing every car\?/);
 assert.match(ui,/noopener noreferrer/);
});

test('known model links are generated without HTTP requests or inventory claims',()=>{
 const opts=originalMarketSearchTargets({query:'Toyota Corolla 2013',condition:'used',filters:{}});
 assert.deepEqual(opts.map(x=>x.name),['Haraj','OpenSooq']);
 assert.ok(opts[0].url.startsWith('https://haraj.com.sa/search/'));
 assert.match(decodeURIComponent(opts[0].url),/كورولا 2013/);
 assert.ok(opts[1].url.startsWith('https://sa.opensooq.com/'));
 assert.ok(opts[1].url.includes('/toyota/corolla/2013'));
 assert.deepEqual(originalMarketSearchTargets({query:'Toyota Corolla',condition:'new'}),[]);
 assert.deepEqual(originalMarketSearchTargets({query:'family SUV',condition:'used'}),[]);
});
test('source filter limits browsing options to requested marketplace',()=>{
 const opts=originalMarketSearchTargets({query:'Nissan Patrol',condition:'used',filters:{seller:'OpenSooq'}});
 assert.deepEqual(opts.map(x=>x.name),['OpenSooq']);
 assert.deepEqual(originalMarketSearchTargets({query:'Nissan Patrol',condition:'used',filters:{seller:'Syarah'}}),[]);
});
