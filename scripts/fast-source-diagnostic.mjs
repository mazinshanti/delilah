import assert from 'node:assert/strict';
import {fetchSalehFast} from '../lib/saleh-fast-source.js';
import {isSalehUiImage} from '../lib/saleh-image.js';

const result=await fetchSalehFast({query:'Toyota Yaris 2026',filters:{},timeout:9000});
assert.ok(Array.isArray(result.listings)&&result.listings.length>0,'no live Saleh Yaris listings');
const sample=result.listings.find(x=>x.imageVerified&&x.image)||result.listings[0];
assert.ok(sample?.image,'Saleh listing has no image');
assert.equal(isSalehUiImage(sample.image,sample.title),false,'Saleh listing image is a UI asset');
assert.match(sample.image,/saleh-platform-eu\.s3\.eu-central-1\.amazonaws\.com\/media\//i,'Saleh listing image did not resolve to Saleh media');
console.log('SALEH_LIVE_IMAGE '+JSON.stringify({count:result.listings.length,title:sample.title,image:sample.image,imageVerified:sample.imageVerified,url:sample.url}));