import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const [home,homeTheme,sell,sellTheme,manifest]=await Promise.all([
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/experience.css',root),'utf8'),
  readFile(new URL('public/sell.html',root),'utf8'),
  readFile(new URL('public/sell-minimal.css',root),'utf8'),
  readFile(new URL('public/manifest.webmanifest',root),'utf8')
]);

test('day and night themes use true white and black foundations',()=>{
  assert.match(homeTheme,/:root\{[^}]*--bg:#fff/);
  assert.match(homeTheme,/:root\[data-theme="dark"\]\{[^}]*--bg:#000/);
  assert.match(sellTheme,/:root\{[^}]*--bg:#fff/);
  assert.match(sellTheme,/:root\[data-theme="dark"\]\{[^}]*--bg:#000/);
});

test('theme follows iPhone conventions and persists between product pages',async()=>{
  const ui=await readFile(new URL('public/market-ui.js',root),'utf8');
  for(const html of [home,sell]){
    assert.match(html,/id="themeToggle"/);
    assert.match(html,/localStorage\.getItem\('dalelah\.theme'\)/);
    assert.match(html,/prefers-color-scheme: dark/);
    assert.match(html===home?ui:html,/localStorage\.setItem\('dalelah\.theme'/);
    if(html===home)assert.match(ui,/next==='dark'\?'day':'night'/);else assert.match(html,/Switch to day mode/);
  }
  assert.match(homeTheme,/-apple-system,BlinkMacSystemFont,"SF Pro Text"/);
  assert.match(sellTheme,/-apple-system,BlinkMacSystemFont,"SF Pro Text"/);
});

test('theme scripts parse and the install surface starts in day mode',()=>{
  for(const [name,html] of [['home',home],['sell',sell]]){
    const scripts=[...html.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);
    for(const [index,source] of scripts.entries())new vm.Script(source,{filename:`${name}-theme-${index+1}.js`});
  }
  const parsed=JSON.parse(manifest);
  assert.equal(parsed.background_color,'#ffffff');
  assert.equal(parsed.theme_color,'#ffffff');
});

test('homepage keeps the product controls and removes repeated marketing clutter',()=>{
  for(const essential of [/id="q"/,/id="usedTab"/,/id="newTab"/,/id="filterBtn"/,/id="brands"/,/id="model"/,/id="category"/,/id="source"/,/id="grid"/])assert.match(home,essential);
  for(const clutter of [/Saudi market live/,/class="heroCopy"/,/class="proof"/,/class="valueGrid"/,/class="installHint"/,/class="snippet"/,/class="chip score"/,/class="chip condition"/])assert.doesNotMatch(home,clutter);
});
