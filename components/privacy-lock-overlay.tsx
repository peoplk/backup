'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock } from 'lucide-react'
import { verifyPassword } from '@/lib/crypto'

const PRIVACY_KEY = 'focusflow-privacy-enabled'
const PRIVACY_HASH_KEY = 'focusflow-privacy-hash'
const PRIVACY_AUTO_LOCK_KEY = 'focusflow-privacy-auto-lock'
const PRIVACY_LOCK_TIMEOUT_KEY = 'focusflow-privacy-lock-timeout'
const PRIVACY_LOCKED_KEY = 'focusflow-privacy-locked'
const LAST_ACTIVITY_KEY = 'focusflow-last-activity'

const LOCK_STATE_EVENT = 'focusflow:privacy-lock-state'

function dispatchLockState() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LOCK_STATE_EVENT))
}

function readLocked(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(PRIVACY_LOCKED_KEY) === 'true'
  } catch {
    return false
  }
}

export function PrivacyLockOverlay() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [autoLock, setAutoLock] = useState(false)
  const [lockTimeout, setLockTimeout] = useState(5)

  useEffect(() => {
    const sync = () => {
      try {
        const enabled = localStorage.getItem(PRIVACY_KEY) === 'true'
        setIsEnabled(enabled)
        setAutoLock(localStorage.getItem(PRIVACY_AUTO_LOCK_KEY) === 'true')
        const savedTimeout = localStorage.getItem(PRIVACY_LOCK_TIMEOUT_KEY)
        if (savedTimeout) setLockTimeout(parseInt(savedTimeout))
      } catch { /* localStorage may throw in private mode */ }
      setIsLocked(readLocked())
    }
    sync()
    window.addEventListener(LOCK_STATE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(LOCK_STATE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!isEnabled || !autoLock || isLocked) return

    const checkInactivity = () => {
      try {
        const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0')
        const now = Date.now()
        const timeoutMs = lockTimeout * 60 * 1000
        if (lastActivity > 0 && now - lastActivity > timeoutMs) {
          localStorage.setItem(PRIVACY_LOCKED_KEY, 'true')
          setIsLocked(true)
          dispatchLockState()
        }
      } catch { /* non-critical */ }
    }

    const updateActivity = () => {
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
      } catch { /* non-critical */ }
    }

    updateActivity()
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    const interval = setInterval(checkInactivity, 30000)

    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
      clearInterval(interval)
    }
  }, [isEnabled, autoLock, lockTimeout, isLocked])

  const handleUnlock = async () => {
    const hash = localStorage.getItem(PRIVACY_HASH_KEY)
    if (!hash) {
      setError('未设置密码')
      return
    }
    const valid = await verifyPassword(password, hash)
    if (valid) {
      localStorage.setItem(PRIVACY_LOCKED_KEY, 'false')
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
      setIsLocked(false)
      setPassword('')
      setError('')
      dispatchLockState()
    } else {
      setError('密码错误')
    }
  }

  if (!isEnabled || !isLocked) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <Card className="w-full max-w-sm mx-4">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">已锁定</h3>
            <p className="text-sm text-muted-foreground mt-1">
              数据已加密保护，请输入密码解锁
            </p>
          </div>
          <Input
            type="password"
            placeholder="输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <Button onClick={handleUnlock} className="w-full">
            解锁
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
