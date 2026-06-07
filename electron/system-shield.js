const { ipcMain } = require('electron')
const { spawn, exec } = require('child_process')
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

// Get hosts file backup path
function getHostsBackupPath() {
  const backupDir = path.join(os.homedir(), '.focusflow')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  return path.join(backupDir, 'hosts.backup')
}

// Backup original hosts file
function backupHosts() {
  try {
    const backupPath = getHostsBackupPath()
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(HOSTS_FILE, backupPath)
    }
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
    exec('ipconfig /flushdns', { windowsHide: true }, () => {})
  } else if (isMac) {
    exec('sudo killall -HUP mDNSResponder', () => {})
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
      const domain = site.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      if (domain) {
        entries.push(`0.0.0.0 ${domain}`)
        entries.push(`0.0.0.0 www.${domain}`)
        entries.push(`:: ${domain}`)
        entries.push(`:: www.${domain}`)
      }
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
    const normalized = appName.toLowerCase().replace('.exe', '')
    // Try to kill by process name
    exec(`taskkill /F /IM "${normalized}.exe" /FI "STATUS eq RUNNING" 2>nul`, { windowsHide: true }, (err) => {
      if (err && err.code !== 128) {
        // 128 = no matching processes found
        // Try without .exe suffix
        exec(`taskkill /F /IM "${normalized}" /FI "STATUS eq RUNNING" 2>nul`, { windowsHide: true }, () => {})
      }
    })
  }
}

// Get running process list and kill blocked ones (more aggressive)
function scanAndKillBlockedApps(apps) {
  if (!isWindows) return

  exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
    if (err || !stdout) return

    const lines = stdout.split('\n')
    for (const line of lines) {
      const parts = line.split('","')
      if (parts.length < 2) continue
      const processName = parts[0].replace('"', '').toLowerCase()

      for (const blockedApp of apps) {
        const blocked = blockedApp.toLowerCase().replace('.exe', '')
        if (processName.includes(blocked) || blocked.includes(processName.replace('.exe', ''))) {
          const pid = parts[1].replace('"', '')
          exec(`taskkill /F /PID ${pid} 2>nul`, { windowsHide: true }, () => {})
        }
      }
    }
  })
}

// Start system shield
function startSystemShield(websites, apps) {
  if (isShieldActive) {
    // Update existing shield
    blockedWebsitesCache = new Set(websites)
    blockedAppsCache = new Set(apps)
    applyWebsiteBlocks(Array.from(blockedWebsitesCache))
    return { success: true, mode: 'updated' }
  }

  blockedWebsitesCache = new Set(websites)
  blockedAppsCache = new Set(apps)

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
function updateShieldRules(websites, apps) {
  blockedWebsitesCache = new Set(websites)
  blockedAppsCache = new Set(apps)

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
  ipcMain.handle('shield-start', (_event, { websites, apps }) => {
    return startSystemShield(websites || [], apps || [])
  })

  ipcMain.handle('shield-stop', () => {
    return stopSystemShield()
  })

  ipcMain.handle('shield-update', (_event, { websites, apps }) => {
    return updateShieldRules(websites || [], apps || [])
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
