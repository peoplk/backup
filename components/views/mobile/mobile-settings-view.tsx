'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import {
  Moon, Sun, Monitor, Volume2, Target, Trash2,
  Download, Upload, ChevronRight, Info,
  Palette, Timer, AlertTriangle, Coffee, Trophy,
  Cloud, CloudOff, RefreshCw, CheckCircle2, User, Shield, Globe
} from 'lucide-react'

const APP_VERSION = '2.0.0'

export function MobileSettingsView() {
  const {
    pomodoroSettings, updatePomodoroSettings, focusGoals, updateFocusGoals,
    trashedItems, emptyTrash,
    tasks, pomodoroSessions, userLevel
  } = useAppStore(useShallow(state => ({
    pomodoroSettings: state.pomodoroSettings,
    updatePomodoroSettings: state.updatePomodoroSettings,
    focusGoals: state.focusGoals,
    updateFocusGoals: state.updateFocusGoals,
    trashedItems: state.trashedItems,
    emptyTrash: state.emptyTrash,
    tasks: state.tasks,
    pomodoroSessions: state.pomodoroSessions,
    userLevel: state.userLevel,
  })))

  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme-mode') || 'system'
    return 'system'
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('focus-sound-enabled') !== 'false'
    return true
  })
  const [showDangerZone, setShowDangerZone] = useState(false)

  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('cloud-sync-enabled') === 'true'
    return false
  })
  const [syncProvider, setSyncProvider] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sync-provider') || 'none'
    return 'none'
  })
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('last-sync-time') || ''
    return ''
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncDetail, setShowSyncDetail] = useState(false)

  const handleThemeChange = (mode: string) => {
    setThemeMode(mode)
    localStorage.setItem('theme-mode', mode)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  }

  const handleSoundToggle = () => {
    const newVal = !soundEnabled
    setSoundEnabled(newVal)
    localStorage.setItem('focus-sound-enabled', String(newVal))
  }

  const handleSyncToggle = () => {
    const newVal = !cloudSyncEnabled
    setCloudSyncEnabled(newVal)
    localStorage.setItem('cloud-sync-enabled', String(newVal))
    if (newVal && syncProvider === 'none') {
      setSyncProvider('webdav')
      localStorage.setItem('sync-provider', 'webdav')
    }
    if (!newVal) {
      setSyncProvider('none')
      localStorage.setItem('sync-provider', 'none')
    }
  }

  const handleSyncProviderChange = (provider: string) => {
    setSyncProvider(provider)
    localStorage.setItem('sync-provider', provider)
  }

  const handleManualSync = () => {
    setIsSyncing(true)
    setTimeout(() => {
      const now = new Date().toLocaleString('zh-CN')
      setLastSyncTime(now)
      localStorage.setItem('last-sync-time', now)
      setIsSyncing(false)
    }, 1500)
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'done').length
  const totalFocusHours = Math.round(pomodoroSessions.reduce((acc, s) => acc + s.duration, 0) / 3600 * 10) / 10
  const levelProgress = userLevel.nextLevelPoints > 0
    ? ((userLevel.totalPoints - userLevel.currentLevelPoints) / (userLevel.nextLevelPoints - userLevel.currentLevelPoints)) * 100
    : 100

  const SYNC_PROVIDERS = [
    { id: 'webdav', label: 'WebDAV', icon: Globe, desc: '自建服务器' },
    { id: 'icloud', label: 'iCloud', icon: Cloud, desc: 'Apple 生态' },
    { id: 'googledrive', label: 'Google Drive', icon: Shield, desc: 'Google 账号' },
  ]

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">{title}</p>
      <div className="rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </div>
  )

  const Row = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
      <span className="flex-1 text-[13px]">{label}</span>
      {children}
    </div>
  )

  const Stepper = ({ value, label, onDec, onInc }: { value: string; label: string; onDec: () => void; onInc: () => void }) => (
    <div className="flex items-center gap-1.5">
      <button
        className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-sm font-medium active:scale-90 transition-transform"
        onClick={onDec}
      >−</button>
      <span className="w-12 text-center text-[13px] font-medium tabular-nums">{value}{label}</span>
      <button
        className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-sm font-medium active:scale-90 transition-transform"
        onClick={onInc}
      >+</button>
    </div>
  )

  const ActionRow = ({ icon: Icon, label, value, onClick, destructive }: {
    icon: React.ElementType; label: string; value?: string; onClick?: () => void; destructive?: boolean
  }) => (
    <button
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 active:bg-muted/30 transition-colors text-left',
        destructive && 'text-red-500'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', destructive ? 'text-red-500' : 'text-muted-foreground')} />
      <span className="flex-1 text-[13px]">{label}</span>
      {value && <span className="text-[13px] text-muted-foreground">{value}</span>}
      {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </button>
  )

  return (
    <div className="space-y-1 px-4 pt-4 pb-24">
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-5 text-primary-foreground">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
            <span className="text-xl font-bold">{userLevel.level}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{userLevel.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{userLevel.totalPoints.toLocaleString()} 积分</p>
          </div>
          <Trophy className="h-5 w-5 opacity-60 shrink-0" />
        </div>
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/90 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }}
            />
          </div>
          <p className="text-[10px] opacity-60 mt-1.5 text-right">
            {userLevel.nextLevelPoints - userLevel.totalPoints} 积分升级
          </p>
        </div>
      </div>

      <Section title="云同步">
        <Row icon={cloudSyncEnabled ? Cloud : CloudOff} label="云同步">
          <button
            className={cn(
              'w-11 h-[26px] rounded-full transition-all relative',
              cloudSyncEnabled ? 'bg-primary' : 'bg-muted'
            )}
            onClick={handleSyncToggle}
          >
            <div className={cn(
              'absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all',
              cloudSyncEnabled ? 'left-[22px]' : 'left-[3px]'
            )} />
          </button>
        </Row>
        {cloudSyncEnabled && (
          <>
            <div className="px-4 py-3">
              <label className="text-xs text-muted-foreground mb-2 block">同步服务</label>
              <div className="space-y-2">
                {SYNC_PROVIDERS.map(provider => {
                  const ProviderIcon = provider.icon
                  return (
                    <button
                      key={provider.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]',
                        syncProvider === provider.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-muted/30 border border-transparent'
                      )}
                      onClick={() => handleSyncProviderChange(provider.id)}
                    >
                      <ProviderIcon className={cn('h-5 w-5 shrink-0', syncProvider === provider.id ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="flex-1 text-left">
                        <p className={cn('text-[13px] font-medium', syncProvider === provider.id && 'text-primary')}>{provider.label}</p>
                        <p className="text-[10px] text-muted-foreground">{provider.desc}</p>
                      </div>
                      {syncProvider === provider.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground">同步状态</label>
                {lastSyncTime && <span className="text-[10px] text-muted-foreground">{lastSyncTime}</span>}
              </div>
              <button
                className={cn(
                  'w-full h-10 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
                  isSyncing
                    ? 'bg-muted/50 text-muted-foreground'
                    : 'bg-primary/10 text-primary'
                )}
                onClick={handleManualSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                {isSyncing ? '同步中...' : '立即同步'}
              </button>
            </div>
            <ActionRow icon={User} label="账号管理" onClick={() => {}} />
            <ActionRow icon={Shield} label="数据加密" value="端对端" onClick={() => {}} />
          </>
        )}
      </Section>

      <Section title="外观">
        <Row icon={Palette} label="主题">
          <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5">
            {[
              { id: 'light', icon: Sun, label: '浅色' },
              { id: 'dark', icon: Moon, label: '深色' },
              { id: 'system', icon: Monitor, label: '跟随' },
            ].map(t => (
              <button
                key={t.id}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all active:scale-95',
                  themeMode === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                )}
                onClick={() => handleThemeChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={Volume2} label="声音提醒">
          <button
            className={cn(
              'w-11 h-[26px] rounded-full transition-all relative',
              soundEnabled ? 'bg-primary' : 'bg-muted'
            )}
            onClick={handleSoundToggle}
          >
            <div className={cn(
              'absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all',
              soundEnabled ? 'left-[22px]' : 'left-[3px]'
            )} />
          </button>
        </Row>
      </Section>

      <Section title="专注">
        <Row icon={Timer} label="专注时长">
          <Stepper
            value={`${pomodoroSettings.workDuration / 60}`}
            label="分"
            onDec={() => updatePomodoroSettings({ workDuration: Math.max(300, pomodoroSettings.workDuration - 300) })}
            onInc={() => updatePomodoroSettings({ workDuration: Math.min(7200, pomodoroSettings.workDuration + 300) })}
          />
        </Row>
        <Row icon={Coffee} label="短休息">
          <Stepper
            value={`${pomodoroSettings.shortBreakDuration / 60}`}
            label="分"
            onDec={() => updatePomodoroSettings({ shortBreakDuration: Math.max(60, pomodoroSettings.shortBreakDuration - 60) })}
            onInc={() => updatePomodoroSettings({ shortBreakDuration: Math.min(1800, pomodoroSettings.shortBreakDuration + 60) })}
          />
        </Row>
        <Row icon={Target} label="每日目标">
          <Stepper
            value={`${focusGoals.dailyMinutes}`}
            label="分"
            onDec={() => updateFocusGoals({ dailyMinutes: Math.max(15, focusGoals.dailyMinutes - 15) })}
            onInc={() => updateFocusGoals({ dailyMinutes: Math.min(720, focusGoals.dailyMinutes + 15) })}
          />
        </Row>
      </Section>

      <Section title="数据">
        <div className="px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center py-2.5 px-1 rounded-xl bg-muted/30">
              <p className="text-lg font-bold tabular-nums">{totalTasks}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">总任务</p>
            </div>
            <div className="text-center py-2.5 px-1 rounded-xl bg-muted/30">
              <p className="text-lg font-bold tabular-nums">{completedTasks}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">已完成</p>
            </div>
            <div className="text-center py-2.5 px-1 rounded-xl bg-muted/30">
              <p className="text-lg font-bold tabular-nums">{totalFocusHours}h</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">专注</p>
            </div>
          </div>
        </div>
        <ActionRow icon={Download} label="导出数据" onClick={() => {}} />
        <ActionRow icon={Upload} label="导入数据" onClick={() => {}} />
        {trashedItems.length > 0 && (
          <ActionRow icon={Trash2} label={`回收站 (${trashedItems.length})`} onClick={() => emptyTrash()} destructive />
        )}
      </Section>

      <Section title="关于">
        <ActionRow icon={Info} label="版本" value={APP_VERSION} />
        <ActionRow icon={Shield} label="隐私政策" onClick={() => {}} />
        <ActionRow icon={Globe} label="开源许可" onClick={() => {}} />
      </Section>

      <Section title="危险操作">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-red-500/5 transition-colors"
          onClick={() => setShowDangerZone(!showDangerZone)}
        >
          <AlertTriangle className="h-[18px] w-[18px] text-red-500 shrink-0" />
          <span className="flex-1 text-[13px] text-red-500">清除所有数据</span>
          <ChevronRight className={cn('h-4 w-4 text-red-500/50 transition-transform', showDangerZone && 'rotate-90')} />
        </button>
        {showDangerZone && (
          <div className="px-4 py-3 bg-red-500/5">
            <p className="text-xs text-red-500/80 mb-2">此操作不可撤销，将清除所有任务、习惯、专注记录等数据。</p>
            <button
              className="w-full h-10 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-[0.98] transition-transform"
              onClick={() => {
                if (confirm('确定要清除所有数据吗？此操作不可撤销！')) {
                  localStorage.clear()
                  window.location.reload()
                }
              }}
            >
              确认清除
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}
