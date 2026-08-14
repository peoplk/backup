const { contextBridge, ipcRenderer } = require('electron')

try {
  const applyTheme = () => {
    const mode = localStorage.getItem('theme-mode') || 'system'
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
    if (isDark) document.documentElement.classList.add('dark')
  }
  if (document.documentElement) {
    applyTheme()
  } else {
    document.addEventListener('DOMContentLoaded', applyTheme)
  }
} catch (e) { /* DOM not ready yet */ }

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  toggleWidget: () => ipcRenderer.send('toggle-widget'),
  closeWidget: () => ipcRenderer.send('close-widget'),
  quitApp: () => ipcRenderer.send('app-quit'),
  onMenuNavigate: (callback) => ipcRenderer.on('menu-navigate', (_event, view) => callback(view)),
  onMenuNewTask: (callback) => ipcRenderer.on('menu-new-task', () => callback()),
  onMenuQuickAdd: (callback) => ipcRenderer.on('menu-quick-add', () => callback()),
  onMenuStartFocus: (callback) => ipcRenderer.on('menu-start-focus', () => callback()),
  setFullScreen: (fullscreen) => ipcRenderer.send('set-fullscreen', fullscreen),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  onFullScreenChange: (callback) => ipcRenderer.on('fullscreen-change', (_event, isFullScreen) => callback(isFullScreen)),

  // System Shield APIs
  shieldStart: (websites, apps, mode) => ipcRenderer.invoke('shield-start', { websites, apps, mode }),
  shieldStop: () => ipcRenderer.invoke('shield-stop'),
  shieldUpdate: (websites, apps, mode) => ipcRenderer.invoke('shield-update', { websites, apps, mode }),
  shieldStatus: () => ipcRenderer.invoke('shield-status'),

  // Desktop enhancements
  notify: (options) => ipcRenderer.invoke('notify', options),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-launch'),
  reportTrayState: (state) => ipcRenderer.send('report-tray-state', state),
  toggleTimerFloat: () => ipcRenderer.send('toggle-timer-float'),
  closeTimerFloat: () => ipcRenderer.send('close-timer-float'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onTrayTogglePomodoro: (callback) => ipcRenderer.on('tray-toggle-pomodoro', () => callback()),
  onClipboardCapture: (callback) => ipcRenderer.on('clipboard-capture', (_event, data) => callback(data)),
  onSystemSuspend: (callback) => ipcRenderer.on('system-suspend', () => callback()),
  onSystemResume: (callback) => ipcRenderer.on('system-resume', () => callback()),
  sendPomodoroState: (state) => ipcRenderer.send('pomodoro-state', state),
  onPomodoroSync: (callback) => ipcRenderer.on('pomodoro-sync', (_event, data) => callback(data)),
  sendFloatControl: (action) => ipcRenderer.send('float-control', action),
  onFloatControl: (callback) => ipcRenderer.on('float-pomodoro-control', (_event, action) => callback(action)),

  // Credential vault (safeStorage)
  credentialVaultAvailable: () => ipcRenderer.invoke('credential-vault-available'),
  credentialEncrypt: (plain) => ipcRenderer.invoke('credential-encrypt', plain),
  credentialDecrypt: (sealed) => ipcRenderer.invoke('credential-decrypt', sealed),
})
