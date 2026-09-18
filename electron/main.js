const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain, dialog, screen, globalShortcut, clipboard, Notification, powerMonitor, powerSaveBlocker, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const net = require('net')
const { spawn } = require('child_process')
const { registerSystemShieldIPC, cleanupShield, startSystemShield, stopSystemShield, getShieldStatus } = require('./system-shield')
const { createShieldScheduler } = require('./shield-scheduler')
let shieldScheduler = null

let mainWindow = null
let widgetWindow = null
let timerFloatWindow = null
let nextProcess = null
let tray = null
let clipboardTimer = null
let lastClipboardText = ''
let trayState = { todayCount: 0, pomodoroStatus: '空闲', timerLabel: '', todaySessions: 0, todayFocusMinutes: 0 }
let isQuitting = false
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── 全屏严格模式：主进程级窗口锁定 ───
// 渲染层只负责「请求」锁定，真正的强制力放在主进程：即便渲染层被刷新/卡死，
// kiosk 与置顶仍由窗口自己维持；退出必须经过渲染层的长按放弃流程解锁。
let strictLockActive = false
let strictSleepBlockerId = null
let lastBlurPullbackAt = 0

function notifyStrictViolation(reason) {
  try {
    mainWindow?.webContents.send('strict-lock-violation', { reason })
  } catch {
    // 窗口已销毁时忽略
  }
}

function applyStrictLock(locked, opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return { success: false, locked: false }

  if (locked) {
    strictLockActive = true
    try {
      // kiosk 会隐藏菜单栏与窗口边框，并压制 Esc / Alt+Tab 等系统级退出路径
      mainWindow.setKiosk(true)
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      mainWindow.show()
      mainWindow.focus()
    } catch (err) {
      console.error('[strict-lock] enable failed:', err)
    }
    if (opts.preventSleep !== false && strictSleepBlockerId === null) {
      try {
        strictSleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
      } catch (err) {
        console.error('[strict-lock] powerSaveBlocker start failed:', err)
        strictSleepBlockerId = null
      }
    }
    return { success: true, locked: true, supported: true }
  }

  strictLockActive = false
  if (strictSleepBlockerId !== null) {
    try {
      powerSaveBlocker.stop(strictSleepBlockerId)
    } catch {
      // 停止失败无需阻塞解锁
    }
    strictSleepBlockerId = null
  }
  try {
    mainWindow.setAlwaysOnTop(false)
    if (mainWindow.isKiosk()) mainWindow.setKiosk(false)
  } catch (err) {
    console.error('[strict-lock] disable failed:', err)
  }
  // 广播解锁结果：托盘紧急解锁 / 快捷键解锁时，渲染层需要同步退出锁定态
  try {
    mainWindow?.webContents.send('strict-lock-changed', { locked: false })
  } catch {
    // 窗口已销毁时忽略
  }
  return { success: true, locked: false, supported: true }
}

/** 严格模式下的兜底拉回：失焦/退出全屏/关闭窗口都重新进入 kiosk */
function pullBackToStrictLock(reason) {
  if (!strictLockActive || !mainWindow || mainWindow.isDestroyed()) return
  try {
    if (!mainWindow.isKiosk()) mainWindow.setKiosk(true)
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.show()
    mainWindow.focus()
    notifyStrictViolation(reason)
  } catch (err) {
    console.error('[strict-lock] pull back failed:', err)
  }
}

const DEFAULT_PORT = 3000
let PORT = DEFAULT_PORT

function portInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(true))
    srv.once('listening', () => srv.close(() => resolve(false)))
    srv.listen(port, '127.0.0.1')
  })
}

// 生产模式下从 3000 起探测可用端口：端口被其他服务占用时会加载到陌生页面内容
async function pickAvailablePort() {
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + 20; p++) {
    if (!(await portInUse(p))) return p
  }
  return DEFAULT_PORT
}

