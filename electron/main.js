const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain, dialog, screen } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const { registerSystemShieldIPC, cleanupShield } = require('./system-shield')

let mainWindow = null
let widgetWindow = null
let nextProcess = null
let tray = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

const PORT = 3000

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
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
    backgroundColor: '#0f172a',
    show: false,
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
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
    height: 540,
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
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  widgetWindow.setMenuBarVisibility(false)

  if (isDev) {
    widgetWindow.loadURL(`http://localhost:${PORT}/widget`)
  } else {
    widgetWindow.loadURL(`http://localhost:${PORT}/widget`)
  }

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png')
  let icon = nativeImage.createFromPath(iconPath)
  icon = icon.resize({ width: 16, height: 16, quality: 'best' })

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 FocusFlow',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: '桌面小组件',
      click: () => {
        createWidgetWindow()
      }
    },
    { type: 'separator' },
    {
      label: '退出 FocusFlow',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('FocusFlow - 专注时间管理')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve()
      return
    }

    const serverPath = path.join(process.resourcesPath, 'server')

    nextProcess = spawn('node', ['server.js'], {
      cwd: serverPath,
      env: { ...process.env, PORT: PORT.toString() },
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

ipcMain.on('set-fullscreen', (_event, fullscreen) => {
  if (mainWindow) {
    if (fullscreen) {
      mainWindow.setFullScreen(true)
      mainWindow.webContents.executeJavaScript(`
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
      `)
    } else {
      mainWindow.setFullScreen(false)
    }
    mainWindow.webContents.send('fullscreen-change', fullscreen)
  }
})

ipcMain.handle('is-fullscreen', () => {
  return mainWindow?.isFullScreen() ?? false
})

ipcMain.on('toggle-widget', () => {
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

ipcMain.on('close-widget', () => {
  widgetWindow?.close()
})

app.whenReady().then(async () => {
  try {
    Menu.setApplicationMenu(null)
    registerSystemShieldIPC()
    await startNextServer()
    createWindow()
    createTray()

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
  app.isQuitting = true
  stopNextServer()
  cleanupShield()
})

app.on('will-quit', () => {
  stopNextServer()
  cleanupShield()
})
