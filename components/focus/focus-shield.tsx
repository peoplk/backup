'use client'

import { useState, useEffect, useRef } from 'react'
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
  Shield,
  ShieldAlert,
  Plus,
  Trash2,
  Globe,
  AppWindow,
  Clock,
  AlertTriangle,
  Monitor,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FocusShieldItem } from '@/lib/types'
import {
  DEFAULT_BLOCKED_WEBSITES,
  DEFAULT_BLOCKED_APPS,
  DEFAULT_ALLOWED_WEBSITES,
  DEFAULT_ALLOWED_APPS,
} from '@/lib/focus-shield-defaults'
import { ShieldScheduleSettings } from '@/components/focus/shield-schedule-settings'

type BlockedItem = FocusShieldItem

type ShieldMode = 'blacklist' | 'whitelist'

const STORAGE_KEY_BLACKLIST = 'focusflow-focus-shield-v2'
const STORAGE_KEY_WHITELIST = 'focusflow-focus-shield-whitelist-v2'
const SHIELD_MODE_KEY = 'focusflow-shield-mode'
const SHIELD_ACTIVE_KEY = 'focusflow-shield-active'
const SHIELD_UNTIL_KEY = 'focusflow-shield-until'

function getStorageKey(mode: ShieldMode) {
  return mode === 'blacklist' ? STORAGE_KEY_BLACKLIST : STORAGE_KEY_WHITELIST
}

function getDefaultItems(mode: ShieldMode): BlockedItem[] {
  return mode === 'blacklist'
    ? [...DEFAULT_BLOCKED_WEBSITES, ...DEFAULT_BLOCKED_APPS]
    : [...DEFAULT_ALLOWED_WEBSITES, ...DEFAULT_ALLOWED_APPS]
}

function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI?.shieldStart
}

