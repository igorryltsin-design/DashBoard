const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openFile: (options) => ipcRenderer.invoke('file-dialog:open', options || {}),
});

