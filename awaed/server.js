const express = require('express');
const path = require('path');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 10000;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_WATCHLIST = ['NVDA','TSLA','AMD','PLTR','AAPL','MSFT','AMZN','META','GOOGL','AVGO','NFLX','COIN','SOFI','TSM','QQQ'];
const clients = new Map();
const recentAlerts = new Map();
const activeSignals = new Map();

function cleanTickers(input) {
  const raw = Array.isArray(input) ? input : [];
  const out = [];
  for (const item of raw) {
    const s = String(item || '').toUpperCase().trim();
    if (/^[A-Z.\-]{1,10}$/.test(s) && !out.includes(s)) out.push(s);
    if (out.length >= 25) break;
  }
  return out.length ? out : DEFAULT_WATCHLIST;
}

function ema(values, period) {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

function rsi(values, period = 14) {
  if (values.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

async function fetchBars(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 AwaedCopilot/0.3',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Market data ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No market data');
  const q = result.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < (result.timestamp || []).length; i++) {
    const close = q.close?.[i];
    if (typeof close !== 'number') continue;
    bars.push({
      t: result.timestamp[i],
      o: q.open?.[i] ?? close,
      h: q.high?.[i] ?? close,
      l: q.low?.[i] ?? close,
      c: close,
      v: q.volume?.[i] ?? 0
    });
  }
  return { bars, meta: result.meta || {} };
}

function scoreBars(symbol, bars, meta = {}) {
  if (bars.length < 12) throw new Error('Not enough bars yet');
  const closes = bars.map(b => b.c);
  const last = bars[bars.length - 1];
  const prior = bars[Math.max(0, bars.length - 7)];
  const momentum = ((last.c / prior.c) - 1) * 100;
  const e9 = ema(closes.slice(-30), 9);
  const e21 = ema(closes.slice(-40), 21);
  const currentRsi = rsi(closes, 14);
  const priorBars = bars.slice(Math.max(0, bars.length - 13), -1);
  const priorHigh = Math.max(...priorBars.map(b => b.h));
  const avgVol = priorBars.reduce((a,b) => a + (b.v || 0), 0) / Math.max(priorBars.length, 1);
  const volRatio = avgVol > 0 ? (last.v || 0) / avgVol : 1;

  let score = 35;
  const reasons = [];
  if (e9 > e21) { score += 15; reasons.push('9 EMA above 21 EMA'); }
  else { score -= 10; reasons.push('short trend weak'); }
  if (momentum > 0.6) { score += 15; reasons.push(`${momentum.toFixed(2)}% short-term momentum`); }
  else if (momentum < -0.5) { score -= 12; reasons.push('negative momentum'); }
  if (last.c > priorHigh) { score += 18; reasons.push('intraday breakout'); }
  if (volRatio >= 1.8) { score += 12; reasons.push(`${volRatio.toFixed(1)}x volume expansion`); }
  if (currentRsi >= 55 && currentRsi <= 74) { score += 10; reasons.push(`RSI ${currentRsi.toFixed(0)} supportive`); }
  if (currentRsi > 82) { score -= 15; reasons.push('RSI very extended'); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const atrProxy = Math.max(last.c * 0.012, Math.abs(last.c - e21) * 0.8);
  const stop = Math.max(0.01, last.c - atrProxy);
  const target1 = last.c + atrProxy * 1.8;
  const target2 = last.c + atrProxy * 3.0;

  return {
    symbol,
    price: last.c,
    previousClose: meta.chartPreviousClose || meta.previousClose || null,
    score,
    label: score >= 78 ? 'BUY SETUP' : score >= 62 ? 'WATCH' : 'AVOID',
    momentumPct: Number(momentum.toFixed(2)),
    volumeRatio: Number(volRatio.toFixed(2)),
    rsi: Number(currentRsi.toFixed(1)),
    ema9: Number(e9.toFixed(3)),
    ema21: Number(e21.toFixed(3)),
    stop: Number(stop.toFixed(2)),
    target1: Number(target1.toFixed(2)),
    target2: Number(target2.toFixed(2)),
    reasons: reasons.slice(0, 4),
    timestamp: Date.now()
  };
}

async function analyzeSymbol(symbol) {
  const { bars, meta } = await fetchBars(symbol);
  return scoreBars(symbol, bars, meta);
}

async function scanSymbols(symbols) {
  const results = [];
  for (const symbol of cleanTickers(symbols)) {
    try {
      results.push(await analyzeSymbol(symbol));
    } catch (err) {
      results.push({ symbol, error: err.message, score: 0, label: 'NO DATA' });
    }
  }
  return results.sort((a,b) => (b.score || 0) - (a.score || 0));
}

async function sendPush(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('Push keys not configured');
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 90 });
}

function activeKey(endpoint, symbol) {
  return `${endpoint}|${symbol}`;
}

