// Synthetic capacity test ONLY. Never writes generated vehicles to production inventory.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {InventoryIndex} from '../lib/inventory-index.js';
const real=JSON.parse(gunzipSync(await readFile('data/market-inventory.json.gz'))).listings;
const size=Number(process.env.BENCHMARK_RECORDS||50000),now=new Date().toISOString();
const listings=Array.from({length:size},(_,i)=>{const c=real[i%real.length],url=new URL(c.url);url.searchParams.set('capacity-fixture',String(i));return {...c,url:url.href,originalUrl:url.href,source_url:url.href,id:'capacity-'+i,inventoryId:'capacity-'+i,vin:null,trim:null,image:null,images:[],gallery_images:[],primary_image:null,displayImage:null,media:{},lastSeenAt:now};});
const start=performance.now(),idx=new InventoryIndex();idx.replace({generatedAt:now,listings});const loadedMs=performance.now()-start;
const cases=[{query:'Toyota Corolla',condition:'used'},{query:'تويوتا كورولا',condition:'used'},{query:'BMW X5',condition:'used'},{query:'GAC GS3',condition:'new',filters:{seller:'Motory'}},{query:'',condition:'new',filters:{maxPrice:100000}},{query:'__all_cars__',condition:'used',filters:{maxMileage:100000}}];
const results=cases.map(body=>{const t=performance.now(),rows=idx.search(body),coldMs=performance.now()-t,t2=performance.now();idx.search(body);return {query:body.query,condition:body.condition,count:rows.length,coldMs:Math.round(coldMs),repeatMs:Math.round(performance.now()-t2)};});
const report={synthetic:true,productionInventoryUnchanged:true,requestedRecords:size,indexedRecords:idx.records.length,loadMs:Math.round(loadedMs),heapMB:Math.round(process.memoryUsage().heapUsed/1048576),results};await mkdir('audit',{recursive:true});await writeFile('audit/inventory-scale.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
