// Read-only QA of collected image evidence; never upgrades a thumbnail URL by guessing.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {curlFetch} from './support/curl-fetch.mjs';
const input=JSON.parse(await readFile(process.argv[2],'utf8')),rows=input.listings||[];
const allowed=new Set(['img.mstaml.com','s3.eu-central-1.amazonaws.com','s3-eu-west-1.amazonaws.com','cache1.arabwheels.sa','cache2.arabwheels.sa','cache3.arabwheels.sa','cache4.arabwheels.sa']);
const output=[];let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<rows.length){const c=rows[next++],row={source:c.source,url:c.url,image:c.image,success:false};try{
 const u=new URL(c.image);if(u.protocol!=='https:'||u.username||u.password||!allowed.has(u.hostname))throw Error('unrecognized-image-host');
 const response=await curlFetch(u.href);row.httpStatus=response.status;if(!response.ok)throw Error('HTTP '+response.status);
 const meta=await sharp(Buffer.from(await response.arrayBuffer())).metadata();row.width=meta.width;row.height=meta.height;row.success=meta.width>=64&&meta.height>=64;row.highResolution=meta.width>=640||meta.height>=640;
 }catch(e){row.error=e.message.slice(0,100);}output.push(row);}}));
const result={checkedAt:new Date().toISOString(),sampleSize:rows.length,results:output};await writeFile(process.argv[3],JSON.stringify(result,null,2));console.log(JSON.stringify({checked:output.length,success:output.filter(r=>r.success).length,highResolution:output.filter(r=>r.highResolution).length}));
