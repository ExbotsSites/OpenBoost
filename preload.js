const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('openboost', {
  list: () => ipcRenderer.invoke('list'),
  apply: o => ipcRenderer.invoke('apply', o),
  relaunch: () => ipcRenderer.invoke('relaunch'),
  live: () => ipcRenderer.invoke('live'),
  scan: () => ipcRenderer.invoke('scan'),
  bench: slot => ipcRenderer.invoke('bench', slot),
  benchGet: () => ipcRenderer.invoke('bench:get'),
  benchReset: () => ipcRenderer.invoke('bench:reset'),
  open: u => ipcRenderer.invoke('open', u),
  bios: () => ipcRenderer.invoke('bios'),
  speed: id => ipcRenderer.invoke('speed', id),
  servers: (force, ookla) => ipcRenderer.invoke('speed:servers', force, ookla),
  search: q => ipcRenderer.invoke('speed:search', q),
  who: () => ipcRenderer.invoke('speed:who'),
  procs: () => ipcRenderer.invoke('procs'),
  onSpeed: cb => ipcRenderer.on('speed', (_, m) => cb(m)),
  dnsOpen: () => ipcRenderer.invoke('dns:open'),
  flush: () => ipcRenderer.invoke('dns:flush')
});
