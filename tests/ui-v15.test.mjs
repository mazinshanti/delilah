import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('Dalelah 1.5 inline scripts parse', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(Boolean);
  assert.ok(scripts.length > 0, 'inline product script missing');
  for (const [index, source] of scripts.entries()) {
    new vm.Script(source, {filename: `dalelah-v15-inline-${index + 1}.js`});
  }
});

test('Dalelah 1.5 keeps All Brands as the default', () => {
  assert.match(html, /All brands is the default/);
  assert.match(html, /selectBrand\(''\)/);
});

test('source dropdown sends the backend seller filter', () => {
  assert.match(html, /seller:\$\('source'\)\.value/);
  assert.doesNotMatch(html, /source:\$\('source'\)\.value/);
});

test('frontend follows progressive market scan results', () => {
  assert.match(html, /async function pollSearch\(/);
  assert.match(html, /\/api\/search\/progress\//);
  assert.match(html, /mergeListings\(d\.listings\|\|\[\]\)/);
});

test('new and used remain separate product modes', () => {
  assert.match(html, /id="usedTab"/);
  assert.match(html, /id="newTab"/);
  assert.match(html, /condition='used'/);
});
