'use client'

import { useEffect } from 'react'

/** 生产环境注册 Service Worker（开发环境不注册，避免干扰 Turbopack HMR） */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW 注册失败不影响应用功能
      })
    }
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
