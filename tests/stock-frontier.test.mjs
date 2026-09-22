import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createStockFrontier,mergeAdditionalSnapshot,allowedStockSitemap,sitemapLocations} from '../lib/stock-frontier.js';
import {collectAdditionalStock} from '../lib/additional-stock-collector.js';
import {ADDITIONAL_MARKET_SOURCES} from '../lib/additional-market-sources.js';
const source=ADDITIONAL_MARKET_SOURCES.find(s=>s.id==='motory'),base=source.url;
const ad=n=>base+'en/cars-for-sale/riyadh-haraj/toyota/corolla/2023/'+n+'/';
const car=url=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Car',url,name:'Toyota Corolla 2023',brand:{name:'Toyota'},model:'Corolla',vehicleModelDate:2023,itemCondition:'UsedCondition',mileageFromOdometer:10000,offers:{price:50000,priceCurrency:'SAR',availability:'https://schema.org/InStock'}})+'</script>';
const wait=async()=>{};
test('frontier deduplicates locale variants and resumes only due ads; old evidence is never timestamp-refreshed by discovery',()=>{
 const now=Date.now(),url=ad(123456),previous=[{source:source.name,url,lastSeenAt:new Date(now).toISOString()}];
 const f=createStockFrontier(source,{},previous,now);assert.equal(f.add(url.replace('/en/','/ar/')),false);assert.equal(f.due().length,0);
 f.add(ad(123457));assert.equal(f.due().length,1);f.finish(ad(123457),'HTTP 404',now);assert.equal(f.due().length,0);
 const later=createStockFrontier(source,f.save(),[],now+25*3600000);assert.equal(later.due().length,2);
});
test('snapshot merge updates a source ID across locale/slug aliases and removes confirmed expired ads',()=>{
 const old={source:source.name,url:ad(123456),price:50000},fresh={...old,url:old.url.replace('/en/','/ar/'),price:40000};
 assert.deepEqual(mergeAdditionalSnapshot([old],[fresh],[],[source]),[fresh]);assert.equal(mergeAdditionalSnapshot([fresh],[],[old.url],[source]).length,0);
});
test('sitemaps are source-bound and do not admit news, image feeds or offsite URLs',()=>{
 assert.equal(allowedStockSitemap(source,base+'sitemap/en/vehicle_posts.xml'),true);
 for(const url of [base+'sitemap/en/images_vehicle.xml',base+'sitemap/en/google-news_en.xml','https://evil.test/sitemap.xml',base+'backend/sitemap.xml'])assert.equal(allowedStockSitemap(source,url),false);
 assert.deepEqual(sitemapLocations('<loc><![CDATA[https://example.com/a?x=1&amp;y=2]]></loc>'),['https://example.com/a?x=1&y=2']);
});
test('collector expands sitemap indexes, saves remaining URLs, and next run avoids fresh detail refetches',async()=>{
 const index=base+'sitemap/en/sitemap.xml',map=base+'sitemap/en/vehicle_posts.xml',calls=[];
 const fetchImpl=async u=>{calls.push(String(u));if(String(u).endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /\nSitemap: '+index);if(u===index)return new Response('<sitemapindex><sitemap><loc>'+map+'</loc></sitemap></sitemapindex>');if(u===map)return new Response('<urlset>'+[123456,123457,123458].map(n=>'<url><loc>'+ad(n)+'</loc></url>').join('')+'</urlset>');if(u===base+'en/cars-for-sale/')return new Response('');return new Response(car(String(u)));};
 let r=await collectAdditionalStock({sources:[source],fetchImpl,wait,maxDetails:2});assert.equal(r.listings.length,2);assert.equal(r.state.motory.entries.length,3);
 calls.length=0;r=await collectAdditionalStock({sources:[source],fetchImpl,wait,maxDetails:1,state:r.state});assert.equal(r.listings.length,1);assert.ok(calls.includes(ad(123458)));assert.ok(!calls.includes(ad(123456)));
});
test('compressed sitemap and source throttling are handled without losing queued discovery',async()=>{
 const s=ADDITIONAL_MARKET_SOURCES.find(s=>s.id==='samaco'),map=s.url+'sitemap.xml.gz';
 const r=await collectAdditionalStock({sources:[s],wait,fetchImpl:async u=>String(u).endsWith('/robots.txt')?new Response('User-agent: *\nAllow: /\nSitemap: '+map):u===map?new Response(gzipSync('<urlset></urlset>')):String(u)===s.url+'stock/'?new Response('<a href="?page=2">Next</a>'):new Response('',{status:429})});
 assert.equal(r.diagnostics[0].successfulSitemaps,1);assert.equal(r.state.samaco.pageQueue.length,1);assert.match(r.diagnostics[0].errors[0].error,/429/);
});
test('mixed classified sitemaps enqueue only Saudi car categories before fetching any detail',()=>{
 const s=ADDITIONAL_MARKET_SOURCES.find(s=>s.id==='mstaml'),f=createStockFrontier(s);
 assert.equal(f.add(s.url+'sa/product/furniture?id=1234567&type=85.118'),false);
 assert.equal(f.add(s.url+'sa/product/car?id=1234568&type=4.41'),true);
 assert.equal(f.due().length,1);
});
test('changed listings return in four hours, errors back off and preserve last successful check',()=>{
 const at=Date.now(),url=ad(123456);let f=createStockFrontier(source,{},[],at);f.add(url);f.finish(url,'accepted',at,{changed:true});
 let entry=f.save().entries[0];assert.equal(entry.nextCheckAt,at+4*3600000);assert.equal(entry.lastSuccessfulAt,new Date(at).toISOString());
 f.finish(url,'HTTP 503',at+4*3600000);entry=f.save().entries[0];assert.equal(entry.failures,1);assert.equal(entry.nextCheckAt,at+5*3600000);assert.equal(entry.lastSuccessfulAt,new Date(at).toISOString());
 f=createStockFrontier(source,f.save(),[],at+5*3600000);f.finish(url,'timeout',at+5*3600000);entry=f.save().entries[0];assert.equal(entry.nextCheckAt,at+7*3600000);assert.equal(entry.failures,2);
 f.finish(url,'accepted',at+7*3600000);assert.equal(f.save().entries[0].failures,0);
});
test('source cooldown survives runs and prevents network calls without deleting listings',async()=>{
 const now=Date.now(),url=ad(123456),old={source:source.name,url,lastSeenAt:new Date(now-48*3600000).toISOString()};
 const r=await collectAdditionalStock({sources:[source],previousListings:[old],now:()=>now,wait,fetchImpl:async u=>String(u).endsWith('/robots.txt')?new Response('User-agent: *\nAllow: /'):new Response('',{status:429,headers:{'retry-after':'7200'}})});
 assert.equal(r.removedUrls.length,0);assert.equal(r.state.motory.pauseUntil,now+7200000);
 const again=await collectAdditionalStock({sources:[source],state:r.state,now:()=>now+1000,fetchImpl:()=>assert.fail('paused source fetched')});assert.equal(again.diagnostics[0].paused,true);assert.deepEqual(again.state,r.state);
});
test('successful changed price is published and prioritized; timeouts never remove old rows',async()=>{
 const now=Date.now(),url=ad(123456),old={source:source.name,url,price:60000,mileage:10000,condition:'used',lastSeenAt:new Date(now-48*3600000).toISOString()};
 const r=await collectAdditionalStock({sources:[source],previousListings:[old],now:()=>now,maxDetails:1,wait,fetchImpl:async u=>String(u).endsWith('/robots.txt')?new Response('User-agent: *\nAllow: /'):new Response(car(url))});
 assert.equal(r.listings[0].price,50000);assert.equal(r.state.motory.entries[0].nextCheckAt,now+4*3600000);
});
test('metadata-only expansion verifies exact ads without downloading image files',async()=>{
 const url=ad(234567),calls=[];
 const html=car(url).replace('"offers":','"image":"https://s3.eu-central-1.amazonaws.com/example-car.jpg","offers":');
 const result=await collectAdditionalStock({sources:[source],mediaMode:'links-only',wait,maxDetails:1,fetchImpl:async u=>{
  calls.push(String(u));if(String(u).endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');
  if(u===base+'en/cars-for-sale/')return new Response('<a href="'+url+'">Car</a>');
  assert.equal(u,url);return new Response(html);
 }});
 assert.equal(result.listings.length,1);const row=result.listings[0];
 assert.equal(row.detailChecked,true);assert.ok(Date.parse(row.lastDetailAt));assert.equal(row.imageVerified,false);assert.equal(row.mediaValidation,'source-url-only');assert.ok(row.image);assert.equal(calls.length,3);
 await assert.rejects(collectAdditionalStock({mediaMode:'skip-everything'}),/invalid-media-mode/);
});
test('opt-in expansion follows observed brand navigation and excludes ads, offsite links and non-stock pages',async()=>{
 const model=base+'en/cars-for-sale/toyota/corolla/',url=ad(345678),calls=[];
 const result=await collectAdditionalStock({sources:[source],expandNavigation:true,mediaMode:'links-only',wait,maxDetails:1,fetchImpl:async u=>{
  calls.push(String(u));if(String(u).endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');
  if(u===base+'en/cars-for-sale/')return new Response('<a href="'+model+'">Corolla</a><a href="https://evil.test/en/cars-for-sale/toyota/">bad</a><a href="/en/news/">news</a>');
  if(u===model)return new Response('<a href="'+url+'">Car</a>');assert.equal(u,url);return new Response(car(url));
 }});
 assert.equal(result.listings.length,1);assert.ok(calls.includes(model));assert.equal(result.state.motory.navigationExpanded,true);assert.equal(result.diagnostics[0].successfulPages,2);
});
test('a removed published sitemap does not block remaining inventory navigation',async()=>{
 const sitemap=base+'sitemap/en/sitemap.xml',page=base+'en/cars-for-sale/?page=2',url=ad(456789);
 const result=await collectAdditionalStock({sources:[source],mediaMode:'links-only',wait,maxDetails:1,fetchImpl:async u=>{
  if(String(u).endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /\nSitemap: '+sitemap);
  if(u===sitemap)return new Response('',{status:404});
  if(u===base+'en/cars-for-sale/')return new Response('<a href="?page=2">next</a>');
  if(u===page)return new Response('<a href="'+url+'">Car</a>');assert.equal(u,url);return new Response(car(url));
 }});
 assert.equal(result.listings.length,1);assert.match(result.diagnostics[0].errors[0].error,/404/);assert.equal(result.state.motory.pauseUntil,0);
});
