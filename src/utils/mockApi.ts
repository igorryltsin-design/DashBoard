import bcrypt from 'bcryptjs';
import { App, AppOperation, User, AppConfig } from '../types';

const STORAGE_KEY = 'app-manager-data';
const SESSION_KEY = 'app-manager-session';

// Демо пользователь (пароль: admin123)
const DEMO_USER: User = {
  id: '1',
  username: 'admin',
  role: 'admin'
};

const DEMO_PASSWORD_HASH = '$2a$10$8K1p/a0dclxKcK8S7gK8Le7VeDyDTKD.2FMJjP5V4HqDNPJNVhQfm'; // admin123

// Демо приложения
const DEMO_APPS: App[] = [
  {
    id: '1',
    name: 'React Portfolio',
    icon: 'Globe',
    type: 'react',
    status: 'running',
    startCommand: 'npm run start',
    healthCheck: 'http://localhost:3000',
    port: 3000,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Flask API',
    icon: 'Server',
    type: 'flask',
    status: 'stopped',
    startCommand: 'python app.py',
    stopCommand: 'pkill -f app.py',
    healthCheck: 'http://localhost:5000/health',
    port: 5000,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'ML Service',
    icon: 'Brain',
    type: 'python-conda',
    status: 'unknown',
    startCommand: 'python ml_service.py',
    environment: 'ml-env',
    healthCheck: 'http://localhost:8000',
    port: 8000,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'PostgreSQL',
    icon: 'Database',
    type: 'docker',
    status: 'running',
    startCommand: 'postgres:13',
    dockerImage: 'postgres:13',
    port: 5432,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// Нормализация и защита от битых/неполных данных в localStorage
const normalizeConfig = (raw: any): AppConfig => {
  const now = new Date().toISOString();

  // Settings
  const rawSettings = (raw && typeof raw === 'object' ? raw.settings : undefined) || {};
  const theme = rawSettings.theme === 'dark' || rawSettings.theme === 'light' ? rawSettings.theme : 'light';
  const settings: AppConfig['settings'] = {
    theme,
    autoRefresh: typeof rawSettings.autoRefresh === 'boolean' ? rawSettings.autoRefresh : true,
    refreshInterval: typeof rawSettings.refreshInterval === 'number' ? rawSettings.refreshInterval : 5000,
  };

  // Apps
  const rawApps: any[] = Array.isArray(raw?.apps) ? raw.apps : [];
  const apps: App[] = rawApps.map((a, idx) => {
    const createdAt = typeof a?.createdAt === 'string' ? a.createdAt : now;
    const updatedAt = typeof a?.updatedAt === 'string' ? a.updatedAt : now;
    const status: App['status'] = a?.status === 'running' || a?.status === 'starting' || a?.status === 'stopped' ? a.status : 'stopped';
    const type: App['type'] = ['local', 'react', 'flask', 'python-conda', 'docker'].includes(a?.type) ? a.type : 'local';
    const order = typeof a?.order === 'number' && Number.isFinite(a.order) ? a.order : idx;
    return {
      id: String(a?.id ?? `${Date.now()}-${idx}`),
      name: String(a?.name ?? 'Без названия'),
      icon: String(a?.icon ?? 'Monitor'),
      type,
      status,
      startCommand: String(a?.startCommand ?? ''),
      stopCommand: a?.stopCommand ? String(a.stopCommand) : undefined,
      healthCheck: a?.healthCheck ? String(a.healthCheck) : undefined,
      environment: a?.environment ? String(a.environment) : undefined,
      dockerImage: a?.dockerImage ? String(a.dockerImage) : undefined,
      port: typeof a?.port === 'number' && Number.isFinite(a.port) ? a.port : undefined,
      order,
      createdAt,
      updatedAt,
    };
  });

  // Operations
  const rawOps: any[] = Array.isArray(raw?.operations) ? raw.operations : [];
  const operations: AppOperation[] = rawOps.map((op, idx) => ({
    id: String(op?.id ?? `${Date.now()}-op-${idx}`),
    appId: String(op?.appId ?? ''),
    operation: op?.operation === 'start' || op?.operation === 'stop' || op?.operation === 'restart' ? op.operation : 'start',
    user: String(op?.user ?? 'admin'),
    timestamp: typeof op?.timestamp === 'string' ? op.timestamp : now,
    success: Boolean(op?.success),
    error: op?.error ? String(op.error) : undefined,
  }));

  return { apps, operations, settings };
};

const getDefaultConfig = (): AppConfig => ({
  apps: DEMO_APPS,
  operations: [],
  settings: {
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 5000,
  }
});

const getStorageData = (): AppConfig => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const normalized = normalizeConfig(parsed);
      // Перезапишем нормализованные данные, чтобы починить структуру навсегда
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      // Если что-то пошло не так — сбрасываем к дефолту
      const def = getDefaultConfig();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
      return def;
    }
  }

  const def = getDefaultConfig();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
  return def;
};

