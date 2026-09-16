import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import sharp from 'sharp';
import {PGlite} from '@electric-sql/pglite';
import {VEHICLE_CATALOG,catalogIntent,catalogMake,catalogModelMatches} from '../public/catalog.js';
import {naturalSearch} from '../public/natural-search.js';
import {strictDirectListings} from '../lib/direct-search.js';
import {extractListingGallery,eligibleGalleryUrl} from '../lib/listing-gallery.js';
import {vehicleImages} from '../public/vehicle-media.js';
import {prepareSellerPhotos} from '../lib/seller-photos.js';
import {validateSellerInput} from '../lib/seller-validation.js';
import {createSellerSubmission,SELLER_SCHEMA,sellerStoreStatus} from '../lib/saudi-seller-store.js';
import {installSellerRoutes} from '../lib/seller-routes.js';

test('every catalog make and model recognizes its own canonical name',()=>{
 const errors=[];for(const make of VEHICLE_CATALOG.makes){assert.equal(catalogMake(make.name)?.name,make.name);for(const model of make.models){const intent=catalogIntent(make.name+' '+model.name);if(intent.make!==make.name||intent.model!==model.name)errors.push({query:make.name+' '+model.name,intent});}}
 assert.deepEqual(errors,[]);
});
test('Pontiac G8 2009 never substitutes a Chevrolet or another Pontiac',()=>{
 const intent=catalogIntent('Pontiac G8 2009');assert.equal(intent.modelKey,'Pontiac::G8');assert.equal(catalogIntent('بونتياك G8 ٢٠٠٩').modelKey,intent.modelKey);
 assert.equal(catalogModelMatches({make:'Chevrolet',model:'G8',title:'Chevrolet G8'},intent.modelKey),false);
 assert.equal(catalogModelMatches({make:'Pontiac',model:'G6',title:'Pontiac G6'},intent.modelKey),false);
 assert.deepEqual(strictDirectListings([{make:'Chevrolet',model:'Impala',year:2009,title:'Chevrolet Impala 2009',condition:'used',url:'https://example.com/car'}],{query:'Pontiac G8 2009',condition:'used'}),[]);
});
test('strict relevance accepts a catalog vehicle for each of the 100 makes',()=>{
 for(const make of VEHICLE_CATALOG.makes){const model=make.models[0].name;const car={make:make.name,brand:make.name,model,title:make.name+' '+model+' 2020',year:2020,yearVerified:true,condition:'used',listingVerified:true,saleVerified:true,url:'https://example.com/test-fixture'};assert.equal(strictDirectListings([car],{query:car.title,condition:'used'}).length,1,car.title);assert.equal(strictDirectListings([car],{query:car.title,condition:'new'}).length,0);}
});
test('natural language extracts explicit constraints and retains unknown model words',()=>{
 assert.deepEqual(naturalSearch('أبغى كورولا ٢٠١٣ مستعملة في الرياض أقل من ٣٠ ألف'),{query:'كورولا 2013',condition:'used',filters:{maxPrice:30000,city:'Riyadh'}});
 assert.deepEqual(naturalSearch('Find me a Toyota Imaginary 2013 under 30k in Jeddah').filters,{maxPrice:30000,city:'Jeddah'});
 assert.match(naturalSearch('Toyota Imaginary 2013 under 30k').query,/Imaginary/);
});
test('gallery preserves source order, safe URLs, single-image compatibility and original Haraj paths',()=>{
 const one='https://mimg6cdn.haraj.com.sa/userfiles30/2026-09-16/1200x1600_example.jpg',two=one.replace('1200x1600','1350x1800');
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',url:'https://haraj.com.sa/11188701805/',image:[one,two,one,'javascript:bad']})+'</script>';
 assert.deepEqual(extractListingGallery(html,'https://haraj.com.sa/11188701805/'),[one,two]);assert.deepEqual(vehicleImages({image:one}),[one]);assert.deepEqual(vehicleImages({images:[{url:two},one],image:one}),[two,one]);
 assert.equal(eligibleGalleryUrl('https://haraj.com.sa.evil.test/11188701805/'),false);assert.equal(eligibleGalleryUrl('http://127.0.0.1/11188701805/'),false);
 assert.deepEqual(extractListingGallery(html,'https://haraj.com.sa/11188701806/'),[]);
});
const input=()=>({sellerName:'Integration test',sellerPhone:'٠٥٠١٢٣٤٥٦٧',make:'Toyota',model:'Camry',year:2020,mileageKm:45000,city:'Riyadh',askingPriceSar:50000,consent:true,requestId:crypto.randomUUID()});
test('seller validation rejects injection types, malformed numbers, invalid contact and absent consent',()=>{
 assert.equal(validateSellerInput(input()).value.sellerPhone,'+966501234567');for(const bad of [{year:'2020 OR 1=1'},{sellerPhone:'123'},{sellerName:{}},{consent:'true'},{photos:Array(11).fill({})},{askingPriceSar:-1}])assert.equal(validateSellerInput({...input(),...bad}).ok,false);
 assert.equal(sellerStoreStatus({SAUDI_DATABASE_URL:'postgres://example',DALELAH_DATA_REGION:'frankfurt'}).writable,false);
});
test('seller photos are decoded, deduplicated, resized and stripped of metadata',async()=>{
 const data=await sharp({create:{width:2100,height:1200,channels:3,background:'#123456'}}).jpeg().withMetadata().toBuffer();const photo={data:'data:image/jpeg;base64,'+data.toString('base64')};const result=await prepareSellerPhotos([photo,photo]);assert.equal(result.length,1);const meta=await sharp(result[0].data).metadata();assert.equal(meta.width,1800);assert.equal(meta.exif,undefined);assert.equal(meta.format,'webp');
 await assert.rejects(prepareSellerPhotos([{data:'data:image/svg+xml;base64,PHN2Zz4='}]));await assert.rejects(prepareSellerPhotos([{data:'data:image/jpeg;base64,aGVsbG8='}]));
});
test('seller HTTP journey commits photos atomically, retries idempotently and rolls back failures',async()=>{
 const db=new PGlite();await db.exec(SELLER_SCHEMA);await db.exec(SELLER_SCHEMA);const pool={connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
 const app=express();installSellerRoutes(app,{status:()=>({writable:true}),ready:async()=>{},create:v=>createSellerSubmission(v,{pool})});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await(await fetch(base+'/api/sell/status')).json()).available,true);const image=await sharp({create:{width:32,height:32,channels:3,background:'red'}}).png().toBuffer();const body={...input(),photos:[{data:'data:image/png;base64,'+image.toString('base64')}]};
 const send=async(value,origin)=>fetch(base+'/api/sell/submit',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(value)});
 const first=await send(body);assert.equal(first.status,201);const a=await first.json();assert.equal(a.photoCount,1);assert.ok(a.reference);assert.equal(a.sellerPhone,undefined);
 const b=await(await send(body)).json();assert.equal(b.reference,a.reference);assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM dalelah_seller_submissions')).rows[0].n,1);
 assert.equal((await send({...body,sellerPhone:'invalid'})).status,400);assert.equal((await send(body,'https://evil.example')).status,403);
 assert.equal((await send({...body,photos:[{data:'data:image/jpeg;base64,aGVsbG8='}]})).status,400);
 await assert.rejects(createSellerSubmission({...input(),photos:[{data:'not-a-buffer'}]},{pool}));assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM dalelah_seller_submissions')).rows[0].n,1);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
