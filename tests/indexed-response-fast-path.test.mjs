import test from 'node:test';
import assert from 'node:assert/strict';
import {initialOrMergedResults} from '../lib/indexed-response-fast-path.js';
import {InventoryIndex} from '../lib/inventory-index.js';
import {applyIntentConstraints} from '../lib/ai-search-intent.js';

const car=(id,make,model,price,extra={})=>({
 source:'Haraj',sourceCategory:'cars for sale',url:'https://haraj.com.sa/'+id,
 title:make+' '+model+' 2022 for sale',make,model,year:2022,
 condition:'used',price,priceVerified:price!=null, ...extra
});
test('already verified filtered index rows are served by identity before source calls finish',()=>{
 const index=new InventoryIndex();
 index.replace({generatedAt:'2026-09-23T00:00:00Z',listings:[
  car('11188361001','Toyota','Fortuner',145000),
  car('11188361002','Toyota','Camry',80000),
  car('11188361003','BMW','X5',120000),
  car('11188361004','Toyota','Prado',200000),
  car('11188361005','Toyota','Fortuner',null),
 ]});
 const body={query:'__all_cars__',condition:'used',filters:{maxPrice:150000}};
 const indexed=index.searchTrustedOriginBody(body,{makes:['Toyota','Lexus','Nissan'],bodyType:'SUV'});
 let merges=0;
 const output=initialOrMergedResults({indexedListings:indexed,recentBufferReused:0},[],[],()=>{
  merges++;throw Error('unnecessary merge');
 });
 assert.equal(output,indexed);
 assert.equal(merges,0);
 assert.equal(output.length,1);
 const final=applyIntentConstraints(output,{originPreference:'Japanese',bodyType:'SUV',maxPrice:150000,condition:'used'});
 assert.equal(final.length,1);
 assert.equal(final[0].priceVerified,true);
 assert.ok(final[0].price>0&&final[0].price<=150000);
});

test('live results always force the strict source merge',()=>{
 const initial=[car('11188361006','Toyota','Fortuner',140000)];
 const next=[car('11188361007','Toyota','Fortuner',135000)];
 let calls=0;
 const out=initialOrMergedResults({indexedListings:initial,recentBufferReused:0},next,[],(h,l,d)=>{
  calls++;assert.equal(h,initial);assert.equal(l,next);assert.deepEqual(d,[]);return [...h,...l];
 });
 assert.equal(calls,1);
 assert.equal(out.length,2);
});
test('temporary cross-query results also force revalidation before returning',()=>{
 const indexed=[car('11188361008','Toyota','Fortuner',120000)];
 assert.deepEqual(initialOrMergedResults({indexedListings:indexed,recentBufferReused:1},[],[],
  ()=>['revalidated']),['revalidated']);
 assert.deepEqual(initialOrMergedResults({indexedListings:indexed,recentBufferReused:0},[],[
  car('11188361009','Toyota','Fortuner',130000)
 ],()=>['deep-merged']),['deep-merged']);
});
