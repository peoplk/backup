const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  toggleWidget: () => ipcRenderer.send('toggle-widget'),
  closeWidget: () => ipcRenderer.send('close-widget'),
  onMenuNavigate: (callback) => ipcRenderer.on('menu-navigate', (_event, view) => callback(view)),
  onMenuNewTask: (callback) => ipcRenderer.on('menu-new-task', () => callback()),
  onMenuQuickAdd: (callback) => ipcRenderer.on('menu-quick-add', () => callback()),
  onMenuStartFocus: (callback) => ipcRenderer.on('menu-start-focus', () => callback()),
  setFullScreen: (fullscreen) => ipcRenderer.send('set-fullscreen', fullscreen),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  onFullScreenChange: (callback) => ipcRenderer.on('fullscreen-change', (_event, isFullScreen) => callback(isFullScreen)),

  // System Shield APIs
  shieldStart: (websites, apps) => ipcRenderer.invoke('shield-start', { websites, apps }),
  shieldStop: () => ipcRenderer.invoke('shield-stop'),
  shieldUpdate: (websites, apps) => ipcRenderer.invoke('shield-update', { websites, apps }),
  shieldStatus: () => ipcRenderer.invoke('shield-status'),
})
