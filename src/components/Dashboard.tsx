import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApps } from '../hooks/useApps';
import { App } from '../types';
import AppCard from './AppCard';
import AddAppModal from './AddAppModal';
import PasswordModal from './PasswordModal';
import LogModal from './LogModal';
import ThemeToggle from './ThemeToggle';
import AnalogClock from './AnalogClock';
import CalendarMonth from './CalendarMonth';
import SystemMonitor from './SystemMonitor';
import { 
  Plus, 
  Search, 
  LogOut, 
  RefreshCw, 
  Download, 
  Upload,
  User
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { api } from '../utils/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const role = user?.role || 'viewer';
  const canOperate = role === 'operator' || role === 'admin';
  const canAdmin = role === 'admin';
  const { 
    apps, 
    loading, 
    refreshing,
    refreshApps,
    createApp,
    updateApp,
    deleteApp,
    reorderApps,
    startApp,
    stopApp,
    restartApp 
  } = useApps();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [logAppId, setLogAppId] = useState<string | null>(null);
  const [sysInfo, setSysInfo] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => { (async () => { try { setSysInfo(await api.systemInfo()); } catch {} })(); }, []);

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Глобальный хук для открытия логов из карточки
  (window as any).openLogs = (id: string) => setLogAppId(id);
  (window as any).refreshApps = () => refreshApps();
  (window as any).forceStop = (id: string) => handleForceStop(id);

  const handlePasswordConfirm = (action: () => Promise<void>, title: string, message: string) => {
    // Если есть валидный reauth-токен — не спрашиваем пароль повторно
    if (api.takeReauthToken()) {
      action().catch(() => {});
      return;
    }
    setPasswordModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        setPasswordModal(prev => ({ ...prev, isOpen: false }));
        try {
          await action();
        } catch (error) {
          // Ошибки уже обрабатываются в хуке useApps
        }
      }
    });
  };

  const handleStart = (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    handlePasswordConfirm(
      () => startApp(id),
      'Запуск приложения',
      `Вы действительно хотите запустить "${app.name}"?`
    );
  };

  const handleStop = (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    handlePasswordConfirm(
      () => stopApp(id, false),
      'Остановка приложения',
      `Вы действительно хотите остановить "${app.name}"?`
    );
  };

  const handleForceStop = (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    handlePasswordConfirm(
      () => stopApp(id, true),
      'Принудительная остановка',
      `Принудительно остановить "${app.name}"? Возможна потеря данных.`
    );
  };

  const handleRestart = (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    handlePasswordConfirm(
      () => restartApp(id),
      'Перезапуск приложения',
      `Вы действительно хотите перезапустить "${app.name}"?`
    );
  };

  const handleEdit = (app: App) => {
    setEditingApp(app);
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    if (confirm(`Вы действительно хотите удалить "${app.name}"?`)) {
      deleteApp(id);
    }
  };

  const handleAddApp = async (appData: Omit<App, 'id' | 'createdAt' | 'updatedAt'>) => {
    setOperationLoading('create');
    try {
      if (editingApp) {
        await updateApp(editingApp.id, appData);
        setEditingApp(null);
      } else {
        await createApp(appData);
      }
      setShowAddModal(false);
    } catch (error) {
      // Ошибки уже обрабатываются в хуке useApps
    } finally {
      setOperationLoading(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = apps.findIndex(app => app.id === active.id);
      const newIndex = apps.findIndex(app => app.id === over.id);
      const newApps = arrayMove(apps, oldIndex, newIndex);
      reorderApps(newApps);
    }
  };

  const handleExport = () => {
    api.exportConfig()
      .then((config) => {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `app-manager-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Конфигурация экспортирована');
      })
      .catch(() => toast.error('Ошибка экспорта'));
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await api.importConfig(JSON.parse(text));
        window.location.reload(); // Простой способ обновить данные
        toast.success('Конфигурация импортирована');
      } catch (error) {
        toast.error('Ошибка импорта: неверный формат файла');
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Загрузка приложений...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                 <div className="text-xl font-bold text-gray-900 dark:text-white">Менеджер приложений</div>
                 <div className="text-[11px] text-gray-500 dark:text-gray-400">made by Ryltsin I.A.</div>
              </h1>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                {apps.length} приложений
              </span>
              {/* Бейджи Docker/Compose убраны из верхнего бара */}
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 w-64 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                  placeholder="Поиск приложений..."
                />
              </div>
              {canAdmin && (
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Экспорт конфигурации"
              >
                <Download className="w-5 h-5" />
              </button>
              )}

              {canAdmin && (
              <button
                onClick={handleImport}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Импорт конфигурации"
              >
                <Upload className="w-5 h-5" />
              </button>
              )}

              <button
                onClick={refreshApps}
                disabled={refreshing}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                title="Обновить статусы"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <ThemeToggle />

              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <User className="w-4 h-4" />
                <span>{user?.username}</span>
              </div>

              <button
                onClick={logout}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Выйти"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-none mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_420px] gap-8">
          {/* Left sticky sidebar: clock + calendar */}
          <aside className="hidden lg:flex flex-col items-center lg:items-start gap-4 sticky top-24 self-start">
            <AnalogClock size={240} />
            <div className="w-full max-w-sm">
              <CalendarMonth />
            </div>
          </aside>

          {/* Center scrollable content: controls + apps grid */}
          <section className="min-w-0">
            {/* Controls */}
            <div className="flex justify-end items-center gap-4 mb-6">
              {canAdmin && (
              <button
                onClick={() => { setEditingApp(null); setShowAddModal(true); }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Добавить приложение</span>
              </button>
              )}
            </div>

            {/* Apps Grid */}
            {filteredApps.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {searchTerm ? 'Приложения не найдены' : 'Нет приложений'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {searchTerm ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первое приложение для начала работы'}
                </p>
                {!searchTerm && canAdmin && (
                  <button
                    onClick={() => { setEditingApp(null); setShowAddModal(true); }}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Добавить приложение</span>
                  </button>
                )}
              </div>
            ) : (
              canAdmin ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredApps.map(app => app.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredApps.map(app => (
                      <AppCard key={app.id} app={app} onStart={handleStart} onStop={handleStop} onRestart={handleRestart} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredApps.map(app => (
                    <AppCard key={app.id} app={app} onStart={handleStart} onStop={handleStop} onRestart={handleRestart} onEdit={handleEdit} onDelete={handleDelete} />
                  ))}
                </div>
              )
            )}
          </section>

          {/* Right sticky sidebar: system monitor */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <SystemMonitor />
          </aside>
        </div>
      </main>

      {/* Modals */}
      {canAdmin && (
      <AddAppModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingApp(null);
        }}
        onSubmit={handleAddApp}
        editingApp={editingApp}
        loading={operationLoading === 'create'}
      />
      )}

      {canOperate && (
      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={passwordModal.onConfirm}
        title={passwordModal.title}
        message={passwordModal.message}
      />
      )}

      {logAppId && (
        <LogModal appId={logAppId} onClose={() => setLogAppId(null)} />
      )}
    </div>
  );
};

export default Dashboard;
