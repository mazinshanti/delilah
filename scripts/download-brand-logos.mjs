import {writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {VEHICLE_CATALOG} from '../public/catalog.js';
const dataset='https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/data.json';
const response=await fetch(dataset,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Logo dataset unavailable');const entries=await response.json();
const norm=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
const rename={Mercedes:'Mercedes-Benz',BAIC:'BAIC Motor',GAC:'GAC Group'};
const official={Denza:'https://www.denza.com/material/denza-overseas/public/logo/logo_bgLight.svg'};
await mkdir(new URL('../public/brand-logos/',import.meta.url),{recursive:true});
const manifest={};let cursor=0;
async function worker(){while(cursor<VEHICLE_CATALOG.makes.length){const make=VEHICLE_CATALOG.makes[cursor++];const item=entries.find(x=>norm(x.name)===norm(rename[make.name]||make.name));const asset=official[make.name]||item?.image.optimized;if(!asset){manifest[make.name]={status:'unavailable',reason:'No verified asset in source dataset'};continue;}try{
 const r=await fetch(asset,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);const input=Buffer.from(await r.arrayBuffer());if(input.length>5000000)throw Error('Asset too large');
 const bytes=await sharp(input).resize({width:256,height:144,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
 const file='/brand-logos/'+(item?.slug||norm(make.name))+'.png';await writeFile(new URL('../public'+file,import.meta.url),bytes);manifest[make.name]={url:file,source:official[make.name]||item.image.source,assetSource:asset,status:'available',rights:'Manufacturer trademark; identification only. No affiliation implied.'};
 }catch(e){manifest[make.name]={status:'unavailable',reason:e.message};}}}
await Promise.all(Array.from({length:5},worker));
await writeFile(new URL('../public/brand-logos.js',import.meta.url),'export const BRAND_LOGOS='+JSON.stringify(manifest)+';\n');
await writeFile(new URL('../docs/brand-logo-provenance.json',import.meta.url),JSON.stringify({retrievedAt:new Date().toISOString(),dataset,notice:'Third-party reproductions except explicitly attributed official assets; not a claim of an official distribution license. Manufacturer trademarks used for identification.',brands:manifest},null,2)+'\n');
console.log({available:Object.values(manifest).filter(x=>x.url).length,unavailable:Object.entries(manifest).filter(([,x])=>!x.url).map(([name])=>name)});
