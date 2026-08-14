const { ipcMain } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

// System-level focus shield for Electron
// Blocks websites via hosts file and kills blocked applications

const isWindows = os.platform() === 'win32'
const isMac = os.platform() === 'darwin'

const HOSTS_FILE = isWindows
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts'

const FOCUSFLOW_MARKER_START = '# === FocusFlow System Shield START ==='
const FOCUSFLOW_MARKER_END = '# === FocusFlow System Shield END ==='

let shieldInterval = null
let blockedAppsCache = new Set()
let blockedWebsitesCache = new Set()
let isShieldActive = false

// 白名单模式下，屏蔽这些常见干扰站点中不在白名单里的
const DEFAULT_DISTRACTING_WEBSITES = [
  'weibo.com',
  'douyin.com',
  'bilibili.com',
  'zhihu.com',
  'xiaohongshu.com',
  'taobao.com',
  'jd.com',
  'v.qq.com',
  'iqiyi.com',
  'youku.com',
  'tiktok.com',
  'instagram.com',
  'twitter.com',
  'facebook.com',
  'youtube.com',
  'reddit.com',
]

const DEFAULT_DISTRACTING_APPS = [
  'wechat',
  'qq',
  'dingtalk',
  'wxwork',
  'taobao',
  'jd',
  'douyin',
]

function normalizeDomain(site) {
  return site.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
}

// 校验单个域名：仅允许 [a-z0-9.-]，且是合法域名形式（防止换行/空格/控制字符注入 hosts）
function sanitizeDomain(site) {
  const raw = String(site || '')
    .replace(/[\r\n\t\s]+/g, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase()
  if (!raw || raw.length > 253) return ''
  if (!/^(?!-)([a-z0-9-]{1,63}\.)*[a-z0-9]{2,63}$/.test(raw)) return ''
  if (/(--)/.test(raw)) return ''
  return raw
}

// 校验进程名：仅允许安全字符（防止命令注入）
function sanitizeAppName(appName) {
  const name = String(appName || '').replace(/\.exe$/i, '').trim().toLowerCase()
  if (!name || name.length < 2 || name.length > 64) return ''
  if (!/^[a-z0-9 _\-\.]+$/.test(name)) return ''
  return name
}

// 白名单模式下，求"需要屏蔽的"列表：默认干扰列表 - 白名单
function computeBlockLists(websites, apps, mode) {
  if (mode !== 'whitelist') {
    return {
      websites: (websites || []).map(sanitizeDomain).filter(Boolean),
      apps: (apps || []).map(sanitizeAppName).filter(Boolean),
    }
  }
  const allowedWebsites = new Set((websites || []).map(sanitizeDomain).filter(Boolean))
  const allowedApps = new Set((apps || []).map(sanitizeAppName).filter(Boolean))
  const blockedWebsites = DEFAULT_DISTRACTING_WEBSITES.filter(d => !allowedWebsites.has(d))
  const blockedApps = DEFAULT_DISTRACTING_APPS.filter(d => !allowedApps.has(d))
  return { websites: blockedWebsites, apps: blockedApps }
}

// Get hosts file backup path
function getHostsBackupPath() {
  const backupDir = path.join(os.homedir(), '.focusflow')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  return path.join(backupDir, 'hosts.backup')
}

// Backup original hosts file
// 先移除自身残留的屏蔽块，确保备份的是"干净"版本
function backupHosts() {
  try {
    const backupPath = getHostsBackupPath()
    removeShieldFromHosts()
    fs.copyFileSync(HOSTS_FILE, backupPath)
    return true
  } catch (err) {
    console.error('Failed to backup hosts file:', err)
    return false
  }
}

// Restore original hosts file
function restoreHosts() {
  try {
    const backupPath = getHostsBackupPath()
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, HOSTS_FILE)
      flushDns()
      return true
    }
    // If no backup, try to remove FocusFlow markers manually
    removeShieldFromHosts()
    return true
  } catch (err) {
    console.error('Failed to restore hosts file:', err)
    return false
  }
}

// Remove FocusFlow entries from hosts without backup
function removeShieldFromHosts() {
  try {
    const content = fs.readFileSync(HOSTS_FILE, 'utf8')
    const lines = content.split('\n')
    const result = []
    let inShieldBlock = false

    for (const line of lines) {
      if (line.includes(FOCUSFLOW_MARKER_START)) {
        inShieldBlock = true
        continue
      }
      if (line.includes(FOCUSFLOW_MARKER_END)) {
        inShieldBlock = false
        continue
      }
      if (!inShieldBlock) {
        result.push(line)
      }
    }

    fs.writeFileSync(HOSTS_FILE, result.join('\n'), 'utf8')
    flushDns()
    return true
  } catch (err) {
    console.error('Failed to remove shield from hosts:', err)
    return false
  }
}

// Flush DNS cache
function flushDns() {
  if (isWindows) {
    spawn('ipconfig', ['/flushdns'], { windowsHide: true })
  } else if (isMac) {
    spawn('killall', ['-HUP', 'mDNSResponder'])
  }
}

