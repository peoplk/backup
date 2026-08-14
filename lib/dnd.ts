'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ElectronAPI } from '@/lib/types/electron'

function getElectronAPI(): ElectronAPI | null {
  if (typeof window === 'undefined') return null
  return window.electronAPI ?? null
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
    async (websites: string[], apps: string[], mode?: string) => {
      const api = getElectronAPI()
      if (!api?.shieldStart) return
      refCount.current += 1
      const lastCount = refCount.current
      setPending(true)
      try {
        const res = await api.shieldStart(websites, apps, mode)
        if (res?.success) {
          setActive(true)
        } else if (lastCount === 1) {
          // 首次启动失败则回滚计数，避免后续 stop 时计数失衡
          refCount.current = 0
        }
      } catch (e) {
        console.warn('shield start failed', e)
        if (lastCount === 1) refCount.current = 0
      } finally {
        setPending(false)
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

// 读取用户在专注屏蔽页配置的规则（与 focus-shield.tsx 的存储 key 保持一致）
function getUserShieldConfig(): { websites: string[]; apps: string[]; mode: 'blacklist' | 'whitelist' } {
  if (typeof window === 'undefined') {
    return { websites: DEFAULT_BLOCKED_WEBSITES, apps: DEFAULT_BLOCKED_APPS, mode: 'blacklist' }
  }
  try {
    const mode = localStorage.getItem('focusflow-shield-mode') === 'whitelist' ? 'whitelist' : 'blacklist'
    const storageKey = mode === 'blacklist' ? 'focusflow-focus-shield-v2' : 'focusflow-focus-shield-whitelist-v2'
    const raw = localStorage.getItem(storageKey)
    const items = raw ? JSON.parse(raw) : []
    const enabled = Array.isArray(items) ? items.filter((i: any) => i && i.enabled) : []
    return {
      websites: enabled.filter((i: any) => i.type === 'website').map((i: any) => i.pattern),
      apps: enabled.filter((i: any) => i.type === 'app').map((i: any) => i.pattern),
      mode,
    }
  } catch {
    return { websites: DEFAULT_BLOCKED_WEBSITES, apps: DEFAULT_BLOCKED_APPS, mode: 'blacklist' }
  }
}

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
      const user = getUserShieldConfig()
      const websites = customWebsites && customWebsites.length > 0 ? customWebsites : user.websites
      const apps = customApps && customApps.length > 0 ? customApps : user.apps
      start(websites, apps, user.mode)
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
