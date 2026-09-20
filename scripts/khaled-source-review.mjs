// Bounded public-source evidence test; no inventory writes or AI calls.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {reviewKhaledOffer,khaledOfferIdentity} from '../lib/khaled-offer-review.js';
import {robotsPolicy} from '../lib/robots-policy.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/khaled-source-review.mjs urls.json report.json');
const urls=JSON.parse(await fs.readFile(input,'utf8'));
if(!Array.isArray(urls)||urls.length>6||!urls.length||urls.some(u=>!khaledOfferIdentity(u)))throw Error('Expected 1–6 Khaled detail URLs');
const transport=process.env.DALELAH_REVIEW_CURL==='1'?(await import('./support/curl-fetch.mjs')).curlFetch:fetch;
const headers={'User-Agent':'Dalelah/1.5 (+https://www.dalelah.co; source-review)'};
async function read(url){
 const response=await transport(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers});
 if(response.status!==200){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>5_000_000)throw Error('source-too-large');chunks.push(Buffer.from(chunk));}
 return {body:Buffer.concat(chunks),contentType:response.headers.get('content-type')||''};
}
const start=performance.now(),results=[];
const robots=await read('https://khaledcars.com/robots.txt');
if(/<html/i.test(robots.body.toString()))throw Error('invalid-robots-response');
const wait=async url=>{const p=robotsPolicy(robots.body.toString(),url);if(!p.allowed)throw Error('robots-disallowed');if(p.delayMs>30000)throw Error('source-delay-exceeds-budget');await new Promise(r=>setTimeout(r,p.delayMs));};
let paused=false;const imageSamples=new Map();
for(const url of [...new Set(urls)]){
 const began=performance.now();let result;
 try{
  if(paused)throw Error('source-paused');await wait(url);const page=await read(url);
  if(!/text\/html/i.test(page.contentType))throw Error('non-html-response');
  result=reviewKhaledOffer({url,html:page.body.toString()});
  const image=result.offer?.images[0];
  if(image){
   if(imageSamples.has(image))result.imageSample={...imageSamples.get(image),cacheHit:true};
   else{try{await wait(image);const media=await read(image);const metadata=await sharp(media.body).metadata();result.imageSample={url:image,status:'decoded',width:metadata.width,height:metadata.height,format:metadata.format};imageSamples.set(image,result.imageSample);}catch(e){result.imageSample={url:image,status:e.message};if(/HTTP (401|403|429)/.test(e.message))paused=true;}}
  }
 }catch(e){result={status:e.message,offer:null,acceptedVehicles:0};if(/HTTP (401|403|429)/.test(e.message))paused=true;}
 results.push({url,...result,totalMs:Math.round(performance.now()-began)});
 console.log(JSON.stringify({url,status:result.status,images:result.offer?.images.length||0,imageSample:result.imageSample,totalMs:results.at(-1).totalMs}));
 await fs.writeFile(output+'.tmp',JSON.stringify({mode:'dealer-offer-evidence-review',acceptedVehicles:0,coverageComplete:false,totalMs:Math.round(performance.now()-start),results},null,2));await fs.rename(output+'.tmp',output);
}
