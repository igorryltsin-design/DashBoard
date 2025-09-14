import React, { useEffect, useMemo, useState } from 'react';
import { Folder, File, X, ChevronLeft, RefreshCw, Search } from 'lucide-react';
import { api } from '../utils/api';

interface FilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fullPath: string, platform: string) => void;
  title?: string;
  acceptExts?: string[]; // e.g. ['.exe','.bat','.cmd','.sh','.app'] lowercased
}

type FsEntry = { name: string; path: string; isDir: boolean; ext: string };

const FilePickerModal: React.FC<FilePickerModalProps> = ({ isOpen, onClose, onSelect, title = 'Выбор файла', acceptExts = [] }) => {
  const [platform, setPlatform] = useState<string>('');
  const [cwd, setCwd] = useState<string>('');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startPath, setStartPath] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setFilter('');
    (async () => {
      try {
        const info = await api.systemInfo();
        setPlatform(info.platform);
        setStartPath(info.homedir || '');
        await loadDir(info.homedir);
      } catch (e: any) {
        setError(e?.message || 'Не удалось получить список файлов');
      }
    })();
  }, [isOpen]);

  const loadDir = async (path: string) => {
    setLoading(true); setError('');
    try {
      const data = await api.fsList(path);
      setCwd(data.cwd);
      setEntries(data.entries as FsEntry[]);
    } catch (e: any) {
      setError(e?.message || 'Ошибка чтения директории');
    } finally { setLoading(false); }
  };

  const canAccept = (e: FsEntry) => {
    if (e.isDir) return true;
    if (!acceptExts || acceptExts.length === 0) return true;
    if (platform === 'darwin' && e.name.toLowerCase().endsWith('.app')) return acceptExts.includes('.app');
    return acceptExts.includes(e.ext);
  };

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = entries.filter(e => !f || e.name.toLowerCase().includes(f));
    // Push non-acceptable files to the end for clarity
    return list.sort((a, b) => {
      const aa = canAccept(a) ? 0 : 1; const bb = canAccept(b) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return 0;
    });
  }, [entries, filter]);

  if (!isOpen) return null;

  const goUp = () => {
    if (!cwd) return;
    const parent = cwd.replace(/\\+$/,'');
    const up = parent.includes('/') || parent.includes('\\') ? parent.replace(/[\\\/][^\\\/]+$/, '') || parent : parent;
    loadDir(up || cwd);
  };

  const isElectron = typeof (window as any).electron?.openFile === 'function';
  const openSystemDialog = async () => {
    try {
      const selected = await (window as any).electron.openFile({
        exts: acceptExts,
      });
      if (!selected) return;
      onSelect(selected, platform || (navigator.userAgent.includes('Windows') ? 'win32' : 'darwin'));
    } catch (e) {
      setError(String((e as any)?.message || e));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={goUp} className="p-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Вверх">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 text-xs text-gray-600 dark:text-gray-300 truncate" title={cwd}>{cwd}</div>
            <button onClick={() => loadDir(cwd)} disabled={loading} className="p-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50" title="Обновить">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Поиск..."
              className="pl-9 pr-3 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={startPath}
              onChange={(e) => setStartPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadDir(startPath); }}
              placeholder="Начальная папка (абсолютный путь)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <button onClick={() => loadDir(startPath)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">Перейти</button>
            {isElectron && (
              <button onClick={openSystemDialog} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Системный диалог</button>
            )}
          </div>
          {error && (<div className="text-sm text-red-500">{error}</div>)}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-[50vh] overflow-auto divide-y dark:divide-gray-700">
            {filtered.map(e => (
              <button
                key={e.path}
                onClick={() => e.isDir ? loadDir(e.path) : canAccept(e) && onSelect(e.path, platform)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${!canAccept(e) && !e.isDir ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {e.isDir ? <Folder className="w-5 h-5 text-amber-500"/> : <File className="w-5 h-5 text-gray-500"/>}
                <div className="flex-1">
                  <div className="text-sm text-gray-900 dark:text-gray-100">{e.name}</div>
                  {!e.isDir && <div className="text-xs text-gray-500">{e.ext || 'file'}</div>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-gray-500 text-center">Пусто</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePickerModal;