const saveStorageData = (data: AppConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const mockApi = {
  // Авторизация
  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    await new Promise(resolve => setTimeout(resolve, 500)); // имитация задержки
    
    if (username === 'admin' && bcrypt.compareSync(password, DEMO_PASSWORD_HASH)) {
      const token = 'demo-jwt-token-' + Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: DEMO_USER, token }));
      return { user: DEMO_USER, token };
    }
    
    throw new Error('Неверный логин или пароль');
  },

  async verifyPassword(password: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return bcrypt.compareSync(password, DEMO_PASSWORD_HASH);
  },

  getSession(): { user: User; token: string } | null {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  // Приложения
  async getApps(): Promise<App[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const data = getStorageData();
    return data.apps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  async createApp(app: Omit<App, 'id' | 'createdAt' | 'updatedAt'>): Promise<App> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const data = getStorageData();
    const newApp: App = {
      ...app,
      id: Date.now().toString(),
      // если порядок не указан — добавляем в конец
      order: typeof (app as any)?.order === 'number' ? (app as any).order : data.apps.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    data.apps.push(newApp);
    saveStorageData(data);
    return newApp;
  },

  async updateApp(id: string, updates: Partial<App>): Promise<App> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const data = getStorageData();
    const index = data.apps.findIndex(app => app.id === id);
    if (index === -1) throw new Error('Приложение не найдено');
    
    data.apps[index] = { ...data.apps[index], ...updates, updatedAt: new Date().toISOString() };
    saveStorageData(data);
    return data.apps[index];
  },

  async deleteApp(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const data = getStorageData();
    data.apps = data.apps.filter(app => app.id !== id);
    saveStorageData(data);
  },

  async reorderApps(apps: App[]): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const data = getStorageData();
    data.apps = apps.map((app, index) => ({ ...app, order: index }));
    saveStorageData(data);
  },

  // Операции с приложениями
  async startApp(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1500)); // имитация запуска
    
    const data = getStorageData();
    const app = data.apps.find(app => app.id === id);
    if (!app) throw new Error('Приложение не найдено');
    
    // Имитация случайной ошибки
    if (Math.random() < 0.1) {
      throw new Error('Не удалось запустить приложение');
    }
    
    app.status = 'running';
    app.updatedAt = new Date().toISOString();
    
    const operation: AppOperation = {
      id: Date.now().toString(),
      appId: id,
      operation: 'start',
      user: 'admin',
      timestamp: new Date().toISOString(),
      success: true,
    };
    
    data.operations.unshift(operation);
    saveStorageData(data);
  },

  async stopApp(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const data = getStorageData();
    const app = data.apps.find(app => app.id === id);
    if (!app) throw new Error('Приложение не найдено');
    
    app.status = 'stopped';
    app.updatedAt = new Date().toISOString();
    
    const operation: AppOperation = {
      id: Date.now().toString(),
      appId: id,
      operation: 'stop',
      user: 'admin',
      timestamp: new Date().toISOString(),
      success: true,
    };
    
    data.operations.unshift(operation);
    saveStorageData(data);
  },

  async restartApp(id: string): Promise<void> {
    await this.stopApp(id);
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.startApp(id);
  },

  async getAppStatus(id: string): Promise<App['status']> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const data = getStorageData();
    const app = data.apps.find(app => app.id === id);
    return app?.status || 'unknown';
  },

  // Настройки
  async getSettings() {
    const data = getStorageData();
    return data.settings;
  },

  async updateSettings(settings: Partial<AppConfig['settings']>) {
    const data = getStorageData();
    data.settings = { ...data.settings, ...settings };
    saveStorageData(data);
  },

  // История операций
  async getOperations(): Promise<AppOperation[]> {
    const data = getStorageData();
    return data.operations.slice(0, 50); // последние 50 операций
  },

  // Экспорт/импорт
  exportConfig(): string {
    const data = getStorageData();
    return JSON.stringify(data, null, 2);
  },

  async importConfig(configJson: string): Promise<void> {
    try {
      const config: AppConfig = JSON.parse(configJson);
      saveStorageData(config);
    } catch (error) {
      throw new Error('Неверный формат конфигурации');
    }
  }
};
