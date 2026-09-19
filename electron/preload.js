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
  // 所有 on* API 返回移除函数，供组件 effect cleanup 调用，防止监听器累积泄漏
  onMenuNavigate: (callback) => {
    const listener = (_event, view) => callback(view)
    ipcRenderer.on('menu-navigate', listener)
    return () => ipcRenderer.removeListener('menu-navigate', listener)
  },
  onMenuNewTask: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu-new-task', listener)
    return () => ipcRenderer.removeListener('menu-new-task', listener)
  },
  onMenuQuickAdd: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu-quick-add', listener)
    return () => ipcRenderer.removeListener('menu-quick-add', listener)
  },
  onMenuStartFocus: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu-start-focus', listener)
    return () => ipcRenderer.removeListener('menu-start-focus', listener)
  },
  setFullScreen: (fullscreen) => ipcRenderer.send('set-fullscreen', fullscreen),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  onFullScreenChange: (callback) => {
    const listener = (_event, isFullScreen) => callback(isFullScreen)
    ipcRenderer.on('fullscreen-change', listener)
    return () => ipcRenderer.removeListener('fullscreen-change', listener)
  },

  // System Shield APIs
  shieldStart: (websites, apps, mode) => ipcRenderer.invoke('shield-start', { websites, apps, mode }),
  shieldStop: () => ipcRenderer.invoke('shield-stop'),
  shieldUpdate: (websites, apps, mode) => ipcRenderer.invoke('shield-update', { websites, apps, mode }),
  shieldStatus: () => ipcRenderer.invoke('shield-status'),
  shieldVerify: () => ipcRenderer.invoke('shield-verify'),
  shieldScheduleSync: (windows) => ipcRenderer.invoke('shield-schedule-sync', windows),
  onShieldStatusChanged: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('shield-status-changed', listener)
    return () => ipcRenderer.removeListener('shield-status-changed', listener)
  },

  // Desktop enhancements
  notify: (options) => ipcRenderer.invoke('notify', options),
  onNotifyAction: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('notify-action', listener)
    return () => ipcRenderer.removeListener('notify-action', listener)
  },
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-launch'),
  reportTrayState: (state) => ipcRenderer.send('report-tray-state', state),
  setWidgetPinned: (pinned) => ipcRenderer.send('widget-set-pinned', !!pinned),
  setKeepAwake: (enabled) => ipcRenderer.send('set-keep-awake', !!enabled),
  shortcutsGet: () => ipcRenderer.invoke('shortcuts-get'),
  shortcutsSet: (map) => ipcRenderer.invoke('shortcuts-set', map),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  updateState: () => ipcRenderer.invoke('update-state'),
  onUpdateDownloaded: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('update-downloaded', listener)
    return () => ipcRenderer.removeListener('update-downloaded', listener)
  },
  toggleTimerFloat: () => ipcRenderer.send('toggle-timer-float'),
  closeTimerFloat: () => ipcRenderer.send('close-timer-float'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  printToPDF: (options) => ipcRenderer.invoke('print-to-pdf', options),
  saveTextFile: (options) => ipcRenderer.invoke('save-text-file', options),
  onTrayTogglePomodoro: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('tray-toggle-pomodoro', listener)
    return () => ipcRenderer.removeListener('tray-toggle-pomodoro', listener)
  },
  onClipboardCapture: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('clipboard-capture', listener)
    return () => ipcRenderer.removeListener('clipboard-capture', listener)
  },
  onSystemSuspend: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('system-suspend', listener)
    return () => ipcRenderer.removeListener('system-suspend', listener)
  },
  onSystemResume: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('system-resume', listener)
    return () => ipcRenderer.removeListener('system-resume', listener)
  },
  sendPomodoroState: (state) => ipcRenderer.send('pomodoro-state', state),
  onPomodoroSync: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('pomodoro-sync', listener)
    return () => ipcRenderer.removeListener('pomodoro-sync', listener)
  },
  sendFloatControl: (action) => ipcRenderer.send('float-control', action),
  onFloatControl: (callback) => {
    const listener = (_event, action) => callback(action)
    ipcRenderer.on('float-pomodoro-control', listener)
    return () => ipcRenderer.removeListener('float-pomodoro-control', listener)
  },

  // Credential vault (safeStorage)
  credentialVaultAvailable: () => ipcRenderer.invoke('credential-vault-available'),
  credentialEncrypt: (plain) => ipcRenderer.invoke('credential-encrypt', plain),
  credentialDecrypt: (sealed) => ipcRenderer.invoke('credential-decrypt', sealed),

  // 全屏严格模式（主进程窗口锁定）
  setStrictLock: (opts) => ipcRenderer.invoke('strict-lock-set', opts),
  getStrictLockStatus: () => ipcRenderer.invoke('strict-lock-status'),
  onStrictLockViolation: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('strict-lock-violation', listener)
    return () => ipcRenderer.removeListener('strict-lock-violation', listener)
  },
  // 主进程侧解锁（托盘紧急解锁 / 快捷键）后广播，供渲染层同步状态
  onStrictLockChanged: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('strict-lock-changed', listener)
    return () => ipcRenderer.removeListener('strict-lock-changed', listener)
  },

  // Activity timeline tracking (local-only sampling of foreground app)
  setActivityTracking: (enabled) => ipcRenderer.send('activity-set-enabled', enabled),
  onActivitySample: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('activity-sample', listener)
    return () => ipcRenderer.removeListener('activity-sample', listener)
  },
  onActivityStatus: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('activity-status', listener)
    return () => ipcRenderer.removeListener('activity-status', listener)
  },
})
