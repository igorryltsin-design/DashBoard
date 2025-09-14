export interface User {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
}

export interface App {
  id: string;
  name: string;
  icon: string;
  imageUrl?: string;
  type: 'local' | 'react' | 'flask' | 'python-conda' | 'docker';
  status: 'running' | 'stopped' | 'starting' | 'unknown';
  startCommand: string;
  stopCommand?: string;
  cwd?: string;
  healthCheck?: string;
  environment?: string; // для conda
  dockerImage?: string; // для docker
  dockerComposeFile?: string;
  dockerComposeProject?: string;
  dockerArchive?: string; // путь к .tar/.tar.gz содержащему image
  dockerPorts?: string[]; // массив маппингов вида "3000:3000"
  dockerVolumes?: string[]; // массив маппингов вида "/host:/container"
  dockerEnv?: string[]; // KEY=VALUE
  dockerNetwork?: string; // имя сети docker
  port?: number;
  autoOpen?: boolean; // открыть URL после старта
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppOperation {
  id: string;
  appId: string;
  operation: 'start' | 'stop' | 'restart';
  user: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface AppConfig {
  apps: App[];
  operations: AppOperation[];
  settings: {
    theme: 'light' | 'dark';
    autoRefresh: boolean;
    refreshInterval: number;
  };
}
