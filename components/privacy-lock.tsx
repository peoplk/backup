'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Lock,
  Unlock,
  Shield,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { hashPassword, verifyPassword, encryptData, decryptData } from '@/lib/crypto'
import { toast } from 'sonner'
import { Download, Upload } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

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

function setLocked(locked: boolean) {
  try {
    localStorage.setItem(PRIVACY_LOCKED_KEY, String(locked))
  } catch { /* non-critical */ }
  dispatchLockState()
}

export function PrivacyLock() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [autoLock, setAutoLock] = useState(false)
  const [lockTimeout, setLockTimeout] = useState(5)

  useEffect(() => {
    const enabled = localStorage.getItem(PRIVACY_KEY) === 'true'
    setIsEnabled(enabled)
    if (enabled) {
      setIsLocked(localStorage.getItem(PRIVACY_LOCKED_KEY) === 'true')
    }

    const sync = () => {
      setIsEnabled(localStorage.getItem(PRIVACY_KEY) === 'true')
      setIsLocked(localStorage.getItem(PRIVACY_LOCKED_KEY) === 'true')
    }
    window.addEventListener(LOCK_STATE_EVENT, sync)

    const savedAutoLock = localStorage.getItem(PRIVACY_AUTO_LOCK_KEY)
    if (savedAutoLock) setAutoLock(savedAutoLock === 'true')

    const savedTimeout = localStorage.getItem(PRIVACY_LOCK_TIMEOUT_KEY)
    if (savedTimeout) setLockTimeout(parseInt(savedTimeout))

    return () => window.removeEventListener(LOCK_STATE_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!isEnabled || !autoLock) return

    const checkInactivity = () => {
      const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0')
      const now = Date.now()
      const timeoutMs = lockTimeout * 60 * 1000

      if (lastActivity > 0 && now - lastActivity > timeoutMs && !isLocked) {
        setIsLocked(true)
      }
    }

    const updateActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
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

  const handleEnablePrivacy = async () => {
    if (password.length < 6) {
      setError('密码至少需要6位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    const hash = await hashPassword(password)
    localStorage.setItem(PRIVACY_HASH_KEY, hash)
    localStorage.setItem(PRIVACY_KEY, 'true')
    setIsEnabled(true)
    setLocked(true)
    setShowSetupDialog(false)
    setPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('隐私保护已开启')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleUnlock = async () => {
    const hash = localStorage.getItem(PRIVACY_HASH_KEY)
    if (!hash) {
      setError('未设置密码')
      return
    }

    const valid = await verifyPassword(password, hash)
    if (valid) {
      setIsLocked(false)
      setLocked(false)
      setShowUnlockDialog(false)
      setPassword('')
      setError('')
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
    } else {
      setError('密码错误')
    }
  }

  const handleLockNow = () => {
    setShowUnlockDialog(false)
    setLocked(true)
  }

  const handleDisablePrivacy = async () => {
    const hash = localStorage.getItem(PRIVACY_HASH_KEY)
    if (hash) {
      const valid = await verifyPassword(password, hash)
      if (!valid) {
        setError('密码错误')
        return
      }
    }

    localStorage.removeItem(PRIVACY_KEY)
    localStorage.removeItem(PRIVACY_HASH_KEY)
    localStorage.removeItem(PRIVACY_AUTO_LOCK_KEY)
    localStorage.removeItem(PRIVACY_LOCK_TIMEOUT_KEY)
    localStorage.removeItem(PRIVACY_LOCKED_KEY)
    setIsEnabled(false)
    setIsLocked(false)
    setLocked(false)
    setPassword('')
    setError('')
    setSuccess('隐私保护已关闭')
    setTimeout(() => setSuccess(''), 3000)
  }

  const toggleAutoLock = (value: boolean) => {
    setAutoLock(value)
    localStorage.setItem(PRIVACY_AUTO_LOCK_KEY, String(value))
  }

  const DATA_KEYS = [
    'productivity-app-storage',
    'sync-provider-selected',
    'focusflow-s3-config',
    'focusflow-s3-secret',
    'focusflow-llm-config',
    'focusflow-llm-api-key',
  ]

  const handleExportEncrypted = async () => {
    if (isLocked) {
      toast.error('请先解锁再导出')
      return
    }
    let exportPassword = password
    if (!exportPassword) {
      const p = window.prompt('请输入隐私密码用于加密备份')
      exportPassword = p || ''
    }
    if (!exportPassword) return
    try {
      const bundle: Record<string, string> = {}
      for (const key of DATA_KEYS) {
        const value = localStorage.getItem(key)
        if (value) bundle[key] = value
      }
      const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: bundle })
      const encrypted = await encryptData(payload, exportPassword)
      const blob = new Blob([encrypted], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `focusflow-encrypted-backup-${new Date().toISOString().slice(0, 10)}.ffb`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('加密备份已导出')
    } catch {
      toast.error('导出失败，请重试')
    }
  }

  const handleRestoreEncrypted = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const restorablePassword = password || (await (async () => {
      const p = window.prompt('请输入隐私密码以解密备份')
      return p || ''
    })())
    if (!restorablePassword) return
    try {
      const content = await file.text()
      const decrypted = await decryptData(content, restorablePassword)
      const parsed = JSON.parse(decrypted)
      if (!parsed?.data || typeof parsed.data !== 'object') {
        throw new Error('Invalid bundle')
      }
      for (const [key, value] of Object.entries(parsed.data)) {
        localStorage.setItem(key, String(value))
      }
      toast.success('备份已恢复，正在重新加载...')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      toast.error('恢复失败：密码错误或文件损坏')
    }
  }

  const updateLockTimeout = (value: number) => {
    setLockTimeout(value)
    localStorage.setItem(PRIVACY_LOCK_TIMEOUT_KEY, String(value))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            隐私保护
          </CardTitle>
          <CardDescription>使用密码保护你的数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-chart-2/10 p-3 text-chart-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEnabled ? (
                <Lock className="h-4 w-4 text-chart-2" />
              ) : (
                <Unlock className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">隐私锁</p>
                <p className="text-xs text-muted-foreground">
                  {isEnabled ? '已开启' : '未开启'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isEnabled ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isLocked) {
                        setPassword('')
                        setError('')
                        setShowUnlockDialog(true)
                      } else {
                        handleLockNow()
                      }
                    }}
                  >
                    {isLocked ? '解锁' : '重新锁定'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setPassword('')
                      setError('')
                      handleDisablePrivacy()
                    }}
                  >
                    关闭
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setPassword('')
                    setConfirmPassword('')
                    setError('')
                    setShowSetupDialog(true)
                  }}
                >
                  开启保护
                </Button>
              )}
            </div>
          </div>

          {isEnabled && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">自动锁定</p>
                  <p className="text-xs text-muted-foreground">一段时间无操作后自动锁定</p>
                </div>
                <Switch checked={autoLock} onCheckedChange={toggleAutoLock} />
              </div>

              {autoLock && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">锁定时间</p>
                  <div className="flex gap-1">
                    {[1, 5, 10, 30].map(min => (
                      <Button
                        key={min}
                        variant={lockTimeout === min ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => updateLockTimeout(min)}
                      >
                        {min}分钟
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-sm font-medium">E2E 加密备份</p>
                <p className="text-xs text-muted-foreground">
                  用你的密码加密导出全部数据，即使文件泄露也无法读取
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExportEncrypted}
                >
                  <Download className="h-3.5 w-3.5" />
                  导出加密备份
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".ffb"
                    className="hidden"
                    onChange={handleRestoreEncrypted}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    恢复加密备份
                  </Button>
                </label>
              </div>
              {isLocked && (
                <p className="text-xs text-muted-foreground/70">导出前请先解锁</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              设置隐私密码
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                请牢记密码，密码丢失将无法恢复数据。密码仅用于本地保护，不会上传到任何服务器。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">设置密码</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="至少6位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">确认密码</label>
              <Input
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEnablePrivacy()}
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <Button onClick={handleEnablePrivacy} className="w-full">
              确认开启
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              输入密码
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center py-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              数据已加密，请输入密码解锁
            </p>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
            <Button onClick={handleUnlock} className="w-full">
              解锁
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
