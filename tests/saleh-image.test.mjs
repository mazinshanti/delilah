import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSalehVehicleImage,isSalehUiImage} from '../lib/saleh-image.js';
import {mergeDirectListings} from '../lib/direct-search.js';

const car='https://saleh-platform-eu.s3.eu-central-1.amazonaws.com/media/693828eb7763c76dda499d52/7c563635-60d7-4567-932c-9ffd6bd21b10.jpg';

test('chooses Saleh vehicle photo instead of language flag and app icons',()=>{
  const html=`
    <img src="/flags/US.svg" alt="English">
    <img src="/_next/image?url=https%3A%2F%2Fsaleh-platform-eu.s3.eu-central-1.amazonaws.com%2Fmedia%2F667980790eeda93c1b747081%2Fc78ac08e-4dbe-4f65-852c-682993045667.png&w=64&q=75" alt="Google Play">
    <img src="${car}" alt="TOYOTA YARIS Y">
  `;
  assert.equal(extractSalehVehicleImage(html,'https://www.salehcars.com/en/cars/x',{title:'TOYOTA YARIS Y 2026'}),car);
});

test('unwraps Next image proxy to original Saleh media image',()=>{
  const original='https://saleh-platform-eu.s3.eu-central-1.amazonaws.com/media/abc/car-main.png';
  const html=`<img src="/_next/image?url=${encodeURIComponent(original)}&w=1920&q=75" alt="TOYOTA COROLLA XLI">`;
  assert.equal(extractSalehVehicleImage(html,'https://www.salehcars.com/en/cars/x',{title:'TOYOTA COROLLA XLI 2026'}),original);
});

test('rejects obvious Saleh UI assets',()=>{
  assert.equal(isSalehUiImage('https://www.salehcars.com/flags/US.svg','English'),true);
  assert.equal(isSalehUiImage('https://www.salehcars.com/logo.svg',''),true);
  assert.equal(isSalehUiImage(car,'TOYOTA YARIS Y'),false);
});

test('merge keeps verified Saleh car photo when legacy result carries flag image',()=>{
  const url='https://www.salehcars.com/en/cars/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026';
  const [merged]=mergeDirectListings(
    [{source:'Saleh Cars',title:'TOYOTA YARIS Y 2026',url,image:car,displayImage:car,imageVerified:true}],
    [{source:'Saleh Cars',title:'TOYOTA YARIS Y 2026',url,image:'https://www.salehcars.com/flags/US.svg',displayImage:'https://www.salehcars.com/flags/US.svg',imageVerified:true}]
  );
  assert.equal(merged.image,car);
  assert.equal(merged.displayImage,car);
  assert.equal(merged.imageVerified,true);
});
