// Run without --write to audit; --write atomically replaces the searchable snapshot.
// Rejected source records remain in a separate quarantine artifact, never in the index.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {classifyVehicle,CLASSIFICATION_VERSION} from '../lib/vehicle-classification.js';
import {normalizeInventoryListing} from '../lib/inventory-normalizer.js';
import {isVehicleSaleListing} from '../lib/listing-quality.js';
const path=new URL('../data/market-inventory.json.gz',import.meta.url);
const data=JSON.parse(gunzipSync(await readFile(path)));
const accepted=[],quarantine=[],sources={};
for(const row of data.listings||[]){
 const verdict=classifyVehicle(row),normalized=normalizeInventoryListing(row);
 const keep=verdict.classification==='VEHICLE_FOR_SALE'&&isVehicleSaleListing(normalized);
 const counts=sources[row.source||'Unknown']||={input:0,accepted:0,quarantined:0,reasons:{}};
 counts.input++;counts[keep?'accepted':'quarantined']++;
 if(keep)accepted.push(normalized);else{
  const reason=verdict.classification==='VEHICLE_FOR_SALE'?'legacy_sale_boundary':verdict.reason;
  counts.reasons[reason]=(counts.reasons[reason]||0)+1;
  quarantine.push({record:row,classification:verdict.classification,reason});
 }
}
const report={classificationVersion:CLASSIFICATION_VERSION,auditedAt:new Date().toISOString(),snapshotGeneratedAt:data.generatedAt,input:data.listings.length,accepted:accepted.length,quarantined:quarantine.length,sources};
if(process.argv.includes('--write')){
 await mkdir(new URL('../data/quarantine/',import.meta.url),{recursive:true});
 await writeFile(new URL('../data/quarantine/vehicle-classification-v1.json.gz',import.meta.url),gzipSync(JSON.stringify({report,records:quarantine})));
 await writeFile(new URL('../data/quarantine/vehicle-classification-v1-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 await writeFile(new URL('../data/market-inventory.json.gz.tmp',import.meta.url),gzipSync(JSON.stringify({...data,listings:accepted,classificationVersion:CLASSIFICATION_VERSION})));
 await rename(new URL('../data/market-inventory.json.gz.tmp',import.meta.url),path);
}
console.log(JSON.stringify(report,null,2));
