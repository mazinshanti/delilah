require('./server');

setTimeout(async () => {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=5m&range=1d&includePrePost=true';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AwaedCopilot/0.2', 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const close = result?.indicators?.quote?.[0]?.close?.filter(v => typeof v === 'number')?.at(-1);
    if (typeof close !== 'number') throw new Error('No AAPL close returned');
    console.log(`MARKET_SELFTEST_OK AAPL ${close.toFixed(2)} PUSH_${process.env.VAPID_PUBLIC_KEY ? 'ON' : 'OFF'}`);
  } catch (err) {
    console.error(`MARKET_SELFTEST_FAIL ${err.message}`);
  }
}, 5000);
