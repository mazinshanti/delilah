import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryCoverageSummary} from '../lib/inventory-coverage.js';

const now=Date.parse('2026-11-02T12:00:00Z');
const sources=[
 {id:'haraj',name:'Haraj',status:'connected-live'},
 {id:'syarah',name:'Syarah',status:'connected-index'},
 {id:'partner',name:'Partner Motors',status:'authorized-feed'}
];
const car=(source,id,extra={})=>({
 source,url:'https://example.com/'+id,condition:'used',price:100000,priceVerified:true,
 image:'https://example.com/1.jpg',lastSeenAt:'2026-11-02T11:00:00Z',...extra
});
test('reports per-source evidence, missing sources and freshness without claiming all Saudi inventory',()=>{
 const records=[
  car('Haraj','a'),
  car('Haraj','b',{lastSeenAt:'2026-09-01T11:00:00Z',image:null,priceVerified:false}),
  car('Syarah','c'),
  car('Syarah','sold',{availability:'sold'}),
  car('Other Dealer','d',{price:null,priceVerified:false})
 ];
 const result=inventoryCoverageSummary(records,{sources,now,generatedAt:'2026-09-23'});
 assert.equal(result.marketExhaustive,false);
 assert.equal(result.marketCoveragePct,null);
 assert.equal(result.indexedUrlCount,4);
 assert.equal(result.freshUrlCount,3);
 assert.equal(result.observedSources,3);
 const haraj=result.representedSources.find(x=>x.name==='Haraj');
 assert.equal(haraj.indexedUrlCount,2);
 assert.equal(haraj.freshUrlCount,1);
 assert.equal(haraj.askingPriceEvidencePct,50);
 assert.equal(haraj.photoCoveragePct,50);
 assert.equal(result.representedSources.find(x=>x.name==='Partner Motors').indexedUrlCount,0);
 assert.equal(result.representedSources.find(x=>x.name==='Other Dealer').connectionStatus,'unregistered-inventory-source');
});

test('inactive and unsupported records are not counted and there is no fake 100 percent coverage',()=>{
 const result=inventoryCoverageSummary([
  car('Haraj','dead',{availability:'removed'}),
  car('Haraj','bad',{url:null})
 ],{sources,now});
 assert.equal(result.indexedUrlCount,0);
 assert.equal(result.representedSources[0].askingPriceEvidencePct,null);
 assert.equal(result.marketCoveragePct,null);
});