export function FocusShield() {
  const [items, setItems] = useState<BlockedItem[]>([])
  const [mode, setMode] = useState<ShieldMode>('blacklist')
  const [isActive, setIsActive] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPattern, setNewItemPattern] = useState('')
  const [newItemType, setNewItemType] = useState<'website' | 'app'>('website')
  const [shieldUntil, setShieldUntil] = useState<Date | null>(null)
  const [remainingTime, setRemainingTime] = useState('')
  const [isElectronApp, setIsElectronApp] = useState(false)
  const [systemShieldStatus, setSystemShieldStatus] = useState<'idle' | 'applying' | 'active' | 'error'>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setIsElectronApp(isElectron())
  }, [])

  useEffect(() => {
    const savedMode = localStorage.getItem(SHIELD_MODE_KEY)
    const initialMode: ShieldMode = savedMode === 'whitelist' ? 'whitelist' : 'blacklist'
    setMode(initialMode)

    const saved = localStorage.getItem(getStorageKey(initialMode))
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch {
        setItems(getDefaultItems(initialMode))
      }
    } else {
      setItems(getDefaultItems(initialMode))
    }

    const active = localStorage.getItem(SHIELD_ACTIVE_KEY) === 'true'
    const until = localStorage.getItem(SHIELD_UNTIL_KEY)
    if (active && until) {
      const untilDate = new Date(until)
      if (untilDate > new Date()) {
        setIsActive(true)
        setShieldUntil(untilDate)
        if (isElectron()) {
          setSystemShieldStatus('active')
        }
      } else {
        localStorage.removeItem(SHIELD_ACTIVE_KEY)
        localStorage.removeItem(SHIELD_UNTIL_KEY)
        // 过期后同步恢复系统屏蔽（hosts 文件），避免残留屏蔽块
        if (isElectron()) {
          window.electronAPI?.shieldStop?.()
        }
      }
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem(getStorageKey(mode), JSON.stringify(items))
    }
  }, [items, mode])

  const switchMode = (newMode: ShieldMode) => {
    if (newMode === mode) return
    // 保存当前模式下的列表
    if (items.length > 0) {
      localStorage.setItem(getStorageKey(mode), JSON.stringify(items))
    }
    // 加载新模式下的列表
    const saved = localStorage.getItem(getStorageKey(newMode))
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch {
        setItems(getDefaultItems(newMode))
      }
    } else {
      setItems(getDefaultItems(newMode))
    }
    setMode(newMode)
    localStorage.setItem(SHIELD_MODE_KEY, newMode)
  }

  useEffect(() => {
    if (!isActive || !shieldUntil) {
      setRemainingTime('')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const updateRemaining = () => {
      const now = new Date()
      const diff = shieldUntil.getTime() - now.getTime()
      if (diff <= 0) {
        deactivateShield()
        return
      }
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setRemainingTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }

    updateRemaining()
    intervalRef.current = setInterval(updateRemaining, 1000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, shieldUntil])

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    ))
  }

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const addItem = () => {
    if (!newItemName.trim() || !newItemPattern.trim()) return
    const newItem: BlockedItem = {
      id: Date.now().toString(),
      type: newItemType,
      name: newItemName.trim(),
      pattern: newItemPattern.trim(),
      enabled: true,
    }
    setItems(prev => [...prev, newItem])
    setNewItemName('')
    setNewItemPattern('')
    setShowAddDialog(false)
  }

  const startSystemShield = async () => {
    if (!isElectronApp) return false
    try {
      setSystemShieldStatus('applying')
      const websites = items.filter(i => i.enabled && i.type === 'website').map(i => i.pattern)
      const apps = items.filter(i => i.enabled && i.type === 'app').map(i => i.pattern)
      const result = await window.electronAPI!.shieldStart(websites, apps, mode)
      if (result.success) {
        setSystemShieldStatus('active')
        return true
      }
      setSystemShieldStatus('error')
      return false
    } catch {
      setSystemShieldStatus('error')
      return false
    }
  }

  const stopSystemShield = async () => {
    if (!isElectronApp) return
    try {
      await window.electronAPI!.shieldStop()
      setSystemShieldStatus('idle')
    } catch {
    }
  }

  const activateShield = async (durationMinutes: number) => {
    const capped = Math.min(Math.max(1, Math.round(durationMinutes)), 24 * 60)
    const until = new Date(Date.now() + capped * 60 * 1000)
    setIsActive(true)
    setShieldUntil(until)
    localStorage.setItem(SHIELD_ACTIVE_KEY, 'true')
    localStorage.setItem(SHIELD_UNTIL_KEY, until.toISOString())

    if (isElectronApp) {
      await startSystemShield()
    }
  }

  const deactivateShield = async () => {
    setIsActive(false)
    setShieldUntil(null)
    localStorage.removeItem(SHIELD_ACTIVE_KEY)
    localStorage.removeItem(SHIELD_UNTIL_KEY)

    if (isElectronApp) {
      await stopSystemShield()
    }
  }

  const updateSystemShieldRules = async () => {
    if (!isElectronApp || !isActive) return
    try {
      const websites = items.filter(i => i.enabled && i.type === 'website').map(i => i.pattern)
      const apps = items.filter(i => i.enabled && i.type === 'app').map(i => i.pattern)
      await window.electronAPI!.shieldUpdate(websites, apps, mode)
    } catch {
    }
  }

  // Update system shield when items or mode change while active
  useEffect(() => {
    if (isActive && isElectronApp) {
      updateSystemShieldRules()
    }
  }, [items, mode])

  const enabledCount = items.filter(i => i.enabled).length
  const websiteCount = items.filter(i => i.enabled && i.type === 'website').length
  const appCount = items.filter(i => i.enabled && i.type === 'app').length

  return (
    <>
      <Card className={cn('overflow-hidden transition-all', isActive && 'border-chart-1/50')}>
        <div className={cn('h-1', isActive ? 'bg-chart-1' : 'bg-muted')} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isActive ? (
                <Shield className="h-5 w-5 text-chart-1" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-base">专注屏蔽</CardTitle>
                <CardDescription>
                  {isActive
                    ? `屏蔽中 · 剩余 ${remainingTime}`
                    : `已启用 ${enabledCount} 个屏蔽规则`
                  }
                </CardDescription>
              </div>
            </div>
            {isActive && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-chart-1 animate-pulse" />
                <span className="text-xs text-chart-1 font-medium">运行中</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isElectronApp && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-2.5">
              <Monitor className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium">系统级屏蔽已就绪</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  网站通过Hosts文件拦截，应用通过进程终止屏蔽。需要管理员权限。
                </p>
              </div>
            </div>
          )}

          {isActive ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-chart-1/5 p-4 text-center">
                <Clock className="h-6 w-6 text-chart-1 mx-auto mb-2" />
                <p className="text-2xl font-bold font-[var(--font-timer)] tabular-nums">{remainingTime}</p>
                <p className="text-xs text-muted-foreground mt-1">专注模式剩余时间</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const remainingMs = shieldUntil ? shieldUntil.getTime() - Date.now() : 0
                    const extendBy = 25
                    const next = remainingMs > 0
                      ? Math.ceil(remainingMs / 60000) + extendBy
                      : extendBy
                    activateShield(next)
                  }}
                >
                  +25分钟
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={deactivateShield}
                >
                  结束屏蔽
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 120].map(min => (
                  <Button
                    key={min}
                    variant="outline"
                    className="h-auto py-3 flex flex-col gap-1"
                    onClick={() => activateShield(min)}
                  >
                    <span className="text-lg font-bold">{min}</span>
                    <span className="text-[10px] text-muted-foreground">分钟</span>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => {
                    const custom = prompt('输入自定义时长（分钟）:', '45')
                    if (custom) {
                      const min = parseInt(custom)
                      if (!isNaN(min) && min > 0) {
                        activateShield(min)
                      }
                    }
                  }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  自定义
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加规则
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {mode === 'blacklist' ? '黑名单（屏蔽列表中的项目）' : '白名单（仅允许列表中的项目）'}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {websiteCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <AppWindow className="h-3 w-3" />
                    {appCount}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={mode === 'blacklist' ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => switchMode('blacklist')}
                    disabled={isActive}
                  >
                    黑名单
                  </Button>
                  <Button
                    variant={mode === 'whitelist' ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => switchMode('whitelist')}
                    disabled={isActive}
                  >
                    白名单
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {items.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all group',
                    item.enabled ? 'bg-muted/30' : 'opacity-50'
                  )}
                >
                  {item.type === 'website' ? (
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.pattern}</p>
                  </div>
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="scale-75"
                  />
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {!isElectronApp && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                当前为浏览器模式，专注屏蔽为提示层模式。如需系统级屏蔽（拦截网站、终止应用进程），请使用桌面客户端（Electron打包后的exe）。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 定时封锁会话：时间窗调度，自动启停专注盾 */}
      <ShieldScheduleSettings />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>添加屏蔽规则</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant={newItemType === 'website' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setNewItemType('website')}
              >
                <Globe className="h-3.5 w-3.5" />
                网站
              </Button>
              <Button
                variant={newItemType === 'app' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setNewItemType('app')}
              >
                <AppWindow className="h-3.5 w-3.5" />
                应用
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">名称</label>
              <Input
                placeholder={newItemType === 'website' ? '例如：微博' : '例如：微信'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {newItemType === 'website' ? '域名关键词' : '进程名称'}
              </label>
              <Input
                placeholder={newItemType === 'website' ? '例如：weibo.com' : '例如：WeChat.exe'}
                value={newItemPattern}
                onChange={(e) => setNewItemPattern(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
              />
              {newItemType === 'app' && (
                <p className="text-[10px] text-muted-foreground">
                  输入Windows任务管理器中显示的进程名称（不含.exe）
                </p>
              )}
            </div>
            <Button onClick={addItem} className="w-full" disabled={!newItemName.trim() || !newItemPattern.trim()}>
              添加
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
