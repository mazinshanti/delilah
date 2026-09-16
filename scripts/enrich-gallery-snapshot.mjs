import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {discoverListingGallery,eligibleGalleryUrl} from '../lib/listing-gallery.js';
import {vehicleImages,withGallery} from '../public/vehicle-media.js';
const path=new URL('../data/market-inventory.json.gz',import.meta.url),snapshot=JSON.parse(gunzipSync(await readFile(path)));
const report={checkedAt:new Date().toISOString(),attempted:0,updated:0,errors:[],bySource:{}};
for(const source of ['Syarah','CarSwitch Saudi']){
 const rows=snapshot.listings.filter(c=>c.source===source&&eligibleGalleryUrl(c.url)).slice(0,12);
 for(const car of rows){report.attempted++;try{const images=await discoverListingGallery(car.url);if(images.length){Object.assign(car,withGallery(car,images),{galleryVerified:true,galleryCheckedAt:report.checkedAt});report.updated++;}}catch(e){report.errors.push({url:car.url,error:e.message});}}
}
// A gallery refresh never changes vehicle availability timestamps.
for(const car of snapshot.listings){car.images=vehicleImages(car);const row=report.bySource[car.source]??={listings:0,multipleImages:0,images:0};row.listings++;row.multipleImages+=Number(car.images.length>1);row.images+=car.images.length;}
await writeFile(path,gzipSync(JSON.stringify(snapshot)));await writeFile(new URL('../docs/gallery-coverage.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
