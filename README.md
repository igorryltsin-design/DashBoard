# App Manager — локальная панель управления приложениями

React + Vite (клиент) и Express (сервер). Управление локальными сервисами и контейнерами: запуск/остановка/перезапуск, ожидание готовности (health check), логи, роли и подтверждение паролем, импорт/экспорт конфигурации. Поддерживаются типы: React, Flask, Python (Conda), Docker, Локальные десктоп‑приложения.

---

## Содержание

1) Возможности
2) Архитектура
3) Требования
4) Быстрый старт
5) Пользователи и роли
6) Хранение данных
7) Модель «Приложение» (поля)
8) Добавление приложений (примеры)
9) Docker‑параметры (порты, тома, переменные, сеть)
10) Ожидание готовности (health check)
11) Логи и диагностика
12) Действия с подтверждением пароля (re‑auth)
13) Интерфейс
14) Импорт/экспорт
15) Частые проблемы и решения
16) API сервера (кратко)
17) Переменные окружения
18) Разработка и структура
19) Дорожная карта

---

## 1) Возможности

- Старт/стоп (мягкий и принудительный)/рестарт локальных процессов
- Типы: React/Node, Flask/Python, Python (Conda), Docker, локальные десктоп‑приложения
- Ожидание `healthCheck` после запуска, авто‑открытие URL после успешного пинга
- Логи stdout/stderr + служебные записи
- Роли: viewer/operator/admin и re‑auth для чувствительных действий
- Импорт/экспорт JSON конфигурации
- Сортировка DnD, поиск, тёмная/светлая тема, крупные плитки

---

## 2) Архитектура

- Клиент: React + Vite, Tailwind. `/api` проксируется на локальный сервер
- Сервер: Express (CommonJS), `server/data.json` — файловое хранилище
- Запуск: `child_process.spawn` (shell, cwd), группы процессов (POSIX) / `taskkill` (Windows)
- Docker: `docker run -d --rm --name app-<id> ...` / `docker rm -f`
- Conda: `conda run -n <env> ...` или `source conda.sh && conda activate <env>` при отсутствии `conda` в PATH

---

## 3) Требования

- Node.js >= 18
- По потребности: Docker, Python/Flask, Conda, curl

---

## 4) Быстрый старт

```
npm install
npm run dev
```

- Клиент: http://localhost:5173
- API: http://localhost:4000 (доступен как `/api` из клиента)

Демо‑пользователи:
- admin / admin123
- operator / operator123
- viewer / viewer123

---

## 5) Пользователи и роли

- viewer: просмотр, пинг, логи
- operator: + старт/стоп/рестарт (re‑auth)
- admin: + добавление/редактирование/удаление, импорт/экспорт, сортировка DnD

Аутентификация: JWT (12h). Перед критическими действиями — re‑auth (одноразовый токен ~2 мин).

---

## 6) Хранение данных

- `server/data.json` содержит: `users`, `apps`, `operations`, `settings`
- Экспорт/импорт полностью сохраняет/восстанавливает конфигурацию

---

## 7) Модель «Приложение» (поля)

Обязательные/важные:

- `name` — имя
- `type` — `local | react | flask | python-conda | docker`
- `startCommand` — команда запуска (кроме docker)
- `status` — `running | stopped | starting | unknown` (обновляется сервером/клиентом)

Опциональные:

- `stopCommand?` — команда мягкой остановки
- `cwd?` — рабочая папка
- `healthCheck?` — URL для проверки (2xx/3xx)
- `port?` — локальный порт (для кнопки «Открыть»)
- `autoOpen?` — открыть URL после успешного пинга
- `imageUrl?` — картинка плитки (URL или data:)
- `environment?` — имя окружения (для `python-conda`)

Docker‑поля:

- `dockerImage?`
- `dockerPorts?: string[]` (например, `['3000:3000','80:80']`)
- `dockerVolumes?: string[]` (например, `['/host:/container','/data:/data']`)
- `dockerEnv?: string[]` (например, `['NODE_ENV=production']`)
- `dockerNetwork?: string` (например, `bridge` или `my-network`)

---

## 8) Добавление приложений (примеры)

Общие шаги: нажмите «Добавить приложение», заполните поля, сохраните.

React:
- `type: react`, `cwd: /abs/path`, `startCommand: npm run dev` (или `npm run start`), `port: 5173`

