import test from 'node:test';import assert from 'node:assert/strict';
import {waitForSearchProgress} from '../lib/search-progress-wait.js';
test('polls return current results without waiting for a slow upstream and share refresh',async()=>{
 let finish,calls=0;const gate=new Promise(r=>finish=r);const job={listings:['existing'],complete:false};
 const refresh=async j=>{calls++;await gate;j.listings.push('new');j.complete=true;};
 await Promise.all([waitForSearchProgress(job,refresh,{sleep:async()=>{}}),waitForSearchProgress(job,refresh,{sleep:async()=>{}})]);
 assert.equal(calls,1);assert.deepEqual(job.listings,['existing']);assert.equal(job.complete,false);
 const pending=job.progressRefreshPromise;finish();await pending;await Promise.resolve();assert.deepEqual(job.listings,['existing','new']);assert.equal(job.progressRefreshPromise,null);
});
test('failed refresh clears its in-flight state so a later poll can retry',async()=>{
 const job={};await assert.rejects(waitForSearchProgress(job,async()=>{throw Error('offline');},{sleep:()=>new Promise(()=>{})}),/offline/);
 await Promise.resolve();assert.equal(job.progressRefreshPromise,null);await waitForSearchProgress(job,async j=>{j.ok=true;});assert.equal(job.ok,true);
});
