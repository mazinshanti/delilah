import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const [index,preview,server]=await Promise.all([
 readFile(new URL('public/index.html',root),'utf8'),
 readFile(new URL('public/builder-preview.html',root),'utf8'),
 readFile(new URL('server-core-candidate.js',root),'utf8')
]);
test('Builder section is isolated; original search and results remain code-managed',()=>{
 assert.match(index,/<builder-component model="dalelah-home-section" api-key="[a-f0-9]{32}"><\/builder-component>/);
 assert.match(index,/id="searchForm"/);
 assert.match(index,/id="results"/);
 assert.match(index,/src="https:\/\/cdn\.builder\.io\/js\/webcomponents"/);
 assert.ok(index.indexOf('id="builderHomeSection"')>index.indexOf('id="searchForm"'));
});
test('Builder visual editor preview uses same model and public key as site',()=>{
 const extract=s=>s.match(/<builder-component model="([^"]+)" api-key="([^"]+)"/)?.slice(1);
 assert.deepEqual(extract(index),extract(preview));
 assert.match(preview,/<meta name="robots" content="noindex,nofollow">/);
});
test('only Builder preview is allowed to be framed by visual editor',()=>{
 assert.match(server,/req\.path==='\/builder-preview'/);
 assert.match(server,/res\.removeHeader\('X-Frame-Options'\)/);
 assert.match(server,/frame-ancestors https:\/\/builder\.io https:\/\/\*\.builder\.io/);
 assert.match(server,/frame-ancestors 'none'/);
 assert.ok(server.indexOf("req.path==='/builder-preview'")<server.indexOf('express.static(publicDir'));
});

test('full Builder visual preview serves the original homepage without opening production framing',()=>{
 assert.match(server,/app\.get\('\/builder-full-preview'/);
 assert.match(server,/indexTemplate\.replace\(/);
 assert.match(server,/noindex,nofollow/);
 assert.match(server,/X-Robots-Tag','noindex, nofollow'/);
 assert.match(server,/req\.path==='\/builder-full-preview'/);
 assert.match(server,/res\.removeHeader\('X-Frame-Options'\)/);
 assert.match(server,/frame-ancestors 'none'/);
 assert.match(index,/id="searchForm"/);
 assert.match(index,/id="brands"/);
 assert.match(index,/id="results"/);
});
