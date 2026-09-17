// Browser contract regression using actual captured source images, never synthetic cars.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.DALELAH_BASE_URL||'http://127.0.0.1:3000';
const cars=JSON.parse(fs.readFileSync('tests/fixtures/saleh-live-media.json')).listings;
const browser=await chromium.launch();const report=[];fs.mkdirSync('artifacts/inventory-media',{recursive:true});
try{for(const [width,language] of [[1440,'ar'],[390,'ar'],[1440,'en'],[390,'en']]){
 const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(lang=>localStorage.setItem('dalelah.language',lang),language);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Only inventory transport is intercepted; frontend, image loading, gallery and URLs are real.
 await page.route('**/api/inventory?**',r=>r.fulfill({json:{listings:cars,pagination:{page:1,total:cars.length,hasMore:false}}}));
 await page.route('**/api/search',r=>r.fulfill({json:{listings:cars,complete:true,intentMode:'rules'}}));
 await page.goto(base);await page.locator('#q').fill('Toyota');await page.locator('#ask').click();await page.locator('.card-link').first().waitFor();
 assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
 const seen=[];
 for(const car of cars){await page.locator('.card-link').filter({has:page.locator('img')}).first().waitFor();
  await page.locator('.card-link').evaluateAll((els,url)=>els.find(a=>a.dataset.vehicle===url)?.click(),car.url);
  await page.locator('.gallery-main img').waitFor();await page.waitForFunction(()=>{const i=document.querySelector('.gallery-main img');return i?.complete&&i.naturalWidth>0;},{timeout:15000});
  assert.equal(await page.locator('.gallery-main img').getAttribute('src'),car.images[0]);assert.equal(await page.locator('.original-cta').getAttribute('href'),car.url);
  assert.equal(await page.locator('.gallery-thumbs button').count(),car.images.length);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  seen.push(car.url);await page.goBack();await page.locator('.card-link').first().waitFor();
 }
 assert.deepEqual(errors,[]);report.push({width,language,checked:seen.length,urls:seen});await page.screenshot({path:`artifacts/inventory-media/${width}-${language}.png`});await context.close();
}}finally{await browser.close();fs.writeFileSync('artifacts/inventory-media/report.json',JSON.stringify(report,null,2));}
