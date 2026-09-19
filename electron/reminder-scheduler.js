// 主进程持久化提醒调度：渲染层定期同步未来触发点，
// 窗口隐藏/最小化（甚至销毁）后依旧能弹出系统通知；重启后从磁盘恢复未触发任务。
const path = require('path')
const fs = require('fs')

const GRACE_MS = 5 * 60 * 1000
const HEARTBEAT_MS = 60 * 1000

function createReminderScheduler({ userDataPath, showNotification, onFired }) {
  const file = path.join(userDataPath, 'reminders.json')
  const jobs = new Map()
  const fired = new Set()
  let timer = null
  let heartbeat = null
  let loaded = false

  function load() {
    if (loaded) return
    loaded = true
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'))
      for (const j of data.jobs || []) {
        if (j && j.key && Number.isFinite(j.fireAt)) jobs.set(j.key, j)
      }
      for (const k of data.fired || []) fired.add(k)
    } catch {
      // 首次运行或文件损坏，从空集开始
    }
  }

  function persist() {
    try {
      fs.writeFileSync(file, JSON.stringify({ jobs: [...jobs.values()], fired: [...fired] }))
    } catch {
      // 持久化失败不影响内存调度
    }
  }

  function deliver(job) {
    fired.add(job.key)
    try {
      showNotification(job)
    } catch (err) {
      console.error('reminder notification failed:', err)
    }
    try {
      if (onFired) onFired(job)
    } catch { /* ignore */ }
  }

  function arm() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const now = Date.now()
    let next = null
    for (const job of [...jobs.values()]) {
      if (fired.has(job.key)) {
        jobs.delete(job.key)
        continue
      }
      if (job.fireAt <= now) {
        jobs.delete(job.key)
        if (now - job.fireAt <= GRACE_MS) deliver(job)
        continue
      }
      if (!next || job.fireAt < next.fireAt) next = job
    }
    persist()
    if (next) timer = setTimeout(arm, next.fireAt - Date.now())
  }

  function sync(list) {
    load()
    const keys = new Set()
    for (const j of list || []) {
      if (!j || !j.key || !Number.isFinite(j.fireAt)) continue
      keys.add(j.key)
      if (fired.has(j.key)) continue
      const prev = jobs.get(j.key)
      if (!prev || prev.fireAt !== j.fireAt || prev.title !== j.title || prev.body !== j.body) {
        jobs.set(j.key, j)
      }
    }
    for (const k of [...jobs.keys()]) {
      if (!keys.has(k)) jobs.delete(k)
    }
    for (const k of [...fired]) {
      if (!keys.has(k)) fired.delete(k)
    }
    arm()
  }

  function start() {
    load()
    arm()
    if (!heartbeat) heartbeat = setInterval(arm, HEARTBEAT_MS)
  }

  function stop() {
    if (timer) clearTimeout(timer)
    if (heartbeat) clearInterval(heartbeat)
    timer = null
    heartbeat = null
  }

  return { sync, start, stop }
}

module.exports = { createReminderScheduler }
