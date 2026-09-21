// Integration-test child only: test the snapshot as of its creation, not its age today.
// The freshness-expiry behavior itself is covered by inventory-index unit tests.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const snapshot=JSON.parse(gunzipSync(readFileSync(new URL('../../data/market-inventory.json.gz',import.meta.url))));
const reference=Date.parse(snapshot.generatedAt),started=performance.now();
if(!Number.isFinite(reference))throw Error('invalid-test-snapshot-clock');
Date.now=()=>reference+performance.now()-started;
