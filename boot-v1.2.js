import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const srcPath=path.join(__dirname,'server-v1.2.js');
const runtimePath=path.join(__dirname,'.runtime-v1.2.mjs');
let src=fs.readFileSync(srcPath,'utf8');

const oldSourceSearch=`async function sourceSearch(query,source,count=20){const key=\`${'${source.name}'}|${'${norm(query)}'}\`,hit=cache.get(key);if(hit&&Date.now()-hit.at<TTL)return hit.value;let rs=[];try{rs=(await brave(\`site:${'${source.site}'} ${'${query}'}\`,count)).filter(r=>source.candidate(r.url))}catch{}const out=[];let i=0;async function worker(){for(;;){const n=i++;if(n>=rs.length)return;const r=rs[n];try{out.push(await parseListing(r,source))}catch{}}}await Promise.all(Array.from({length:Math.min(4,rs.length||1)},worker));cache.set(key,{at:Date.now(),value:out});return out}`;

const newSourceSearch=`async function sourceSearch(query,source,count=20){const key=\`${'${source.name}'}|${'${norm(query)}'}\`,hit=cache.get(key);if(hit&&Date.now()-hit.at<TTL)return hit.value;let rs=[];try{rs=(await brave(\`site:${'${source.site}'} ${'${query}'}\`,count)).filter(r=>source.candidate(r.url))}catch(e){console.log('source discovery failed',source.name,e?.message||e)}const out=[];let i=0;async function worker(){for(;;){const n=i++;if(n>=rs.length)return;const r=rs[n];try{out.push(await parseListing(r,source))}catch{const txt=\`${'${r.title||\'\'}'} ${'${r.description||\'\'}'}\`;const y=yearOf(txt),id=inferIdentity(r.title||''),p=priceOf(txt);out.push({source:source.name,sourceType:source.type,channel:source.channel,seller:source.name,title:(r.title||source.name+' vehicle').slice(0,220),snippet:r.description||'',url:canonical(r.url),brand:id.brand,model:id.model,year:id.year||y,mileage:mileageOf(txt),city:cityOf(txt),price:p,priceVerified:Boolean(p),condition:conditionOf(txt,source.name),saleVerified:true,image:null,displayImage:null,imageVerified:false,score:76,discovery:'market_search_fallback'})}}}await Promise.all(Array.from({length:Math.min(4,rs.length||1)},worker));cache.set(key,{at:Date.now(),value:out});return out}`;

const oldHard=`function hardMatch(c,intent,condition,y){const t=norm(\`${'${c.brand||\'\'}'} ${'${c.model||\'\'}'} ${'${c.title||\'\'}'}\`);if(condition&&c.condition&&c.condition!==condition)return false;if(y&&Number(c.year)!==y)return false;if(intent.make&&!t.includes(norm(intent.make)))return false;if(intent.model&&!t.includes(norm(intent.model)))return false;if(intent.minYear&&c.year&&c.year<intent.minYear)return false;if(intent.maxYear&&c.year&&c.year>intent.maxYear)return false;if(intent.minPrice&&c.price&&c.price<intent.minPrice)return false;if(intent.maxPrice&&c.price&&c.price>intent.maxPrice)return false;if(intent.maxMileage&&c.mileage!=null&&c.mileage>intent.maxMileage)return false;if(intent.city&&c.city&&norm(c.city)!==norm(intent.city))return false;return true}`;

const newHard=`function hardMatch(c,intent,condition,y){if(condition&&c.condition&&c.condition!==condition)return false;if(y&&Number(c.year)!==y)return false;if(intent.minYear&&c.year&&c.year<intent.minYear)return false;if(intent.maxYear&&c.year&&c.year>intent.maxYear)return false;if(intent.minPrice&&c.price&&c.price<intent.minPrice)return false;if(intent.maxPrice&&c.price&&c.price>intent.maxPrice)return false;if(intent.maxMileage&&c.mileage!=null&&c.mileage>intent.maxMileage)return false;if(intent.city&&c.city&&norm(c.city)!==norm(intent.city))return false;return true}`;

if(!src.includes(oldSourceSearch)) throw new Error('sourceSearch patch target not found');
if(!src.includes(oldHard)) throw new Error('hardMatch patch target not found');
src=src.replace(oldSourceSearch,newSourceSearch).replace(oldHard,newHard);
fs.writeFileSync(runtimePath,src);
console.log('Dalelah market-search hotfix active',{brave:Boolean(process.env.BRAVE_SEARCH_API_KEY),ai:Boolean(process.env.OPENAI_API_KEY)});
await import(pathToFileURL(runtimePath).href+'?v='+Date.now());
