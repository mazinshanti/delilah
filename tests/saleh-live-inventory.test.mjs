import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSalehIntent,parseSalehSitemap} from '../lib/saleh-fast-source.js';

test('Saleh intent accepts canonical make-only new-car searches without weakening model matching',()=>{
  const english=detectSalehIntent('New Toyota');
  const arabic=detectSalehIntent('تويوتا جديدة');
  const exact=detectSalehIntent('Toyota Corolla 2026');
  assert.equal(english?.key,'toyota');
  assert.equal(english?.brandOnly,true);
  assert.equal(arabic?.key,'toyota');
  assert.equal(arabic?.brandOnly,true);
  assert.equal(exact?.key,'corolla');
  assert.equal(exact?.brandOnly,undefined);
  assert.equal(exact?.year,2026);
});

test('Saleh sitemap parser discovers current English product URLs and dedupes by product id',()=>{
  const xml=`<?xml version="1.0"?><urlset>
    <url><loc>https://www.salehcars.com/cars/6a3fa477859699adfe95dc9b/toyota-yaris-y-limited-2026</loc>
      <xhtml:link rel="alternate" hreflang="en" href="https://www.salehcars.com/en/cars/6a3fa477859699adfe95dc9b/toyota-yaris-y-limited-2026" />
    </url>
    <url><loc>https://www.salehcars.com/en/cars/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026</loc></url>
    <url><loc>https://www.salehcars.com/en/cars/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026?duplicate=1</loc></url>
  </urlset>`;
  const urls=parseSalehSitemap(xml);
  assert.equal(urls.length,2);
  assert.ok(urls.some(x=>x.includes('/6a3fa477859699adfe95dc9b/toyota-yaris-y-limited-2026')));
  assert.ok(urls.some(x=>x.includes('/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026')));
  assert.ok(urls.every(x=>x.includes('/en/cars/')));
});