function evaluateExit(signal, active) {
  if (!signal || !active) return null;
  const price = Number(signal.price || 0);

  if (price <= active.stop) {
    return { reason: 'STOP HIT', body: `$${price.toFixed(2)} fell to/below stop $${active.stop.toFixed(2)}` };
  }
  if (price >= active.target2) {
    return { reason: 'TARGET 2 HIT', body: `$${price.toFixed(2)} reached T2 $${active.target2.toFixed(2)}` };
  }
  if (price >= active.target1) {
    return { reason: 'TARGET 1 HIT', body: `$${price.toFixed(2)} reached T1 $${active.target1.toFixed(2)}` };
  }
  if ((signal.score || 0) < 55 || signal.ema9 < signal.ema21 || signal.momentumPct < -0.5) {
    return { reason: 'MOMENTUM EXIT', body: `${signal.symbol} score weakened to ${signal.score}/100 at $${price.toFixed(2)}` };
  }
  return null;
}

async function scanAndNotify() {
  if (!clients.size) return;
  const allSymbols = [...new Set([...clients.values()].flatMap(c => c.watchlist))].slice(0, 30);
  if (!allSymbols.length) return;

  let results;
  try { results = await scanSymbols(allSymbols); } catch { return; }
  const bySymbol = new Map(results.map(r => [r.symbol, r]));

  for (const [endpoint, client] of clients) {
    for (const symbol of client.watchlist) {
      const signal = bySymbol.get(symbol);
      if (!signal || signal.error) continue;

      const key = activeKey(endpoint, symbol);
      const active = activeSignals.get(key);

      if (active) {
        const exit = evaluateExit(signal, active);
        if (!exit) continue;

        const sellKey = `${key}|SELL|${exit.reason}`;
        const lastSent = recentAlerts.get(sellKey) || 0;
        if (Date.now() - lastSent < 30 * 60 * 1000) continue;

        try {
          const pnlPct = ((signal.price / active.entry) - 1) * 100;
          await sendPush(client.subscription, {
            title: `SELL / EXIT ${symbol} · ${exit.reason}`,
            body: `${exit.body} · Since BUY ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
            data: { url: `/?symbol=${encodeURIComponent(symbol)}&action=sell` }
          });
          recentAlerts.set(sellKey, Date.now());
          activeSignals.delete(key);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) clients.delete(endpoint);
        }
        continue;
      }

      if ((signal.score || 0) < client.minScore || signal.label !== 'BUY SETUP') continue;

      const buyKey = `${key}|BUY`;
      const lastSent = recentAlerts.get(buyKey) || 0;
      if (Date.now() - lastSent < 30 * 60 * 1000) continue;

      try {
        await sendPush(client.subscription, {
          title: `BUY ALERT ${symbol} · ${signal.score}/100`,
          body: `$${signal.price.toFixed(2)} · Stop $${signal.stop.toFixed(2)} · T1 $${signal.target1.toFixed(2)} · T2 $${signal.target2.toFixed(2)}`,
          data: { url: `/?symbol=${encodeURIComponent(symbol)}&action=buy` }
        });

        activeSignals.set(key, {
          symbol,
          entry: signal.price,
          stop: signal.stop,
          target1: signal.target1,
          target2: signal.target2,
          openedAt: Date.now(),
          scoreAtEntry: signal.score
        });
        recentAlerts.set(buyKey, Date.now());
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) clients.delete(endpoint);
      }
    }
  }
}

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    version: '0.3.0',
    pushConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
    subscribers: clients.size,
    activeSignals: activeSignals.size,
    provider: 'Yahoo Finance web chart fallback',
    alerts: ['BUY SETUP', 'SELL STOP', 'SELL TARGET 1', 'SELL TARGET 2', 'SELL MOMENTUM EXIT'],
    note: 'Signals are analytical alerts only; orders are not sent to Awaed.'
  });
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/scan', async (req, res) => {
  try {
    const symbols = cleanTickers(req.body?.symbols);
    const results = await scanSymbols(symbols);
    res.json({ ok: true, results, at: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/subscribe', (req, res) => {
  const subscription = req.body?.subscription;
  if (!subscription?.endpoint) return res.status(400).json({ ok:false, error:'Missing subscription' });
  clients.set(subscription.endpoint, {
    subscription,
    watchlist: cleanTickers(req.body?.watchlist),
    minScore: Math.max(70, Math.min(95, Number(req.body?.minScore) || 78))
  });
  res.json({ ok:true, subscribers: clients.size });
});

app.post('/api/preferences', (req, res) => {
  const endpoint = req.body?.endpoint;
  const client = clients.get(endpoint);
  if (!client) return res.status(404).json({ ok:false, error:'Subscription not found' });
  client.watchlist = cleanTickers(req.body?.watchlist);
  client.minScore = Math.max(70, Math.min(95, Number(req.body?.minScore) || client.minScore));
  clients.set(endpoint, client);
  res.json({ ok:true });
});

app.post('/api/test-push', async (req, res) => {
  const endpoint = req.body?.endpoint;
  const client = clients.get(endpoint);
  if (!client) return res.status(404).json({ ok:false, error:'Enable notifications first' });
  try {
    await sendPush(client.subscription, {
      title: 'Awaed Copilot BUY/SELL alerts are live',
      body: 'You will receive paired BUY and EXIT notifications for tracked setups.',
      data: { url: '/' }
    });
    res.json({ ok:true });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

setInterval(scanAndNotify, 60 * 1000);
setTimeout(scanAndNotify, 10 * 1000);

app.listen(PORT, () => console.log(`Awaed Copilot listening on ${PORT}`));