function isTrustedOrigin(origin) {
  return origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`
}

let autoUpdater = null
let updateFeedState = { status: 'idle' }
try {
  autoUpdater = require('electron-updater').autoUpdater
} catch {
  autoUpdater = null
}

const gotTheLock = app.requestSingleInstanceLock()

// 全局未捕获异常兜底：记录日志并提示，避免静默崩溃
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

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
    return isTrustedOrigin(new URL(url).origin)
  } catch {
    return false
  }
}

// 仅允许 https 与本应用本地 http 地址交给系统打开，其余协议（file:/ms-msdt:/search-ms: 等）一律丢弃
function isSafeExternalUrl(rawUrl) {
  const u = tryParseUrl(rawUrl)
  if (!u) return false
  if (u.protocol === 'https:') return true
  return u.protocol === 'http:' && isLocalAppUrl(rawUrl)
}

function secureWindow(windowInstance) {
  if (!windowInstance) return
  windowInstance.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  windowInstance.webContents.on('will-navigate', (event, url) => {
    if (isLocalAppUrl(url)) return
    event.preventDefault()
    // 与 setWindowOpenHandler 同一协议策略：非 https/本地地址不交给系统，防止 Follina 类协议滥用
    if (isSafeExternalUrl(url)) {
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

// ─── 窗口状态记忆：bounds + 最大化持久化到 userData，重启后恢复 ───
function windowBoundsPath() {
  return path.join(app.getPath('userData'), 'window-bounds.json')
}

function loadWindowBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(windowBoundsPath(), 'utf8'))
    if (typeof b.width !== 'number' || typeof b.height !== 'number') return null
    if (b.maximized) return { maximized: true }
    const x = typeof b.x === 'number' ? b.x : 0
    const y = typeof b.y === 'number' ? b.y : 0
    // 拔掉副屏后保存的坐标可能落在不可见区域，要求窗口标题栏至少一部分在某个显示器内
    const visible = screen.getAllDisplays().some((d) => {
      const area = d.workArea
      return x + 200 > area.x && y + 40 > area.y && x < area.x + area.width - 200 && y < area.y + area.height - 40
    })
    if (!visible) return null
    return { x, y, width: b.width, height: b.height, maximized: false }
  } catch {
    return null
  }
}

let boundsSaveTimer = null
function scheduleSaveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || strictLockActive) return
  clearTimeout(boundsSaveTimer)
  boundsSaveTimer = setTimeout(() => {
    try {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || mainWindow.isFullScreen()) return
      const b = mainWindow.getBounds()
      fs.writeFileSync(windowBoundsPath(), JSON.stringify({ ...b, maximized: mainWindow.isMaximized() }))
    } catch {
      // 落盘失败不影响使用
    }
  }, 800)
}

function createWindow() {
  const savedBounds = loadWindowBounds()
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    ...(savedBounds && !savedBounds.maximized
      ? { x: savedBounds.x, y: savedBounds.y, width: savedBounds.width, height: savedBounds.height }
      : {}),
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
    if (savedBounds?.maximized) mainWindow.maximize()
  })

  mainWindow.on('move', scheduleSaveWindowBounds)
  mainWindow.on('resize', scheduleSaveWindowBounds)
  mainWindow.on('maximize', scheduleSaveWindowBounds)
  mainWindow.on('unmaximize', scheduleSaveWindowBounds)

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
    // 严格模式下 Esc 触发的退出全屏必须被拉回，否则锁定形同虚设
    if (strictLockActive) {
      pullBackToStrictLock('leave-fullscreen')
      mainWindow?.webContents.send('fullscreen-change', true)
      return
    }
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

function formatTrayTooltip() {
  const base = `FocusFlow - 今日待办 ${trayState.todayCount} 项`
  if (trayState.pomodoroStatus === '空闲') return `${base} | 番茄钟：空闲`
  const remaining = trayState.timerLabel ? ` ${trayState.timerLabel}` : ''
  return `${base} | 番茄钟：${trayState.pomodoroStatus}${remaining}`
}

function updateTrayTooltip() {
  try {
    tray?.setToolTip(formatTrayTooltip())
  } catch {
    // 托盘已销毁时忽略
  }
}

function updateTray() {
  if (!tray) return
  updateTrayTooltip()

  const pomodoroStatus = trayState.pomodoroStatus || '空闲'
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
      label: `今日专注 ${trayState.todaySessions} 个 · ${trayState.todayFocusMinutes} 分钟`,
      enabled: false,
    },
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

    // 轮询健康检查：最多等待 20s，替代固定 2s 的竞态等待
    let attempts = 0
    const checkInterval = setInterval(async () => {
      attempts++
      try {
        // 带超时的健康检查，防止悬挂请求堆积
        const res = await fetch(`http://127.0.0.1:${PORT}`, { signal: AbortSignal.timeout(2000) })
        if (res.ok) {
          clearInterval(checkInterval)
          resolve()
          return
        }
      } catch {
        // server 尚未就绪，继续轮询
      }
      if (attempts >= 40) {
        clearInterval(checkInterval)
        console.error('Next.js server failed to become ready in time')
        // 启动失败时回收子进程，避免残留 node 进程常驻
        stopNextServer()
        reject(new Error('本地服务启动超时'))
      }
    }, 500)
  })
}

