import { useState, useEffect, useCallback } from 'react';
import { App } from '../types';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export const useApps = () => {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.getApps();
      setApps(data);
    } catch (error) {
      toast.error('Ошибка загрузки приложений');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshApps = useCallback(async () => {
    setRefreshing(true);
    await loadApps();
    setRefreshing(false);
  }, [loadApps]);

  const createApp = async (appData: Omit<App, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newApp = await api.createApp(appData);
      setApps(prev => [...prev, newApp]);
      toast.success(`Приложение "${newApp.name}" создано`);
      return newApp;
    } catch (error) {
      toast.error('Ошибка создания приложения');
      throw error;
    }
  };

  const updateApp = async (id: string, updates: Partial<App>) => {
    try {
      const updatedApp = await api.updateApp(id, updates);
      setApps(prev => prev.map(app => app.id === id ? updatedApp : app));
      toast.success(`Приложение "${updatedApp.name}" обновлено`);
      return updatedApp;
    } catch (error) {
      toast.error('Ошибка обновления приложения');
      throw error;
    }
  };

  const deleteApp = async (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    try {
      await api.deleteApp(id);
      setApps(prev => prev.filter(a => a.id !== id));
      toast.success(`Приложение "${app.name}" удалено`);
    } catch (error) {
      toast.error('Ошибка удаления приложения');
      throw error;
    }
  };

  const reorderApps = async (newApps: App[]) => {
    try {
      await api.reorderApps(newApps);
      setApps(newApps);
    } catch (error) {
      toast.error('Ошибка сортировки');
      console.error(error);
    }
  };

  const startApp = async (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    // Обновляем статус на "запускается"
    setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'starting' as const } : a));
    
    try {
      await api.startApp(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'running' as const } : a));
      toast.success(`${app.name} запущен`);
      const url = app.healthCheck || (app.port ? `http://localhost:${app.port}` : undefined);
      if (app.autoOpen && url) {
        setTimeout(() => { try { window.open(url, '_blank'); } catch {} }, 300);
      }
      setTimeout(() => { loadApps(); }, 1200);
    } catch (error) {
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'stopped' as const } : a));
      toast.error(`Ошибка запуска ${app.name}: ${(error as Error).message}`);
      throw error;
    }
  };

  const stopApp = async (id: string, force: boolean = false) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    try {
      await api.stopApp(id, force);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'stopped' as const } : a));
      toast.success(`${app.name} остановлен`);
      setTimeout(() => { loadApps(); }, 800);
    } catch (error) {
      toast.error(`Ошибка остановки ${app.name}`);
      throw error;
    }
  };

  const restartApp = async (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'starting' as const } : a));

    try {
      await api.restartApp(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'running' as const } : a));
      toast.success(`${app.name} перезапущен`);
      setTimeout(() => { loadApps(); }, 1200);
    } catch (error) {
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'stopped' as const } : a));
      toast.error(`Ошибка перезапуска ${app.name}`);
      throw error;
    }
  };

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  return {
    apps,
    loading,
    refreshing,
    loadApps,
    refreshApps,
    createApp,
    updateApp,
    deleteApp,
    reorderApps,
    startApp,
    stopApp,
    restartApp,
  };
};
