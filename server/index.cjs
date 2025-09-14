const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { spawn, spawnSync } = require('child_process');
const os = require('os');

const PORT = process.env.API_PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REAUTH_SECRET = process.env.JWT_REAUTH_SECRET || 'dev-reauth-secret-change-me';
const DATA_PATH = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    const now = new Date().toISOString();
    const defaultData = {
      users: [
        { id: '1', username: 'admin', role: 'admin', passwordHash: bcrypt.hashSync('admin123', 10) },
        { id: '2', username: 'operator', role: 'operator', passwordHash: bcrypt.hashSync('operator123', 10) },
        { id: '3', username: 'viewer', role: 'viewer', passwordHash: bcrypt.hashSync('viewer123', 10) },
      ],
      apps: [],
      operations: [],
      settings: { theme: 'light', autoRefresh: true, refreshInterval: 5000 },
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2));
  }
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read data.json', e);
    return { users: [], apps: [], operations: [], settings: { theme: 'light', autoRefresh: true, refreshInterval: 5000 } };
  }
}

function saveData(data) { fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2)); }

const processes = new Map();
const logs = new Map(); // appId -> string[]
function logLine(appId, line) {
  const arr = logs.get(appId) || [];
  const ts = new Date().toISOString();
  arr.push(`[${ts}] ${line}`);
  // ограничим буфер ~1000 строк
  if (arr.length > 1000) arr.splice(0, arr.length - 1000);
  logs.set(appId, arr);
}

// Locate executable in PATH (and common conda locations)
function whichSync(cmd) {
  if (cmd === 'conda' && process.env.CONDA_EXE && fs.existsSync(process.env.CONDA_EXE)) return process.env.CONDA_EXE;
  const PATH = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const dir of PATH.split(sep)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext.toLowerCase());
      try { if (fs.existsSync(p)) return p; } catch (_) {}
    }
  }
  if (cmd === 'conda') {
    const candidates = [
      path.join(process.env.HOME || '', 'miniconda3/bin/conda'),
      path.join(process.env.HOME || '', 'anaconda3/bin/conda'),
      '/opt/anaconda3/bin/conda',
      '/usr/local/anaconda3/bin/conda',
      '/opt/homebrew/Caskroom/miniforge/base/bin/conda',
    ];
    for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (_) {} }
  }
  return null;
}

function cmdExists(cmd) { return !!whichSync(cmd); }

function findCondaSh() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    // miniconda/anaconda common paths
    `${home}/miniconda3/etc/profile.d/conda.sh`,
    `${home}/anaconda3/etc/profile.d/conda.sh`,
    '/opt/anaconda3/etc/profile.d/conda.sh',
    '/usr/local/anaconda3/etc/profile.d/conda.sh',
    '/opt/homebrew/Caskroom/miniforge/base/etc/profile.d/conda.sh',
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}
function composeDockerName(app) { return `app-${app.id}`; }
function findDockerCompose() {
  const dockerComposeExe = whichSync('docker-compose');
  if (dockerComposeExe) return { cmd: 'docker-compose', argsPrefix: [] };
  const dockerExe = whichSync('docker');
  if (dockerExe) return { cmd: 'docker', argsPrefix: ['compose'] };
  return null;
}

function dockerImageExists(tag) {
  try {
    const r = spawnSync('docker', ['image', 'inspect', tag], { stdio: 'ignore' });
    return r.status === 0;
  } catch (_) { return false; }
}