function stopNextServer() {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
}

function sendNativeNotification(title, body, tag, onClick, opts = {}) {
  if (!Notification.isSupported()) return false
  try {
    const actions = Array.isArray(opts.actions)
      ? opts.actions.map((label, i) => ({ type: 'button', index: i, label: String(label) }))
      : undefined
    const n = new Notification({
      title,
      body,
      icon: path.join(__dirname, '../public/icon.png'),
      silent: false,
      requireInteraction: !!opts.requireInteraction,
      ...(actions && actions.length ? { actions } : {}),
    })
    n.on('click', () => {
      showMainWindow()
      if (onClick) onClick()
    })
    if (typeof opts.onAction === 'function') {
      n.on('action', (_event, index) => {
        opts.onAction(index)
      })
    }
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

// ─── 自动时间线追踪：周期采样前台应用（仅 Windows，本地存储不上传） ───
const ACTIVITY_INTERVAL_MS = 30000
let activityTimer = null
let activityPsProc = null
const isWindowsPlatform = process.platform === 'win32'

// 单次查询前台窗口的进程名与标题（PowerShell + Win32 API）
// 通过 -EncodedCommand 传递，彻底规避多层引号转义问题
const FOREGROUND_QUERY_SCRIPT = "$sig='using System;using System.Runtime.InteropServices;public class FFWin{[DllImport(\"user32.dll\")]public static extern IntPtr GetForegroundWindow();[DllImport(\"user32.dll\")]public static extern uint GetWindowThreadProcessId(IntPtr p,out uint id);}';Add-Type $sig;$h=[FFWin]::GetForegroundWindow();$id=0;[void][FFWin]::GetWindowThreadProcessId($h,[ref]$id);$p=Get-Process -Id $id -ErrorAction SilentlyContinue;if($p -and $p.ProcessName){$t=$p.MainWindowTitle;if($t){$t=$t.Substring(0,[Math]::Min(120,$t.Length))};\"$($p.ProcessName)|$t\"}"
const FOREGROUND_QUERY_ENCODED = Buffer.from(FOREGROUND_QUERY_SCRIPT, 'utf16le').toString('base64')

function stopActivitySampling() {
  if (activityTimer) {
    clearInterval(activityTimer)
    activityTimer = null
  }
  if (activityPsProc) {
    try { activityPsProc.kill() } catch { /* 忽略 */ }
    activityPsProc = null
  }
}

function startActivitySampling() {
  if (activityTimer || !isWindowsPlatform) return
  const broadcast = (app, title) => {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send('activity-sample', { app, title, intervalSec: Math.round(ACTIVITY_INTERVAL_MS / 1000) }) } catch { /* 忽略 */ }
    }
  }
  activityTimer = setInterval(() => {
    if (activityPsProc) return // 上一次查询尚未返回，跳过本轮
    try {
      activityPsProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', FOREGROUND_QUERY_ENCODED], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      let out = ''
      const proc = activityPsProc
      proc.stdout.on('data', (d) => { out += d.toString() })
      proc.on('close', () => {
        if (activityPsProc === proc) activityPsProc = null
        const line = out.trim().split(/\r?\n/).filter(Boolean).pop()
        if (!line) return
        const sep = line.indexOf('|')
        if (sep <= 0) return
        const app = line.slice(0, sep).trim().slice(0, 64)
        const title = line.slice(sep + 1).trim().slice(0, 120)
        if (app) broadcast(app, title)
      })
      proc.on('error', () => {
        if (activityPsProc === proc) activityPsProc = null
      })
    } catch {
      // spawn 失败忽略本轮
    }
  }, ACTIVITY_INTERVAL_MS)
}

ipcMain.on('activity-set-enabled', (event, enabled) => {
  if (!isTrustedSender(event)) return
  if (enabled) startActivitySampling()
  else stopActivitySampling()
})