Flask:
- `type: flask`, `cwd: /abs/path/to/app`, `startCommand: python app.py`, `port: 5050`, `healthCheck: http://localhost:5050/health`

Python (Conda):
- `type: python-conda`, `environment: myenv`, `cwd: /abs/path`, `startCommand: python app.py`
- Сервер сам выполнит `conda run -n myenv python app.py` или `source conda.sh && conda activate myenv && python app.py`

Docker (nginx пример):
- `type: docker`, `dockerImage: nginx:alpine`, `dockerPorts: 8080:80`, `healthCheck: http://localhost:8080`
- Дополнительно: `dockerVolumes: /host/html:/usr/share/nginx/html`, `dockerEnv: NODE_ENV=production`, `dockerNetwork: my-net`

Локальное (Word/TextEdit/Notepad):
- macOS: `open -a "Microsoft Word"` / `osascript -e 'quit app "Microsoft Word"'`
- Windows: `start "" winword` / `taskkill /IM WINWORD.EXE /F`

Авто‑открытие:
- Поставьте «Открывать URL после запуска». Вкладка откроется только после успешного health check.

Принудительная остановка:
- Иконка XCircle → запрос пароля → SIGKILL/taskkill /F.

---

## 9) Docker‑параметры (порты, тома, переменные, сеть)

- Порты: `host:container` (через запятую)
- Томы: `/host/path:/container/path` (через запятую)
- Переменные окружения: `KEY=VALUE` (через запятую)
- Сеть: `--network <name>` (пусто = `bridge`)

Фактическая команда видна в логах `start: docker run ...`.

---

## 10) Ожидание готовности (health check)

- Если указан `healthCheck`, сервер после запуска ждёт ответа 2xx/3xx до 30 секунд
- Опрос каждые ~800 мс через `curl`
- При таймауте: процесс останавливается, старт отвечает 504
- Авто‑открытие URL выполняется только после успеха

---

## 11) Логи и диагностика

- Кнопка «Логи» на карточке — stdout/stderr + служебные записи
- Буфер ~1000 строк, автообновление каждые 1.5 сек
- Диагностика портов (macOS): `lsof -i :5050` → `kill -9 <PID>`

---

## 12) Действия с подтверждением пароля (re‑auth)

- Для operator/admin: перед старт/стоп/рестарт вводите пароль
- Сервер выдает одноразовый токен на ~2 минуты, используется однократно

---

## 13) Интерфейс

- Шапка: экспорт/импорт (admin), рефреш, тема, пользователь, выход
- Поиск по названию
- Плитки: крупные, с иконкой или `imageUrl`
- Кнопки: старт, стоп, принудительный стоп, рестарт, пинг, открыть, логи
- Меню (шестерёнка, admin): редактировать, удалить
- Сортировка DnD: за «ручку» слева вверху

---

## 14) Импорт/экспорт

- Экспорт: JSON со всеми разделами
- Импорт: полностью заменяет текущее состояние (сделайте экспорт‑резервную копию перед импортом)

---

## 15) Частые проблемы и решения

- Порт занят: измените порт в карточке или остановите процесс (`lsof`/`taskkill`)
- `conda not found`: запустите `npm run dev` в оболочке с доступной conda, либо установите Miniconda/Anaconda; сервер пытается найти `conda.sh` автоматически
- Docker без прав (Linux): добавьте пользователя в группу `docker`
- Нет `curl`: установите (Homebrew/apt/yum)
- Команда не запускается: проверьте `cwd` и повторите команду в терминале руками

---

## 16) API сервера (кратко)

Аутентификация
- `POST /api/auth/login` → { token, user }
- `POST /api/auth/reauth` (с JWT) → { reauthToken }

Приложения
- `GET /api/apps` — список (live‑статус учитывается)
- `POST /api/apps` (admin)
- `PUT /api/apps/:id` (admin)
- `DELETE /api/apps/:id` (admin)
- `POST /api/apps/reorder` (admin)
- `POST /api/apps/:id/start` (operator/admin + re‑auth)
- `POST /api/apps/:id/stop[?force=1]` (operator/admin + re‑auth)
- `POST /api/apps/:id/restart` (operator/admin + re‑auth)
- `GET /api/apps/:id/status`
- `GET /api/apps/:id/health`
- `GET /api/apps/:id/logs`

