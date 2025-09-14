import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../utils/api';

interface LogModalProps {
  appId: string | null;
  onClose: () => void;
}

const LogModal: React.FC<LogModalProps> = ({ appId, onClose }) => {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let timer: any;
    const load = async () => {
      if (!appId) return;
      try {
        const res: any = await api.get(`/apps/${appId}/logs`);
        setLines(res.lines || []);
      } catch {}
    };
    load();
    timer = setInterval(load, 1500);
    return () => clearInterval(timer);
  }, [appId]);

  if (!appId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Логи приложения</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900 overflow-auto max-h-[70vh]">
          <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{lines.join('\n')}</pre>
        </div>
      </div>
    </div>
  );
};

export default LogModal;

