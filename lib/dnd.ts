'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface ElectronAPI {
  shieldStart?: (websites: string[], apps: string[]) => Promise<{ success: boolean; mode: string }>
  shieldStop?: () => Promise<{ success: boolean; mode: string }>
  shieldStatus?: () => Promise<{ active: boolean; websitesBlocked: string[]; appsBlocked: string[] }>
  shieldUpdate?: (websites: string[], apps: string[]) => Promise<{ success: boolean }>
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window === 'undefined') return null
  return (window as any).electronAPI as ElectronAPI | null
}

export function isElectronWithShield(): boolean {
  const api = getElectronAPI()
  return !!api?.shieldStart && !!api?.shieldStop
}

/**
 * 屏蔽会话管理
 * - 调用 system-shield IPC 屏蔽网站/应用
 * - 自动管理：start / stop 生命周期
 */
export function useFocusShield() {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)
  const [pending, setPending] = useState(false)
  const refCount = useRef(0) // 多处同时启停时计数

  useEffect(() => {
    setSupported(isElectronWithShield())
  }, [])

  const start = useCallback(
    async (websites: string[], apps: string[]) => {
      const api = getElectronAPI()
      if (!api?.shieldStart) return
      refCount.current += 1
      if (refCount.current === 1) {
        setPending(true)
        try {
          const res = await api.shieldStart(websites, apps)
          if (res?.success) setActive(true)
        } catch (e) {
          console.warn('shield start failed', e)
        } finally {
          setPending(false)
        }
      } else {
        // 已经在跑，必要时更新规则
        if (api.shieldUpdate) {
          try {
            await api.shieldUpdate(websites, apps)
          } catch {}
        }
      }
    },
    []
  )

  const stop = useCallback(async () => {
    const api = getElectronAPI()
    if (!api?.shieldStop) return
    refCount.current = Math.max(0, refCount.current - 1)
    if (refCount.current === 0) {
      setPending(true)
      try {
        const res = await api.shieldStop()
        if (res?.success) setActive(false)
      } catch (e) {
        console.warn('shield stop failed', e)
      } finally {
        setPending(false)
      }
    }
  }, [])

  return { active, supported, pending, start, stop }
}

const DEFAULT_BLOCKED_WEBSITES = [
  'weibo.com',
  'douyin.com',
  'bilibili.com',
  'xiaohongshu.com',
  'taobao.com',
  'jd.com',
  'v.qq.com',
  'iqiyi.com',
  'youku.com',
]

const DEFAULT_BLOCKED_APPS: string[] = []

/**
 * 便捷 hook：开始/结束专注时自动屏蔽
 * 仅在 isRunning 变化时触发
 */
export function useAutoShield(
  isRunning: boolean,
  isWork: boolean,
  customWebsites?: string[],
  customApps?: string[]
) {
  const { start, stop, supported } = useFocusShield()

  useEffect(() => {
    if (!supported) return
    if (isRunning && isWork) {
      const websites = customWebsites && customWebsites.length > 0 ? customWebsites : DEFAULT_BLOCKED_WEBSITES
      const apps = customApps && customApps.length > 0 ? customApps : DEFAULT_BLOCKED_APPS
      start(websites, apps)
      return () => {
        stop()
      }
    } else {
      // 兜底：确保状态清理
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isWork, supported])
}
