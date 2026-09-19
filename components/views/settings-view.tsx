'use client'

import { useAppStore } from '@/lib/store'
import { useS3SyncStore, pullDataFromS3, resolveS3Conflict } from '@/lib/s3-store'
import { getIsS3Configured, getS3Config, saveS3Config, hasSyncPassphrase, S3_PRESET_SERVICES, type S3ConfigInput } from '@/lib/s3-sync'
import { getCredentialVaultStatus, getCredentialVaultStatusAsync } from '@/lib/credential-vault'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DataExport } from '@/components/data-export'
import { DataImport } from '@/components/data-import'
import { DataBackup } from '@/components/data-backup'
import { PrivacyLock } from '@/components/privacy-lock'
import { SHORTCUT_LIST } from '@/lib/shortcuts'
import { checkForUpdateFlow } from '@/components/title-bar'
import type { GlobalShortcutInfo } from '@/lib/types/electron'
import { generateICS, downloadICS } from '@/lib/ics-export'
import { tasksToCSV, downloadCSV, importTasksFromCSV, downloadImportTemplate } from '@/lib/csv'
import {
  Database,
  Palette,
  Trash2,
  Keyboard,
  Download,
  FileDown,
  Upload,
  Bell,
  Volume2,
  Info,
  Target,
  RotateCcw,
  Archive,
  Calendar,
  Sun,
  Moon,
  Clock,
  FolderOpen,
  Plus,
  Edit,
  Check,
  X,
  Cloud,
  RefreshCw,
  CloudOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings,
  Eye,
  EyeOff,
HardDrive,
Power,
Sparkles,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ViewTabs, ViewTabsList, ViewTabsTrigger, ViewTabsContent } from '@/components/ui/view-tabs'
import { getStoredTheme, setTheme, type ThemeMode } from '@/lib/theme'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { COLOR_PALETTE } from '@/lib/palette'
import { getLLMConfig, setLLMConfig, parseTaskIntent, type LLMConfig } from '@/lib/llm-assistant'
import { getIdleMinutes, setIdleMinutes } from '@/lib/use-idle-detector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PROJECT_COLORS = COLOR_PALETTE

