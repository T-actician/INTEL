const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('intel', {
  lookup: (ip) => ipcRenderer.invoke('lookup', ip),
  onUpdate: (cb) => ipcRenderer.on('update-status', (_e, msg) => cb(msg)),
});
