const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ironboundDesktop', {
  saveSnapshot: (payload) => ipcRenderer.invoke('save:snapshot', payload),
  loadSnapshot: () => ipcRenderer.invoke('load:snapshot')
});
