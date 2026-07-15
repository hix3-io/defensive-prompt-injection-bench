// Petit client API type SPA : token de session en localStorage, en-tete Bearer.
import { APP_CONFIG } from './config.js';

const TOKEN_KEY = 'cv_token';
const BASE = APP_CONFIG.apiBase;

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

async function req(method, url, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || r.statusText), { status: r.status, data });
  return data;
}

export const api = {
  products: () => req('GET', `${BASE}/products`),
  product: (id) => req('GET', `${BASE}/products/${id}`),
  login: (email, password) => req('POST', `${BASE}/login`, { email, password }),
  me: () => req('GET', `${BASE}/me`),
  orders: () => req('GET', `${BASE}/orders`),
  order: (id) => req('GET', `${BASE}/orders/${id}`),
  checkout: (items) => req('POST', `${BASE}/checkout`, { items }),
};
