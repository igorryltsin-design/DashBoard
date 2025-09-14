const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const isDev = process.env.ELECTRON_START_URL || process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || (isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`);
  win.loadURL(startUrl);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('file-dialog:open', async (event, args) => {
  const { exts } = args || {};
  const filters = exts && Array.isArray(exts) && exts.length > 0 ? [{ name: 'Executables', extensions: exts.map(e => e.replace(/^\./, '')) }] : [];
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters,
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

