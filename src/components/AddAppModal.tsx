import React, { useState, useEffect } from 'react';
import { X, Globe, Server, Brain, Database, Monitor, Container, FolderOpen } from 'lucide-react';
import { App } from '../types';
import FilePickerModal from './FilePickerModal';

interface AddAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (app: Omit<App, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingApp?: App | null;
  loading?: boolean;
}

const icons = [
  { name: 'Globe', icon: Globe, label: 'Веб' },
  { name: 'Server', icon: Server, label: 'Сервер' },
  { name: 'Brain', icon: Brain, label: 'ИИ/ML' },
  { name: 'Database', icon: Database, label: 'База данных' },
  { name: 'Monitor', icon: Monitor, label: 'Монитор' },
  { name: 'Container', icon: Container, label: 'Контейнер' },
];

const appTypes = [
  { value: 'local', label: 'Локальное приложение' },
  { value: 'react', label: 'React приложение' },
  { value: 'flask', label: 'Flask приложение' },
  { value: 'python-conda', label: 'Python (Anaconda)' },
  { value: 'docker', label: 'Docker контейнер' },
];

const AddAppModal: React.FC<AddAppModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingApp,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    icon: 'Monitor',
    imageUrl: '',
    type: 'local' as App['type'],
    status: 'stopped' as App['status'],
    startCommand: '',
    stopCommand: '',
    cwd: '',
    healthCheck: '',
    environment: '',
    dockerImage: '',
    dockerComposeFile: '',
    dockerComposeProject: '',
    dockerArchive: '',
    dockerPorts: '', // comma separated
    dockerVolumes: '', // comma separated
    dockerEnv: '', // comma separated KEY=VALUE
    dockerNetwork: '',
    port: '',
    autoOpen: false,
    order: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<{ startCommand?: boolean }>({});
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerFor, setFilePickerFor] = useState<'start' | 'compose' | 'archive'>('start');
  const [detectedPlatform, setDetectedPlatform] = useState<'win'|'unix'>('unix');

  useEffect(() => {
    if (editingApp) {
      setFormData({
        name: editingApp.name,
        icon: editingApp.icon,
        imageUrl: editingApp.imageUrl || '',
        type: editingApp.type,
        status: editingApp.status,
        startCommand: editingApp.startCommand,
        stopCommand: editingApp.stopCommand || '',
        cwd: editingApp.cwd || '',
        healthCheck: editingApp.healthCheck || '',
        environment: editingApp.environment || '',
        dockerImage: editingApp.dockerImage || '',
        dockerComposeFile: (editingApp as any).dockerComposeFile || '',
        dockerComposeProject: (editingApp as any).dockerComposeProject || '',
        dockerArchive: (editingApp as any).dockerArchive || '',
        dockerPorts: (editingApp.dockerPorts || []).join(', '),
        dockerVolumes: (editingApp.dockerVolumes || []).join(', '),
        dockerEnv: (editingApp.dockerEnv || []).join(', '),
        dockerNetwork: editingApp.dockerNetwork || '',
        port: editingApp.port?.toString() || '',
        autoOpen: !!editingApp.autoOpen,
        order: editingApp.order,
      });
    } else {
      setFormData({
        name: '',
        icon: 'Monitor',
        imageUrl: '',
        type: 'local',
        status: 'stopped',
        startCommand: '',
        stopCommand: '',
        cwd: '',
        healthCheck: '',
        environment: '',
        dockerImage: '',
        dockerComposeFile: '',
        dockerComposeProject: '',
        dockerArchive: '',
        dockerPorts: '',
        dockerVolumes: '',
        dockerEnv: '',
        dockerNetwork: '',
        port: '',
        autoOpen: false,
        order: 0,
      });
    }
    setErrors({});
  }, [editingApp, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно';
    }

    if (formData.type !== 'docker' && !formData.startCommand.trim()) {
      newErrors.startCommand = 'Команда запуска обязательна';
    }

    if (formData.type === 'python-conda' && !formData.environment.trim()) {
      newErrors.environment = 'Укажите окружение Anaconda';
    }

    if (formData.type === 'docker' && !formData.dockerImage.trim() && !formData.dockerComposeFile.trim()) {
      newErrors.dockerImage = 'Укажите Docker образ или Compose файл';
    }

    if (formData.port && (isNaN(Number(formData.port)) || Number(formData.port) < 1 || Number(formData.port) > 65535)) {
      newErrors.port = 'Некорректный порт (1-65535)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Определение ОС для пресетов
  const getOS = () => {
    const ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'win';
    return 'unix';
  };

  const getPresets = (type: App['type']) => {
    const os = getOS();
    switch (type) {
      case 'react':
        return { start: os === 'win' ? 'npm run start' : 'npm run start', stop: 'npm stop' };
      case 'flask':
        return { start: os === 'win' ? 'python app.py' : 'python app.py', stop: '' };
      case 'python-conda':
        return { start: `conda run -n ${formData.environment || '<env>'} python app.py`, stop: '' };
      case 'docker':
        return { start: '', stop: '' };
      default:
        // Local desktop app example presets
        if (os === 'win') {
          return { start: 'start "" winword', stop: 'taskkill /IM WINWORD.EXE /F' };
        }
        // macOS
        return { start: 'open -a "Microsoft Word"', stop: "osascript -e 'quit app \"Microsoft Word\"'" };
    }
  };

  // Автоподстановка при смене типа (если не редактировали вручную)
  useEffect(() => {
    const preset = getPresets(formData.type);
    if (!touched.startCommand) {
      setFormData(prev => ({ ...prev, startCommand: preset.start, stopCommand: prev.stopCommand || preset.stop }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.type]);

  useEffect(() => {
    setDetectedPlatform(getOS());
  }, [isOpen]);

  // Обновление команды при смене окружения для conda
  useEffect(() => {
    if (formData.type === 'python-conda' && !touched.startCommand) {
      const preset = getPresets('python-conda');
      setFormData(prev => ({ ...prev, startCommand: preset.start }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.environment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const appData: Omit<App, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name.trim(),
      icon: formData.icon,
      imageUrl: formData.imageUrl.trim() || undefined,
      type: formData.type,
      status: formData.status,
      startCommand: formData.startCommand.trim(),
      stopCommand: formData.stopCommand.trim() || undefined,
      cwd: formData.cwd.trim() || undefined,
      healthCheck: formData.healthCheck.trim() || undefined,
      environment: formData.environment.trim() || undefined,
      dockerImage: formData.dockerImage.trim() || undefined,
      dockerComposeFile: formData.dockerComposeFile.trim() || undefined,
      dockerComposeProject: formData.dockerComposeProject.trim() || undefined,
      dockerArchive: formData.dockerArchive.trim() || undefined,
      dockerPorts: formData.dockerPorts
        ? formData.dockerPorts.split(',').map(p => p.trim()).filter(Boolean)
        : undefined,
      dockerVolumes: formData.dockerVolumes
        ? formData.dockerVolumes.split(',').map(v => v.trim()).filter(Boolean)
        : undefined,
      dockerEnv: formData.dockerEnv
        ? formData.dockerEnv.split(',').map(e => e.trim()).filter(Boolean)
        : undefined,
      dockerNetwork: formData.dockerNetwork.trim() || undefined,
      port: formData.port ? Number(formData.port) : undefined,
      autoOpen: formData.autoOpen || undefined,
      order: formData.order,
    };

    onSubmit(appData);
  };

  const getPlaceholderCommand = () => {
    switch (formData.type) {
      case 'react':
        return 'npm run start или yarn start';
      case 'flask':
        return 'python app.py или flask run';
      case 'python-conda':
        return 'python app.py';
      case 'docker':
        return 'nginx:latest';
      default:
        return './my-app или node server.js';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingApp ? 'Редактировать приложение' : 'Добавить приложение'}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Название *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.name ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Мое приложение"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Тип приложения
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as App['type'] }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {appTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Картинка плитки (URL или data:)
            </label>
            <input
              type="text"
              value={formData.imageUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="https://... или data:image/png;base64,..."
            />
            {formData.imageUrl && (
              <div className="mt-2">
                <img src={formData.imageUrl} alt="preview" className="h-24 w-auto rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Иконка
            </label>
            <div className="grid grid-cols-6 gap-2">
              {icons.map(({ name, icon: IconComponent, label }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    formData.icon === name
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                  title={label}
                >
                  <IconComponent className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {formData.type === 'docker' ? 'Docker образ' : 'Команда запуска *'}
            </label>
              <div className="flex gap-2">
              <input
                type="text"
                value={formData.type === 'docker' ? formData.dockerImage : formData.startCommand}
              onChange={(e) => { setTouched(prev => ({ ...prev, startCommand: true })); setFormData(prev => 
                formData.type === 'docker'
                  ? { ...prev, dockerImage: e.target.value }
                  : { ...prev, startCommand: e.target.value }
              );}}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  (errors.startCommand || errors.dockerImage) 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder={getPlaceholderCommand()}
            />
            {formData.type !== 'docker' && (
              <button
                type="button"
                onClick={() => { setFilePickerFor('start'); setShowFilePicker(true); }}
                className="px-3 py-2 whitespace-nowrap bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Выбрать файл (.exe/.app/.bat/.sh)"
              >
                <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4"/>Выбрать</span>
              </button>
            )}
            </div>
            {(errors.startCommand || errors.dockerImage) && (
              <p className="text-red-500 text-sm mt-1">{errors.startCommand || errors.dockerImage}</p>
            )}
          </div>

          {formData.type !== 'docker' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Команда остановки
              </label>
              <input
                type="text"
                value={formData.stopCommand}
                onChange={(e) => setFormData(prev => ({ ...prev, stopCommand: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="pkill -f my-app или оставьте пустым"
              />
            </div>
          )}

          {formData.type === 'docker' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Docker Compose файл (.yml/.yaml)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.dockerComposeFile}
                    onChange={(e) => setFormData(prev => ({ ...prev, dockerComposeFile: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="/path/to/docker-compose.yml"
                  />
                  <button type="button" onClick={() => { setFilePickerFor('compose'); setShowFilePicker(true); }} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Выбрать</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Проект Compose (-p)
                  </label>
                  <input
                    type="text"
                    value={formData.dockerComposeProject}
                    onChange={(e) => setFormData(prev => ({ ...prev, dockerComposeProject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="app-myservice"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Архив образа (.tar/.tar.gz)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.dockerArchive}
                      onChange={(e) => setFormData(prev => ({ ...prev, dockerArchive: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="/path/to/image.tar"
                    />
                    <button type="button" onClick={() => { setFilePickerFor('archive'); setShowFilePicker(true); }} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Выбрать</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Порты (через запятую)
                </label>
                <input
                  type="text"
                  value={formData.dockerPorts}
                  onChange={(e) => setFormData(prev => ({ ...prev, dockerPorts: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="3000:3000, 80:80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Томы (через запятую)
                </label>
                <input
                  type="text"
                  value={formData.dockerVolumes}
                  onChange={(e) => setFormData(prev => ({ ...prev, dockerVolumes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="/host/path:/container/path, /data:/data"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Переменные окружения (через запятую)
                </label>
                <input
                  type="text"
                  value={formData.dockerEnv}
                  onChange={(e) => setFormData(prev => ({ ...prev, dockerEnv: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="KEY=VALUE, NODE_ENV=production"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Сеть Docker
                </label>
                <input
                  type="text"
                  value={formData.dockerNetwork}
                  onChange={(e) => setFormData(prev => ({ ...prev, dockerNetwork: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="bridge (по умолчанию) или my-network"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Рабочая папка (cwd)
            </label>
            <input
              type="text"
              value={formData.cwd}
              onChange={(e) => setFormData(prev => ({ ...prev, cwd: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="/absolute/path/to/project"
            />
          </div>

          {formData.type === 'python-conda' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Anaconda окружение *
              </label>
              <input
                type="text"
                value={formData.environment}
                onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.environment ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="myenv"
              />
              {errors.environment && <p className="text-red-500 text-sm mt-1">{errors.environment}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Порт
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.port ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="3000"
                min="1"
                max="65535"
              />
              {errors.port && <p className="text-red-500 text-sm mt-1">{errors.port}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Проверка здоровья
              </label>
              <input
                type="text"
                value={formData.healthCheck}
                onChange={(e) => setFormData(prev => ({ ...prev, healthCheck: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="http://localhost:3000/health"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.autoOpen}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoOpen: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Открывать URL после запуска</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Сохранение...' : (editingApp ? 'Сохранить' : 'Создать')}
            </button>
          </div>
        </form>
      </div>

      {/* File Picker Modal */}
      {showFilePicker && (
        <FilePickerModal
          isOpen={showFilePicker}
          onClose={() => setShowFilePicker(false)}
          title={filePickerFor === 'compose' ? 'Выберите docker-compose.yml' : filePickerFor === 'archive' ? 'Выберите архив образа Docker' : 'Выберите исполняемый файл или скрипт'}
          acceptExts={filePickerFor === 'compose' ? ['.yml', '.yaml'] : filePickerFor === 'archive' ? ['.tar', '.gz', '.tgz'] : (detectedPlatform === 'win' ? ['.exe', '.bat', '.cmd'] : ['.app', '.sh'])}
          onSelect={(fullPath, platform) => {
            if (filePickerFor === 'compose') {
              setFormData(prev => ({ ...prev, dockerComposeFile: fullPath }));
            } else if (filePickerFor === 'archive') {
              setFormData(prev => ({ ...prev, dockerArchive: fullPath }));
            } else {
              const isWin = platform === 'win32';
              const lower = fullPath.toLowerCase();
              let start = '';
              if (!isWin && lower.endsWith('.app')) {
                start = `open "${fullPath}"`;
              } else if (!isWin && lower.endsWith('.sh')) {
                start = `bash "${fullPath}"`;
              } else {
                start = `"${fullPath}"`;
              }
              setFormData(prev => ({
                ...prev,
                startCommand: start,
                cwd: prev.cwd || fullPath.replace(/[\\/][^\\/]+$/, ''),
              }));
              setTouched(prev => ({ ...prev, startCommand: true }));
            }
            setShowFilePicker(false);
          }}
        />
      )}
    </div>
  );
};

export default AddAppModal;
