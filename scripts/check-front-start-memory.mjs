import {InventoryIndex} from '../lib/inventory-index.js';
const index=new InventoryIndex();
if(!await index.load())throw Error('startup-snapshot-failed');
if(index.records.length<1000)throw Error('inventory-unexpectedly-empty');
const stats=index.stats();
const rss=process.memoryUsage().rss;
const mb=n=>Math.round(n/1048576);
console.log('FRONT_START_MEMORY '+JSON.stringify({
 indexed:stats.totalUnique, heapUsedMb:mb(process.memoryUsage().heapUsed),
 heapTotalMb:mb(process.memoryUsage().heapTotal), rssMb:mb(rss)
}));
// 512MiB Render instance needs room for startup and requests beyond indexing.
if(rss>=450*1048576)throw Error('front-startup-memory-exceeds-budget');
