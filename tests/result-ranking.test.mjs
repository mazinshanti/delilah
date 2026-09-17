import test from 'node:test';
import assert from 'node:assert/strict';
import {rankListings} from '../lib/result-ranking.js';
import {imageUrls} from '../public/vehicle-media.js';

test('mixed-source ranking follows relevance and quality, not source blocks',()=>{
 const now=new Date().toISOString();
 const cars=[
  {source:'Haraj',make:'Toyota',model:'Land Cruiser',year:2023,condition:'used',title:'Toyota Land Cruiser 2023',price:210000,priceVerified:true,lastSeenAt:now},
  {source:'Syarah',make:'Toyota',model:'Land Cruiser',year:2023,condition:'used',title:'Toyota Land Cruiser 2023',price:215000,priceVerified:true,mileage:20000,city:'Riyadh',image:'https://img.example/full.jpg',imageVerified:true,trim:'GXR',lastSeenAt:now},
  {source:'CarSwitch Saudi',make:'Toyota',model:'Camry',year:2023,condition:'used',title:'Toyota Camry 2023',price:90000,priceVerified:true,image:'https://img.example/camry.jpg',imageVerified:true,lastSeenAt:now}
 ];
 const ranked=rankListings(cars,{query:'Toyota Land Cruiser 2023',condition:'used'});
 assert.equal(ranked[0].source,'Syarah');
 assert.equal(ranked.at(-1).model,'Camry');
 assert.ok(ranked.every(x=>Number.isFinite(x.relevanceScore)));
});

test('original image variants rank before thumbnails without upscaling URLs',()=>{
 const thumb='https://cdn.example/car-thumb-160x120.jpg';
 const original='https://cdn.example/car-original-1600x1200.jpg';
 assert.deepEqual(imageUrls(thumb,original),[original,thumb]);
 assert.equal(imageUrls(thumb)[0],thumb);
});
