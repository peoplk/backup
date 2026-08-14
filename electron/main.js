const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain, dialog, screen, globalShortcut, clipboard, Notification, powerMonitor, safeStorage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const { registerSystemShieldIPC, cleanupShield } = require('./system-shield')

let mainWindow = null
let widgetWindow = null
let timerFloatWindow = null
let nextProcess = null
let tray = null
let clipboardTimer = null
let lastClipboardText = ''
let trayState = { todayCount: 0, pomodoroStatus: '空闲' }
let isQuitting = false
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

const PORT = 3000
const TRUSTED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

let autoUpdater = null
try {
  autoUpdater = require('electron-updater').autoUpdater
} catch {
  autoUpdater = null
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// 严格校验 URL 是否指向本应用本地服务（防前缀匹配绕过 / 任意页面拿到 preload 桥）
function isLocalAppUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    const port = String(u.port || (u.protocol === 'http:' ? '80' : '443'))
    return (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      port === String(PORT)
    )
  } catch {
    return false
  }
}

// 校验 IPC 请求是否来自可信渲染页面
function isTrustedSender(event) {
  try {
    const url = event?.senderFrame?.url
    if (!url) return false
    return TRUSTED_ORIGINS.includes(new URL(url).origin)
  } catch {
    return false
  }
}

function secureWindow(windowInstance) {
  if (!windowInstance) return
  windowInstance.webContents.setWindowOpenHandler(({ url }) => {
    const u = tryParseUrl(url)
    if (u && u.protocol === 'https:') {
      shell.openExternal(url)
    } else if (u && u.protocol === 'http:' && isLocalAppUrl(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  windowInstance.webContents.on('will-navigate', (event, url) => {
    if (!isLocalAppUrl(url)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

function tryParseUrl(rawUrl) {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function toggleMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
  } else {
    showMainWindow()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'FocusFlow',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
    backgroundColor: '#0f172a',
    show: false,
    roundedCorners: false,
    hasShadow: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${PORT}`)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}`)
  }

  secureWindow(mainWindow)

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-change', true)
  })

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.setResizable(true)
    mainWindow?.webContents.send('fullscreen-change', false)
  })
}

function createWidgetWindow() {
  if (widgetWindow) {
    widgetWindow.show()
    widgetWindow.focus()
    return
  }

  widgetWindow = new BrowserWindow({
    width: 340,
    height: 560,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  widgetWindow.setMenuBarVisibility(false)

  if (isDev) {
    widgetWindow.loadURL(`http://localhost:${PORT}/widget`)
  } else {
    widgetWindow.loadURL(`http://localhost:${PORT}/widget`)
  }

  secureWindow(widgetWindow)

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })
}

function createTimerFloatWindow() {
  if (timerFloatWindow) {
    timerFloatWindow.show()
    timerFloatWindow.focus()
    return
  }

  timerFloatWindow = new BrowserWindow({
    width: 320,
    height: 120,
    resizable: false,
    frame: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  timerFloatWindow.setMenuBarVisibility(false)

  if (isDev) {
    timerFloatWindow.loadURL(`http://localhost:${PORT}/widget?mode=timer`)
  } else {
    timerFloatWindow.loadURL(`http://localhost:${PORT}/widget?mode=timer`)
  }

  secureWindow(timerFloatWindow)

  timerFloatWindow.on('closed', () => {
    timerFloatWindow = null
  })
}

function updateTray() {
  if (!tray) return
  const pomodoroStatus = trayState.pomodoroStatus || '空闲'
  tray.setToolTip(`FocusFlow - 今日待办 ${trayState.todayCount} 项 | 番茄钟：${pomodoroStatus}`)

  const isRunning = pomodoroStatus !== '空闲' && !pomodoroStatus.includes('暂停')
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 FocusFlow',
      click: () => showMainWindow()
    },
    {
      label: '桌面小组件',
      click: () => createWidgetWindow()
    },
    {
      label: '番茄钟浮窗',
      click: () => createTimerFloatWindow()
    },
    { type: 'separator' },
    {
      label: isRunning ? '⏸ 暂停番茄钟' : '▶ 开始番茄钟',
      click: () => {
        mainWindow?.webContents.send('tray-toggle-pomodoro')
      }
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: isAutoLaunchEnabled(),
      click: (menuItem) => {
        setAutoLaunch(menuItem.checked)
      }
    },
    { type: 'separator' },
    {
      label: '退出 FocusFlow',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

function isAutoLaunchEnabled() {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
}

function setAutoLaunch(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    })
    updateTray()
    return true
  } catch (err) {
    console.error('setLoginItemSettings failed:', err)
    return false
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png')
  let icon = nativeImage.createFromPath(iconPath)
  icon = icon.resize({ width: 16, height: 16, quality: 'best' })

  tray = new Tray(icon)
  updateTray()

  tray.on('double-click', () => {
    showMainWindow()
  })
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve()
      return
    }

    const serverPath = path.join(process.resourcesPath, 'server')

    // 仅绑定本机回环地址，避免暴露到局域网（防 SSRF / 额度滥用）
    nextProcess = spawn('node', ['server.js'], {
      cwd: serverPath,
      env: { ...process.env, PORT: PORT.toString(), HOSTNAME: '127.0.0.1' },
      stdio: 'pipe',
      windowsHide: true,
    })

    nextProcess.on('error', (err) => {
      console.error('Failed to start Next.js server:', err)
      reject(err)
    })

    setTimeout(resolve, 2000)
  })
}