Конфигурация
- `GET /api/config/export` (admin)
- `POST /api/config/import` (admin)

Коды: 401/403/404/5xx/504.

---

## 17) Переменные окружения

- `API_PORT` — порт API (по умолчанию 4000)
- `JWT_SECRET`, `JWT_REAUTH_SECRET` — секреты JWT (в проде задайте свои)

Пример:

```
API_PORT=5001 JWT_SECRET=... JWT_REAUTH_SECRET=... npm run dev
```

---

## 18) Разработка и структура

Скрипты:
- `npm run dev` — сервер (`server/index.cjs`) + Vite
- `npm run server` — только сервер

Ключевые файлы:
- `server/index.cjs` — сервер/процессы/JWT/роли/логи/импорт‑экспорт
- `src/components/Dashboard.tsx` — основная панель
- `src/components/AppCard.tsx` — карточка приложения
- `src/components/AddAppModal.tsx` — форма добавления/редактирования
- `src/components/LogModal.tsx` — модалка логов
- `src/hooks/useApps.tsx` — состояние приложений/операции
- `src/hooks/useAuth.tsx` — аутентификация и re‑auth
- `src/utils/api.ts` — клиент к `/api`

---

## 19) Дорожная карта

- Таймаут/интервал healthCheck в настройках приложения
- Авто‑ретраи старта при фейлах
- Docker: entrypoint/command, env‑file, restart‑policy
- Логи: скачивание, фильтрация stderr/stdout, настройка размера буфера
- Теги/группы приложений и фильтр
- Экран состояния сервера и настроек

---

## 20) Готовые конфигурации (apps JSON)

- Рекомендовано: сначала сделайте «Экспорт конфигурации», затем в полученном JSON замените только массив `apps` на один из примеров и выполните «Импорт конфигурации».

Мини‑набор (React + Flask/Conda + Nginx):

