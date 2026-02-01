import { API_BASE_URL } from './config.js';

export function resolveUrl(maybePath) {
  const p = String(maybePath || '');
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (!API_BASE_URL) return p;
  if (p.startsWith('/')) return `${API_BASE_URL}${p}`;
  return `${API_BASE_URL}/${p}`;
}
