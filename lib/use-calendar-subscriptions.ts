'use client'

import { useEffect } from 'react'
import { refreshAllSubscriptions } from '@/lib/calendar-subscriptions'
import { useAppStore } from '@/lib/store'

const REFRESH_INTERVAL_MS = 30 * 60 * 1000

/** 应用启动时及每 30 分钟刷新已启用的日历订阅 */
export function useCalendarSubscriptions(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const sync = () => {
      let hasEnabled = false
      try {
        hasEnabled = useAppStore
          .getState()
          .subscribedCalendars.some((c) => c.enabled)
      } catch {
        hasEnabled = false
      }
      if (hasEnabled) {
        void refreshAllSubscriptions().catch(() => {})
      }
    }

    // 等待持久化 rehydrate 之后再拉取，避免空列表误判
    const timer = setTimeout(sync, 3000)
    const interval = setInterval(sync, REFRESH_INTERVAL_MS)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])
}
