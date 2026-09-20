import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=3191,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server-entry.js'],{env:{...process.env,PORT:String(port),DALELAH_RUNTIME_ROLE:'front'},stdio:'inherit'});
let browser;
try {
 for(let n=0;n<60;n++){
  if(await fetch(`${base}/healthz`).then(r=>r.ok).catch(()=>false))break;
  if(n===59)throw new Error('QA server did not start');
  await new Promise(r=>setTimeout(r,500));
 }
 browser=await chromium.launch({headless:true});
 for(const width of [1440,390])for(const language of ['ar','en']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const car={url:'https://haraj.com.sa/123456789/camry',title:'Toyota Camry 2023',brand:'Toyota',model:'Camry',year:2023,price:90000,mileage:40000,city:'Riyadh',condition:'used',source:'Haraj',image:'https://qa-images.example/car.png'};
  const second={...car,url:'https://sa.opensooq.com/en/search/123456789',source:'OpenSooq',image:'https://qa-images.example/second.png'};
  let phase=0,imageRequests=0,partial=false;
  await page.route('https://qa-images.example/**',route=>{
   if(route.request().url().endsWith('/car.png'))imageRequests++;
   return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  });
  let releaseNewHome;
  const newHomeGate=new Promise(resolve=>{releaseNewHome=resolve;});
  const newCar={...car,url:'https://syarah.com/cardetail/toyota-camry-new-123456',condition:'new',mileage:0};
  await page.route('**/api/inventory?**',async route=>{
   const params=new URL(route.request().url()).searchParams;
   if(params.has('q'))return route.fulfill({json:{listings:[]}});
   if(params.get('condition')==='new'){await newHomeGate;return route.fulfill({json:{listings:[newCar]}});}
   return route.fulfill({json:{listings:[car]}});
  });
  await page.route('**/api/search',route=>route.fulfill({json:{listings:[car],searchId:'qa-progress',complete:false}}));
  await page.route('**/api/search/progress/qa-progress',route=>route.fulfill({json:{listings:phase===0?[car]:[{...car,price:88000},second],complete:phase===2,partial}}));
  await page.goto(base);
  assert.equal(await page.locator('#searchProgress').isVisible(),false,'bar must be hidden before search');
  if(language==='en')await page.locator('#languageToggle').click();
  await page.locator('#grid .card').first().waitFor();
  await page.locator('#newTab').click();
  assert.equal(await page.locator('#newTab').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#grid .card').count(),0,'New tab must not retain Used cards while loading');
  await page.locator('#usedTab').click();
  await page.locator('#grid .card').first().waitFor();
  releaseNewHome();
  await page.waitForTimeout(200);
  assert.match(await page.locator('#grid [data-vehicle]').first().getAttribute('data-vehicle'),/haraj/,'late New response must not replace Used');
  await page.locator('#newTab').click();
  await page.waitForFunction(()=>document.querySelector('#grid [data-vehicle]')?.dataset.vehicle.includes('syarah'));
  assert.match(await page.locator('#grid .facts').innerText(),language==='ar'?/جديدة/:/New/);
  await page.locator('#usedTab').click();
  await page.waitForFunction(()=>document.querySelector('#grid [data-vehicle]')?.dataset.vehicle.includes('haraj'));
  imageRequests=0;
  await page.locator('#q').fill(language==='ar'?'تويوتا كامري 2023':'Toyota Camry 2023');
  await page.locator('#ask').click();
  await page.locator('#grid .photo img').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('#grid .photo img')?.naturalWidth>0);
  const original=await page.locator('#grid .photo img').first().elementHandle();
  await page.waitForTimeout(1800);
  assert.equal(await original.evaluate(el=>el.isConnected),true,'unchanged poll disconnected the image');
  assert.equal(await page.locator('#searchProgress').getAttribute('data-state'),'scanning','poll must not end active progress');
  assert.equal(await page.locator('#searchProgressBar').getAttribute('value'),null,'no invented percentage');
  assert.match(await page.locator('#searchProgressText').innerText(),language==='ar'?/نبحث عن المزيد/:/Searching for more/);
  phase=1;
  await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length===2);
  assert.equal(await original.evaluate(el=>el.isConnected),true,'metadata enrichment replaced the image');
  assert.equal(imageRequests,1,'progressive updates fetched the original image again');
  await page.locator('#languageToggle').click();
  assert.equal(await original.evaluate(el=>el.isConnected),true,'language switch replaced the image');
  assert.match(await page.locator('#grid .seller-line').first().innerText(),language==='ar'?/Source/:/المصدر/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');
  phase=2;
  await page.waitForTimeout(1800);
  assert.equal(await original.evaluate(el=>el.isConnected),true,'completion replaced the image');
  assert.equal(await page.locator('#searchProgress').getAttribute('data-state'),'complete');
  assert.equal(await page.locator('#searchProgressBar').getAttribute('value'),'1');
  assert.match(await page.locator('#searchProgressText').innerText(),language==='ar'?/Search completed/:/اكتمل البحث/);
  partial=true;phase=0;
  await page.locator('#ask').click();
  await page.waitForFunction(()=>document.querySelector('#searchProgress')?.dataset.state==='scanning');
  assert.equal(await page.locator('#searchProgressBar').getAttribute('value'),null,'new search must reset completion');
  phase=2;
  await page.waitForFunction(()=>document.querySelector('#searchProgress')?.dataset.state==='partial');
  assert.equal(await page.locator('#searchProgressBar').isVisible(),false,'partial completion must not show a full bar');
  assert.match(await page.locator('#searchProgressText').innerText(),language==='ar'?/could not finish/:/لم يكتمل/);
  await page.emulateMedia({reducedMotion:'reduce'});
  partial=false;phase=0;
  await page.locator('#ask').click();
  await page.waitForFunction(()=>document.querySelector('#searchProgress')?.dataset.state==='scanning');
  assert.equal(await page.locator('#searchProgressBar').evaluate(el=>getComputedStyle(el).animationName),'none');
  // Rapid replacement must not let an older poll finish the newer search.
  await page.locator('#ask').click();
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('#searchProgress').getAttribute('data-state'),'scanning');
  phase=2;
  await page.waitForFunction(()=>document.querySelector('#searchProgress')?.dataset.state==='complete');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log(`PASS progress scanning/reset/partial/completion/reduced-motion, image identity, language toggle and overflow: ${width}px ${language}`);
  await page.close();
 }
}finally{await browser?.close();server.kill('SIGTERM');}
