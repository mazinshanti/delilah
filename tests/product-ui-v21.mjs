const base=process.env.DELILAH_URL||'https://delilah-pm5f.onrender.com';
const h=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(10000)});if(!h.ok)throw new Error(`health HTTP ${h.status}`);const health=await h.json();
if(health.edge!=='inventory-v22'||health.frontendProgressPolling!==true||health.indexedExactFallback!==true||!Array.isArray(health.sourceNativeAdapters))throw new Error(`v22 product edge not live: ${JSON.stringify(health)}`);
const r=await fetch(`${base}/`,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`home HTTP ${r.status}`);const html=await r.text();if(!html.includes('/app-v21.js'))throw new Error('Progressive UI script not injected');
const jsr=await fetch(`${base}/app-v21.js`,{signal:AbortSignal.timeout(10000)});if(!jsr.ok)throw new Error(`app-v21.js HTTP ${jsr.status}`);const js=await jsr.text();if(!js.includes('/api/search/progress/')||!js.includes('mergeByUrl')||!js.includes('window.go'))throw new Error('Progress polling logic missing');
console.log('PASS v22 product UI: fast results + progressive polling + source-native fallback wired');
