const $ = (id) => document.getElementById(id);
const APP_STORE = 'https://apps.apple.com/sa/app/awaed-invest-trade/id1610134585';
let swReg = null;
let pushSubscription = null;
let latestResults = [];

function tickers() {
  return $('watchlist').value.split(/[\s,]+/).map(x => x.trim().toUpperCase()).filter(Boolean).slice(0,25);
}
function fmt(n, d=2){ return Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}); }
function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function boot() {
  if ('serviceWorker' in navigator) {
    swReg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    pushSubscription = await swReg.pushManager?.getSubscription?.();
  }
  $('installCard').style.display = isStandalone() ? 'none' : 'flex';
  await refreshStatus();
  updateNotificationUi();
  $('accountSize').value = localStorage.getItem('accountSize') || '10000';
  $('riskPct').value = localStorage.getItem('riskPct') || '5';
  $('minScore').value = localStorage.getItem('minScore') || '78';
  $('watchlist').value = localStorage.getItem('watchlist') || $('watchlist').value;
  bind();
  scan();
}

function bind(){
  $('scanNow').addEventListener('click', scan);
  $('enableNotifications').addEventListener('click', enableNotifications);
  $('testNotification').addEventListener('click', testNotification);
  $('openAwaed').addEventListener('click', openAwaed);
  $('copyInstall').addEventListener('click', () => alert('On iPhone: open this page in Safari → tap the Share button → Add to Home Screen → Add. Then open Awaed Copilot from your Home Screen and tap Enable notifications.'));
  ['accountSize','riskPct','minScore','watchlist'].forEach(id => $(id).addEventListener('change', saveSettings));
}

function saveSettings(){
  localStorage.setItem('accountSize', $('accountSize').value);
  localStorage.setItem('riskPct', $('riskPct').value);
  localStorage.setItem('minScore', $('minScore').value);
  localStorage.setItem('watchlist', $('watchlist').value);
  syncPreferences();
}

async function refreshStatus(){
  try{
    const r = await fetch('/api/status');
    const s = await r.json();
    $('marketStatus').textContent = s.ok ? 'LIVE' : 'OFFLINE';
  }catch{
    $('marketStatus').textContent = 'OFFLINE';
  }
}

function updateNotificationUi(){
  if (!isStandalone()) {
    $('notificationText').textContent = 'On iPhone, add this site to your Home Screen first. iOS web push works from installed web apps.';
  } else if (Notification.permission === 'granted' && pushSubscription) {
    $('notificationText').textContent = 'Notifications enabled. Copilot can alert you when a watched ticker reaches your score threshold.';
    $('enableNotifications').textContent = 'Notifications on';
  } else if (Notification.permission === 'denied') {
    $('notificationText').textContent = 'Notifications are blocked. Enable them for Awaed Copilot in iPhone Settings.';
  } else {
    $('notificationText').textContent = 'Ready. Tap Enable notifications and allow alerts.';
  }
}

async function enableNotifications(){
  try{
    if (!isStandalone()) {
      alert('First add Awaed Copilot to your iPhone Home Screen using Safari → Share → Add to Home Screen. Then open the installed app and enable notifications.');
      return;
    }
    if (!('Notification' in window) || !swReg?.pushManager) throw new Error('Push notifications are not supported on this device.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');
    const keyRes = await fetch('/api/vapid-public-key');
    const { publicKey } = await keyRes.json();
    if (!publicKey) throw new Error('Push service is not configured yet.');
    pushSubscription = await swReg.pushManager.getSubscription();
    if (!pushSubscription) {
      pushSubscription = await swReg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToUint8Array(publicKey) });
    }
    const res = await fetch('/api/subscribe', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({subscription:pushSubscription,watchlist:tickers(),minScore:Number($('minScore').value)})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Subscription failed');
    updateNotificationUi();
    await testNotification();
  }catch(err){ alert(err.message); }
}

async function syncPreferences(){
  if (!pushSubscription) return;
  try{
    await fetch('/api/preferences', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({endpoint:pushSubscription.endpoint,watchlist:tickers(),minScore:Number($('minScore').value)})
    });
  }catch{}
}

