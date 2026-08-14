'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

const IDLE_STORAGE_KEY = 'focusflow-idle-minutes'

export function getIdleMinutes(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(IDLE_STORAGE_KEY)
  const value = parseInt(raw || '0', 10)
  return Number.isFinite(value) && value > 0 ? Math.min(120, value) : 0
}

export function setIdleMinutes(minutes: number): void {
  localStorage.setItem(IDLE_STORAGE_KEY, String(Math.max(0, Math.min(120, minutes || 0))))
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart']

/** 检测长时间无操作：番茄钟运行时若超过阈值无活动，自动暂停并提示 */
export function useIdleDetector() {
  const lastActivityRef = useRef(Date.now())
  const notifiedRef = useRef(false)

  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now()
      notifiedRef.current = false
    }
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true })
    }
    const interval = setInterval(() => {
      const idleMinutes = getIdleMinutes()
      if (idleMinutes <= 0) return
      const state = useAppStore.getState()
      if (!state.pomodoroTimerState.isRunning) {
        notifiedRef.current = false
        return
      }
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= idleMinutes * 60 * 1000 && !notifiedRef.current) {
        notifiedRef.current = true
        state.updatePomodoroTimerState({ isRunning: false })
        toast.warning(`已暂停番茄钟（${idleMinutes} 分钟无操作）`)
      }
    }, 15000)
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity)
      }
      clearInterval(interval)
    }
  }, [])
}
