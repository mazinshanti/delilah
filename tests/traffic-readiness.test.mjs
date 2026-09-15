import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [html,robots,sitemap,server]=await Promise.all([
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/robots.txt',root),'utf8'),
  readFile(new URL('public/sitemap.xml',root),'utf8'),
  readFile(new URL('server-core-candidate.js',root),'utf8')
]);

test('search engines can discover only intentional public pages',()=>{
  assert.match(robots,/Sitemap: https:\/\/www\.dalelah\.co\/sitemap\.xml/);
  assert.match(robots,/Disallow: \/api\//);
  assert.match(sitemap,/\/cars\/used\/nissan\/patrol/);
  assert.match(sitemap,/\/cars\/new\/hyundai\/elantra/);
  assert.doesNotMatch(sitemap,/\?q=/);
});

test('landing pages have unique server-rendered metadata and live search hydration',()=>{
  assert.match(server,/renderLanding/);
  assert.match(server,/og:title/);
  assert.match(server,/__DALELAH_LANDING__/);
  assert.match(html,/hydrateFromUrl/);
  assert.match(html,/SearchAction/);
});