function getImageTagFromArchive(archivePath) {
  // Best-effort: try reading manifest.json from tar(.gz)
  try {
    const r = spawnSync('tar', ['-xO', '-f', archivePath, 'manifest.json'], { encoding: 'utf-8' });
    if (r.status === 0 && r.stdout) {
      const j = JSON.parse(r.stdout);
      const first = Array.isArray(j) && j[0] && Array.isArray(j[0].RepoTags) ? j[0].RepoTags[0] : null;
      if (first && typeof first === 'string') return first;
    }
  } catch (_) {}
  return null;
}
function startProcess(app) {
  if (processes.has(app.id)) return;
  let child;
  if (app.type === 'docker') {
    // Heuristic: if user mistakenly put compose file path into dockerImage, treat it as compose
    try {
      const cwd = app.cwd || process.cwd();
      if (app.dockerImage && /\.(yml|yaml)$/i.test(app.dockerImage)) {
        let composePath = app.dockerImage;
        if (!path.isAbsolute(composePath)) composePath = path.join(cwd, composePath);
        if (fs.existsSync(composePath)) {
          app.dockerComposeFile = composePath;
          app.dockerImage = undefined;
        }
      }
    } catch (_) {}
    if (app.dockerComposeFile) {
      const comp = findDockerCompose();
      if (!comp) throw new Error('Docker Compose not found');
      const proj = app.dockerComposeProject || composeDockerName(app);
      const args = [...comp.argsPrefix, '-f', app.dockerComposeFile, '-p', proj, 'up', '-d'];
      logLine(app.id, `start: ${comp.cmd} ${args.join(' ')}`);
      child = spawn(comp.cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } else if (app.dockerImage || app.dockerArchive) {
      if (app.dockerArchive) {
        let needLoad = true;
        if (app.dockerImage && dockerImageExists(app.dockerImage)) {
          needLoad = false;
          logLine(app.id, `docker image '${app.dockerImage}' already exists, skip loading archive`);
        } else {
          const tag = getImageTagFromArchive(app.dockerArchive);
          if (tag && dockerImageExists(tag)) {
            needLoad = false;
            if (!app.dockerImage) app.dockerImage = tag;
            logLine(app.id, `docker image '${tag}' already exists (from archive manifest), skip loading`);
          }
        }
        if (needLoad) {
          logLine(app.id, `docker load -i ${app.dockerArchive}`);
          const res = spawnSync('docker', ['load', '-i', app.dockerArchive], { encoding: 'utf-8' });
          if (res.error) logLine(app.id, `ERR docker load: ${String(res.error)}`);
          if (res.stderr) logLine(app.id, `ERR ${String(res.stderr).trimEnd()}`);
          if (res.stdout) logLine(app.id, `OUT ${String(res.stdout).trimEnd()}`);
          const m = /Loaded image:\s*([^\s]+)\s*$/m.exec(res.stdout || '');
          if (!app.dockerImage && m) app.dockerImage = m[1];
        }
      }
      const name = composeDockerName(app);
      const args = ['run', '-d', '--rm', '--name', name];
      if (Array.isArray(app.dockerPorts)) {
        for (const p of app.dockerPorts) { args.push('-p', p); }
      }
      if (Array.isArray(app.dockerVolumes)) {
        for (const v of app.dockerVolumes) { args.push('-v', v); }
      }
      if (Array.isArray(app.dockerEnv)) {
        for (const e of app.dockerEnv) { args.push('-e', e); }
      }
      if (app.dockerNetwork) {
        args.push('--network', app.dockerNetwork);
      }
      if (!app.dockerImage) throw new Error('Docker image not specified');
      args.push(app.dockerImage);
      logLine(app.id, `start: docker ${args.join(' ')}`);
      child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      throw new Error('Docker configuration is incomplete');
    }
  } else {
    const cwd = app.cwd || process.cwd();
    let cmd = app.startCommand;
    // If startCommand looks like a direct file path, normalize execution for common types
    try {
      const raw = (cmd || '').trim();
      // Parse first token (handle quotes)
      let first = raw;
      if (raw.startsWith('"')) {
        const m = raw.match(/^"([^\"]+)"/);
        if (m) first = m[1];
      } else {
        first = raw.split(/\s+/)[0] || raw;
      }
      // Resolve tilde and relative paths
      const resolved = first.startsWith('~') ? path.join(os.homedir(), first.slice(1))
                        : path.isAbsolute(first) ? first : path.join(cwd, first);
      if (first && fs.existsSync(resolved)) {
        const lower = resolved.toLowerCase();
        if (process.platform === 'darwin' && lower.endsWith('.app')) {
          cmd = `open "${resolved}"`;
        } else if (process.platform === 'win32' && (lower.endsWith('.bat') || lower.endsWith('.cmd'))) {
          cmd = `cmd /c "${resolved}"`;
        } else if (process.platform !== 'win32' && lower.endsWith('.sh')) {
          cmd = `bash "${resolved}"`;
        } else if (raw.startsWith('"') || raw.includes(' ')) {
          // Ensure path with spaces stays quoted as the first arg
          const rest = raw.slice(first.length).trimStart();
          cmd = `"${resolved}"${rest ? ' ' + rest : ''}`;
        }
      }
    } catch (_) {}
    if (app.type === 'python-conda') {
      const baseCmd = (cmd && cmd.trim()) ? cmd : 'python app.py';
      const envName = app.environment || '';
      // Если пользователь уже указал conda run/activate — не оборачиваем повторно
      const alreadyConda = /\bconda\s+(run|activate)\b/.test(baseCmd);
      if (alreadyConda) {
        logLine(app.id, `start (user): ${baseCmd} (cwd=${cwd})`);
        child = spawn(baseCmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd });
      } else if (cmdExists('conda')) {
        const condaPath = whichSync('conda');
        cmd = `"${condaPath}" run -n ${envName} ${baseCmd}`;
        logLine(app.id, `start: ${cmd} (cwd=${cwd})`);
        child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd });
      } else {
        const condaSh = findCondaSh();
        if (condaSh && process.platform !== 'win32') {
          const bashCmd = `source "${condaSh}" && conda activate ${envName} && ${baseCmd}`;
          logLine(app.id, `start: bash -lc '${bashCmd}' (cwd=${cwd})`);
          child = spawn('bash', ['-lc', bashCmd], { stdio: ['ignore', 'pipe', 'pipe'], cwd });
        } else {
          logLine(app.id, 'warn: conda not found, fallback to base command');
          cmd = baseCmd;
          logLine(app.id, `start: ${cmd} (cwd=${cwd})`);
          child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd });
        }
      }
    } else {
      if (!cmd) throw new Error('Start command is empty');
      logLine(app.id, `start: ${cmd} (cwd=${cwd})`);
      child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd, detached: process.platform !== 'win32' });
    }
  }
  processes.set(app.id, child);
  child.stdout?.on('data', (d) => logLine(app.id, `OUT ${String(d).trimEnd()}`));
  child.stderr?.on('data', (d) => logLine(app.id, `ERR ${String(d).trimEnd()}`));
  child.on('exit', (code) => { logLine(app.id, `exit: code=${code}`); processes.delete(app.id); });
}
function stopProcess(app, force = false) {
  if (app.type === 'docker') {
    if (app.dockerComposeFile) {
      const comp = findDockerCompose();
      if (comp) {
        const proj = app.dockerComposeProject || composeDockerName(app);
        const args = [...comp.argsPrefix, '-f', app.dockerComposeFile, '-p', proj, 'down'];
        logLine(app.id, `stop: ${comp.cmd} ${args.join(' ')}`);
        spawn(comp.cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      }
    } else {
      const name = composeDockerName(app);
      logLine(app.id, `stop: docker rm -f ${name}`);
      spawn('docker', ['rm', '-f', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    }
  }
  const child = processes.get(app.id);
  if (app.stopCommand) {
    logLine(app.id, `stop: ${app.stopCommand}`);
    spawn(app.stopCommand, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], cwd: app.cwd || process.cwd() });
  }
  if (child && !child.killed) {
    try {
      if (process.platform === 'win32') {
        const args = force ? ['/PID', String(child.pid), '/T', '/F'] : ['/PID', String(child.pid), '/T'];
        spawn('taskkill', args, { stdio: 'ignore' });
      } else {
        // убиваем всю группу процессов
        process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
      }
    } catch (_) {}
  }
  processes.delete(app.id);
}
function restartProcess(app) { stopProcess(app); setTimeout(() => startProcess(app), 500); }

function signToken(user) { return jwt.sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' }); }
function signReauthToken(user) { return jwt.sign({ sub: user.id, purpose: 'reauth' }, JWT_REAUTH_SECRET, { expiresIn: '10m' }); }
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({ error: 'Invalid token' }); }
}
const roleMiddleware = (roles) => (req, res, next) => { if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' }); next(); };
function requireReauth(req, res, next) {
  const token = req.headers['x-reauth-token'];
  if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Reauth required' });
  try { const p = jwt.verify(token, JWT_REAUTH_SECRET); if (p.purpose !== 'reauth') throw new Error('bad'); next(); } catch { return res.status(401).json({ error: 'Reauth token invalid' }); }
}

const app = express();
app.use(express.json());

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = loadData();
  const user = db.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/auth/reauth', authMiddleware, (req, res) => {
  const { password } = req.body || {};
  const db = loadData();
  const user = db.users.find(u => u.id === req.user.sub);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid password' });
  const token = signReauthToken(user);
  res.json({ reauthToken: token, expiresInSec: 600 });
});

