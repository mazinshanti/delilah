import express from 'express';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {installOnDemandRoutes} from './routes.js';
import {SAUDI_MARKET_SEARCH_TARGETS} from '../saudi-market-search-plan.js';
import {allSources} from './study.mjs';
const publicDir=fileURLToPath(new URL('../../public/',import.meta.url));
const login=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دليلة — تجربة البحث</title><body><main><h1>دليلة — تجربة البحث</h1><p>معاينة خاصة / Private preview</p><form method="post" action="/preview/login"><label>رمز الدخول / Access code <input name="token" type="password" required autocomplete="current-password"></label><button>دخول / Open</button></form></main></body></html>`;
export function createPreviewApp({env=process.env,intentEngine,service}={}){
 const app=express(),sessions=new Map();const secret=env.DALELAH_ON_DEMAND_TOKEN||'';
 if(secret.length<32)throw Error('preview-token-required');
 const equal=value=>{const a=Buffer.from(value||''),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);};
 const cookieName=env.NODE_ENV==='production'?'__Host-dalelah-preview':'dalelah-preview';
 const session=req=>{const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);return (sessions.get(value)||0)>Date.now();};
 app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
 app.use((_req,res,next)=>{res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});next();});
 app.get('/health',(_req,res)=>res.json({ok:true,preview:true,commit:env.RENDER_GIT_COMMIT||null,node:process.version,mode:env.DALELAH_ON_DEMAND_PROVIDER,adapterCount:allSources.length,configured:{brave:Boolean(env.BRAVE_SEARCH_API_KEY||env.BRAVE_API_KEY),openai:Boolean(env.OPENAI_API_KEY),tavily:Boolean(env.TAVILY_API_KEY)}}));
 app.get('/preview/login',(_req,res)=>res.type('html').send(login));
 let attempts=0,windowAt=Date.now();
 app.post('/preview/login',express.urlencoded({extended:false,limit:'1kb'}),(req,res)=>{
  if(Date.now()-windowAt>60000){windowAt=Date.now();attempts=0;}
  if(++attempts>30)return res.status(429).send('Please retry in a minute.');
  if(typeof req.body.token!=='string'||!equal(req.body.token))return res.status(401).type('html').send(login);
  for(const [k,expiry]of sessions)if(expiry<=Date.now())sessions.delete(k);
  if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
  const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+3600000);
  res.cookie(cookieName,id,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'strict',maxAge:3600000,path:'/'}).redirect(303,'/');
 });
 app.use((req,res,next)=>{
  if(session(req)||equal((req.get('authorization')||'').replace(/^Bearer /,'')))return next();
  if(req.path.startsWith('/api/'))return res.status(401).json({error:'unauthorized'});
  return res.redirect('/preview/login');
 });
 app.use((req,_res,next)=>{
  if(req.path==='/api/search')req.url='/api/search/on-demand';
  else if(req.path.startsWith('/api/search/progress/'))req.url=req.url.replace('/api/search/progress/','/api/search/on-demand/');
  next();
 });
 const active=installOnDemandRoutes(app,{env,intentEngine,service,authorizeSession:session});
 app.get('/api/inventory',(_req,res)=>res.json({listings:[],partial:true}));
 app.get('/api/inventory/stats',(_req,res)=>res.json({byCity:{}}));
 app.get('/api/sources',(_req,res)=>res.json({scope:'preview-source-directory',sources:SAUDI_MARKET_SEARCH_TARGETS.map(s=>({id:s.id,name:s.name,url:s.url,status:allSources.includes(s.name)?'adapter-ready':s.status,enabledForOnDemand:allSources.includes(s.name),liveVerified:false,reason:s.evidence}))}));
 app.get('/api/sell/status',(_req,res)=>res.json({available:false}));
 app.get('/api/listing/gallery',(_req,res)=>res.json({images:[]}));
 app.get('/',(_req,res)=>res.type('html').send(readFileSync(publicDir+'/index.html','utf8').replace('<head>','<head><script>window.__DALELAH_ON_DEMAND_PREVIEW__=true;</script>')));
 app.use(express.static(publicDir,{index:false,etag:false,lastModified:false}));
 return {app,service:active};
}