async function testNotification(){
  try{
    if (!pushSubscription) { await enableNotifications(); return; }
    const res = await fetch('/api/test-push', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({endpoint:pushSubscription.endpoint})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Test failed');
  }catch(err){ alert(err.message); }
}

async function scan(){
  saveSettings();
  $('scanNow').disabled = true;
  $('scanNow').textContent = 'Scanning…';
  $('lastScan').textContent = 'Scanning live market data…';
  try{
    const res = await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:tickers()})});
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Scan failed');
    latestResults = data.results || [];
    renderResults(latestResults);
    $('lastScan').textContent = `Updated ${new Date(data.at).toLocaleTimeString()} · ${latestResults.length} tickers`;
  }catch(err){
    $('results').innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    $('lastScan').textContent = 'Scan failed';
  }finally{
    $('scanNow').disabled = false;
    $('scanNow').textContent = 'Scan now';
  }
}

function riskSizing(signal){
  const accountSar = Math.max(0, Number($('accountSize').value) || 0);
  const riskPct = Math.max(0, Math.min(100, Number($('riskPct').value) || 0));
  const accountUsd = accountSar / 3.75;
  const riskUsd = accountUsd * (riskPct / 100);
  const perShareRisk = Math.max(0.01, signal.price - signal.stop);
  const byRisk = Math.floor(riskUsd / perShareRisk);
  const byCash = Math.floor(accountUsd / signal.price);
  const shares = Math.max(0, Math.min(byRisk, byCash));
  return { shares, positionUsd: shares * signal.price, maxLossUsd: shares * perShareRisk };
}

function renderResults(results){
  if (!results.length){ $('results').innerHTML='<div class="error">No results.</div>'; return; }
  $('results').innerHTML = results.map(s => {
    if (s.error) return `<article class="signal avoid"><div class="signal-top"><div class="ticker">${escapeHtml(s.symbol)}</div><div class="score">NO DATA</div></div><div class="reasons">${escapeHtml(s.error)}</div></article>`;
    const cls = s.label === 'BUY SETUP' ? 'buy' : s.label === 'WATCH' ? 'watch' : 'avoid';
    const size = riskSizing(s);
    return `<article class="signal ${cls}">
      <div class="signal-top"><div><div class="ticker">${escapeHtml(s.symbol)}</div><div class="price">$${fmt(s.price)}</div></div><div class="score">${escapeHtml(s.label)} · ${s.score}/100</div></div>
      <div class="signal-grid">
        <div class="signal-stat"><span>STOP</span><strong>$${fmt(s.stop)}</strong></div>
        <div class="signal-stat"><span>TARGET 1</span><strong>$${fmt(s.target1)}</strong></div>
        <div class="signal-stat"><span>TARGET 2</span><strong>$${fmt(s.target2)}</strong></div>
        <div class="signal-stat"><span>SIZE</span><strong>${size.shares} sh</strong></div>
      </div>
      <div class="reasons">${(s.reasons||[]).map(escapeHtml).join(' · ')}<br>Approx position $${fmt(size.positionUsd)} · defined stop risk $${fmt(size.maxLossUsd)}</div>
      <div class="trade-line"><button class="primary" onclick="copyTrade('${escapeJs(s.symbol)}',${s.price},${s.stop},${s.target1},${s.target2},${size.shares})">Copy trade</button><button class="ghost" onclick="openAwaed()">Open Awaed</button></div>
    </article>`;
  }).join('');
}

async function copyTrade(symbol, price, stop, t1, t2, shares){
  const text = `${symbol} | ${shares} shares | Entry ~ $${fmt(price)} | Stop $${fmt(stop)} | T1 $${fmt(t1)} | T2 $${fmt(t2)}`;
  try{ await navigator.clipboard.writeText(text); alert('Trade details copied.'); }catch{ prompt('Copy trade details:', text); }
}
window.copyTrade = copyTrade;

function openAwaed(){
  let left = false;
  const onVis = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', onVis, {once:true});
  window.location.href = 'awaed://';
  setTimeout(() => { if (!left) window.location.href = APP_STORE; }, 1200);
}
window.openAwaed = openAwaed;

function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeJs(str){ return String(str ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

window.addEventListener('load', boot);
