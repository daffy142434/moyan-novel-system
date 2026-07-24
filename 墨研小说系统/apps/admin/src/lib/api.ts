'use client';
const API = 'http://localhost:3100/api';
const TOKEN_KEY = 'moyan_admin_token';
const ROLE_KEY = 'moyan_admin_role';
const PERMS_KEY = 'moyan_admin_perms';

export function setToken(token: string) { if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token); }
export function getToken() { return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null; }
export function clearToken() { if (typeof window !== 'undefined') { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ROLE_KEY); localStorage.removeItem(PERMS_KEY); } }
export function getRole() { return typeof window !== 'undefined' ? localStorage.getItem(ROLE_KEY) : null; }
export function setRole(role: string) { if (typeof window !== 'undefined') localStorage.setItem(ROLE_KEY, role); }
export function getPermissions(): string[] { try { return JSON.parse(localStorage.getItem(PERMS_KEY) || '[]'); } catch { return []; } }
export function setPermissions(perms: string[]) { localStorage.setItem(PERMS_KEY, JSON.stringify(perms)); }
export function isAdmin() { return getRole() === 'admin'; }

async function api(method: string, path: string, body?: unknown) {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { clearToken(); throw new Error('未授权，请重新登录'); }
  if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw new Error(err.message || err.code || res.statusText); }
  return res.json();
}

// ====== Auth ======
export const auth = {
  login: (email: string, password: string) => api('POST', '/admin/login', { email, password }),
};

// ====== Models ======
export const sysModels = {
  list: () => api('GET', '/admin/models'),
  create: (data: any) => api('POST', '/admin/models', data),
  update: (id: string, data: any) => api('PUT', `/admin/models/${id}`, data),
  remove: (id: string) => api('DELETE', `/admin/models/${id}`),
};

// ====== Users ======
export const users = {
  list: (page?: number, search?: string) => api('GET', `/admin/users?page=${page || 1}&search=${encodeURIComponent(search || '')}`),
  update: (id: string, data: any) => api('PUT', `/admin/users/${id}`, data),
  create: (data: { email: string; password: string; displayName?: string; role?: string }) => api('POST', '/admin/create-user', data),
  me: () => api('GET', '/admin/me'),
};

// ====== Usage ======
export const usage = {
  stats: (days?: number) => api('GET', `/admin/usage/stats?days=${days || 30}`),
  byUser: (page?: number) => api('GET', `/admin/usage/by-user?page=${page || 1}`),
};

// ====== Dashboard ======
export const dashboard = {
  summary: () => api('GET', '/admin/dashboard'),
  modelUsage: () => api('GET', '/admin/monitor/models'),
  activity: (days?: number) => api('GET', `/admin/activity?days=${days || 7}`),
};

// ====== Skills ======
export const skills = {
  list: () => api('GET', '/admin/skills'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    return fetch(`${API}/admin/skills`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }).then(r => r.json());
  },
  remove: (name: string) => api('DELETE', `/admin/skills/${encodeURIComponent(name)}`),
};

// ====== Logs ======
export const logs = {
  list: (page?: number) => api('GET', `/admin/logs?page=${page || 1}`),
};

// ====== Memberships ======
export const memberships = {
  list: (page?: number, search?: string) => api('GET', `/admin/memberships?page=${page || 1}&search=${encodeURIComponent(search || '')}`),
};

// ====== Product Configs ======
export const productConfigs = {
  list: () => api('GET', '/admin/product-configs'),
  save: (data: any) => api('POST', '/admin/product-configs', data),
  remove: (id: string) => api('DELETE', `/admin/product-configs/${id}`),
};

// ====== Settings ======
export const settings = {
  get: () => api('GET', '/admin/settings'),
  update: (data: any) => api('PUT', '/admin/settings', data),
};
