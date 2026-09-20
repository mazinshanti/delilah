import test from 'node:test';
import assert from 'node:assert/strict';
import {searchProgressState as state} from '../public/search-progress.js';
test('cached completion does not finish an active broader search',()=>{
 assert.equal(state({started:true,busy:true,response:{complete:true},count:3}).kind,'scanning');
});
test('only confirmed non-partial completion fills the bar',()=>{
 assert.equal(state({started:true,response:{complete:true}}).kind,'complete');
 for(const response of [{},{complete:true,partial:true},{complete:true,interpretationUnavailable:true}])
  assert.equal(state({started:true,response}).kind,'partial');
});
test('idle hidden, fresh searches reset and bilingual counts stay visible',()=>{
 assert.equal(state().hidden,true);
 for(const language of ['ar','en']){
  const s=state({started:true,busy:true,count:12,language});
  assert.equal(s.hidden,false);assert.equal(s.kind,'scanning');assert.match(s.text,/12/);
 }
});
