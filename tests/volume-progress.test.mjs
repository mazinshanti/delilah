import test from 'node:test';
import assert from 'node:assert/strict';
import {finishVolumeSearch, volumeSourceErrors} from './helpers/volume-progress.mjs';

const noPoll = {poll: async () => {throw new Error('unexpected poll');}, sleep: async () => {}};
test('volume QA accepts completed cached responses without a search id', async () => {
  for (const flag of ['complete', 'marketScanComplete']) {
    const response = {[flag]: true, listings: []};
    assert.equal(await finishVolumeSearch(response, noPoll), response);
  }
});
test('volume QA polls incomplete responses until completion', async () => {
  let calls = 0;
  const result = await finishVolumeSearch({searchId: 'dc.example'}, {
    sleep: async () => {},
    poll: async id => {assert.equal(id, 'dc.example'); return {complete: ++calls === 2};}
  });
  assert.equal(calls, 2);
  assert.equal(result.complete, true);
});
test('volume QA rejects missing or invalid ids for incomplete searches', async () => {
  for (const searchId of [undefined, 'other.example']) {
    await assert.rejects(finishVolumeSearch({searchId}, noPoll), /incomplete search/);
  }
});
test('volume QA never accepts unfinished scans after exhausting the budget', async () => {
  await assert.rejects(finishVolumeSearch({searchId: 'vol.example'}, {
    attempts: 2, sleep: async () => {}, poll: async () => ({complete: false})
  }), /did not complete/);
});
test('volume diagnostics use current source errors and preserve legacy support', () => {
  const errors = [{source: 'Haraj', error: 'timeout'}];
  assert.deepEqual(volumeSourceErrors({sourceErrors: errors, volumeErrors: []}), errors);
  assert.deepEqual(volumeSourceErrors({directCoreErrors: errors}), errors);
  assert.deepEqual(volumeSourceErrors({volumeErrors: errors}), errors);
  assert.deepEqual(volumeSourceErrors({}), []);
});