function stopNextServer() {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
}

function sendNativeNotification(title, body, tag, onClick) {
  if (!Notification.isSupported()) return false
  try {
    const n = new Notification({
      title,
      body,
      icon: path.join(__dirname, '../public/icon.png'),
      silent: false,
    })
    n.on('click', () => {
      showMainWindow()
      if (onClick) onClick()
    })
    n.show()
    return true
  } catch (err) {
    console.error('Notification failed:', err)
    return false
  }
}

function startClipboardWatcher() {
  if (clipboardTimer) return
  clipboardTimer = setInterval(() => {
    try {
      const text = clipboard.readText().trim()
      if (!text || text === lastClipboardText) return
      lastClipboardText = text
      if (text.length > 500) return

      const isUrl = /^(https?:\/\/|www\.)[^\s]+$/i.test(text)
      if (!isUrl) return

      const url = isUrl && !text.startsWith('http') ? 'https://' + text : text
      sendNativeNotification('📥 检测到链接', text.length > 60 ? text.slice(0, 60) + '…' : text, 'clipboard-url', () => {
        mainWindow?.webContents.send('clipboard-capture', { text: url, type: 'url' })
      })
    } catch {
      // clipboard 读取失败忽略
    }
  }, 2000)
}

function stopClipboardWatcher() {
  if (clipboardTimer) {
    clearInterval(clipboardTimer)
    clipboardTimer = null
  }
}

function registerGlobalShortcuts() {
  globalShortcut.register('Ctrl+Shift+F', () => {
    toggleMainWindow()
  })

  globalShortcut.register('Ctrl+Shift+N', () => {
    showMainWindow()
    mainWindow?.webContents.send('menu-quick-add')
  })

  globalShortcut.register('Ctrl+Shift+P', () => {
    showMainWindow()
    mainWindow?.webContents.send('tray-toggle-pomodoro')
  })
}

function registerPowerMonitor() {
  powerMonitor.on('suspend', () => {
    mainWindow?.webContents.send('system-suspend')
  })
  powerMonitor.on('resume', () => {
    mainWindow?.webContents.send('system-resume')
  })
  powerMonitor.on('lock-screen', () => {
    mainWindow?.webContents.send('system-suspend')
  })
  powerMonitor.on('unlock-screen', () => {
    mainWindow?.webContents.send('system-resume')
  })
}

function setupAutoUpdater() {
  if (!autoUpdater || isDev) return
  autoUpdater.autoDownload = false
  autoUpdater.on('update-available', (info) => {
    sendNativeNotification('🔄 发现新版本', `FocusFlow ${info.version} 已发布，点击更新`, 'update-available', () => {
      autoUpdater.downloadUpdate()
    })
  })
  autoUpdater.on('update-downloaded', () => {
    sendNativeNotification('✅ 更新已就绪', '重启应用即可完成更新', 'update-downloaded', () => {
      autoUpdater.quitAndInstall()
    })
  })
  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err?.message || err)
  })
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates().catch(() => {})
    } catch {
      // 静默失败（未配置发布地址时）
    }
  }, 15000)
}

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', () => {
  mainWindow?.hide()
})

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false
})

