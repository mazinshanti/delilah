import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../public/product-v24.html',import.meta.url),'utf8');
assert.match(html,/Search the car\./,'hero missing');
assert.match(html,/id="usedTab"/,'used tab missing');
assert.match(html,/id="newTab"/,'new tab missing');
assert.match(html,/Saved cars/,'saved cars missing');
assert.match(html,/Compare cars/,'compare missing');
assert.match(html,/Connected sources/,'sources missing');
assert.match(html,/Max price · SAR/,'price filter missing');
assert.match(html,/Max mileage · km/,'mileage filter missing');
assert.match(html,/Open original listing/,'original-listing CTA missing');
assert.match(html,/\/api\/search\/progress\//,'progress polling missing');
assert.match(html,/localStorage\.getItem\('delilah\.saved'/,'saved persistence missing');

const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
assert.ok(scripts.length>=1,'inline product script missing');
for(const [i,js] of scripts.entries()){
  try{new vm.Script(js,{filename:`product-v24-inline-${i+1}.js`})}
  catch(e){throw new Error(`Product inline script ${i+1} does not parse: ${e.message}`)}
}
const hotfix=await readFile(new URL('../public/hotfix-v24.js',import.meta.url),'utf8');
new vm.Script(hotfix,{filename:'hotfix-v24.js'});
console.log(`PASS v24 product shell: ${scripts.length} inline script(s) parse and core product features are present`);
