/**
 * 专注屏蔽 · 主进程调度器（屏蔽可靠性三连之二/三）：
 * 1. 主进程调度：定时封锁窗口在 Electron 主进程推进，不再依赖渲染层轮询
 *    ——渲染进程崩溃/重载不影响进行中的封锁。
 * 2. 崩溃重放：屏蔽会话持久化到 userData/shield-state.json；
 *    应用被杀后重启时，未过期的会话重新应用，已过期的会话回滚 hosts。
 *
 * 设计为依赖注入（applyBlock/removeBlock/now/读写状态），便于在 Node 中单测。
 */

function defaultNow() {
  return Date.now()
}

function createShieldScheduler(deps) {
  const {
    statePath,
    applyBlock, // (session: { websites, apps, mode }) => Promise<{ success }>
    removeBlock, // () => Promise<{ success }>
    onNotify, // (payload) => void，向渲染层广播状态变化
    now = defaultNow,
    tickIntervalMs = 10000,
  } = deps

  /** @type {{ activeSession: {websites:string[],apps:string[],mode:string,startedAt:number,until:number|null}|null, scheduled: Array<{id:string,start:string,end:string,days?:number[],websites:string[],apps:string[],mode:string}> }} */
  let state = { activeSession: null, scheduled: [] }
  let wasInWindow = false
  let tickTimer = null

  function readStateFile() {
    try {
      const raw = require('fs').readFileSync(statePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return {
          activeSession: parsed.activeSession || null,
          scheduled: Array.isArray(parsed.scheduled) ? parsed.scheduled : [],
        }
      }
    } catch {
      // 文件不存在或损坏：视为无历史状态
    }
    return null
  }

  function writeStateFile() {
    const fs = require('fs')
    const path = require('path')
    try {
      const tmp = statePath + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(state), 'utf8')
      // 原子替换，避免崩溃时留下半截 JSON
      fs.renameSync(tmp, statePath)
    } catch {
      // 持久化失败不阻断屏蔽本身
    }
  }

  // ---- 时间窗判定（与渲染层 use-shield-schedule 同一套语义） ----
  function parseHM(time) {
    const parts = String(time || '').split(':').map(Number)
    const h = parts[0]
    const m = parts[1]
    if (Number.isNaN(h)) return -1
    return h * 60 + (Number.isNaN(m) ? 0 : m)
  }

  function inWindow(d, win) {
    const start = parseHM(win.start)
    const end = parseHM(win.end)
    if (start < 0 || end < 0) return false
    if (Array.isArray(win.days) && win.days.length > 0 && !win.days.includes(d.getDay())) {
      return false
    }
    const cur = d.getHours() * 60 + d.getMinutes()
    if (start <= end) return cur >= start && cur < end
    // 跨夜窗口：凌晨时段归属前一天开启的窗口
    const prevDayOk =
      !Array.isArray(win.days) || win.days.length === 0 || win.days.includes((d.getDay() + 6) % 7)
    return (cur >= start && prevDayOk) || cur < end
  }

  function currentWindow(d) {
    return state.scheduled.find((w) => inWindow(d, w)) || null
  }

  // ---- 会话管理 ----

  /** 手动/即时屏蔽（渲染层 shield-start 成功后调用以持久化） */
  async function startSession(session) {
    state.activeSession = {
      websites: Array.isArray(session.websites) ? session.websites : [],
      apps: Array.isArray(session.apps) ? session.apps : [],
      mode: session.mode || 'blacklist',
      startedAt: now(),
      until: typeof session.until === 'number' ? session.until : null,
    }
    writeStateFile()
  }

  async function stopSession() {
    const had = state.activeSession !== null
    state.activeSession = null
    writeStateFile()
    if (had) notify({ type: 'shield-stopped', reason: 'stopped' })
    return had
  }

  /** 渲染层推送定时窗口清单（全量替换） */
  function syncSchedule(windows) {
    state.scheduled = Array.isArray(windows) ? windows.filter((w) => w && w.id && w.start && w.end) : []
    writeStateFile()
  }

  function notify(payload) {
    if (typeof onNotify === 'function') {
      try { onNotify(payload) } catch { /* 通知失败不影响调度 */ }
    }
  }

  async function applySession(session, reason) {
    const result = await applyBlock(session.websites, session.apps, session.mode)
    notify({ type: 'shield-applied', reason, active: true, result })
    return result
  }

  async function revoke(reason) {
    const result = await removeBlock()
    notify({ type: 'shield-removed', reason, active: false, result })
    return result
  }

  /**
   * 崩溃重放：应用启动时调用。
   * - 持久化的即时会话未过期 → 重新应用（应用被杀时 hosts 可能仍是旧状态，
   *   重新应用保证规则与缓存一致）；已过期 → 回滚清理。
   * - 当前时刻落在定时窗口内 → 应用窗口清单。
   */
  async function replay() {
    const persisted = readStateFile()
    if (persisted) {
      state = persisted
      const session = state.activeSession
      if (session) {
        const expired = typeof session.until === 'number' && now() >= session.until
        if (expired) {
          state.activeSession = null
          writeStateFile()
          await revoke('replay-expired')
        } else {
          await applySession(session, 'replay-active')
        }
      }
    }
    const d = new Date()
    const win = currentWindow(d)
    if (win) {
      wasInWindow = true
      await applySession(win, 'replay-window')
    }
    return { active: state.activeSession !== null || !!win }
  }

  /** 周期推进：会话到期自动停 + 定时窗口跳变沿启停 */
  async function tick() {
    const session = state.activeSession
    if (session && typeof session.until === 'number' && now() >= session.until) {
      state.activeSession = null
      writeStateFile()
      await revoke('session-expired')
    }

    const win = currentWindow(new Date())
    if (win && !wasInWindow) {
      await applySession(win, 'window-start')
    } else if (!win && wasInWindow) {
      await revoke('window-end')
    }
    wasInWindow = !!win
  }

  function start() {
    if (tickTimer) return
    tickTimer = setInterval(() => { void tick() }, tickIntervalMs)
  }

  function dispose() {
    if (tickTimer) clearInterval(tickTimer)
    tickTimer = null
  }

  function getStatus() {
    return {
      activeSession: state.activeSession,
      scheduled: state.scheduled,
      inWindow: wasInWindow,
    }
  }

  return { replay, start, dispose, tick, startSession, stopSession, syncSchedule, getStatus, inWindow }
}

module.exports = { createShieldScheduler }