// ─── 可配置全局快捷键：注册结果必须校验，冲突时静默失败会让用户以为功能坏了 ───
const GLOBAL_SHORTCUT_DEFAULTS = [
  { id: 'toggle-window', accelerator: 'CommandOrControl+Shift+F', label: '显示/隐藏主窗口' },
  { id: 'quick-add', accelerator: 'CommandOrControl+Shift+N', label: '快速添加任务' },
  { id: 'toggle-pomodoro', accelerator: 'CommandOrControl+Shift+P', label: '开始/暂停番茄钟' },
]
const GLOBAL_SHORTCUT_HANDLERS = {
  'toggle-window': () => toggleMainWindow(),
  'quick-add': () => {
    showMainWindow()
    mainWindow?.webContents.send('menu-quick-add')
  },
  'toggle-pomodoro': () => {
    showMainWindow()
    mainWindow?.webContents.send('tray-toggle-pomodoro')
  },
}

function shortcutConfigPath() {
  return path.join(app.getPath('userData'), 'shortcuts.json')
}

function loadShortcutOverrides() {
  try {
    const raw = JSON.parse(fs.readFileSync(shortcutConfigPath(), 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function getShortcutsSnapshot() {
  const overrides = loadShortcutOverrides()
  return GLOBAL_SHORTCUT_DEFAULTS.map((s) => {
    const accelerator = typeof overrides[s.id] === 'string' && overrides[s.id] ? overrides[s.id] : s.accelerator
    let registered = false
    try {
      registered = globalShortcut.isRegistered(accelerator)
    } catch {
      // app 未 ready 时查询失败按未注册处理
    }
    return { id: s.id, label: s.label, default: s.accelerator, accelerator, registered }
  })
}

function applyGlobalShortcuts() {
  globalShortcut.unregisterAll()
  const overrides = loadShortcutOverrides()
  const failures = []
  for (const s of GLOBAL_SHORTCUT_DEFAULTS) {
    const accelerator = typeof overrides[s.id] === 'string' && overrides[s.id] ? overrides[s.id] : s.accelerator
    let ok = false
    try {
      ok = globalShortcut.register(accelerator, GLOBAL_SHORTCUT_HANDLERS[s.id])
    } catch {
      ok = false
    }
    if (!ok) failures.push(`${s.label}（${accelerator}）`)
  }
  if (failures.length) {
    console.error('[global-shortcut] registration failed:', failures.join('、'))
    sendNativeNotification(
      '⌨️ 全局快捷键冲突',
      `${failures.join('、')} 注册失败，可能被其他应用占用，可在 设置-快捷键 中修改`,
      'shortcut-conflict'
    )
  }
}

ipcMain.handle('shortcuts-get', (event) => {
  if (!isTrustedSender(event)) return []
  return getShortcutsSnapshot()
})

ipcMain.handle('shortcuts-set', (event, map) => {
  if (!isTrustedSender(event)) return { success: false, message: '非法调用' }
  if (!map || typeof map !== 'object') return { success: false, message: '参数无效' }
  const validAcc = /^[Cm]ommandOrControl(\+[A-Za-z0-9]){2,4}$/
  const overrides = loadShortcutOverrides()
  for (const s of GLOBAL_SHORTCUT_DEFAULTS) {
    const acc = map[s.id]
    if (acc === undefined) continue
    if (typeof acc !== 'string' || !validAcc.test(acc)) {
      return { success: false, message: `快捷键格式无效：${s.label}` }
    }
    overrides[s.id] = acc
  }
  try {
    fs.writeFileSync(shortcutConfigPath(), JSON.stringify(overrides))
  } catch (err) {
    console.error('[global-shortcut] save failed:', err)
    return { success: false, message: '保存失败' }
  }
  applyGlobalShortcuts()
  return { success: true, shortcuts: getShortcutsSnapshot() }
})

function registerPowerMonitor() {
  powerMonitor.on('suspend', () => {
    mainWindow?.webContents.send('system-suspend')
  })
  powerMonitor.on('resume', () => {
    mainWindow?.webContents.send('system-resume')
    // 休眠/锁屏恢复后窗口可能掉出 kiosk，严格模式下重新拉回
    if (strictLockActive) pullBackToStrictLock('blur')
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
    updateFeedState = { status: 'available', version: info.version }
    sendNativeNotification('🔄 发现新版本', `FocusFlow ${info.version} 已发布，点击更新`, 'update-available', () => {
      autoUpdater.downloadUpdate()
    })
  })
  autoUpdater.on('update-not-available', () => {
    updateFeedState = { status: 'not-available' }
  })
  autoUpdater.on('update-downloaded', () => {
    updateFeedState = { status: 'downloaded', version: updateFeedState.version || null }
    sendNativeNotification('✅ 更新已就绪', '重启应用即可完成更新', 'update-downloaded', () => {
      isQuitting = true
      autoUpdater.quitAndInstall()
    })
    try {
      mainWindow?.webContents.send('update-downloaded', { version: updateFeedState.version })
    } catch {
      // 窗口已销毁时忽略
    }
  })
  autoUpdater.on('error', (err) => {
    updateFeedState = { status: 'error', message: err?.message || String(err) }
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

ipcMain.handle('update-check', async (event) => {
  if (!isTrustedSender(event)) return { status: 'error', message: '非法调用' }
  if (!autoUpdater) return { status: 'unavailable', message: '未安装更新组件' }
  if (isDev) return { status: 'unavailable', message: '开发模式不支持检查更新' }
  updateFeedState = { status: 'checking' }
  try {
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version
    if (version && version !== app.getVersion()) {
      updateFeedState = { status: 'available', version }
      return { status: 'available', version }
    }
    updateFeedState = { status: 'not-available' }
    return { status: 'not-available', version: app.getVersion() }
  } catch (err) {
    const message = err?.message || '检查更新失败'
    updateFeedState = { status: 'error', message }
    return { status: 'error', message }
  }
})

ipcMain.handle('update-download', async (event) => {
  if (!isTrustedSender(event)) return { status: 'error', message: '非法调用' }
  if (!autoUpdater || isDev) return { status: 'unavailable' }
  if (updateFeedState.status !== 'available') return { status: 'idle', message: '当前没有可用更新' }
  try {
    await autoUpdater.downloadUpdate()
    return { status: 'downloading' }
  } catch (err) {
    return { status: 'error', message: err?.message || '下载失败' }
  }
})

ipcMain.handle('update-install', (event) => {
  if (!isTrustedSender(event)) return false
  if (!autoUpdater || isDev) return false
  isQuitting = true
  autoUpdater.quitAndInstall()
  return true
})

ipcMain.handle('update-state', (event) => {
  if (!isTrustedSender(event)) return { status: 'idle' }
  return updateFeedState
})

ipcMain.on('window-minimize', (event) => {
  if (!isTrustedSender(event)) return
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', (event) => {
  if (!isTrustedSender(event)) return
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window-close', (event) => {
  if (!isTrustedSender(event)) return
  mainWindow?.hide()
})

ipcMain.handle('window-is-maximized', (event) => {
  if (!isTrustedSender(event)) return false
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

// 全屏严格模式：窗口级锁定（kiosk + 置顶 + 防休眠 + 拦截退出）
ipcMain.handle('strict-lock-set', (event, opts = {}) => {
  if (!isTrustedSender(event)) return { success: false, locked: strictLockActive, supported: false }
  const options = opts && typeof opts === 'object' ? opts : {}
  return applyStrictLock(!!options.locked, options)
})

ipcMain.handle('strict-lock-status', () => {
  return { locked: strictLockActive, supported: true }
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

ipcMain.on('widget-set-pinned', (event, pinned) => {
  if (!isTrustedSender(event)) return
  try {
    widgetWindow?.setAlwaysOnTop(!!pinned, 'screen-saver')
  } catch {
    // 窗口已销毁时忽略
  }
})

// 普通专注期间的屏幕常亮（独立于严格模式的 powerSaveBlocker 句柄）
let focusSleepBlockerId = null
ipcMain.on('set-keep-awake', (event, enabled) => {
  if (!isTrustedSender(event)) return
  try {
    if (enabled && focusSleepBlockerId === null) {
      focusSleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    } else if (!enabled && focusSleepBlockerId !== null) {
      powerSaveBlocker.stop(focusSleepBlockerId)
      focusSleepBlockerId = null
    }
  } catch (err) {
    console.error('[keep-awake] failed:', err)
  }
})

ipcMain.on('app-quit', (event) => {
  if (!isTrustedSender(event)) return
  app.quit()
})

ipcMain.handle('notify', (event, { title, body, tag, requireInteraction, actions } = {}) => {
  if (!isTrustedSender(event)) return false
  if (!title) return false
  const sender = event.sender
  return sendNativeNotification(title, body || '', tag || null, null, {
    requireInteraction,
    actions,
    onAction: (index) => {
      showMainWindow()
      try {
        sender.send('notify-action', { tag: tag || null, index })
      } catch {
        // 渲染层已销毁时忽略
      }
    },
  })
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
    let label = ''
    if (state.isRunning) {
      const tl = Math.max(0, Math.round(Number(state.timeLeft) || 0))
      label = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(tl % 60).padStart(2, '0')}`
    }
    if (label !== trayState.timerLabel) {
      trayState = { ...trayState, timerLabel: label }
      updateTrayTooltip()
    }
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

// 打印到 PDF：渲染进程提供 HTML，主进程用隐藏窗口渲染并调起保存对话框
ipcMain.handle('print-to-pdf', async (event, { html, fileName } = {}) => {
  if (!isTrustedSender(event)) return { success: false, message: '非法调用' }
  if (typeof html !== 'string' || html.length === 0) return { success: false, message: '内容为空' }
  // 上限 2MB，防止异常/恶意渲染请求造成内存压力
  if (html.length > 2_000_000) return { success: false, message: '内容过大' }
  if (typeof fileName !== 'string') return { success: false, message: '缺少文件名' }
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '') + '.pdf'
  let printWin = null
  try {
    printWin = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdfData = await printWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'printableArea' },
    })
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 PDF',
      defaultPath: safeName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { success: false, canceled: true }
    const fs = require('fs')
    await fs.promises.writeFile(filePath, pdfData)
    return { success: true, filePath }
  } catch (err) {
    console.error('printToPDF failed', err)
    return { success: false, message: err instanceof Error ? err.message : '导出失败' }
  } finally {
    // 无论成功失败都销毁隐藏窗口，避免累积泄漏
    if (printWin && !printWin.isDestroyed()) printWin.destroy()
  }
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
    // safeStorage 不可用或加密失败时返回空串，绝不静默回退为明文；
    // 由渲染层感知后显式降级（值带 plain: 标记，可被检测与提示）
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[credential-vault] safeStorage unavailable, refusing to store plaintext')
      return ''
    }
    return safeStorage.encryptString(plain).toString('base64')
  } catch (err) {
    console.error('[credential-vault] encrypt failed:', err)
    return ''
  }
})

ipcMain.handle('credential-decrypt', (event, sealed) => {
  if (!isTrustedSender(event)) return ''
  if (typeof sealed !== 'string' || !sealed) return ''
  try {
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(Buffer.from(sealed, 'base64'))
  } catch (err) {
    console.error('[credential-vault] decrypt failed:', err)
    return ''
  }
})


// 屏蔽可靠性：主进程调度器（崩溃重放 + 定时窗口推进，不依赖渲染层存活）
function initShieldScheduler() {
  try {
    shieldScheduler = createShieldScheduler({
      statePath: path.join(app.getPath('userData'), 'shield-state.json'),
      applyBlock: (websites, apps, mode) => startSystemShield(websites, apps, mode),
      removeBlock: () => stopSystemShield(),
      onNotify: (payload) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) win.webContents.send('shield-status-changed', payload)
      },
    })
    void shieldScheduler.replay()
    shieldScheduler.start()
  } catch (err) {
    console.error('[shield-scheduler] init failed:', err)
  }
  ipcMain.handle('shield-schedule-sync', (event, windows) => {
    if (!isTrustedSender(event)) return { success: false }
    if (shieldScheduler) shieldScheduler.syncSchedule(Array.isArray(windows) ? windows : [])
    return { success: true }
  })
}

app.whenReady().then(async () => {
  try {
    Menu.setApplicationMenu(null)
    if (!isDev) PORT = await pickAvailablePort()
    initShieldScheduler()
    registerSystemShieldIPC(isTrustedSender, {
      onSessionStart: (session) => shieldScheduler ? shieldScheduler.startSession(session) : Promise.resolve(),
      onSessionStop: () => shieldScheduler ? shieldScheduler.stopSession() : Promise.resolve(),
    })
    registerPowerMonitor()
    applyGlobalShortcuts()
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
  if (shieldScheduler) shieldScheduler.dispose()
  cleanupShield()
  stopClipboardWatcher()
  globalShortcut.unregisterAll()
})

app.on('will-quit', () => {
  if (strictLockActive) applyStrictLock(false)
  stopNextServer()
  cleanupShield()
  stopClipboardWatcher()
})