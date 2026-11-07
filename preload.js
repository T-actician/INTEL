const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('intel', {
  lookup: (ip) => ipcRenderer.invoke('lookup', ip),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