app.get('/api/apps', authMiddleware, roleMiddleware(['viewer','operator','admin']), (req, res) => {
  const db = loadData();
  const withLive = db.apps.map(a => ({
    ...a,
    status: processes.has(a.id) ? 'running' : a.status
  }));
  res.json(withLive.sort((a,b) => (a.order||0)-(b.order||0)));
});

app.post('/api/apps', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const db = loadData();
  const payload = req.body; const now = new Date().toISOString();
  const newApp = { id: Date.now().toString(), name: payload.name, icon: payload.icon || 'Monitor', imageUrl: payload.imageUrl || undefined, type: payload.type || 'local', status: 'stopped', startCommand: payload.startCommand || '', stopCommand: payload.stopCommand || undefined, cwd: payload.cwd || undefined, healthCheck: payload.healthCheck || undefined, environment: payload.environment || undefined, dockerImage: payload.dockerImage || undefined, dockerComposeFile: payload.dockerComposeFile || undefined, dockerComposeProject: payload.dockerComposeProject || undefined, dockerArchive: payload.dockerArchive || undefined, port: payload.port || undefined, order: db.apps.length, createdAt: now, updatedAt: now };
  db.apps.push(newApp); saveData(db); res.json(newApp);
});

app.put('/api/apps/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const db = loadData();
  const i = db.apps.findIndex(a => a.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  db.apps[i] = { ...db.apps[i], ...req.body, updatedAt: new Date().toISOString() };
  saveData(db); res.json(db.apps[i]);
});

