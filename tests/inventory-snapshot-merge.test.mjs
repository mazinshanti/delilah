import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeInventorySnapshot} from '../lib/inventory-snapshot-merge.js';

const t='2026-11-02T12:00:00.000Z';
const listing=(source,id,model='Corolla',extras={})=>({
  source, sourceCategory:'cars for sale',condition:'used',
  url:'https://example.com/ad/'+id, title:'Toyota '+model+' 2021 for sale',
  make:'Toyota',model,year:2021,price:75000,priceVerified:true,...extras
});

test('incremental source refresh adds cars and preserves inventory from other sources',()=>{
  const original={generatedAt:'2026-10-30T00:00:00Z',listings:[
    listing('Syarah','old-a'),listing('Haraj','old-b')
  ]};
  const {snapshot,report}=mergeInventorySnapshot(original,{
    source:'Haraj',scannedAt:t,listings:[listing('Haraj','new-c')]
  });
  assert.equal(snapshot.listings.length,3);
  assert.ok(snapshot.listings.some(x=>x.source==='Syarah'));
  assert.ok(snapshot.listings.some(x=>x.url==='https://example.com/ad/old-b'));
  assert.equal(report.added,1);
  assert.equal(report.original,2);
});

test('refresh updates an existing canonical URL without creating a duplicate',()=>{
  const old=listing('Haraj','car?utm_source=older');
  old.firstSeenAt='2026-10-01T00:00:00Z';
  const {snapshot,report}=mergeInventorySnapshot({listings:[old]},{
    source:'Haraj',scannedAt:t,listings:[listing('Haraj','car?utm_source=newer')]
  });
  assert.equal(snapshot.listings.length,1);
  assert.equal(report.updated,1);
  assert.equal(snapshot.listings[0].firstSeenAt,'2026-10-01T00:00:00Z');
});

test('vehicle-quality boundary rejects unrelated advertisements and mislabeled sources',()=>{
  const rows=[
    listing('Haraj','accepted'),
    listing('Haraj','parts','Corolla',{title:'عداد تويوتا كورولا 2021 للبيع'}),
    listing('Other','wrong-source')
  ];
  const {report}=mergeInventorySnapshot({}, {source:'Haraj',scannedAt:t,listings:rows});
  assert.equal(report.added,1);
  assert.equal(report.rejected,2);
});

test('unknown new price clears a previously verified asking price',()=>{
  const old=listing('Haraj','price');
  const next=listing('Haraj','price','Corolla',{price:null,priceVerified:false});
  const {snapshot}=mergeInventorySnapshot({listings:[old]}, {source:'Haraj',scannedAt:t,listings:[next]});
  assert.equal(snapshot.listings[0].price,null);
  assert.equal(snapshot.listings[0].priceVerified,false);
  assert.equal(snapshot.listings[0].priceSource,null);
});


test('an empty partial scan cannot delete existing inventory',()=>{
  const base={listings:[listing('Haraj','one')]};
  const {report,snapshot}=mergeInventorySnapshot(base,{source:'Haraj',scannedAt:t,listings:[]});
  assert.equal(report.total,1);
  assert.equal(snapshot.listings.length,1);
});

test('retains verified gallery images through a lightweight listing refresh',()=>{
  const img='https://images.example.com/corolla.jpg';
  const previous=listing('Haraj','gallery','Corolla',{image:img,images:[img]});
  const next=listing('Haraj','gallery','Corolla',{image:null,images:[]});
  const {snapshot}=mergeInventorySnapshot({listings:[previous]},{
    source:'Haraj',scannedAt:t,listings:[next]
  });
  const row=snapshot.listings[0];
  assert.equal(row.image,img);
  assert.equal(row.primary_image,img);
  assert.deepEqual(row.gallery_images,[img]);
  assert.equal(row.media.primaryImage,img);
});
