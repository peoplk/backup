'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * 自动时间线追踪（仅 Electron/Windows 生效）：
 * 根据活动设置动态启停主进程采样，把前台应用样本聚合进本地 store。
 */
export function useActivityTracker(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const api = window.electronAPI
    if (!api?.setActivityTracking || !api.onActivitySample) return

    let unsubscribeApi: (() => void) | undefined
    let active = false

    const stop = () => {
      if (!active) return
      active = false
      try { unsubscribeApi?.() } catch { /* 忽略 */ }
      unsubscribeApi = undefined
      try { api.setActivityTracking!(false) } catch { /* 忽略 */ }
    }

    const start = () => {
      if (active) return
      active = true
      unsubscribeApi = api.onActivitySample?.((data) => {
        if (!data?.app) return
        try {
          useAppStore.getState().recordActivitySample({
            app: data.app,
            title: data.title,
            seconds: Math.max(1, Math.min(300, data.intervalSec ?? 30)),
          })
        } catch {
          // 聚合失败不影响追踪循环
        }
      })
      try { api.setActivityTracking!(true) } catch { /* 忽略 */ }
    }

    // 初始同步 + 响应开关变化
    const sync = () => {
      let enabled = false
      try {
        enabled = useAppStore.getState().activitySettings.enabled === true
      } catch {
        enabled = false
      }
      if (enabled) start()
      else stop()
    }
    sync()

    const unsubscribeStore = useAppStore.subscribe(sync)
    return () => {
      try { unsubscribeStore() } catch { /* 忽略 */ }
      stop()
    }
  }, [])
}
