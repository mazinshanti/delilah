import express from 'express';
import {sellerStoreStatus,createSellerSubmission,sellerStoreReady,findSellerSubmission} from './saudi-seller-store.js';
import {validateSellerInput} from './seller-validation.js';
import {prepareSellerPhotos} from './seller-photos.js';
export function installSellerRoutes(app,{status=sellerStoreStatus,ready=sellerStoreReady,create=createSellerSubmission,find=findSellerSubmission}={}){
 const router=express.Router(),clients=new Map();
 router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');const origin=req.get('origin');if(origin&&!['https://www.dalelah.co','https://dalelah.co','https://delilah-pm5f.onrender.com','https://dalelah-mobile-preview.onrender.com'].includes(origin)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return res.status(403).json({error:'origin-not-allowed'});if(req.method==='POST'){const key=req.ip,now=Date.now(),old=clients.get(key);const row=old&&now-old.at<600000?old:{at:now,n:0};if(++row.n>15)return res.status(429).json({error:'too-many-submissions'});clients.set(key,row);if(clients.size>5000)for(const[k,v]of clients)if(now-v.at>600000)clients.delete(k);}next();});
 router.get('/status',async(_req,res)=>{const s=status();let writable=false;if(s.writable){try{await ready();writable=true;}catch{}}res.json({available:writable,reason:writable?null:s.reason||'storage-unavailable',maxPhotos:10,maxPhotoBytes:2000000});});
 router.post('/submit',express.json({limit:'12mb'}),async(req,res)=>{
  const validation=validateSellerInput(req.body||{});if(!validation.ok)return res.status(400).json({error:'invalid-submission',fields:validation.errors});
  const s=status();if(!s.writable)return res.status(503).json({error:'seller-submissions-not-open',reason:s.reason});
  let photos;try{photos=await prepareSellerPhotos(validation.value.photos);}catch{return res.status(400).json({error:'invalid-photos',fields:['photos']});}
  try{const r=await create({...validation.value,photos});res.status(201).json({ok:true,submissionId:r.id,status:r.status,createdAt:r.created_at,reference:r.public_token,photoCount:r.photo_count??photos.length});}catch{res.status(503).json({error:'seller-storage-unavailable'});}
 });
 router.post('/reference',express.json({limit:'2kb'}),async(req,res)=>{const ref=req.body?.reference;if(typeof ref!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(ref))return res.status(400).json({error:'invalid-reference'});try{const r=await find(ref);if(!r)return res.status(404).json({error:'not-found'});res.json({status:r.status,createdAt:r.created_at,photoCount:r.photo_count});}catch{res.status(503).json({error:'seller-storage-unavailable'});}});
 router.use((err,req,res,next)=>res.status(err.status===413?413:400).json({error:err.status===413?'request-too-large':'invalid-request'}));
 app.use('/api/sell',router);
}
