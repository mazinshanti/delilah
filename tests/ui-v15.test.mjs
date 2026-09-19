import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const ui = await readFile(new URL('../public/market-ui.js', import.meta.url), 'utf8');
const front = await readFile(new URL('../server-core-candidate.js', import.meta.url), 'utf8');

test('Dalelah 1.5 inline scripts parse', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*(?:\bsrc=|application\/ld\+json))[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(Boolean);
  assert.ok(scripts.length > 0, 'inline product script missing');
  for (const [index, source] of scripts.entries()) {
    new vm.Script(source, {filename: `dalelah-v15-inline-${index + 1}.js`});
  }
});

test('Dalelah 1.5 keeps All Brands as the default', () => {
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(ui, /selectBrand\(''\)/);
});

test('source dropdown sends the backend seller filter', () => {
  assert.match(ui, /seller:\$\('source'\)\.value/);
  assert.doesNotMatch(ui, /source:\$\('source'\)\.value/);
});

test('frontend follows progressive market scan results', () => {
  assert.match(ui, /async function pollSearch\(/);
  assert.match(ui, /\/api\/search\/progress\//);
  assert.match(ui, /mergeListings\(d\.listings\|\|\[\]\)/);
});

test('card identity changes on language, image and metadata updates', () => {
  const stateSource=ui.match(/function cardState\(c\)\{[^\n]+\}/)?.[0];
  assert.ok(stateSource);
  const context=vm.createContext({language:'ar',listingTitle:c=>c.title,galleryImages:c=>c.images||[],detailsHref:c=>c.url});
  vm.runInContext(stateSource,context);
  const car={url:'https://example.com/car',title:'Toyota Camry',images:['https://example.com/car.jpg'],price:90000};
  const original=context.cardState(car);
  assert.equal(context.cardState({...car}),original);
  assert.notEqual(context.cardState({...car,price:80000}),original);
  assert.notEqual(context.cardState({...car,images:['https://example.com/new.jpg']}),original);
  context.language='en';
  assert.notEqual(context.cardState(car),original);
});

test('new and used remain separate product modes', () => {
  assert.match(html, /id="usedTab"/);
  assert.match(html, /id="newTab"/);
  assert.match(ui, /condition='used'/);
  assert.match(ui, /conditionLabel=c\.condition==='new'\|\|c\.condition==='used'\?t\(c\.condition\)/);
});

test('front service owns the product shell and has a local health check', () => {
  assert.match(front, /app\.get\('\/healthz'/);
  assert.match(front, /express\.static\(/);
  assert.ok(front.indexOf('express.static(') < front.indexOf('app.use(proxy)'), 'static shell must load before legacy proxy');
  assert.match(front, /app\.listen\(externalPort,'0\.0\.0\.0'/);
});

test('Dalelah can be installed as a mobile web app', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /apple-mobile-web-app-capable/);
});

test('searches have crawlable landing pages and shareable URLs', () => {
  assert.match(html, /href="\/cars\/used\/toyota\/corolla\/2013"/);
  assert.match(ui, /history\.replaceState/);
  assert.match(ui, /window\.__DALELAH_LANDING__/);
  assert.match(front, /landingPages=new Map/);
  assert.match(front, /Used Toyota Corolla 2013 for sale/);
});

test('traffic and conversion surfaces are present', () => {
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /href="\/sell"/);
  assert.match(html, /id="shareSearch"/);
});
