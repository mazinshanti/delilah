export const colors = {
  bg: '#090A0B',
  panel: '#111316',
  panel2: '#171A1F',
  line: '#2B3037',
  text: '#F7F6F1',
  muted: '#9298A1',
  accent: '#D8FF5A',
  ok: '#AAFC8B',
  bad: '#FF9999',
  white: '#FFFFFF',
  black: '#090A0B'
};

export const money = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n).toLocaleString('en-SA')} SAR` : 'Price unavailable';
};

export const number = value => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n.toLocaleString('en-SA') : null;
};
