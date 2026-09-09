const PREVIEW_API = 'https://dalelah-sell-preview.onrender.com';
const SEARCH_API = process.env.EXPO_PUBLIC_DALELAH_API_URL || PREVIEW_API;
const MARKETPLACE_API = process.env.EXPO_PUBLIC_DALELAH_MARKETPLACE_URL || PREVIEW_API;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function mergeByUrl(map, cars = []) {
  for (const car of Array.isArray(cars) ? cars : []) {
    const key = car?.url || car?.originalUrl || car?.id || `${car?.title || 'car'}:${car?.price || ''}`;
    if (!key) continue;
    map.set(key, { ...(map.get(key) || {}), ...car });
  }
}

export async function searchCars({ query, condition = 'used', filters = {} }, onUpdate) {
  const response = await fetch(`${SEARCH_API}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, condition, filters })
  });
  const first = await response.json();
  if (!response.ok) throw new Error(first?.error || 'Search unavailable');

  const byUrl = new Map();
  mergeByUrl(byUrl, first.listings);
  onUpdate?.([...byUrl.values()], first);
  let data = first;

  if (data.searchId) {
    for (let i = 0; i < 12 && data.complete !== true; i += 1) {
      await sleep(800);
      const progress = await fetch(`${SEARCH_API}/api/search/progress/${encodeURIComponent(data.searchId)}`);
      if (!progress.ok) break;
      data = await progress.json();
      mergeByUrl(byUrl, data.listings);
      onUpdate?.([...byUrl.values()], data);
    }
  }
  return { listings: [...byUrl.values()], meta: data };
}

export async function estimateCar(vehicle) {
  const response = await fetch(`${MARKETPLACE_API}/api/sell/estimate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(vehicle)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail || data?.error || 'Valuation unavailable');
  return data;
}

export async function marketplaceStatus() {
  const response = await fetch(`${MARKETPLACE_API}/api/marketplace/status`);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Marketplace unavailable');
  return data;
}

export const apiConfig = { search: SEARCH_API, marketplace: MARKETPLACE_API };
