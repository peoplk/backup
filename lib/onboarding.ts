'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'focusflow-onboarding-complete'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1'
}

function getServerSnapshot(): boolean {
  return true
}

/** 标记引导已完成（跳过/完成均视为不再自动弹出） */
export function setOnboardingComplete(): void {
  window.localStorage.setItem(STORAGE_KEY, '1')
  listeners.forEach((l) => l())
}

/** 首次启动判断：SSR 恒为已完成（true），客户端挂载后按 localStorage 渲染，无 hydration 错配 */
export function useOnboardingComplete(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
