// Simple API wrapper around the local server

let authToken: string | null = null;
let pendingReauthToken: string | null = null;
let reauthExpiresAt: number | null = null; // epoch ms

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request(path: string, method: HttpMethod = 'GET', body?: any, extraHeaders: Record<string,string> = {}) {
  const headers: Record<string,string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  async get(path: string) { return request(path, 'GET'); },
  setToken(token: string | null) {
    authToken = token;
  },
  // one-time use token for privileged actions
  setReauthToken(token: string, ttlSec?: number) {
    pendingReauthToken = token;
    const ttl = typeof ttlSec === 'number' && ttlSec > 0 ? ttlSec : 600; // default 10m
    reauthExpiresAt = Date.now() + (ttl * 1000) - 5000; // 5s safety margin
  },
  takeReauthToken(): string | null {
    if (!pendingReauthToken) return null;
    if (reauthExpiresAt && Date.now() > reauthExpiresAt) {
      pendingReauthToken = null; reauthExpiresAt = null; return null;
    }
    return pendingReauthToken;
  },

  // auth
  async login(username: string, password: string) {
    return request('/auth/login', 'POST', { username, password });
  },
  async reauth(password: string) {
    const data = await request('/auth/reauth', 'POST', { password });
    return data as { reauthToken: string; expiresInSec?: number };
  },

  // apps
  async getApps() { return request('/apps'); },
  async createApp(app: any) { return request('/apps', 'POST', app); },
  async updateApp(id: string, updates: any) { return request(`/apps/${id}`, 'PUT', updates); },
  async deleteApp(id: string) { return request(`/apps/${id}`, 'DELETE'); },
  async reorderApps(apps: any[]) { return request('/apps/reorder', 'POST', apps); },
  async startApp(id: string) {
    const t = api.takeReauthToken();
    if (!t) throw new Error('Требуется подтверждение паролем');
    return request(`/apps/${id}/start`, 'POST', {}, { 'x-reauth-token': t });
  },
  async stopApp(id: string, force: boolean = false) {
    const t = api.takeReauthToken();
    if (!t) throw new Error('Требуется подтверждение паролем');
    const q = force ? '?force=1' : '';
    return request(`/apps/${id}/stop${q}`, 'POST', {}, { 'x-reauth-token': t });
  },
  async restartApp(id: string) {
    const t = api.takeReauthToken();
    if (!t) throw new Error('Требуется подтверждение паролем');
    return request(`/apps/${id}/restart`, 'POST', {}, { 'x-reauth-token': t });
  },
  async healthCheck(id: string) { return request(`/apps/${id}/health`, 'GET'); },
  async getLogs(id: string) { return request(`/apps/${id}/logs`, 'GET'); },

  // config
  async exportConfig() { return request('/config/export'); },
  async importConfig(config: any) { return request('/config/import', 'POST', config); },

  // system
  async systemInfo() { return request('/system/info'); },
  async systemMetrics() { return request('/system/metrics'); },
  async fsList(dirPath: string) {
    const q = encodeURIComponent(dirPath || '');
    return request(`/fs/list?path=${q}`);
  },
};
