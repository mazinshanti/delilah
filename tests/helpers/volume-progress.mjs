import assert from 'node:assert/strict';

export const scanComplete = data => data?.complete === true || data?.marketScanComplete === true;

// Completed/coalesced searches intentionally have no searchId in publicJob.
export async function finishVolumeSearch(first, {poll, sleep, attempts = 45}) {
  let latest = first;
  if (!scanComplete(latest)) {
    assert.match(String(first.searchId || ''), /^(vol|dc)\./,
      'used: incomplete search must have a progressive volume or indexed search id');
    for (let i = 0; i < attempts && !scanComplete(latest); i++) {
      await sleep(i ? 900 : 400);
      latest = await poll(first.searchId);
    }
  }
  assert.ok(scanComplete(latest), 'used: scan did not complete within the polling budget');
  return latest;
}

export function volumeSourceErrors(data) {
  // The direct-first production chain uses sourceErrors/directCoreErrors;
  // retain legacy diagnostics for the old volume response shape.
  return data.sourceErrors ?? data.directCoreErrors ?? data.volumeErrors ?? [];
}
