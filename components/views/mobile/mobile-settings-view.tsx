﻿'use client'

import { useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { restoreDataToStore } from '@/lib/data-restore'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { encryptData, decryptData } from '@/lib/crypto'
import {
  Moon, Sun, Monitor, Volume2, Target, Trash2,
  Download, Upload, ChevronRight, Info,
  Palette, Timer, AlertTriangle, Coffee, Trophy,
  Cloud, RefreshCw, CheckCircle2, User, Shield, Globe,
  FileJson, FileSpreadsheet, Lock, Unlock, AlertCircle,
  X, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { SyncProviderSheet } from '@/components/mobile/sync-provider-sheet'

const APP_VERSION = '2.0.0'

export function MobileSettingsView() {
  const {
    pomodoroSettings, updatePomodoroSettings, focusGoals, updateFocusGoals,
    trashedItems, emptyTrash,
    tasks, pomodoroSessions, userLevel,
    habits, habitCheckIns, goals, anniversaries, projects,
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
    habits: state.habits,
    habitCheckIns: state.habitCheckIns,
    goals: state.goals,
    anniversaries: state.anniversaries,
    projects: state.projects,
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

  // 云同步 Sheet —— 状态由 SyncProviderSheet 内部管理，避免父组件重渲染
  const [showProviderSheet, setShowProviderSheet] = useState(false)

  // 导出数据
  const [showExportSheet, setShowExportSheet] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')

  // 导入数据
  const [showImportSheet, setShowImportSheet] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; counts?: Record<string, number> } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // 账号管理
  const [showAccountSheet, setShowAccountSheet] = useState(false)
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('user-display-name') || ''
    return ''
  })
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // 数据加密
  const [showEncryptionSheet, setShowEncryptionSheet] = useState(false)
  const [encryptionEnabled, setEncryptionEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('data-encryption-enabled') === 'true'
    return false
  })
  const [encryptPassword, setEncryptPassword] = useState('')
  const [encryptStatus, setEncryptStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [isEncrypting, setIsEncrypting] = useState(false)

  // 隐私政策
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false)

  // 开源许可
  const [showLicenseDialog, setShowLicenseDialog] = useState(false)

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

  // 云同步相关 handler 全部移至 SyncProviderSheet 子组件，父组件不再持有这些状态

  // 导出数据处理
  const handleExport = () => {
    if (exportFormat === 'json') {
      const data: Record<string, unknown> = {
        tasks,
        pomodoroSessions,
        habits,
        habitCheckIns,
        goals,
        anniversaries,
        projects,
        exportInfo: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
        },
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `focusflow-export-${new Date().toISOString().split('T')[0]}.json`)
    } else {
      const csvParts: string[] = []
      if (tasks.length > 0) {
        csvParts.push('任务')
        csvParts.push('标题,优先级,状态,项目,标签,截止日期,创建日期')
        tasks.forEach(t => {
          csvParts.push(`"${t.title}","${t.priority}","${t.status}","${t.project || ''}","${t.tags.join(';')}","${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}","${new Date(t.createdAt).toLocaleDateString()}"`)
        })
        csvParts.push('')
      }
      if (pomodoroSessions.length > 0) {
        csvParts.push('番茄钟记录')
        csvParts.push('类型,时长(分钟),完成时间')
        pomodoroSessions.forEach(s => {
          csvParts.push(`"${s.type}","${Math.round(s.duration / 60)}","${new Date(s.completedAt).toLocaleString()}"`)
        })
      }
      const blob = new Blob(['\uFEFF' + csvParts.join('\n')], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, `focusflow-export-${new Date().toISOString().split('T')[0]}.csv`)
    }
    setShowExportSheet(false)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 导入数据处理
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string
        const data = JSON.parse(content)
        const counts = restoreDataToStore(data)

        const total = Object.values(counts).reduce((a, b) => a + b, 0)
        setImportResult({
          success: true,
          message: total > 0 ? `成功导入 ${total} 条数据` : '未找到可导入的数据',
          counts,
        })
      } catch {
        setImportResult({ success: false, message: '文件格式错误，请确保上传有效的 JSON 文件' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 账号管理
  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    setDisplayName(trimmed)
    localStorage.setItem('user-display-name', trimmed)
    setEditingName(false)
  }

  // 数据加密
  const handleEncryptionToggle = async () => {
    if (encryptionEnabled) {
      // 解密
      if (!encryptPassword) return
      setIsEncrypting(true)
      setEncryptStatus(null)
      try {
        const encryptedData = localStorage.getItem('productivity-app-storage-encrypted')
        if (!encryptedData) throw new Error('未找到加密数据')
        const decrypted = await decryptData(encryptedData, encryptPassword)
        localStorage.setItem('productivity-app-storage', decrypted)
        localStorage.removeItem('productivity-app-storage-encrypted')
        setEncryptionEnabled(false)
        localStorage.setItem('data-encryption-enabled', 'false')
        setEncryptPassword('')
        setEncryptStatus({ success: true, message: '数据已成功解密' })
        window.location.reload()
      } catch {
        setEncryptStatus({ success: false, message: '解密失败，请检查密码是否正确' })
      } finally {
        setIsEncrypting(false)
      }
    } else {
      // 加密
      if (!encryptPassword || encryptPassword.length < 4) {
        setEncryptStatus({ success: false, message: '密码至少需要4个字符' })
        return
      }
      setIsEncrypting(true)
      setEncryptStatus(null)
      try {
        const rawData = localStorage.getItem('productivity-app-storage')
        if (!rawData) throw new Error('未找到数据')
        const encrypted = await encryptData(rawData, encryptPassword)
        localStorage.setItem('productivity-app-storage-encrypted', encrypted)
        localStorage.removeItem('productivity-app-storage')
        setEncryptionEnabled(true)
        localStorage.setItem('data-encryption-enabled', 'true')
        setEncryptPassword('')
        setEncryptStatus({ success: true, message: '数据已成功加密' })
      } catch {
        setEncryptStatus({ success: false, message: '加密失败，请重试' })
      } finally {
        setIsEncrypting(false)
      }
    }
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'done').length
  const totalFocusHours = Math.round(pomodoroSessions.reduce((acc, s) => acc + s.duration, 0) / 3600 * 10) / 10
  const levelProgress = userLevel.nextLevelPoints > 0
    ? ((userLevel.totalPoints - userLevel.currentLevelPoints) / (userLevel.nextLevelPoints - userLevel.currentLevelPoints)) * 100
    : 100

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
        <ActionRow
          icon={Cloud}
          label="云同步"
          value="点击配置"
          onClick={() => setShowProviderSheet(true)}
        />
        <button
          className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/30 transition-colors text-left"
          onClick={() => setShowProviderSheet(true)}
        >
          <div className="h-[18px] w-[18px] shrink-0 flex items-center justify-center">
            <span className="block h-2 w-2 rounded-full bg-muted-foreground/40" />
          </div>
          <div className="flex-1">
            <p className="text-[13px]">未配置</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              点击选择 Firebase / Supabase / WebDAV
            </p>
          </div>
        </button>
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
        <ActionRow icon={Download} label="导出数据" onClick={() => setShowExportSheet(true)} />
        <ActionRow icon={Upload} label="导入数据" onClick={() => { setShowImportSheet(true); setImportResult(null) }} />
        {trashedItems.length > 0 && (
          <ActionRow icon={Trash2} label={`回收站 (${trashedItems.length})`} onClick={() => emptyTrash()} destructive />
        )}
      </Section>

      <Section title="关于">
        <ActionRow icon={Info} label="版本" value={APP_VERSION} />
        <ActionRow icon={Shield} label="隐私政策" onClick={() => setShowPrivacyDialog(true)} />
        <ActionRow icon={Globe} label="开源许可" onClick={() => setShowLicenseDialog(true)} />
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
                if (confirm('确定要清除所有数据吗？此操作不可撤销。')) {
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

      {/* 导出数据 Sheet */}
      <Sheet open={showExportSheet} onOpenChange={setShowExportSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>导出数据</SheetTitle>
            <SheetDescription>选择导出格式，将数据保存到本地文件</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-4 transition-all active:scale-[0.98]',
                  exportFormat === 'json' ? 'border-primary bg-primary/5' : 'border-border/50'
                )}
                onClick={() => setExportFormat('json')}
              >
                <FileJson className="h-5 w-5 text-chart-1" />
                <div className="text-left">
                  <p className="text-sm font-medium">JSON</p>
                  <p className="text-[10px] text-muted-foreground">完整数据结构</p>
                </div>
              </button>
              <button
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-4 transition-all active:scale-[0.98]',
                  exportFormat === 'csv' ? 'border-primary bg-primary/5' : 'border-border/50'
                )}
                onClick={() => setExportFormat('csv')}
              >
                <FileSpreadsheet className="h-5 w-5 text-chart-2" />
                <div className="text-left">
                  <p className="text-sm font-medium">CSV</p>
                  <p className="text-[10px] text-muted-foreground">表格格式</p>
                </div>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/30 py-2">
                <p className="text-base font-bold tabular-nums">{tasks.length}</p>
                <p className="text-[10px] text-muted-foreground">任务</p>
              </div>
              <div className="rounded-xl bg-muted/30 py-2">
                <p className="text-base font-bold tabular-nums">{habits.length}</p>
                <p className="text-[10px] text-muted-foreground">习惯</p>
              </div>
              <div className="rounded-xl bg-muted/30 py-2">
                <p className="text-base font-bold tabular-nums">{anniversaries.length}</p>
                <p className="text-[10px] text-muted-foreground">纪念日</p>
              </div>
            </div>
            <button
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              导出
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 导入数据 Sheet */}
      <Sheet open={showImportSheet} onOpenChange={setShowImportSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>导入数据</SheetTitle>
            <SheetDescription>从 JSON 文件导入数据，数据将追加到现有记录中</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            <button
              className="w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all active:scale-[0.98] border-border hover:border-primary/50"
              onClick={() => importFileRef.current?.click()}
            >
              <FileJson className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">点击选择 JSON 文件</p>
              <p className="text-xs text-muted-foreground mt-1">支持 FocusFlow 导出的 JSON 文件</p>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </button>

            {importResult && (
              <div className={cn(
                'flex items-start gap-3 rounded-xl p-4',
                importResult.success ? 'bg-chart-2/10' : 'bg-destructive/10'
              )}>
                {importResult.success
                  ? <CheckCircle2 className="h-5 w-5 text-chart-2 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                }
                <div>
                  <p className={cn('text-sm font-medium', importResult.success ? 'text-chart-2' : 'text-destructive')}>
                    {importResult.message}
                  </p>
                  {importResult.counts && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {importResult.counts.tasks ? <span>任务: {importResult.counts.tasks} </span> : null}
                      {importResult.counts.habits ? <span>习惯: {importResult.counts.habits} </span> : null}
                      {importResult.counts.anniversaries ? <span>纪念日: {importResult.counts.anniversaries} </span> : null}
                      {importResult.counts.projects ? <span>项目: {importResult.counts.projects} </span> : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 账号管理 Sheet */}
      <Sheet open={showAccountSheet} onOpenChange={setShowAccountSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>账号管理</SheetTitle>
            <SheetDescription>管理本地用户信息</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate">{displayName || '本地用户'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">本地账号 · 无需登录</p>
              </div>
            </div>
            {editingName ? (
              <div className="space-y-3">
                <Input
                  placeholder="输入显示名称"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    className="flex-1 h-10 rounded-xl bg-muted text-sm font-medium active:scale-[0.98] transition-transform"
                    onClick={() => setEditingName(false)}
                  >取消</button>
                  <button
                    className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform"
                    onClick={handleSaveName}
                  >保存</button>
                </div>
              </div>
            ) : (
              <button
                className="w-full h-10 rounded-xl bg-primary/10 text-primary text-sm font-medium active:scale-[0.98] transition-transform"
                onClick={() => { setNameInput(displayName); setEditingName(true) }}
              >修改显示名称</button>
            )}
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                当前为本地账号模式，所有数据存储在设备本地。开启云同步后可跨设备同步数据。
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 数据加密 Sheet */}
      <Sheet open={showEncryptionSheet} onOpenChange={setShowEncryptionSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>数据加密</SheetTitle>
            <SheetDescription>{encryptionEnabled ? '数据已加密，输入密码可解密' : '启用加密以保护本地存储的数据'}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
              {encryptionEnabled
                ? <Lock className="h-6 w-6 text-chart-2" />
                : <Unlock className="h-6 w-6 text-muted-foreground" />
              }
              <div className="flex-1">
                <p className="text-sm font-medium">{encryptionEnabled ? '加密已启用' : '加密未启用'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {encryptionEnabled ? '您的数据已使用 AES-256-GCM 加密' : '启用后，本地数据将以加密形式存储'}
                </p>
              </div>
            </div>
            <Input
              type="password"
              placeholder={encryptionEnabled ? '输入密码以解密' : '设置加密密码（至少4位）'}
              value={encryptPassword}
              onChange={(e) => setEncryptPassword(e.target.value)}
            />
            <button
              className={cn(
                'w-full h-11 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2',
                encryptionEnabled
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-primary text-primary-foreground',
                isEncrypting && 'opacity-50 pointer-events-none'
              )}
              onClick={handleEncryptionToggle}
              disabled={isEncrypting}
            >
              {isEncrypting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : encryptionEnabled ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {isEncrypting ? '处理中...' : encryptionEnabled ? '解密数据' : '启用加密'}
            </button>
            {encryptStatus && (
              <div className={cn(
                'flex items-center gap-2 rounded-xl p-3',
                encryptStatus.success ? 'bg-chart-2/10' : 'bg-destructive/10'
              )}>
                {encryptStatus.success
                  ? <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                }
                <p className={cn('text-xs', encryptStatus.success ? 'text-chart-2' : 'text-destructive')}>
                  {encryptStatus.message}
                </p>
              </div>
            )}
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                加密使用 AES-256-GCM 算法，请牢记密码。密码丢失将无法恢复数据。
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 云同步 —— 使用独立组件，状态本地化、避免父组件重渲染 */}
      <SyncProviderSheet open={showProviderSheet} onClose={() => setShowProviderSheet(false)} />

      {/* 隐私政策 Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>隐私政策</DialogTitle>
            <DialogDescription>FocusFlow 隐私声明</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">数据存储</strong>：FocusFlow 是一款本地优先的应用，所有数据均存储在您的设备本地（浏览器 localStorage），不会上传至任何服务器。</p>
            <p><strong className="text-foreground">数据收集</strong>：我们不收集任何个人身份信息、使用习惯或行为数据。应用不包含任何第三方分析或追踪工具。</p>
            <p><strong className="text-foreground">云同步</strong>：如果您主动开启云同步功能，数据将通过您选择的同步服务（如 WebDAV）传输。我们不会在中途存储或访问您的数据。</p>
            <p><strong className="text-foreground">数据加密</strong>：您可以选择启用本地数据加密，使用 AES-256-GCM 算法保护存储在设备上的数据。加密密钥由您的密码派生，我们无法获取。</p>
            <p><strong className="text-foreground">数据删除</strong>：您可以随时在设置中清除所有数据。卸载应用或清除浏览器缓存也会删除所有本地数据。</p>
            <p><strong className="text-foreground">权限使用</strong>：应用仅在您授权的情况下访问通知权限，用于提醒功能。不会访问摄像头、麦克风、位置等敏感权限。</p>
            <p><strong className="text-foreground">儿童隐私</strong>：本应用不面向 13 岁以下儿童，也不会有意收集儿童的个人信。</p>
            <p><strong className="text-foreground">政策更新</strong>：如本政策发生变更，我们会在应用内通知您。继续使用即表示您同意更新后的政策。</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 开源许可 Dialog */}
      <Dialog open={showLicenseDialog} onOpenChange={setShowLicenseDialog}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>开源许可</DialogTitle>
            <DialogDescription>FocusFlow 使用的开源软件</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {[
              { name: 'Next.js', license: 'MIT', desc: 'React 全栈框架' },
              { name: 'React', license: 'MIT', desc: '用户界面库' },
              { name: 'Zustand', license: 'MIT', desc: '状态管理库' },
              { name: 'Tailwind CSS', license: 'MIT', desc: '实用优先的 CSS 框架' },
              { name: 'shadcn/ui', license: 'MIT', desc: '可复用 UI 组件' },
              { name: 'Radix UI', license: 'MIT', desc: '无障碍 UI 原语' },
              { name: 'Lucide', license: 'ISC', desc: '图标库' },
              { name: 'date-fns', license: 'MIT', desc: '日期工具库' },
              { name: 'Recharts', license: 'MIT', desc: '图表库' },
              { name: 'cmdk', license: 'MIT', desc: '命令面板组件' },
              { name: 'vaul', license: 'MIT', desc: '抽屉组件' },
              { name: 'Capacitor', license: 'MIT', desc: '跨平台运行时' },
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{item.license}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
