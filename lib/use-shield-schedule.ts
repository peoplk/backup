'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { readActiveShieldConfig } from '@/lib/focus-shield-defaults'
import type { FocusShieldWindow } from '@/lib/types'

function parseHM(time: string): number {
  const [h, m] = (time || '').split(':').map(Number)
  if (Number.isNaN(h)) return -1
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

/** 判定当前时刻是否落在时间窗内（支持 start > end 的跨夜窗口；days 为周日=0） */
function inWindow(now: Date, win: FocusShieldWindow): boolean {
  const start = parseHM(win.start)
  const end = parseHM(win.end)
  if (start < 0 || end < 0) return false
  if (Array.isArray(win.days) && win.days.length > 0 && !win.days.includes(now.getDay())) {
    return false
  }
  // 跨夜窗口的"归属日"判定：凌晨时段属于前一天的窗口
  const cur = now.getHours() * 60 + now.getMinutes()
  if (start <= end) return cur >= start && cur < end
  const prevDayOk =
    !Array.isArray(win.days) ||
    win.days.length === 0 ||
    win.days.includes((now.getDay() + 6) % 7)
  return (cur >= start && prevDayOk) || (cur < end && true)
}

/**
 * 定时封锁会话调度：仅在"进入/离开时间窗"的跳变沿触发盾启停，
 * 因此用户在窗口内手动停止后不会被立即重启，直到下一个窗口边界。
 */
export function useShieldSchedule(): void {
  const wasInRef = useRef(false)

  useEffect(() => {
    const tick = () => {
      const api = window.electronAPI
      if (!api?.shieldStart || !api?.shieldStop) return
      let sched: ReturnType<typeof useAppStore.getState>['focusShieldSchedule']
      try {
        sched = useAppStore.getState().focusShieldSchedule
      } catch {
        return
      }
      if (!sched?.enabled || !sched.windows?.length) {
        if (wasInRef.current) {
          wasInRef.current = false
          void Promise.resolve(api.shieldStop()).catch(() => {})
        }
        return
      }

      const now = new Date()
      const inW = sched.windows.some((w) => inWindow(now, w))

      if (inW && !wasInRef.current) {
        // 与手动开启使用完全相同的清单来源（localStorage），保证行为一致
        const { websites, apps, mode } = readActiveShieldConfig()
        if (websites.length > 0 || apps.length > 0) {
          void Promise.resolve(api.shieldStart(websites, apps, mode)).catch(() => {})
        }
      } else if (!inW && wasInRef.current) {
        void Promise.resolve(api.shieldStop()).catch(() => {})
      }
      wasInRef.current = inW
    }

    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [])
}
