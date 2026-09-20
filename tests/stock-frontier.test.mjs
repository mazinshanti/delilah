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
