'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { readActiveShieldConfig } from '@/lib/focus-shield-defaults'

/**
 * 定时封锁调度（渲染层侧）：
 * 只负责把窗口清单（附带当前屏蔽清单）推送到 Electron 主进程调度器；
 * 进入/离开窗口的跳变沿判定、会话到期自动停、崩溃重放全部由主进程
 * shield-scheduler 承担——渲染进程崩溃或重载不再影响进行中的封锁。
 */
export function useShieldSchedule(): void {
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.shieldScheduleSync) return

    const push = () => {
      let sched: ReturnType<typeof useAppStore.getState>['focusShieldSchedule']
      try {
        sched = useAppStore.getState().focusShieldSchedule
      } catch {
        return
      }
      if (!sched?.enabled || !sched.windows?.length) {
        void Promise.resolve(api.shieldScheduleSync!([])).catch(() => {})
        return
      }
      // 与手动开启使用完全相同的清单来源（localStorage），保证行为一致
      const { websites, apps, mode } = readActiveShieldConfig()
      const windows = sched.windows.map((w) => ({
        id: w.id,
        start: w.start,
        end: w.end,
        days: w.days,
        websites,
        apps,
        mode,
      }))
      void Promise.resolve(api.shieldScheduleSync!(windows)).catch(() => {})
    }

    push()
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.focusShieldSchedule !== prev.focusShieldSchedule) {
        push()
      }
    })
    const offStatus = api.onShieldStatusChanged?.(() => {
      // 预留：主进程窗口启停/到期通知（当前 UI 无需响应，保留通道）
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      if (typeof offStatus === 'function') offStatus()
    }
  }, [])
}
