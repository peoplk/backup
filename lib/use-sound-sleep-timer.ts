'use client'

import { useEffect, useRef } from 'react'

/**
 * 专注音效睡眠定时（专注页弹层与全屏面板共用）：
 * endsAt 为到期时间戳，到点回调一次；传 null 取消。
 */
export function useSoundSleepTimer(endsAt: number | null, onEnd: () => void): void {
  const cbRef = useRef(onEnd)
  cbRef.current = onEnd

  useEffect(() => {
    if (!endsAt) return
    const remaining = endsAt - Date.now()
    if (remaining <= 0) {
      cbRef.current()
      return
    }
    const timer = window.setTimeout(() => cbRef.current(), remaining)
    return () => window.clearTimeout(timer)
  }, [endsAt])
}
