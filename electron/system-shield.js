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

// 屏蔽生效自检状态。startSystemShield 历史上只回传布尔值，"为什么失败"无处可查，
// 渲染层因此无法区分「成功」「UAC 被拒」「杀软回滚」。这里记录最近一次 hosts 写入的
// 真实结果，由 getShieldStatus() 与 shield-verify 回传给界面。
let lastShieldHealth = {
  ok: false,
  reason: 'never_run',
  elevated: false,
  verified: false,
  blockedCount: 0,
  at: null,
}

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
async function backupHosts() {
  try {
    const backupPath = getHostsBackupPath()
    await removeShieldFromHosts()
    fs.copyFileSync(HOSTS_FILE, backupPath)
    return true
  } catch (err) {
    console.error('Failed to backup hosts file:', err)
    return false
  }
}

// Restore original hosts file
async function restoreHosts() {
  try {
    const backupPath = getHostsBackupPath()
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf8')
      const { ok } = await writeHostsWithFallback(content)
      if (ok) flushDns()
      return ok
    }
    // If no backup, try to remove FocusFlow markers manually
    const removed = await removeShieldFromHosts()
    return removed
  } catch (err) {
    console.error('Failed to restore hosts file:', err)
    return false
  }
}

// Remove FocusFlow entries from hosts without backup
async function removeShieldFromHosts() {
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

    const { ok } = await writeHostsWithFallback(result.join('\n'))
    if (ok) flushDns()
    return ok
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

// ---------------------------------------------------------------------------
// hosts 提权写入：普通权限直写失败（EACCES/EPERM）时，弹出 UAC 提权窗口，
// 由临时提权的 PowerShell 完成 hosts 写入。内容以 Base64 内嵌于命令行，
// 不落临时文件（避免写入间隙被替换），也不经 shell 拼接（杜绝注入）。
// ---------------------------------------------------------------------------

/** 用提权 PowerShell 将 content 写入 hosts；以最终文件内容是否一致判定成败 */
function writeHostsElevated(content) {
  if (!isWindows) return Promise.resolve(false)
  const payload = Buffer.from(content, 'utf8').toString('base64')
  const innerCmd =
    '$c=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(\'' + payload + '\'));' +
    '[IO.File]::WriteAllText(\'' + HOSTS_FILE + '\', $c);'
  const innerB64 = Buffer.from(innerCmd, 'utf16le').toString('base64')
  const outerArgs = [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList \'-NoProfile\',\'-EncodedCommand\',\'' + innerB64 + '\'',
  ]
  return new Promise((resolve) => {
    let child
    try {
      child = spawn('powershell.exe', outerArgs, { windowsHide: true })
    } catch {
      resolve(false)
      return
    }
    child.on('error', () => resolve(false))
    child.on('exit', () => {
      // 用户可能拒绝 UAC：以实际文件内容是否等于目标内容为准
      try {
        resolve(fs.readFileSync(HOSTS_FILE, 'utf8') === content)
      } catch {
        resolve(false)
      }
    })
  })
}

/** 通用 hosts 写入：先直写，权限不足时走提权回退。返回 { ok, elevated } */
async function writeHostsWithFallback(content) {
  try {
    fs.writeFileSync(HOSTS_FILE, content, 'utf8')
    return { ok: true, elevated: false }
  } catch (err) {
    const code = err && err.code
    if (code !== 'EACCES' && code !== 'EPERM') {
      console.error('Failed to write hosts file:', err)
      return { ok: false, elevated: false }
    }
    const ok = await writeHostsElevated(content)
    if (!ok) console.error('Elevated hosts write failed or was declined by user')
    return { ok, elevated: true }
  }
}

/** 读回 hosts 文件，确认屏蔽块真的在。写入成功 ≠ 生效：UAC 被拒、杀软回滚、
 *  文件被还原都会让实际内容与写入内容不一致，必须回读才算自检。 */
function verifyHostsBlock() {
  try {
    const content = fs.readFileSync(HOSTS_FILE, 'utf8')
    return (
      content.includes(FOCUSFLOW_MARKER_START) &&
      content.includes(FOCUSFLOW_MARKER_END)
    )
  } catch {
    return false
  }
}

/** 把写入结果翻译成渲染层可直接展示的原因码 */
function describeWriteFailure(writeResult, verified) {
  if (writeResult && writeResult.ok) return verified ? 'ok' : 'reverted'
  if (writeResult && writeResult.elevated) return 'uac_declined'
  return 'write_failed'
}

function recordShieldHealth(next) {
  lastShieldHealth = { ...lastShieldHealth, ...next, at: Date.now() }
}

/** 实时自检状态：verified 每次重新回读 hosts，能反映中途被回滚的情况 */
function getShieldHealth() {
  return { ...lastShieldHealth, verified: verifyHostsBlock() }
}

// Apply website blocks to hosts file
async function applyWebsiteBlocks(websites) {
  try {
    await backupHosts()
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

    const writeResult = await writeHostsWithFallback(result.join('\n'))
    if (writeResult.ok) flushDns()

    // 回读自检：写入成功不等于真正生效，必须读回来确认屏蔽块确实在
    const verified = writeResult.ok && verifyHostsBlock()
    recordShieldHealth({
      ok: !!verified,
      reason: describeWriteFailure(writeResult, verified),
      elevated: !!writeResult.elevated,
      verified: !!verified,
      blockedCount: websites.length,
    })
    return writeResult.ok
  } catch (err) {
    console.error('Failed to apply website blocks:', err)
    recordShieldHealth({
      ok: false,
      reason: 'exception',
      elevated: false,
      verified: false,
      blockedCount: websites.length,
    })
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
async function startSystemShield(websites, apps, mode) {
  const lists = computeBlockLists(websites, apps, mode)
  if (isShieldActive) {
    // Update existing shield
    blockedWebsitesCache = new Set(lists.websites)
    blockedAppsCache = new Set(lists.apps)
    const updatedOk = await applyWebsiteBlocks(Array.from(blockedWebsitesCache))
    return { success: updatedOk, mode: 'updated', health: getShieldHealth() }
  }

  blockedWebsitesCache = new Set(lists.websites)
  blockedAppsCache = new Set(lists.apps)

  // Apply hosts file blocks
  const hostsSuccess = await applyWebsiteBlocks(Array.from(blockedWebsitesCache))

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
  return { success: hostsSuccess, mode: 'started', health: getShieldHealth() }
}

// Stop system shield
async function stopSystemShield() {
  if (!isShieldActive) return { success: true, mode: 'already_stopped' }

  // Clear interval
  if (shieldInterval) {
    clearInterval(shieldInterval)
    shieldInterval = null
  }

  // Restore hosts file
  const hostsSuccess = await restoreHosts()

  blockedWebsitesCache.clear()
  blockedAppsCache.clear()
  isShieldActive = false
  recordShieldHealth({
    ok: false,
    reason: 'stopped',
    elevated: false,
    verified: false,
    blockedCount: 0,
  })

  return { success: hostsSuccess, mode: 'stopped' }
}

// Update shield rules while active
async function updateShieldRules(websites, apps, mode) {
  const lists = computeBlockLists(websites, apps, mode)
  blockedWebsitesCache = new Set(lists.websites)
  blockedAppsCache = new Set(lists.apps)

  if (isShieldActive) {
    await applyWebsiteBlocks(Array.from(blockedWebsitesCache))

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
    health: getShieldHealth(),
  }
}

// Register IPC handlers
// 所有 handler 必须经过 isTrustedSender 校验，防止任意本地页面滥用系统级能力
function registerSystemShieldIPC(isTrustedSender, hooks) {
  const trusted = typeof isTrustedSender === 'function' ? isTrustedSender : () => false

  ipcMain.handle('shield-start', async (event, { websites, apps, mode } = {}) => {
    if (!trusted(event)) return { success: false, mode: 'denied' }
    const result = await startSystemShield(websites || [], apps || [], mode || 'blacklist')
    if (result.success && hooks && typeof hooks.onSessionStart === 'function') {
      try { await hooks.onSessionStart({ websites: websites || [], apps: apps || [], mode: mode || 'blacklist' }) } catch {}
    }
    return result
  })

  ipcMain.handle('shield-stop', async (event) => {
    if (!trusted(event)) return { success: false, mode: 'denied' }
    const result = await stopSystemShield()
    if (result.success && hooks && typeof hooks.onSessionStop === 'function') {
      try { await hooks.onSessionStop() } catch {}
    }
    return result
  })

  ipcMain.handle('shield-update', async (event, { websites, apps, mode } = {}) => {
    if (!trusted(event)) return { success: false, mode: 'denied' }
    return updateShieldRules(websites || [], apps || [], mode || 'blacklist')
  })

  // 自检 / 重试：屏蔽已激活时重放一次 hosts 写入（UAC 被拒或杀软回滚后的补救入口）；
  // 未激活时只回读一次，不触碰 hosts。会写系统文件，必须校验来源。
  ipcMain.handle('shield-verify', async (event) => {
    if (!trusted(event)) return { ok: false, reason: 'denied' }
    if (isShieldActive) {
      await applyWebsiteBlocks(Array.from(blockedWebsitesCache))
    } else {
      recordShieldHealth({ verified: verifyHostsBlock() })
    }
    return getShieldHealth()
  })

  ipcMain.handle('shield-status', () => {
    // 只读状态，无需校验
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
  getShieldStatus,
}
