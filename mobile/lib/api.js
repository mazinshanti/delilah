const PRIMARY_API = process.env.EXPO_PUBLIC_DALELAH_API_URL || 'https://www.dalelah.co';
const SEARCH_FALLBACK_API = process.env.EXPO_PUBLIC_DALELAH_SEARCH_FALLBACK_URL || 'https://delilah-pm5f.onrender.com';
const MARKETPLACE_API = process.env.EXPO_PUBLIC_DALELAH_MARKETPLACE_URL || PRIMARY_API;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function mergeByUrl(map, cars = []) {
  for (const car of Array.isArray(cars) ? cars : []) {
    const key = car?.url || car?.originalUrl || car?.id || `${car?.title || 'car'}:${car?.price || ''}`;
    if (!key) continue;
    map.set(key, { ...(map.get(key) || {}), ...car });
  }
}

async function jsonFetch(url, options = {}, timeoutMs = 55_000) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!response.ok) throw new Error(data?.detail || data?.error || `Dalelah HTTP ${response.status}`);
    if (!data) throw new Error('Dalelah returned an invalid response');
    return data;
  } catch (error) {
    if (/Dalelah HTTP|invalid response|Search|Valuation|Marketplace/i.test(String(error?.message || ''))) throw error;
    throw new Error('Could not reach Dalelah. Check your connection and try again.');
  }
}

async function startSearch(base, payload) {
  return jsonFetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  }, 65_000);
}

export async function searchCars({ query, condition = 'used', filters = {} }, onUpdate) {
  const payload = { query, condition, filters };
  let activeBase = PRIMARY_API;
  let first;
  try {
    first = await startSearch(PRIMARY_API, payload);
  } catch (primaryError) {
    if (SEARCH_FALLBACK_API === PRIMARY_API) throw primaryError;
    activeBase = SEARCH_FALLBACK_API;
    first = await startSearch(SEARCH_FALLBACK_API, payload);
  }

  const byUrl = new Map();
  mergeByUrl(byUrl, first.listings);
  onUpdate?.([...byUrl.values()], first);
  let data = first;

  if (data.searchId) {
    for (let i = 0; i < 12 && data.complete !== true; i += 1) {
      await sleep(800);
      try {
        data = await jsonFetch(`${activeBase}/api/search/progress/${encodeURIComponent(data.searchId)}`, {}, 35_000);
      } catch {
        break;
      }
      mergeByUrl(byUrl, data.listings);
      onUpdate?.([...byUrl.values()], data);
    }
  }
  return { listings: [...byUrl.values()], meta: data };
}

export async function estimateCar(vehicle) {
  return jsonFetch(`${MARKETPLACE_API}/api/sell/estimate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(vehicle)
  }, 90_000);
}

export async function marketplaceStatus() {
  return jsonFetch(`${MARKETPLACE_API}/api/marketplace/status`, {}, 30_000);
}

export const apiConfig = {
  search: PRIMARY_API,
  searchFallback: SEARCH_FALLBACK_API,
  marketplace: MARKETPLACE_API
};