```json
[
  {
    "id": "r1",
    "name": "React App",
    "icon": "Globe",
    "type": "react",
    "status": "stopped",
    "startCommand": "npm run dev",
    "cwd": "/abs/path/react-app",
    "healthCheck": "http://localhost:5173",
    "port": 5173,
    "autoOpen": true,
    "order": 0,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "f1",
    "name": "Flask (Conda)",
    "icon": "Brain",
    "type": "python-conda",
    "status": "stopped",
    "startCommand": "python app.py",
    "cwd": "/abs/path/flask-app",
    "environment": "flask_env",
    "healthCheck": "http://localhost:5050/health",
    "port": 5050,
    "autoOpen": true,
    "order": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "d1",
    "name": "Nginx",
    "icon": "Server",
    "type": "docker",
    "status": "stopped",
    "startCommand": "",
    "dockerImage": "nginx:alpine",
    "dockerPorts": ["8080:80"],
    "dockerVolumes": ["/abs/path/site:/usr/share/nginx/html:ro"],
    "dockerEnv": ["NGINX_ENTRYPOINT_QUIET_LOGS=1"],
    "dockerNetwork": "bridge",
    "healthCheck": "http://localhost:8080",
    "port": 8080,
    "autoOpen": true,
    "order": 2,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

Расширенный набор (Postgres + Redis + Adminer + локальное приложение):

```json
[
  {
    "id": "pg",
    "name": "Postgres 16",
    "icon": "Database",
    "type": "docker",
    "status": "stopped",
    "dockerImage": "postgres:16",
    "dockerPorts": ["5432:5432"],
    "dockerVolumes": ["/abs/pgdata:/var/lib/postgresql/data"],
    "dockerEnv": ["POSTGRES_PASSWORD=secret", "POSTGRES_USER=admin", "POSTGRES_DB=app"],
    "dockerNetwork": "bridge",
    "order": 0,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "redis",
    "name": "Redis",
    "icon": "Server",
    "type": "docker",
    "status": "stopped",
    "dockerImage": "redis:7-alpine",
    "dockerPorts": ["6379:6379"],
    "dockerVolumes": ["/abs/redis:/data"],
    "dockerEnv": [],
    "dockerNetwork": "bridge",
    "order": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "adminer",
    "name": "Adminer",
    "icon": "Globe",
    "type": "docker",
    "status": "stopped",
    "dockerImage": "adminer",
    "dockerPorts": ["8081:8080"],
    "dockerNetwork": "bridge",
    "healthCheck": "http://localhost:8081",
    "port": 8081,
    "autoOpen": true,
    "order": 2,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "word",
    "name": "Microsoft Word",
    "icon": "Monitor",
    "type": "local",
    "status": "stopped",
    "startCommand": "open -a \"Microsoft Word\"",
    "stopCommand": "osascript -e 'quit app \"Microsoft Word\"'",
    "order": 3,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

## 21) Автозапуск: systemd и PM2

### systemd (user service, dev)

Файл: `~/.config/systemd/user/app-manager.service`

```
[Unit]
Description=App Manager (Vite + API)
After=network.target

[Service]
Type=simple
WorkingDirectory=/ABS/PATH/TO/DashBoard
Environment=API_PORT=4000
Environment=NODE_ENV=development
ExecStart=/bin/bash -lc "npm run dev"
Restart=always
RestartSec=3
KillMode=control-group

[Install]
WantedBy=default.target
```

Команды:

```
mkdir -p ~/.config/systemd/user
systemctl --user daemon-reload
systemctl --user enable --now app-manager
journalctl --user -u app-manager -f
```

### systemd (prod‑like: отдельно API и web preview)

`~/.config/systemd/user/app-manager-api.service`

```
[Unit]
Description=App Manager API
After=network.target

[Service]
Type=simple
WorkingDirectory=/ABS/PATH/TO/DashBoard
Environment=API_PORT=4000
ExecStart=/usr/bin/node server/index.cjs
Restart=always
RestartSec=3
KillMode=control-group

[Install]
WantedBy=default.target
```

`~/.config/systemd/user/app-manager-web.service`

```
[Unit]
Description=App Manager Web (vite preview)
After=network.target

[Service]
Type=simple
WorkingDirectory=/ABS/PATH/TO/DashBoard
ExecStart=/bin/bash -lc "npx vite preview --host --port 5173"
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

### PM2 (dev одним процессом — concurrently)

`ecosystem.config.cjs`

```js
module.exports = {
  apps: [
    {
      name: 'app-manager-dev',
      cwd: '/ABS/PATH/TO/DashBoard',
      script: 'npm',
      args: 'run dev',
      env: { API_PORT: 4000, NODE_ENV: 'development' },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
```

Команды:

```
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # выполните команду, которую выведет PM2
```

### PM2 (prod‑like: отдельно API + web preview)

```js
module.exports = {
  apps: [
    {
      name: 'app-manager-api',
      cwd: '/ABS/PATH/TO/DashBoard',
      script: 'server/index.cjs',
      node_args: '--enable-source-maps',
      env: { API_PORT: 4000, NODE_ENV: 'production' },
    },
    {
      name: 'app-manager-web',
      cwd: '/ABS/PATH/TO/DashBoard',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host --port 5173',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

---

## 22) Рецепты популярных Docker‑образов

Nginx (статический сайт):
- `dockerImage`: `nginx:alpine`
- Порты: `8080:80`
- Томы: `/abs/site:/usr/share/nginx/html:ro`
- Переменные: `NGINX_ENTRYPOINT_QUIET_LOGS=1`
- Сеть: `bridge`
- `healthCheck`: `http://localhost:8080`

Postgres:
- `dockerImage`: `postgres:16`
- Порты: `5432:5432`
- Томы: `/abs/pgdata:/var/lib/postgresql/data`
- Переменные: `POSTGRES_PASSWORD=secret, POSTGRES_USER=admin, POSTGRES_DB=app`
- Сеть: `bridge`
- `healthCheck`: (не HTTP — можно оставить пустым)

Redis:
- `dockerImage`: `redis:7-alpine`
- Порты: `6379:6379`
- Томы: `/abs/redis:/data`
- `healthCheck`: (не HTTP — оставить пустым)

Adminer:
- `dockerImage`: `adminer`
- Порты: `8081:8080`
- `healthCheck`: `http://localhost:8081`
- `autoOpen`: да

Portainer:
- `dockerImage`: `portainer/portainer-ce`
- Порты: `9443:9443`
- Томы: `/var/run/docker.sock:/var/run/docker.sock`, `/abs/portainer:/data`
- `healthCheck`: `https://localhost:9443` (в dev можно `http://localhost:9443`)