// ─── 桌面端全局快捷键：注册发生在主进程，冲突（注册失败）必须显式暴露给用户 ───
function GlobalShortcutsCard() {
  const [shortcuts, setShortcuts] = useState<GlobalShortcutInfo[] | null>(null)
  const [capturingId, setCapturingId] = useState<string | null>(null)

  useEffect(() => {
    if (!window.electronAPI?.shortcutsGet) return
    window.electronAPI.shortcutsGet().then(setShortcuts).catch(() => setShortcuts(null))
  }, [])

  useEffect(() => {
    if (!capturingId) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturingId(null)
        return
      }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
      if (!e.ctrlKey && !e.metaKey) {
        toast.error('请至少按住 Ctrl/⌘，推荐 Ctrl+Shift+字母')
        return
      }
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
      if (!/^[A-Z0-9]$/.test(key)) {
        toast.error('仅支持单个字母或数字')
        return
      }
      const accelerator = `CommandOrControl+${e.shiftKey ? 'Shift+' : e.altKey ? 'Alt+' : ''}${key}`
      window.electronAPI
        ?.shortcutsSet?.({ [capturingId]: accelerator })
        .then((res) => {
          if (res?.shortcuts) setShortcuts(res.shortcuts)
          const mine = res?.shortcuts?.find((s) => s.id === capturingId)
          if (res?.success && mine?.registered) {
            toast.success(`已设置为 ${mine.accelerator.replace('CommandOrControl', 'Ctrl/⌘')}`)
          } else if (res?.success) {
            toast.error('该组合已被其他应用占用，注册失败')
          } else {
            toast.error(res?.message || '保存失败')
          }
        })
        .finally(() => setCapturingId(null))
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [capturingId])

  if (!shortcuts?.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          全局快捷键（桌面端）
        </CardTitle>
        <CardDescription>应用最小化或未聚焦时也可触发的系统级快捷键</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1">
              <div>
                <span className="text-sm">{s.label}</span>
                {!s.registered && (
                  <span className="ml-2 text-xs text-destructive">冲突：注册失败</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.registered ? 'secondary' : 'destructive'} className="text-xs">
                  {capturingId === s.id ? '按下新快捷键…（Esc 取消）' : s.accelerator.replace('CommandOrControl', 'Ctrl/⌘')}
                </Badge>
                {s.accelerator !== s.default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      window.electronAPI
                        ?.shortcutsSet?.({ [s.id]: s.default })
                        .then((res) => res?.shortcuts && setShortcuts(res.shortcuts))
                    }
                  >
                    默认
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setCapturingId(capturingId === s.id ? null : s.id)}
                >
                  {capturingId === s.id ? '取消' : '修改'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const SYNC_DATA_KEYS = [
  'tasks', 'habits', 'habitCheckIns', 'timeEntries', 'pomodoroSessions',
  'projects', 'anniversaries', 'goals', 'tags', 'reminders',
  'journals', 'focusGoals', 'dailyReviewSettings',
] as const

function ProjectManager({ projects, addProject, updateProject, deleteProject, tasks }: {
  projects: { id: string; name: string; color: string; totalTime: number; parentId?: string; budgetMinutes?: number }[]
  addProject: (p: { name: string; color: string; parentId?: string; budgetMinutes?: number }) => void
  updateProject: (id: string, updates: { name?: string; color?: string; parentId?: string; budgetMinutes?: number }) => void
  deleteProject: (id: string) => void
  tasks: { project?: string; status: string }[]
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newParentId, setNewParentId] = useState<string>('')
  const [newBudget, setNewBudget] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editParentId, setEditParentId] = useState<string>('')
  const [editBudget, setEditBudget] = useState('')

  const handleAdd = () => {
    if (!newName.trim()) return
    addProject({
      name: newName.trim(),
      color: newColor,
      parentId: newParentId === 'none' ? undefined : newParentId || undefined,
      budgetMinutes: newBudget ? Math.max(1, parseInt(newBudget) || 1) : undefined,
    })
    setNewName('')
    setNewColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)])
    setNewParentId('')
    setNewBudget('')
    toast.success('项目已创建')
  }

  const handleStartEdit = (id: string, name: string, color: string, parentId?: string, budgetMinutes?: number) => {
    setEditingId(id)
    setEditName(name)
    setEditColor(color)
    setEditParentId(parentId ?? '')
    setEditBudget(budgetMinutes ? String(budgetMinutes) : '')
  }

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateProject(editingId, {
      name: editName.trim(),
      color: editColor,
      parentId: editParentId === 'none' ? undefined : editParentId || undefined,
      budgetMinutes: editBudget ? Math.max(1, parseInt(editBudget) || 0) : undefined,
    })
    setEditingId(null)
    toast.success('项目已更新')
  }

  const handleDelete = (id: string, name: string) => {
    const taskCount = tasks.filter(t => t.project === name).length
    if (taskCount > 0) {
      toast.error(`该项目下有 ${taskCount} 个任务，请先移动或删除任务`)
      return
    }
    const childCount = projects.filter(p => p.parentId === id).length
    if (childCount > 0) {
      toast.error(`该项目下有 ${childCount} 个子项目，请先移除子项目`)
      return
    }
    deleteProject(id)
    toast.success('项目已删除')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="新项目名称..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 min-w-[140px] h-9"
        />
        <div className="flex items-center gap-1.5">
          {PROJECT_COLORS.slice(0, 5).map((color) => (
            <button
              key={color}
              className={cn(
                'h-6 w-6 rounded-full transition-all',
                newColor === color && 'ring-2 ring-offset-1 ring-primary scale-110'
              )}
              style={{ backgroundColor: color }}
              onClick={() => setNewColor(color)}
            />
          ))}
        </div>
        <Select value={newParentId} onValueChange={setNewParentId}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="父项目（可选）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">无（顶级项目）</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          placeholder="周预算(分)"
          value={newBudget}
          onChange={(e) => setNewBudget(e.target.value)}
          className="w-[100px] h-9"
          title="每周投入预算（分钟）"
        />
        <Button size="sm" className="gap-1.5 h-9" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-8 w-8 opacity-30 mb-2" />
          <p className="text-sm">暂无项目</p>
          <p className="text-xs mt-1">创建项目来分类管理你的任务</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {projects.map((project) => {
            const taskCount = tasks.filter(t => t.project === project.name).length
            const completedCount = tasks.filter(t => t.project === project.name && t.status === 'done').length
            const isEditing = editingId === project.id

            return (
              <div
                key={project.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:border-primary/20 transition-colors"
              >
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-1">
                      {PROJECT_COLORS.slice(0, 5).map((color) => (
                        <button
                          key={color}
                          className={cn(
                            'h-5 w-5 rounded-full transition-all',
                            editColor === color && 'ring-2 ring-offset-1 ring-primary'
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setEditColor(color)}
                        />
                      ))}
                    </div>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      className="flex-1 h-8"
                      autoFocus
                    />
                    <Select value={editParentId} onValueChange={setEditParentId}>
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue placeholder="父项目" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无（顶级）</SelectItem>
                        {projects.filter((p) => p.id !== editingId).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      placeholder="周预算(分)"
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      className="w-[90px] h-8"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} aria-label="保存修改">
                      <Check className="h-4 w-4 text-chart-2" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)} aria-label="取消编辑">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div
                      className="h-4 w-4 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {taskCount} 个任务 · {completedCount} 已完成
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleStartEdit(project.id, project.name, project.color, project.parentId, project.budgetMinutes)}
                      aria-label="编辑项目"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(project.id, project.name)}
                      aria-label="删除项目"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SettingsView() {
  const { 
    projects, 
    addProject,
    updateProject,
    deleteProject,
    pomodoroSettings,
    updatePomodoroSettings,
    tasks, 
    habits, 
    timeEntries, 
    anniversaries,
    pomodoroSessions,
    habitCheckIns,
    notifications,
    focusGoals,
    updateFocusGoals,
    trashedItems,
    restoreFromTrash,
    emptyTrash,
    darkModeSchedule,
    updateDarkModeSchedule,
    workingHours,
    updateWorkingHours,
    dailyReviewSettings,
    updateDailyReviewSettings,
  } = useAppStore(useShallow((state) => ({
    projects: state.projects,
    addProject: state.addProject,
    updateProject: state.updateProject,
    deleteProject: state.deleteProject,
    pomodoroSettings: state.pomodoroSettings,
    updatePomodoroSettings: state.updatePomodoroSettings,
    tasks: state.tasks,
    habits: state.habits,
    timeEntries: state.timeEntries,
    anniversaries: state.anniversaries,
    pomodoroSessions: state.pomodoroSessions,
    habitCheckIns: state.habitCheckIns,
    notifications: state.notifications,
    focusGoals: state.focusGoals,
    updateFocusGoals: state.updateFocusGoals,
    trashedItems: state.trashedItems,
    restoreFromTrash: state.restoreFromTrash,
    emptyTrash: state.emptyTrash,
    darkModeSchedule: state.darkModeSchedule,
    updateDarkModeSchedule: state.updateDarkModeSchedule,
    workingHours: state.workingHours,
    updateWorkingHours: state.updateWorkingHours,
    dailyReviewSettings: state.dailyReviewSettings,
    updateDailyReviewSettings: state.updateDailyReviewSettings,
  })))
  
  const s3SyncStore = useS3SyncStore()
  const [isElectronApp, setIsElectronApp] = useState(false)
  const [appVersion, setAppVersion] = useState('1.0.0')
  useEffect(() => {
    if (!window.electronAPI) return
    setIsElectronApp(true)
    window.electronAPI.getAppVersion?.().then((v) => v && setAppVersion(v)).catch(() => {})
  }, [])
  const [llmConfig, setLLMConfigState] = useState(() => getLLMConfig())
  const [vaultStatus, setVaultStatus] = useState(() => getCredentialVaultStatus())
  // Electron 下 safeStorage 可能被系统禁用，异步刷新真实状态以显示准确警告
  useEffect(() => {
    getCredentialVaultStatusAsync().then(setVaultStatus).catch(() => {})
  }, [])
  const isPlainStorage = vaultStatus.engine === 'none'
  const [showLLMKey, setShowLLMKey] = useState(false)
  const [llmTesting, setLLMTesting] = useState(false)
  const updateLLMConfig = (patch: Partial<LLMConfig>) => {
    setLLMConfigState(setLLMConfig(patch))
  }
  const handleLLMTest = async () => {
    setLLMTesting(true)
    try {
      const result = await parseTaskIntent('明天下午3点提醒我交房租')
      if (result.tasks.length > 0) {
        toast.success(`连接成功，识别到 ${result.tasks.length} 个任务`)
      } else {
        toast.success('连接成功')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '连接失败，请检查配置')
    } finally {
      setLLMTesting(false)
    }
  }
  const [idleMinutes, setStateIdleMinutes] = useState(() => getIdleMinutes())

  // 统一的云同步面板状态
  const [selectedProvider, setSelectedProvider] = useState<'none' | 's3'>(() => {
    if (typeof window === 'undefined') return 'none'
    const saved = localStorage.getItem('sync-provider-selected')
    // 历史值 'firebase' 已废弃（Firebase 方案已移除），回落到未配置
    return saved === 's3' ? 's3' : 'none'
  })
  const [s3ConfigForm, setS3ConfigForm] = useState<S3ConfigInput>({
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    forcePathStyle: true,
    remoteKey: 'focusflow-sync.json',
    syncInterval: 30,
    compress: false,
    encrypt: false,
    syncPassphrase: '',
  })
  const [showS3Config, setShowS3Config] = useState(false)
  const [showS3Secret, setShowS3Secret] = useState(false)
  const [showS3Passphrase, setShowS3Passphrase] = useState(false)
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    // 恢复加密/密封存储的 LLM API Key，使表单反映已保存状态
    void import('@/lib/llm-assistant').then(({ initLLMConfig, getLLMConfig }) =>
      initLLMConfig().then(() => setLLMConfigState(getLLMConfig()))
    )
    const s3 = getS3Config()
    if (s3) {
      setS3ConfigForm({
        endpoint: s3.endpoint,
        region: s3.region || 'us-east-1',
        bucket: s3.bucket,
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
        forcePathStyle: s3.forcePathStyle ?? true,
        remoteKey: s3.remoteKey || 'focusflow-sync.json',
        syncInterval: s3.syncInterval || 30,
        compress: s3.compress ?? false,
        encrypt: s3.encrypt ?? false,
        syncPassphrase: '',
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sync-provider-selected', selectedProvider)
    }
  }, [selectedProvider])

  // Show the enabled provider's status, or fall back to selected provider
  const activeSyncStore = s3SyncStore

  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [autoStart, setAutoStart] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const { confirm: showConfirm, DialogComponent: ConfirmDialog } = useConfirm()

  useEffect(() => {
    const savedSound = localStorage.getItem('sound-enabled')
    const savedNotif = localStorage.getItem('notification-enabled')
    const savedAutoStart = localStorage.getItem('auto-start')
    if (savedSound !== null) setSoundEnabled(savedSound === 'true')
    if (savedNotif !== null) setNotificationEnabled(savedNotif === 'true')
    if (savedAutoStart !== null) setAutoStart(savedAutoStart === 'true')
    setThemeModeState(getStoredTheme())
    setIsElectron(!!window.electronAPI)
  }, [])

  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('sound-enabled', String(newValue))
  }

  const toggleNotification = () => {
    const newValue = !notificationEnabled
    setNotificationEnabled(newValue)
    localStorage.setItem('notification-enabled', String(newValue))
    if (newValue && typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission()
    }
  }

  const changeTheme = (mode: ThemeMode) => {
    setThemeModeState(mode)
    setTheme(mode)
  }

  const toggleAutoStart = async () => {
    const newValue = !autoStart
    setAutoStart(newValue)
    localStorage.setItem('auto-start', String(newValue))
    if (window.electronAPI?.setAutoStart) {
      await window.electronAPI.setAutoStart(newValue)
    }
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'done').length
  const totalFocusTime = pomodoroSessions.reduce((acc, s) => acc + s.duration, 0)
  const totalTrackedTime = timeEntries.reduce((acc, e) => acc + e.duration, 0)

  const [settingsTab, setSettingsTab] = useState('ai')

  return (
    <div className="space-y-6 view-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground mt-0.5">管理你的应用偏好</p>
      </div>

      <ViewTabs value={settingsTab} onValueChange={setSettingsTab}>
        <ViewTabsList>
          <ViewTabsTrigger value="ai"><Sparkles className="h-4 w-4" />智能</ViewTabsTrigger>
          <ViewTabsTrigger value="behavior"><Target className="h-4 w-4" />行为</ViewTabsTrigger>
          <ViewTabsTrigger value="data"><Database className="h-4 w-4" />数据</ViewTabsTrigger>
          <ViewTabsTrigger value="general"><Palette className="h-4 w-4" />外观</ViewTabsTrigger>
          <ViewTabsTrigger value="sync"><Cloud className="h-4 w-4" />同步</ViewTabsTrigger>
          <ViewTabsTrigger value="about"><Info className="h-4 w-4" />其他</ViewTabsTrigger>
        </ViewTabsList>

        <ViewTabsContent value="ai" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              AI 智能助手
            </CardTitle>
            <CardDescription>配置 OpenAI 兼容 API，用自然语言快速创建任务</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPlainStorage && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                当前运行在浏览器模式，密钥将以明文存储在本机，建议仅限 Electron 桌面端使用。
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">启用</p>
                <p className="text-xs text-muted-foreground">在仪表盘显示 AI 助手卡片</p>
              </div>
              <Switch
                checked={llmConfig.enabled}
                onCheckedChange={(v) => updateLLMConfig({ enabled: v })}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <label htmlFor="llm-api-key" className="text-sm font-medium">接口密钥（API Key）</label>
              <div className="flex gap-2">
                <Input
                  id="llm-api-key"
                  type={showLLMKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={llmConfig.apiKey}
                  onChange={(e) => updateLLMConfig({ apiKey: e.target.value })}
                  className="flex-1 h-9 font-mono text-xs"
                />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowLLMKey(!showLLMKey)} aria-label={showLLMKey ? '隐藏 API Key' : '显示 API Key'}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="llm-base-url" className="text-sm font-medium">接口地址（Base URL）</label>
              <Input
                id="llm-base-url"
                placeholder="https://api.openai.com/v1"
                value={llmConfig.baseUrl}
                onChange={(e) => updateLLMConfig({ baseUrl: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="llm-model" className="text-sm font-medium">模型（Model）</label>
              <Input
                id="llm-model"
                placeholder="gpt-4o-mini"
                value={llmConfig.model}
                onChange={(e) => updateLLMConfig({ model: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!llmConfig.enabled || !llmConfig.apiKey || llmTesting}
              onClick={handleLLMTest}
            >
              {llmTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              测试连接
            </Button>
          </CardContent>
        </Card>
        </ViewTabsContent>

        <ViewTabsContent value="behavior" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              专注目标
            </CardTitle>
            <CardDescription>设置每日和每周的专注时间目标</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">每日目标</p>
                <p className="text-xs text-muted-foreground">每天专注时长目标（分钟）</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={720}
                  value={focusGoals.dailyMinutes}
                  onChange={(e) => updateFocusGoals({ dailyMinutes: Math.max(10, parseInt(e.target.value) || 120) })}
                  className="w-20 h-8 text-center"
                />
                <span className="text-sm text-muted-foreground">分钟</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">每日番茄数</p>
                <p className="text-xs text-muted-foreground">每天完成的番茄钟数目标</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={focusGoals.dailyPomodoros}
                  onChange={(e) => updateFocusGoals({ dailyPomodoros: Math.max(1, Math.min(20, parseInt(e.target.value) || 8)) })}
                  className="w-20 h-8 text-center"
                />
                <span className="text-sm text-muted-foreground">个</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">每周目标</p>
                <p className="text-xs text-muted-foreground">每周专注时长目标（分钟）</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={60}
                  max={5040}
                  value={focusGoals.weeklyMinutes}
                  onChange={(e) => updateFocusGoals({ weeklyMinutes: Math.max(60, parseInt(e.target.value) || 600) })}
                  className="w-20 h-8 text-center"
                />
                <span className="text-sm text-muted-foreground">分钟</span>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-chart-1/8 to-chart-1/3 p-3">
              <p className="text-xs text-muted-foreground">
                💡 建议：每日专注 2-4 小时，每周 10-20 小时，保持高效节奏
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              每日回顾
            </CardTitle>
            <CardDescription>每天定时弹窗，回顾今日并整理思绪</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">启用每日回顾</p>
                <p className="text-xs text-muted-foreground">到时间自动弹窗，仅当天弹一次</p>
              </div>
              <Button
                variant={dailyReviewSettings.enabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDailyReviewSettings({ enabled: !dailyReviewSettings.enabled })}
              >
                {dailyReviewSettings.enabled ? '已开启' : '已关闭'}
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">回顾时间</p>
                <p className="text-xs text-muted-foreground">每天在这个时间弹窗，默认 21:00</p>
              </div>
              <Input
                type="time"
                value={dailyReviewSettings.reviewTime}
                onChange={(e) => updateDailyReviewSettings({ reviewTime: e.target.value })}
                className="w-28 h-8 text-center"
                disabled={!dailyReviewSettings.enabled}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">浏览器通知</p>
                <p className="text-xs text-muted-foreground">同时推送系统通知（需授权）</p>
              </div>
              <Button
                variant={dailyReviewSettings.showNotification ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDailyReviewSettings({ showNotification: !dailyReviewSettings.showNotification })}
              >
                {dailyReviewSettings.showNotification ? '已开启' : '已关闭'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">立即回顾</p>
                <p className="text-xs text-muted-foreground">手动打开今日回顾弹窗</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                     window.__openDailyReview?.()
                  }
                }}
              >
                打开回顾
              </Button>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-chart-3/8 to-chart-2/3 p-3">
              <p className="text-xs text-muted-foreground">
                💡 推荐在睡前 30 分钟回顾，有助于整理当天的收获并规划明日
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              项目管理
            </CardTitle>
            <CardDescription>管理你的项目分类和颜色</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProjectManager
              projects={projects}
              addProject={addProject}
              updateProject={updateProject}
              deleteProject={deleteProject}
              tasks={tasks}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              工作时间
            </CardTitle>
            <CardDescription>设置你的常规工作时间段，智能推荐专注时段</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">启用工作时间</p>
                <p className="text-xs text-muted-foreground">根据工作时间段推荐最佳专注时间</p>
              </div>
              <Button
                variant={workingHours.enabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateWorkingHours({ enabled: !workingHours.enabled })}
              >
                {workingHours.enabled ? '已开启' : '已关闭'}
              </Button>
            </div>
            {workingHours.enabled && (
              <div className="space-y-3 bg-muted/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs">开始时间</span>
                  </div>
                  <Input
                    type="time"
                    value={workingHours.workStartTime}
                    onChange={(e) => updateWorkingHours({ workStartTime: e.target.value })}
                    className="w-28 h-7 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs">结束时间</span>
                  </div>
                  <Input
                    type="time"
                    value={workingHours.workEndTime}
                    onChange={(e) => updateWorkingHours({ workEndTime: e.target.value })}
                    className="w-28 h-7 text-xs"
                  />
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium mb-2">工作日</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { day: 1, label: '一' },
                      { day: 2, label: '二' },
                      { day: 3, label: '三' },
                      { day: 4, label: '四' },
                      { day: 5, label: '五' },
                      { day: 6, label: '六' },
                      { day: 0, label: '日' },
                    ].map(({ day, label }) => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = workingHours.workDays.includes(day)
                            ? workingHours.workDays.filter((d) => d !== day)
                            : [...workingHours.workDays, day].sort()
                          updateWorkingHours({ workDays: days })
                        }}
                        className={cn(
                          'h-8 w-8 rounded-lg text-xs font-medium transition-all',
                          workingHours.workDays.includes(day)
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-2xs text-muted-foreground mt-2">
                    💡 设置工作时间有助于系统为你推荐最佳专注时段和智能提醒
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </ViewTabsContent>

        <ViewTabsContent value="data" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              回收站
            </CardTitle>
            <CardDescription>恢复已删除的项目（30天后自动清除）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {trashedItems.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Archive className="mx-auto h-8 w-8 opacity-30 mb-2" />
                <p className="text-sm">回收站为空</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {trashedItems.slice(0, 10).map((item) => {
                    const data = item.data as { title?: string; name?: string }
                    const typeLabels = { task: '任务', habit: '习惯', goal: '目标', anniversary: '纪念日' }
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-2xs shrink-0">
                            {typeLabels[item.type]}
                          </Badge>
                          <span className="text-sm truncate">{data.title || data.name || '未知'}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 shrink-0"
                          onClick={() => restoreFromTrash(item.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          恢复
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">共 {trashedItems.length} 项</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7"
                    onClick={async () => {
                      const confirmed = await showConfirm({
                        title: '清空回收站',
                        description: '确定要清空回收站吗？此操作不可恢复！',
                        confirmText: '确认清空',
                        cancelText: '取消',
                        variant: 'destructive',
                      })
                      if (confirmed) {
                        emptyTrash()
                      }
                    }}
                  >
                    清空回收站
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              数据概览
            </CardTitle>
            <CardDescription>当前数据存储状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-muted to-muted/50 p-3">
                <p className="text-2xl font-bold tracking-tight">{totalTasks}</p>
                <p className="text-xs text-muted-foreground mt-0.5">总任务</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-chart-2/10 to-chart-2/5 p-3">
                <p className="text-2xl font-bold tracking-tight">{completedTasks}</p>
                <p className="text-xs text-muted-foreground mt-0.5">已完成</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-chart-1/10 to-chart-1/5 p-3">
                <p className="text-2xl font-bold tracking-tight">{habits.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">习惯</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-chart-3/10 to-chart-3/5 p-3">
                <p className="text-2xl font-bold tracking-tight">{anniversaries.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">纪念日</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">专注时长</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={15}
                    max={60}
                    step={5}
                    value={pomodoroSettings.workDuration / 60}
                    onChange={(e) => updatePomodoroSettings({ workDuration: Math.max(15, Math.min(60, parseInt(e.target.value) || 25)) * 60 })}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">分钟</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">短休息时长</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={3}
                    max={15}
                    step={1}
                    value={pomodoroSettings.shortBreakDuration / 60}
                    onChange={(e) => updatePomodoroSettings({ shortBreakDuration: Math.max(3, Math.min(15, parseInt(e.target.value) || 5)) * 60 })}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">分钟</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">长休息时长</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={30}
                    step={5}
                    value={pomodoroSettings.longBreakDuration / 60}
                    onChange={(e) => updatePomodoroSettings({ longBreakDuration: Math.max(10, Math.min(30, parseInt(e.target.value) || 15)) * 60 })}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">分钟</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">长休息间隔</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={2}
                    max={6}
                    step={1}
                    value={pomodoroSettings.sessionsBeforeLongBreak}
                    onChange={(e) => updatePomodoroSettings({ sessionsBeforeLongBreak: Math.max(2, Math.min(6, parseInt(e.target.value) || 4)) })}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">个番茄钟</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">累计专注时长</span>
                <span className="font-medium">{Math.floor(totalFocusTime / 3600)} 小时</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">累计追踪时长</span>
                <span className="font-medium">{Math.floor(totalTrackedTime / 3600)} 小时</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">无操作自动暂停</span>
                  <p className="text-2xs text-muted-foreground/70">番茄钟运行中超过该时长无操作将自动暂停（0=关闭）</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={idleMinutes}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(120, parseInt(e.target.value) || 0))
                      setStateIdleMinutes(v)
                      setIdleMinutes(v)
                    }}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">分钟</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </ViewTabsContent>

        <ViewTabsContent value="general" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              外观与通知
            </CardTitle>
            <CardDescription>自定义应用外观和通知设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">主题模式</p>
                <p className="text-xs text-muted-foreground">选择应用外观主题</p>
              </div>
              <div className="flex rounded-lg border p-1 gap-1">
                {([
                  { mode: 'light' as ThemeMode, label: '浅色' },
                  { mode: 'dark' as ThemeMode, label: '深色' },
                  { mode: 'system' as ThemeMode, label: '系统' },
                ]).map(({ mode, label }) => (
                  <Button
                    key={mode}
                    variant={themeMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => changeTheme(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">语言</p>
                <p className="text-xs text-muted-foreground">选择应用显示语言</p>
              </div>
              <div className="flex rounded-lg border p-1 gap-1">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  简体中文
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs opacity-50"
                  disabled
                >
                  English
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">新手引导</p>
                <p className="text-xs text-muted-foreground">重新查看应用功能分步介绍</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.__openOnboarding?.()
                  }
                }}
              >
                查看引导
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">定时切换主题</p>
                  <p className="text-xs text-muted-foreground">根据时间自动切换浅色/深色模式</p>
                </div>
              </div>
              <Button
                variant={darkModeSchedule.enabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDarkModeSchedule({ enabled: !darkModeSchedule.enabled })}
              >
                {darkModeSchedule.enabled ? '已开启' : '已关闭'}
              </Button>
            </div>
            {darkModeSchedule.enabled && (
              <div className="ml-8 space-y-2 bg-muted/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs">浅色开始</span>
                  </div>
                  <Input
                    type="time"
                    value={darkModeSchedule.lightStart}
                    onChange={(e) => updateDarkModeSchedule({ lightStart: e.target.value })}
                    className="w-28 h-7 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs">深色开始</span>
                  </div>
                  <Input
                    type="time"
                    value={darkModeSchedule.darkStart}
                    onChange={(e) => updateDarkModeSchedule({ darkStart: e.target.value })}
                    className="w-28 h-7 text-xs"
                  />
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">声音提醒</p>
                  <p className="text-xs text-muted-foreground">完成任务时播放提示音</p>
                </div>
              </div>
              <Button
                variant={soundEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleSound}
              >
                {soundEnabled ? '已开启' : '已关闭'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">桌面通知</p>
                  <p className="text-xs text-muted-foreground">接收桌面推送通知</p>
                </div>
              </div>
              <Button
                variant={notificationEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleNotification}
              >
                {notificationEnabled ? '已开启' : '已关闭'}
              </Button>
            </div>
            {isElectron && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">开机自启</p>
                    <p className="text-xs text-muted-foreground">系统启动时自动运行</p>
                  </div>
                </div>
                <Button
                  variant={autoStart ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleAutoStart}
                >
                  {autoStart ? '已开启' : '已关闭'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              快捷键
            </CardTitle>
            <CardDescription>使用快捷键提高效率</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SHORTCUT_LIST.map((shortcut, index) => (
                <div key={shortcut.description} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <GlobalShortcutsCard />
        </ViewTabsContent>

        <ViewTabsContent value="sync" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              云同步
              <Badge variant={activeSyncStore.isEnabled ? 'default' : 'outline'} className="ml-auto text-2xs">
                {activeSyncStore.isEnabled ? '已启用' : '未启用'}
              </Badge>
            </CardTitle>
            <CardDescription>选择服务并配置你的同步方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 顶部状态条：始终显示当前 provider 状态 */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">当前服务：</span>
                  <Badge variant="secondary" className="text-2xs">
                    {selectedProvider === 'none' && '未配置'}
                    {selectedProvider === 's3' && 'S3'}
                  </Badge>
                </div>
                {activeSyncStore.isEnabled && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">状态：</span>
                      {activeSyncStore.status === 'syncing' && <Loader2 className="h-3 w-3 animate-spin text-chart-1" />}
                      {activeSyncStore.status === 'synced' && <CheckCircle2 className="h-3 w-3 text-chart-2" />}
                      {activeSyncStore.status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
                      {activeSyncStore.status === 'offline' && <CloudOff className="h-3 w-3 text-muted-foreground" />}
                      <span>
                        {activeSyncStore.status === 'idle' && '空闲'}
                        {activeSyncStore.status === 'syncing' && '同步中'}
                        {activeSyncStore.status === 'synced' && '已同步'}
                        {activeSyncStore.status === 'error' && '出错'}
                        {activeSyncStore.status === 'offline' && '离线'}
                      </span>
                    </div>
                    {activeSyncStore.lastSyncAt && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">上次同步：</span>
                        <span>
                          {activeSyncStore.lastSyncAt instanceof Date
                            ? activeSyncStore.lastSyncAt.toLocaleString('zh-CN')
                            : new Date(activeSyncStore.lastSyncAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="ml-auto">
                  {activeSyncStore.isEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={async () => {
                        await activeSyncStore.logout()
                        toast.success('已停用云同步')
                      }}
                    >
                      <Power className="h-3 w-3" />
                      停用
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => activeSyncStore.setSyncEnabled(true)}
                      disabled={
                        (selectedProvider === 's3' && !getIsS3Configured()) ||
                        selectedProvider === 'none'
                      }
                    >
                      <Power className="h-3 w-3" />
                      启用
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {activeSyncStore.conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-600">
                      {activeSyncStore.conflicts.length} 个同步冲突待解决
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => activeSyncStore.clearConflicts()}
                  >
                    全部忽略
                  </Button>
                </div>
                <div className="space-y-2">
                  {activeSyncStore.conflicts.map((conflict) => (
                    <div key={conflict.id} className="rounded-lg border border-border/50 bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{conflict.name}</p>
                          <p className="text-2xs text-muted-foreground mt-0.5">
                            {conflict.type} · {conflict.localUpdatedAt ? `本地 ${new Date(conflict.localUpdatedAt).toLocaleString('zh-CN')}` : '本地无时间'} ·
                            {conflict.remoteUpdatedAt ? ` 远端 ${new Date(conflict.remoteUpdatedAt).toLocaleString('zh-CN')}` : ' 远端无时间'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              activeSyncStore.resolveConflictItem(conflict.id)
                              toast.success(`「${conflict.name}」已保留本地版本`)
                            }}
                          >
                            保留本地
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              activeSyncStore.resolveConflictItem(conflict.id)
                              toast.success(`「${conflict.name}」已保留远端版本`)
                            }}
                          >
                            保留远端
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 提供方选择器：2 列分段控件 */}
            <div>
              <p className="text-sm font-medium mb-2">服务提供商</p>
              <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-muted/20 p-1">
                {[
                  { key: 'none' as const, label: '未配置', Icon: Power },
                  { key: 's3' as const, label: 'S3', Icon: HardDrive },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={selectedProvider === key}
                    onClick={() => setSelectedProvider(key)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                      selectedProvider === key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* === 概览页：未配置 === */}
            {selectedProvider === 'none' && (
              <div className="grid gap-3">
                <div className="rounded-xl border border-border/50 p-4 space-y-2 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <HardDrive className="h-4 w-4 text-sky-500" />
                    </div>
                    <p className="text-sm font-semibold">S3</p>
                  </div>
                  <p className="text-2xs text-muted-foreground leading-relaxed">
                    S3 兼容存储（阿里云 OSS / MinIO / AWS），AccessKey 认证，定时轮询
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-2xs">S3兼容</Badge>
                    <Badge variant="secondary" className="text-2xs">AccessKey</Badge>
                    <Badge variant="secondary" className="text-2xs">轮询</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1" onClick={() => setSelectedProvider('s3')}>
                    配置 S3
                  </Button>
                </div>
              </div>
            )}

            {/* === S3 === */}
            {selectedProvider === 's3' && (
              <div className="space-y-4">
                {isPlainStorage && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    当前运行在浏览器模式，密钥将以明文存储在本机，建议仅限 Electron 桌面端使用。
                  </div>
                )}
                {!getIsS3Configured() && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">S3 未配置</p>
                    <p className="text-2xs text-muted-foreground mt-1">请填写下方 S3 配置信息后保存</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowS3Config(!showS3Config)}
                >
                  <Settings className="h-3.5 w-3.5" />
                  {showS3Config ? '收起配置' : (getIsS3Configured() ? '修改 S3 配置' : '填写 S3 配置')}
                </Button>

                {showS3Config && (
                  <div className="space-y-3 rounded-xl border border-border/50 p-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">预设服务</label>
                      <select
                        value={s3ConfigForm.endpoint}
                        onChange={(e) => {
                          const preset = S3_PRESET_SERVICES.find((p) => p.endpoint === e.target.value)
                          setS3ConfigForm((p) => ({
                            ...p,
                            endpoint: e.target.value,
                            region: preset?.region || p.region,
                            forcePathStyle: preset?.forcePathStyle ?? p.forcePathStyle,
                          }))
                        }}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {S3_PRESET_SERVICES.map((preset) => (
                          <option key={preset.name} value={preset.endpoint}>
                            {preset.name}（{preset.description}）
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="s3-endpoint" className="text-xs font-medium">接口地址（Endpoint）*</label>
                      <Input
                        id="s3-endpoint"
                        type="text"
                        placeholder="https://s3.amazonaws.com"
                        value={s3ConfigForm.endpoint}
                        onChange={(e) => setS3ConfigForm((p) => ({ ...p, endpoint: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label htmlFor="s3-region" className="text-xs font-medium">区域（Region）*</label>
                        <Input
                          id="s3-region"
                          type="text"
                          placeholder="us-east-1"
                          value={s3ConfigForm.region}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, region: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="s3-bucket" className="text-xs font-medium">存储桶（Bucket）*</label>
                        <Input
                          id="s3-bucket"
                          type="text"
                          placeholder="my-bucket"
                          value={s3ConfigForm.bucket}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, bucket: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="s3-access-key-id" className="text-xs font-medium">访问密钥 ID（AccessKey ID）*</label>
                      <Input
                        id="s3-access-key-id"
                        type="text"
                        placeholder="LTAI5t..."
                        value={s3ConfigForm.accessKeyId}
                        onChange={(e) => setS3ConfigForm((p) => ({ ...p, accessKeyId: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="s3-secret-key" className="text-xs font-medium">密钥（Secret Access Key）*</label>
                      <div className="relative">
                        <Input
                          id="s3-secret-key"
                          type={showS3Secret ? 'text' : 'password'}
                          placeholder="••••••"
                          value={s3ConfigForm.secretAccessKey}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, secretAccessKey: e.target.value }))}
                          className="h-8 text-xs pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowS3Secret(!showS3Secret)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showS3Secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">远端对象 Key</label>
                        <Input
                          type="text"
                          placeholder="focusflow-sync.json"
                          value={s3ConfigForm.remoteKey || 'focusflow-sync.json'}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, remoteKey: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">同步间隔（秒）</label>
                        <Input
                          type="number"
                          min={0}
                          max={3600}
                          placeholder="30"
                          value={s3ConfigForm.syncInterval ?? 30}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, syncInterval: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="h-8 text-xs"
                        />
                        <p className="text-2xs text-muted-foreground">0 = 仅手动</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">Path Style 访问</label>
                      <Switch
                        checked={s3ConfigForm.forcePathStyle ?? true}
                        onCheckedChange={(checked) => setS3ConfigForm((p) => ({ ...p, forcePathStyle: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-medium">传输压缩（gzip）</label>
                        <p className="text-2xs text-muted-foreground">减小同步体积，旧版本客户端可能无法读取</p>
                      </div>
                      <Switch
                        checked={s3ConfigForm.compress ?? false}
                        onCheckedChange={(checked) => setS3ConfigForm((p) => ({ ...p, compress: checked }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-medium">端到端加密（AES-256-GCM）</label>
                          <p className="text-2xs text-muted-foreground">口令仅存本机，云服务商无法读取内容；丢失口令无法恢复云端数据</p>
                        </div>
                        <Switch
                          checked={s3ConfigForm.encrypt ?? false}
                          onCheckedChange={(checked) => setS3ConfigForm((p) => ({ ...p, encrypt: checked }))}
                        />
                      </div>
                      {s3ConfigForm.encrypt && (
                        <div className="relative">
                          <Input
                            type={showS3Passphrase ? 'text' : 'password'}
                            placeholder={hasSyncPassphrase() ? '已保存口令（留空保持不变，输入则覆盖）' : '设置同步口令'}
                            value={s3ConfigForm.syncPassphrase || ''}
                            onChange={(e) => setS3ConfigForm((p) => ({ ...p, syncPassphrase: e.target.value }))}
                            className="h-8 text-xs pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowS3Passphrase(!showS3Passphrase)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showS3Passphrase ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={!s3ConfigForm.endpoint || !s3ConfigForm.bucket || !s3ConfigForm.accessKeyId || s3SyncStore.status === 'syncing'}
                        onClick={async () => {
                          setS3TestResult(null)
                          const result = await s3SyncStore.testConnection(s3ConfigForm)
                          setS3TestResult(result)
                          if (result.success) {
                            toast.success(result.message)
                          } else {
                            toast.error(result.message)
                          }
                        }}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', s3SyncStore.status === 'syncing' && 'animate-spin')} />
                        测试连接
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={!s3ConfigForm.endpoint || !s3ConfigForm.bucket || !s3ConfigForm.accessKeyId || s3SyncStore.status === 'syncing'}
                        onClick={async () => {
                          setS3TestResult(null)
                          const ok = await s3SyncStore.saveConfig(s3ConfigForm)
                          if (ok) {
                            toast.success('S3 配置已保存')
                            setShowS3Config(false)
                          } else {
                            toast.error('保存失败，请检查配置')
                          }
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        保存配置
                      </Button>
                    </div>

                    {s3TestResult && (
                      <div className={cn(
                        'rounded-lg p-2.5 text-xs',
                        s3TestResult.success ? 'bg-chart-2/10 text-chart-2' : 'bg-destructive/10 text-destructive'
                      )}>
                        {s3TestResult.message}
                      </div>
                    )}

                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 text-2xs text-amber-600 dark:text-amber-400">
                      ⚠ AccessKey Secret 已通过操作系统安全存储加密（Electron 桌面端），浏览器端建议使用 RAM 子账号 + 最小权限以提升安全性
                    </div>
                  </div>
                )}

                {getIsS3Configured() && (
                  <>
                    <Separator />

                    {s3SyncStore.accessKeyId && (
                      <div className="flex items-center justify-between rounded-xl bg-sky-500/5 border border-sky-500/20 p-3">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-sky-500" />
                          <div>
                            <p className="text-sm font-medium">{s3SyncStore.accessKeyId}</p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const cfg = getS3Config()
                                return cfg ? `${cfg.bucket} · ${cfg.endpoint}` : ''
                              })()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default" className="text-2xs">S3</Badge>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {s3SyncStore.status === 'syncing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {s3SyncStore.status === 'synced' && <CheckCircle2 className="h-3.5 w-3.5 text-chart-2" />}
                      {s3SyncStore.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                      <span className="text-xs text-muted-foreground">
                        {s3SyncStore.status === 'syncing' && '同步中...'}
                        {s3SyncStore.status === 'synced' && '已同步'}
                        {s3SyncStore.status === 'error' && s3SyncStore.error}
                        {s3SyncStore.status === 'idle' && (s3SyncStore.userId ? `用户：${s3SyncStore.userId.slice(0, 8)}...` : '启用后开始同步')}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={async () => {
                          try {
                            await s3SyncStore.forceSync()
                            toast.success('数据已推送到 S3')
                          } catch {
                            toast.error('推送失败')
                          }
                        }}
                        disabled={s3SyncStore.status === 'syncing' || !s3SyncStore.isEnabled}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        推送
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={async () => {
                          try {
                            const cloudData = await pullDataFromS3()
                            if (cloudData) {
                              const store = useAppStore.getState()
                              const localData: Record<string, unknown> = {}
                              SYNC_DATA_KEYS.forEach((k) => { if ((store as any)[k] !== undefined) localData[k] = (store as any)[k] })
                              const merged = await resolveS3Conflict(localData)
                              const mergedKeys = Object.keys(merged)
                              mergedKeys.forEach((k) => {
                                if (typeof (useAppStore.getState() as any)[k] !== 'function') {
                                  (useAppStore.setState as any)({ [k]: merged[k] })
                                }
                              })
                              toast.success('已从 S3 拉取并合并数据')
                            } else {
                              toast.info('S3 暂无数据')
                            }
                          } catch {
                            toast.error('拉取失败')
                          }
                        }}
                        disabled={s3SyncStore.status === 'syncing' || !s3SyncStore.isEnabled}
                      >
                        <Download className="h-3.5 w-3.5" />
                        拉取
                      </Button>
                    </div>

                    <div className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-medium">使用说明</p>
                      <p className="text-2xs text-muted-foreground leading-relaxed">
                        • S3 同步依赖 AccessKey，请妥善保管<br />
                        • 首次推送会自动创建远端对象；支持手动推送/拉取<br />
                        • 定时轮询自动同步，也可手动推送/拉取
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              数据管理
            </CardTitle>
            <CardDescription>导出和管理你的数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">导出数据</p>
                <p className="text-xs text-muted-foreground">导出为 JSON、CSV 或 Markdown</p>
              </div>
              <DataExport />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">导入数据</p>
                <p className="text-xs text-muted-foreground">从 JSON 文件导入数据（追加模式）</p>
              </div>
              <DataImport />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">导出任务 CSV</p>
                <p className="text-xs text-muted-foreground">任务列表导出为 CSV，可用 Excel 打开</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  downloadCSV(`focusflow-tasks-${new Date().toISOString().slice(0, 10)}.csv`, tasksToCSV(tasks))
                  toast.success('任务 CSV 已导出')
                }}
              >
                <Download className="h-3.5 w-3.5" />
                导出 CSV
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">导入任务 CSV</p>
                <p className="text-xs text-muted-foreground">批量导入任务（追加模式），兼容 Todoist / TickTick 导出列名</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    downloadImportTemplate()
                    toast.success('导入模板已下载')
                  }}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  下载模板
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      const content = await file.text()
                      const count = importTasksFromCSV(content, (task) => useAppStore.getState().addTask(task))
                      if (count > 0) toast.success(`已导入 ${count} 个任务`)
                      else toast.error('未解析到有效任务行，请参考「下载模板」整理表头')
                    }}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    导入 CSV
                  </Button>
                </label>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">备份管理</p>
                <p className="text-xs text-muted-foreground">创建和恢复本地备份</p>
              </div>
              <DataBackup />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">导出日历</p>
                  <p className="text-xs text-muted-foreground">导出为 ICS 格式，可导入 Google Calendar、Outlook 等</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  const icsContent = generateICS(tasks, anniversaries)
                  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
                  if (api?.saveTextFile) {
                    const res = await api.saveTextFile({
                      content: icsContent,
                      fileName: 'focusflow-calendar',
                      extension: 'ics',
                    })
                    if (res.success) toast.success(`已发布日历文件：${res.filePath}`)
                    else if (!res.canceled) toast.error(res.message || '导出失败')
                  } else {
                    downloadICS(icsContent)
                  }
                }}
              >
                <Download className="h-3.5 w-3.5" />
                导出 ICS
              </Button>
            </div>
          </CardContent>
        </Card>
        </ViewTabsContent>

        <ViewTabsContent value="about" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            关于
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">FocusFlow</p>
              <p className="text-sm text-muted-foreground">版本 {appVersion}</p>
            </div>
            <div className="flex items-center gap-2">
              {isElectronApp && (
                <Button variant="outline" size="sm" onClick={() => void checkForUpdateFlow()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  检查更新
                </Button>
              )}
              <Badge variant="secondary">Next.js 16</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <PrivacyLock />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            危险操作
          </CardTitle>
          <CardDescription>以下操作不可恢复，请谨慎操作</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">清除所有数据</p>
              <p className="text-xs text-muted-foreground">删除所有任务、时间记录和设置数据</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const confirmed = await showConfirm({
                  title: '⚠️ 危险操作',
                  description: '确定要清除所有数据吗？此操作将删除所有任务、时间记录和设置数据，且不可恢复！',
                  confirmText: '确认清除',
                  cancelText: '取消',
                  variant: 'destructive',
                })
                if (confirmed) {
                  // 标记已清除，防止 demo 数据复活并覆盖云端备份
                  try {
                    localStorage.setItem('focusflow-data-cleared', 'true')
                  } catch {
                    // 忽略写入失败
                  }
                  // 清理应用相关的全部本地键（含密封凭据、主题、同步配置等）
                  const keysToRemove: string[] = []
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (key && (key === 'productivity-app-storage' || key.startsWith('focusflow-'))) {
                      keysToRemove.push(key)
                    }
                  }
                  keysToRemove.forEach((k) => localStorage.removeItem(k))
                  window.location.reload()
                }
              }}
            >
              清除数据
            </Button>
          </div>
        </CardContent>
      </Card>
        </ViewTabsContent>
      </ViewTabs>
      
      {ConfirmDialog}
    </div>
  )
}
