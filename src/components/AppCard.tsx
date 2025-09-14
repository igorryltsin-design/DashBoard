import React, { useState } from 'react';
import { App } from '../types';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  Trash2, 
  Circle,
  Globe,
  Server,
  Brain,
  Database,
  Monitor,
  Container,
  GripVertical,
  FileText,
  ExternalLink,
  XCircle
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface AppCardProps {
  app: App;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onEdit: (app: App) => void;
  onDelete: (id: string) => void;
}

const getAppIcon = (iconName: string) => {
  const icons = {
    Globe,
    Server,
    Brain,
    Database,
    Monitor,
    Container
  };
  const Icon = icons[iconName as keyof typeof icons] || Monitor;
  return Icon;
};

const getStatusColor = (status: App['status']) => {
  switch (status) {
    case 'running':
      return 'text-green-500';
    case 'stopped':
      return 'text-red-500';
    case 'starting':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

const getStatusText = (status: App['status']) => {
  switch (status) {
    case 'running':
      return 'Запущено';
    case 'stopped':
      return 'Остановлено';
    case 'starting':
      return 'Запускается';
    default:
      return 'Неизвестно';
  }
};

const getTypeText = (type: App['type']) => {
  switch (type) {
    case 'react':
      return 'React';
    case 'flask':
      return 'Flask';
    case 'python-conda':
      return 'Python (Conda)';
    case 'docker':
      return 'Docker';
    default:
      return 'Локальное';
  }
};

const AppCard: React.FC<AppCardProps> = ({
  app,
  onStart,
  onStop,
  onRestart,
  onEdit,
  onDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { user } = useAuth();
  const role = user?.role || 'viewer';
  const canOperate = role === 'operator' || role === 'admin';
  const canAdmin = role === 'admin';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getAppIcon(app.icon);
  const isRunning = app.status === 'running';
  const isStarting = app.status === 'starting';
  const canStart = (!isRunning && !isStarting) && canOperate;
  const canStop = (isRunning || isStarting) && canOperate;
  const openUrl = app.healthCheck || (app.port ? `http://localhost:${app.port}` : undefined);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-8 hover:shadow-lg transition-shadow cursor-pointer"
      {...attributes}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-3">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Перетащить"
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {app.imageUrl ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img src={app.imageUrl} alt="app" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <Icon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {app.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getTypeText(app.type)}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toast.dismiss(); }}
            className="hidden"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (canAdmin) onEdit(app);
                  setShowMenu(false);
                }}
                disabled={!canAdmin}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                Редактировать
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (canAdmin) onDelete(app.id);
                  setShowMenu(false);
                }}
                disabled={!canAdmin}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-red-600 dark:text-red-400 disabled:opacity-50"
              >
                Удалить
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  (window as any).openLogs?.(app.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              >
                Логи
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Circle className={`w-3 h-3 ${getStatusColor(app.status)} ${isStarting ? 'animate-pulse' : ''}`} fill="currentColor" />
          <span className={`text-sm font-medium ${getStatusColor(app.status)}`}>
            {getStatusText(app.status)}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {app.port && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              :{app.port}
            </span>
          )}
          {app.healthCheck && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const res: any = await api.healthCheck(app.id);
                  if (res.healthy) toast.success('Сервис отвечает');
                  else toast.error(`Проблема: HTTP ${res.httpCode}`);
                } catch {
                  toast.error('Не удалось выполнить проверку');
                } finally {
                  (window as any).refreshApps?.();
                }
              }}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Пинг
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (openUrl) window.open(openUrl, '_blank');
            }}
            disabled={!openUrl}
            title={openUrl ? 'Открыть в браузере' : 'URL не задан'}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              (window as any).openLogs?.(app.id);
            }}
            title="Логи"
            className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-row flex-wrap gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart(app.id);
          }}
          disabled={!canStart}
          className="w-10 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          title="Запустить"
        >
          <Play className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop(app.id);
          }}
          disabled={!canStop}
          className="w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          title="Остановить"
        >
          <Square className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // глобальный обработчик в Dashboard вызывает модалку пароля
            (window as any).forceStop?.(app.id);
          }}
          disabled={!canStop}
          className="w-10 h-10 flex items-center justify-center bg-red-600/20 hover:bg-red-600/30 text-red-600 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50"
          title="Принудительная остановка"
        >
          <XCircle className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestart(app.id);
          }}
          disabled={isStarting || !canOperate}
          className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          title="Перезапустить"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default AppCard;
