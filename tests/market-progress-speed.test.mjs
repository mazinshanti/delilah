import test from 'node:test';import assert from 'node:assert/strict';
import {runAdaptiveMarketDiscovery} from '../lib/ai-market-discovery-trial.js';
test('fast page result arrives while an independent direct source is stalled',{timeout:2000},async()=>{
 let release;const slow=new Promise(r=>release=r);let running=0,peak=0;const events=[];
 const detail='https://syarah.com/en/cardetail/toyota-corolla-used-123456';
 const schema=`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url:detail,name:'Toyota Corolla 2020',brand:'Toyota',model:'Corolla',vehicleModelDate:2020,itemCondition:'UsedCondition',offers:{price:60000}})}</script>`;
 try{const r=await runAdaptiveMarketDiscovery({query:'Toyota Corolla',condition:'used',filters:{}},{excludedMakes:[]},{maxRounds:1,maxDetails:3,maxPages:1,concurrency:2,discover:async()=>({status:'completed',urls:['https://haraj.com.sa/12345678901/'],discoveryPages:['https://syarah.com/en/autos/toyota/corolla']}),readDetail:async c=>{running++;peak=Math.max(peak,running);try{if(c.source.id==='haraj'){await slow;events.push('slow-complete');return '';}return c.discoveryPage?`<a href="${detail}">car</a>`:schema;}finally{running--; }},onProgress:e=>{if(e.listing){events.push('fast-result');release();}}});
 assert.equal(r.accepted,1);assert.deepEqual(events,['fast-result','slow-complete']);assert.ok(peak<=2);assert.equal(r.checked,2);
 }finally{release();}
});