// Apply website blocks to hosts file
function applyWebsiteBlocks(websites) {
  try {
    backupHosts()
    let content = fs.readFileSync(HOSTS_FILE, 'utf8')

    // Remove existing FocusFlow block
    const lines = content.split('\n')
    const result = []
    let inShieldBlock = false
    for (const line of lines) {
      if (line.includes(FOCUSFLOW_MARKER_START)) {
        inShieldBlock = true
        continue
      }
      if (line.includes(FOCUSFLOW_MARKER_END)) {
        inShieldBlock = false
        continue
      }
      if (!inShieldBlock) {
        result.push(line)
      }
    }

    // Build new block entries
    const entries = []
    entries.push(FOCUSFLOW_MARKER_START)
    entries.push('# FocusFlow System Shield - Do not edit manually')
    for (const site of websites) {
      const domain = sanitizeDomain(site)
      if (!domain) continue
      entries.push(`0.0.0.0 ${domain}`)
      entries.push(`0.0.0.0 www.${domain}`)
      entries.push(`:: ${domain}`)
      entries.push(`:: www.${domain}`)
    }
    entries.push(FOCUSFLOW_MARKER_END)

    // Append new block
    result.push('')
    result.push(...entries)

    fs.writeFileSync(HOSTS_FILE, result.join('\n'), 'utf8')
    flushDns()
    return true
  } catch (err) {
    console.error('Failed to apply website blocks:', err)
    return false
  }
}

// Kill blocked application processes on Windows
function killBlockedApps(apps) {
  if (!isWindows) return

  for (const appName of apps) {
    const normalized = sanitizeAppName(appName)
    if (!normalized) continue
    // Try to kill by process name（使用 spawn argv 数组，不经 shell，杜绝注入）
    spawn('taskkill', ['/F', '/IM', `${normalized}.exe`, '/FI', 'STATUS eq RUNNING'], { windowsHide: true })
  }
}

// Get running process list and kill blocked ones (more aggressive)
// 使用精确的进程名匹配，避免 "QQ" 匹配到 QQBrowser/QQMusic 等误杀
function scanAndKillBlockedApps(apps) {
  if (!isWindows) return

  const exactNames = new Set((apps || []).map(sanitizeAppName).filter(Boolean))

  spawn('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true }, (err, stdout) => {
    if (err || !stdout) return

    const lines = stdout.split('\n')
    for (const line of lines) {
      const parts = line.split('","')
      if (parts.length < 2) continue
      const processName = parts[0].replace('"', '').toLowerCase()

      if (exactNames.has(processName) || exactNames.has(processName.replace('.exe', ''))) {
        const pid = String(parts[1].replace('"', '')).trim()
        if (!/^\d+$/.test(pid)) continue
        spawn('taskkill', ['/F', '/PID', pid], { windowsHide: true })
      }
    }
  })
}

// Start system shield
function startSystemShield(websites, apps, mode) {
  const lists = computeBlockLists(websites, apps, mode)
  if (isShieldActive) {
    // Update existing shield
    blockedWebsitesCache = new Set(lists.websites)
    blockedAppsCache = new Set(lists.apps)
    applyWebsiteBlocks(Array.from(blockedWebsitesCache))
    return { success: true, mode: 'updated' }
  }

  blockedWebsitesCache = new Set(lists.websites)
  blockedAppsCache = new Set(lists.apps)

  // Apply hosts file blocks
  const hostsSuccess = applyWebsiteBlocks(Array.from(blockedWebsitesCache))

  // Start periodic app killer
  if (blockedAppsCache.size > 0) {
    // Immediate kill
    scanAndKillBlockedApps(Array.from(blockedAppsCache))
    // Periodic scan every 3 seconds
    shieldInterval = setInterval(() => {
      scanAndKillBlockedApps(Array.from(blockedAppsCache))
    }, 3000)
  }

  isShieldActive = true
  return { success: hostsSuccess, mode: 'started' }
}

// Stop system shield
function stopSystemShield() {
  if (!isShieldActive) return { success: true, mode: 'already_stopped' }

  // Clear interval
  if (shieldInterval) {
    clearInterval(shieldInterval)
    shieldInterval = null
  }

  // Restore hosts file
  const hostsSuccess = restoreHosts()

  blockedWebsitesCache.clear()
  blockedAppsCache.clear()
  isShieldActive = false

  return { success: hostsSuccess, mode: 'stopped' }
}

// Update shield rules while active
function updateShieldRules(websites, apps, mode) {
  const lists = computeBlockLists(websites, apps, mode)
  blockedWebsitesCache = new Set(lists.websites)
  blockedAppsCache = new Set(lists.apps)

  if (isShieldActive) {
    applyWebsiteBlocks(Array.from(blockedWebsitesCache))

    // Restart app killer if needed
    if (shieldInterval) {
      clearInterval(shieldInterval)
    }
    if (blockedAppsCache.size > 0) {
      scanAndKillBlockedApps(Array.from(blockedAppsCache))
      shieldInterval = setInterval(() => {
        scanAndKillBlockedApps(Array.from(blockedAppsCache))
      }, 3000)
    }
  }

  return { success: true }
}

// Get shield status
function getShieldStatus() {
  return {
    active: isShieldActive,
    websitesBlocked: Array.from(blockedWebsitesCache),
    appsBlocked: Array.from(blockedAppsCache),
  }
}

// Register IPC handlers
function registerSystemShieldIPC() {
  ipcMain.handle('shield-start', (_event, { websites, apps, mode }) => {
    return startSystemShield(websites || [], apps || [], mode || 'blacklist')
  })

  ipcMain.handle('shield-stop', () => {
    return stopSystemShield()
  })

  ipcMain.handle('shield-update', (_event, { websites, apps, mode }) => {
    return updateShieldRules(websites || [], apps || [], mode || 'blacklist')
  })

  ipcMain.handle('shield-status', () => {
    return getShieldStatus()
  })
}

// Cleanup on app quit
function cleanupShield() {
  stopSystemShield()
}

module.exports = {
  registerSystemShieldIPC,
  cleanupShield,
  startSystemShield,
  stopSystemShield,
}
