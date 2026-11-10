import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('React visual design entry imports the createRoot function it calls',async()=>{
 const entry=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(entry,/import\s*\{\s*createRoot\s*\}\s*from\s*['"]react-dom\/client['"]/);
 assert.match(entry,/createRoot\(document\.getElementById\(['"]root['"]\)\)/);
});

test('visual design preview explicitly excludes live inventory and production API',async()=>{
 const entry=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(entry,/fetch\s*\(/);
 assert.match(entry,/demoCars/);
 assert.match(entry,/معاينة تصميم/);
});