app.delete('/api/apps/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const db = loadData(); db.apps = db.apps.filter(a => a.id !== req.params.id); saveData(db); res.json({ ok: true });
});

app.post('/api/apps/reorder', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const db = loadData(); const incoming = req.body; const byId = new Map(db.apps.map(a => [a.id, a]));
  db.apps = (incoming || []).map((a, idx) => ({ ...byId.get(a.id), order: idx })); saveData(db); res.json({ ok: true });
});

app.post('/api/apps/:id/start', authMiddleware, roleMiddleware(['operator','admin']), requireReauth, async (req, res) => {
  const db = loadData(); const appItem = db.apps.find(a => a.id === req.params.id); if (!appItem) return res.status(404).json({ error: 'Not found' });
  try {
    startProcess(appItem);
    // простая проверка: если нет pid у child для non-docker, считаем ошибкой
    const proc = processes.get(appItem.id);
    if (!proc || ((appItem.type !== 'docker') && !proc.pid)) throw new Error('Failed to start process');

    // Если есть healthCheck — ждём готовности
    const url = appItem.healthCheck;
    if (url) {
      const timeoutMs = 30000; // 30s
      const intervalMs = 800;
      const startTs = Date.now();
      let healthy = false;
      logLine(appItem.id, `health: waiting for ${url} up to ${timeoutMs}ms`);
      while (Date.now() - startTs < timeoutMs) {
        try {
          const curl = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url]);
          let out = '';
          await new Promise((resolve) => {
            curl.stdout.on('data', c => { out += String(c); });
            curl.on('close', () => resolve(null));
          });
          const code = parseInt(out || '0', 10);
          if (code >= 200 && code < 400) { healthy = true; break; }
        } catch {}
        await new Promise(r => setTimeout(r, intervalMs));
      }
      if (!healthy) {
        logLine(appItem.id, `health: timeout waiting for ${url}`);
        // не удалось — откатываем
        stopProcess(appItem, true);
        appItem.status = 'stopped';
        appItem.updatedAt = new Date().toISOString();
        saveData(db);
        return res.status(504).json({ error: 'Health check timeout' });
      }
      logLine(appItem.id, `health: OK for ${url}`);
    }

    appItem.status = 'running'; appItem.updatedAt = new Date().toISOString();
    db.operations.unshift({ id: Date.now().toString(), appId: appItem.id, operation: 'start', user: req.user.username, timestamp: new Date().toISOString(), success: true });
    saveData(db); res.json({ ok: true });
  }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.post('/api/apps/:id/stop', authMiddleware, roleMiddleware(['operator','admin']), requireReauth, (req, res) => {
  const db = loadData(); const appItem = db.apps.find(a => a.id === req.params.id); if (!appItem) return res.status(404).json({ error: 'Not found' });
  try {
    const force = String(req.query.force || '') === '1';
    stopProcess(appItem, force);
    appItem.status = 'stopped'; appItem.updatedAt = new Date().toISOString();
    db.operations.unshift({ id: Date.now().toString(), appId: appItem.id, operation: 'stop', user: req.user.username, timestamp: new Date().toISOString(), success: true });
    saveData(db); res.json({ ok: true });
  }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.post('/api/apps/:id/restart', authMiddleware, roleMiddleware(['operator','admin']), requireReauth, (req, res) => {
  const db = loadData(); const appItem = db.apps.find(a => a.id === req.params.id); if (!appItem) return res.status(404).json({ error: 'Not found' });
  try { restartProcess(appItem); appItem.status = 'running'; appItem.updatedAt = new Date().toISOString(); db.operations.unshift({ id: Date.now().toString(), appId: appItem.id, operation: 'restart', user: req.user.username, timestamp: new Date().toISOString(), success: true }); saveData(db); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.get('/api/apps/:id/status', authMiddleware, roleMiddleware(['viewer','operator','admin']), (req, res) => {
  const db = loadData(); const appItem = db.apps.find(a => a.id === req.params.id); if (!appItem) return res.status(404).json({ error: 'Not found' });
  const running = processes.has(appItem.id); res.json({ status: running ? 'running' : appItem.status || 'unknown' });
});

app.get('/api/apps/:id/health', authMiddleware, roleMiddleware(['viewer','operator','admin']), (req, res) => {
  const db = loadData(); const appItem = db.apps.find(a => a.id === req.params.id); const url = appItem?.healthCheck; if (!url) return res.status(400).json({ error: 'No healthCheck URL' });
  const curl = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url]); let out = '';
  curl.stdout.on('data', chunk => { out += chunk.toString(); });
  curl.on('close', () => { const code = parseInt(out || '0', 10); res.json({ httpCode: code, healthy: code >= 200 && code < 400 }); });
  curl.on('error', () => res.status(500).json({ error: 'curl failed' }));
});

// Logs
app.get('/api/apps/:id/logs', authMiddleware, roleMiddleware(['viewer','operator','admin']), (req, res) => {
  const arr = logs.get(req.params.id) || [];
  res.json({ lines: arr });
});

app.get('/api/config/export', authMiddleware, roleMiddleware(['admin']), (req, res) => { const db = loadData(); res.json(db); });
app.post('/api/config/import', authMiddleware, roleMiddleware(['admin']), (req, res) => { const data = req.body; if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Bad config' }); saveData(data); res.json({ ok: true }); });

// System info (platform, homedir)
app.get('/api/system/info', authMiddleware, roleMiddleware(['viewer','operator','admin']), (req, res) => {
  const dockerExe = whichSync('docker');
  const compose = findDockerCompose();
  let dockerVersion = null, composeVersion = null;
  try { const r = spawnSync('docker', ['--version'], { encoding: 'utf-8' }); if (r.status === 0) dockerVersion = (r.stdout || '').trim(); } catch {}
  if (compose) {
    try { const r = spawnSync(compose.cmd, ['--version'], { encoding: 'utf-8' }); if (r.status === 0) composeVersion = (r.stdout || '').trim(); } catch {}
  }
  res.json({ platform: process.platform, homedir: os.homedir(), arch: process.arch, dockerInstalled: !!dockerExe, composeTool: compose ? compose.cmd : null, dockerVersion, composeVersion });
});

// Lightweight system metrics
app.get('/api/system/metrics', authMiddleware, roleMiddleware(['viewer','operator','admin']), async (req, res) => {
  function cpuSnapshot() {
    const cpus = os.cpus();
    const t = cpus.map(c => c.times).reduce((a,b) => ({ user:a.user+b.user, nice:a.nice+b.nice, sys:a.sys+b.sys, idle:a.idle+b.idle, irq:a.irq+b.irq }), { user:0,nice:0,sys:0,idle:0,irq:0 });
    return t;
  }
  function getDisks() {
    try {
      if (process.platform === 'win32') {
        const r = spawnSync('wmic', ['logicaldisk', 'get', 'Size,FreeSpace,Caption', '/format:csv'], { encoding: 'utf-8' });
        if (r.status === 0) {
          const lines = (r.stdout||'').trim().split(/\r?\n/).slice(1).filter(Boolean);
          const drives = lines.map(l => { const parts = l.split(','); return { mount: parts[1], label: parts[1], total: Number(parts[3]||0), free: Number(parts[2]||0) }; }).filter(d => d.total>0);
          return drives;
        }
      } else {
        const r = spawnSync('df', ['-kP'], { encoding: 'utf-8' });
        if (r.status === 0) {
          return (r.stdout||'').trim().split(/\r?\n/).slice(1).map(line => line.trim().split(/\s+/)).filter(cols => cols.length>=6 && !/^tmpfs|devfs|overlay|udev/.test(cols[0])).map(cols => ({
            mount: cols[5], label: cols[0], total: Number(cols[1]||0)*1024, free: Number(cols[3]||0)*1024,
          }));
        }
      }
    } catch {}
    return [];
  }
  async function netCounters() {
    try {
      if (process.platform === 'win32') {
        const r = spawnSync('netstat', ['-e'], { encoding: 'utf-8' });
        const m = (r.stdout||'').match(/Bytes\s+Received\s*=\s*(\d+).*Bytes\s+Sent\s*=\s*(\d+)/si);
        if (m) return { rx: Number(m[1]), tx: Number(m[2]) };
      } else if (process.platform === 'darwin') {
        const r = spawnSync('netstat', ['-ibn'], { encoding: 'utf-8' });
        if (r.status === 0) {
          let rx=0, tx=0;
          for (const line of (r.stdout||'').split(/\r?\n/).slice(1)) {
            const cols = line.trim().split(/\s+/);
            if (cols.length>10) {
              const name = cols[0]; if (/^lo/.test(name)) continue;
              rx += Number(cols[6]||0); tx += Number(cols[9]||0);
            }
          }
          return { rx, tx };
        }
      } else {
        const s = fs.readFileSync('/proc/net/dev', 'utf-8');
        let rx=0, tx=0; for (const line of s.split(/\n/).slice(2)) { if (!line.trim()) continue; const [iface, rest] = line.split(':'); if (/lo\b/.test(iface)) continue; const cols = rest.trim().split(/\s+/); rx+=Number(cols[0]||0); tx+=Number(cols[8]||0); }
        return { rx, tx };
      }
    } catch {}
    return { rx: 0, tx: 0 };
  }

  const aCpu = cpuSnapshot();
  const aNet = await netCounters();
  await new Promise(r => setTimeout(r, 500));
  const bCpu = cpuSnapshot();
  const bNet = await netCounters();
  const idle = bCpu.idle - aCpu.idle; const total = (bCpu.user-aCpu.user)+(bCpu.nice-aCpu.nice)+(bCpu.sys-aCpu.sys)+idle+(bCpu.irq-aCpu.irq);
  const cpuPct = total > 0 ? Math.max(0, Math.min(100, 100 * (1 - idle/total))) : 0;
  const totalMem = os.totalmem(); const freeMem = os.freemem();
  const disks = getDisks();
  const aggDisk = disks.reduce((acc,d)=>({ total: acc.total + (d.total||0), free: acc.free + (d.free||0) }), { total:0, free:0 });
  const rxBps = Math.max(0, (bNet.rx - aNet.rx) * 2); // 500ms interval => *2
  const txBps = Math.max(0, (bNet.tx - aNet.tx) * 2);
  res.json({ cpuPct, mem: { total: totalMem, free: freeMem }, disk: aggDisk.total?aggDisk:null, disks, net: { rxBps, txBps } });
});

// Simple filesystem listing for picking executables/scripts
// Query: ?path=/abs/path (defaults to homedir)
app.get('/api/fs/list', authMiddleware, roleMiddleware(['viewer','operator','admin']), (req, res) => {
  try {
    let p = String(req.query.path || '') || os.homedir();
    if (!path.isAbsolute(p)) {
      // Resolve relative paths against homedir
      p = path.resolve(os.homedir(), p);
    }
    const stat = fs.statSync(p);
    let dir = p;
    if (!stat.isDirectory()) {
      dir = path.dirname(p);
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true }).map(d => {
      const full = path.join(dir, d.name);
      const isDir = d.isDirectory();
      return {
        name: d.name,
        path: full,
        isDir,
        ext: isDir ? '' : path.extname(d.name).toLowerCase(),
      };
    }).sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
    res.json({ cwd: dir, entries });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.listen(PORT, () => { console.log(`[api] listening on http://localhost:${PORT}`); });
