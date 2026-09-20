import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogIntent} from '../public/catalog.js';
import {marketCandidate,parseMarketDetail} from '../lib/ai-market-discovery-trial.js';
import {strictDirectListings} from '../lib/direct-search.js';
test('Corolla Cross has its own canonical identity in Arabic and English',()=>{
 for(const q of ['Toyota Corolla Cross 2021','تويوتا كورولا كروس 2021'])assert.equal(catalogIntent(q).modelKey,'Toyota::Corolla Cross');
 assert.equal(catalogIntent('Toyota Corolla 2021').modelKey,'Toyota::Corolla');
});
test('fresh source extraction separates Corolla and Cross under strict retrieval',()=>{
 const url='https://haraj.com.sa/12345678901/';
 for(const title of ['Toyota Corolla Cross 2021','تويوتا كورولا كروس 2021']){
 const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name:title,description:'سيارة مستعملة للبيع الممشى 50000 كم السعر 60000 ريال'})}</script>`;
 const parsed=parseMarketDetail(marketCandidate(url),html);
 assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].model,'Corolla Cross');
 assert.equal(strictDirectListings(parsed.records,{query:'Toyota Corolla',condition:'all',filters:{}}).length,0);
 assert.equal(strictDirectListings(parsed.records,{query:'تويوتا كورولا كروس',condition:'all',filters:{}}).length,1);
 }
});
