const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ov', { on: cb => ipcRenderer.on('ov', (_, d) => cb(d)) });
