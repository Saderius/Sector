const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openFileInExplorer: (filePath) => ipcRenderer.invoke('open-file-in-explorer', filePath),
  isElectron: () => true
});
