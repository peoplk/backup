'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { PomodoroStrictMode } from '@/lib/types'
import { getUserShieldConfig, useFocusShield } from '@/lib/dnd'

/**
 * 全屏严格模式的配置解析。
 * 老版本持久化的 pomodoroStrictMode 缺少新增字段，这里统一回落默认值，
 * 避免读设置时出现 undefined 导致开关态抖动。
 */
export function resolveStrictFullscreen(strict: PomodoroStrictMode | undefined) {
  return {
    fullscreenLock: strict?.fullscreenLock ?? false,
    holdSeconds: strict?.fullscreenGiveUpHoldSeconds ?? 3,
    shield: strict?.fullscreenShield ?? true,
    preventSleep: strict?.fullscreenPreventSleep ?? true,
    muteNotifications: strict?.fullscreenMuteNotifications ?? true,
  }
}

export type StrictViolationReason = 'leave-fullscreen' | 'close' | 'blur'

export interface StrictFullscreenState {
  /** 主进程是否提供了锁定能力（Electron 环境） */
  supported: boolean
  /** 当前是否处于主进程级锁定 */
  locked: boolean
  /** 尝试绕过锁定的次数（Esc 退出全屏 / 关闭窗口 / 窗口失焦） */
  violationCount: number
  /** 最近一次绕过尝试 */
  lastViolation: { reason: StrictViolationReason; at: number } | null
  /** 放弃前需要长按的秒数 */
  holdSeconds: number
  /** 是否允许中途放弃（0 表示必须走完） */
  canGiveUp: boolean
  /** 屏蔽是否已生效 */
  shieldActive: boolean
}

/**
 * 番茄钟「全屏严格模式」的运行时控制。
 *
 * 传入 active=true 时按顺序联动：
 * 1. 请求主进程 kiosk 锁定窗口（置顶 + 拦截 Esc/关闭 + 失焦拉回）
 * 2. 可选：阻止系统休眠/息屏
 * 3. 可选：按用户现有屏蔽配置开启 hosts + 应用查杀，解锁后自动解除
 * 4. 可选：静默应用内通知（结束后恢复）
 *
 * 非 Electron 环境（浏览器/PWA）不支持系统级锁定，自动降级为「仅前端确认」，
 * supported=false，其余行为保持一致。
 */
export function useStrictFullscreen(active: boolean): StrictFullscreenState {
  const strict = useAppStore((s) => s.pomodoroStrictMode)
  const cfg = resolveStrictFullscreen(strict)
  const { start: startShield, stop: stopShield, supported: shieldSupported } = useFocusShield()

  const [supported] = useState(
    () => typeof window !== 'undefined' && !!window.electronAPI?.setStrictLock
  )
  const [locked, setLocked] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [lastViolation, setLastViolation] = useState<{ reason: StrictViolationReason; at: number } | null>(null)
  const [shieldActive, setShieldActive] = useState(false)

  // preventSleep 只作为锁定参数使用，不参与 effect 依赖，避免设置改动导致重复锁定
  const preventSleepRef = useRef(cfg.preventSleep)
  useEffect(() => {
    preventSleepRef.current = cfg.preventSleep
  }, [cfg.preventSleep])
  const shieldRef = useRef(false)

  // 1+2. 窗口锁定与防休眠（每次重新进入重置违规计数）
  useEffect(() => {
    if (!active) return
    setViolationCount(0)
    setLastViolation(null)
    const api = window.electronAPI
    if (!api || !api.setStrictLock) return

    let cancelled = false
    void api
      .setStrictLock({ locked: true, preventSleep: preventSleepRef.current, reason: 'pomodoro-strict' })
      .then((res) => {
        if (cancelled) return
        setLocked(!!res?.locked)
      })
      .catch(() => {
        if (!cancelled) setLocked(false)
      })
    ;(window as unknown as { __strictLockActive?: boolean }).__strictLockActive = true

    return () => {
      cancelled = true
      setLocked(false)
      ;(window as unknown as { __strictLockActive?: boolean }).__strictLockActive = false
      // 清理阶段重新取一次 API：窗口可能已重载，且避免在闭包中依赖收窄
      const lockFn = window.electronAPI?.setStrictLock
      if (lockFn) {
        lockFn({ locked: false, reason: 'pomodoro-strict-end' }).catch(() => {})
      }
    }
  }, [active])

  // 3. 专注屏蔽联动
  useEffect(() => {
    if (!active || !cfg.shield || !shieldSupported) return
    const { websites, apps, mode } = getUserShieldConfig()
    shieldRef.current = true
    void startShield(websites, apps, mode).then(() => {
      if (shieldRef.current) setShieldActive(true)
    })
    return () => {
      shieldRef.current = false
      setShieldActive(false)
      void stopShield()
    }
  }, [active, cfg.shield, shieldSupported, startShield, stopShield])

  // 4. 通知静默
  useEffect(() => {
    if (!active || !cfg.muteNotifications) return
    const w = window as unknown as { __strictLockMuted?: boolean }
    w.__strictLockMuted = true
    return () => {
      w.__strictLockMuted = false
    }
  }, [active, cfg.muteNotifications])

  // 绕过尝试回传（Esc 退出全屏 / 关闭窗口 / 失焦）
  useEffect(() => {
    if (!active) return
    const off = window.electronAPI?.onStrictLockViolation?.((payload) => {
      setViolationCount((c) => c + 1)
      setLastViolation({ reason: payload?.reason ?? 'blur', at: Date.now() })
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, [active])

  // 主进程侧解锁（托盘紧急解锁）回传，保持渲染层状态一致
  useEffect(() => {
    if (!active) return
    const off = window.electronAPI?.onStrictLockChanged?.((payload) => {
      if (payload?.locked === false) setLocked(false)
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, [active])

  return {
    supported,
    locked,
    violationCount,
    lastViolation,
    holdSeconds: cfg.holdSeconds,
    canGiveUp: cfg.holdSeconds > 0,
    shieldActive,
  }
}
