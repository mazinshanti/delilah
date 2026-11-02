import {readFile,writeFile,stat} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {mergeInventorySnapshot} from '../lib/inventory-snapshot-merge.js';

const args=process.argv.slice(2);
const flag=name=>{const at=args.indexOf(name);return at<0?null:args[at+1];};
const input=flag('--input');
const output=flag('--output');
const snapshotPath=flag('--snapshot')||'data/market-inventory.json.gz';
if (!input || !output) {
  console.error('Usage: node scripts/merge-inventory-snapshot.mjs --input source-results.json --output next-market-inventory.json.gz [--snapshot current.json.gz]');
  process.exit(2);
}
if (resolve(output)===resolve(snapshotPath) || resolve(input)===resolve(output)) {
  throw new Error('Choose a new output path; the existing snapshot will not be overwritten.');
}
let base={listings:[],diagnostics:[]};
try {
  await stat(snapshotPath);
  base=JSON.parse(gunzipSync(await readFile(snapshotPath)).toString('utf8'));
} catch (error) {
  if (error?.code!=='ENOENT') throw error;
}
const incoming=JSON.parse(await readFile(input,'utf8'));
const {snapshot,report}=mergeInventorySnapshot(base,incoming);
await writeFile(output,gzipSync(JSON.stringify(snapshot)));
console.log(JSON.stringify({event:'inventory-snapshot-merge',output,...report}));
