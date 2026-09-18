'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => undefined
const getClientIsMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const getServerIsMac = () => false

/** 当前是否为 macOS（SSR 返回 false，客户端挂载后按真实平台渲染，无 hydration 告警） */
export function useIsMacOS(): boolean {
  return useSyncExternalStore(noopSubscribe, getClientIsMac, getServerIsMac)
}

/** 按平台返回修饰键显示标签：macOS 用 ⌘/⇧，Windows/Linux 用 Ctrl/Shift */
export function useModKeyLabels() {
  const isMac = useIsMacOS()
  return isMac
    ? { mod: '⌘', shift: '⇧' }
    : { mod: 'Ctrl', shift: 'Shift' }
}