ipcMain.on('set-fullscreen', (event, fullscreen) => {
  if (!isTrustedSender(event) || !mainWindow) return
  if (fullscreen) {
    mainWindow.setFullScreen(true)
    mainWindow.setResizable(false)
    mainWindow.webContents.executeJavaScript(`
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
    `)
  } else {
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
  }
  mainWindow.webContents.send('fullscreen-change', fullscreen)
})

ipcMain.handle('is-fullscreen', () => {
  return mainWindow?.isFullScreen() ?? false
})

ipcMain.on('toggle-widget', (event) => {
  if (!isTrustedSender(event)) return
  if (widgetWindow) {
    if (widgetWindow.isVisible()) {
      widgetWindow.hide()
    } else {
      widgetWindow.show()
      widgetWindow.focus()
    }
  } else {
    createWidgetWindow()
  }
})

ipcMain.on('close-widget', (event) => {
  if (!isTrustedSender(event)) return
  widgetWindow?.close()
})

ipcMain.on('app-quit', (event) => {
  if (!isTrustedSender(event)) return
  app.quit()
})

ipcMain.handle('notify', (event, { title, body, tag } = {}) => {
  if (!isTrustedSender(event)) return false
  if (!title) return false
  return sendNativeNotification(title, body || '', tag || null, null)
})

ipcMain.handle('set-auto-launch', (event, enabled) => {
  if (!isTrustedSender(event)) return false
  return setAutoLaunch(!!enabled)
})

ipcMain.handle('get-auto-launch', () => {
  return isAutoLaunchEnabled()
})

ipcMain.on('report-tray-state', (event, state) => {
  if (!isTrustedSender(event)) return
  if (state && typeof state === 'object') {
    trayState = { ...trayState, ...state }
    updateTray()
  }
})

let latestPomodoroState = null

ipcMain.on('pomodoro-state', (event, state) => {
  if (!isTrustedSender(event)) return
  if (state && typeof state === 'object') {
    latestPomodoroState = state
    timerFloatWindow?.webContents.send('pomodoro-sync', state)
    widgetWindow?.webContents.send('pomodoro-sync', state)
  } else if (latestPomodoroState) {
    timerFloatWindow?.webContents.send('pomodoro-sync', latestPomodoroState)
    widgetWindow?.webContents.send('pomodoro-sync', latestPomodoroState)
  }
})

ipcMain.on('float-control', (event, action) => {
  if (!isTrustedSender(event)) return
  mainWindow?.webContents.send('float-pomodoro-control', action)
})

ipcMain.on('toggle-timer-float', (event) => {
  if (!isTrustedSender(event)) return
  if (timerFloatWindow) {
    if (timerFloatWindow.isVisible()) {
      timerFloatWindow.hide()
    } else {
      timerFloatWindow.show()
      timerFloatWindow.focus()
    }
  } else {
    createTimerFloatWindow()
  }
})

ipcMain.on('close-timer-float', (event) => {
  if (!isTrustedSender(event)) return
  timerFloatWindow?.close()
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

// 凭据安全存储：使用操作系统级加密（Windows DPAPI / macOS Keychain）
ipcMain.handle('credential-vault-available', () => {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
})

ipcMain.handle('credential-encrypt', (event, plain) => {
  if (!isTrustedSender(event)) return ''
  if (typeof plain !== 'string' || !plain) return ''
  try {
    if (!safeStorage.isEncryptionAvailable()) return plain
    return safeStorage.encryptString(plain).toString('base64')
  } catch {
    return plain
  }
})

ipcMain.handle('credential-decrypt', (event, sealed) => {
  if (!isTrustedSender(event)) return ''
  if (typeof sealed !== 'string' || !sealed) return ''
  try {
    if (!safeStorage.isEncryptionAvailable()) return sealed
    return safeStorage.decryptString(Buffer.from(sealed, 'base64'))
  } catch {
    return ''
  }
})

app.whenReady().then(async () => {
  try {
    Menu.setApplicationMenu(null)
    registerSystemShieldIPC()
    registerPowerMonitor()
    registerGlobalShortcuts()
    await startNextServer()
    createWindow()
    createTray()
    startClipboardWatcher()
    setupAutoUpdater()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error) {
    console.error('Failed to start app:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopNextServer()
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopNextServer()
  cleanupShield()
  stopClipboardWatcher()
  globalShortcut.unregisterAll()
})

app.on('will-quit', () => {
  stopNextServer()
  cleanupShield()
  stopClipboardWatcher()
})