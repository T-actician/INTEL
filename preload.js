const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('intel', {
  lookup: (ip) => ipcRenderer.invoke('lookup', ip),
  resolveLink: (url) => ipcRenderer.invoke('resolve-link', url),
  geocode: (q) => ipcRenderer.invoke('geocode', q),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
