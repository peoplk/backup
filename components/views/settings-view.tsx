'use client'

import { useAppStore } from '@/lib/store'
import { useSyncStore, pullDataFromCloud, resolveConflict } from '@/lib/sync-store'
import { useS3SyncStore, pushDataToS3, pullDataFromS3, resolveS3Conflict } from '@/lib/s3-store'
import { getIsFirebaseConfigured, getFirebaseConfig } from '@/lib/firebase'
import type { FirebaseConfigInput } from '@/lib/firebase'
import { getIsS3Configured, getS3Config, saveS3Config, S3_PRESET_SERVICES, type S3ConfigInput } from '@/lib/s3-sync'
import { CalendarBridge, isNativePlatform } from '@/lib/calendar-bridge'
import type { CalendarInfo } from '@/lib/calendar-bridge'
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
import { generateICS, downloadICS } from '@/lib/ics-export'
import {
  Database,
  Palette,
  Trash2,
  Keyboard,
  Download,
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
  Smartphone,
  CalendarDays,
  Flame,
  HardDrive,
  Power,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { getStoredTheme, setTheme, type ThemeMode } from '@/lib/theme'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

const PROJECT_COLORS = [
  '#4A90E2', '#7ED321', '#F5A623', '#9B59B6', '#E91E63',
  '#00CED1', '#FF5722', '#607D8B', '#8BC34A', '#FF9800',
  '#3F51B5', '#E4075E', '#009688', '#795548', '#CDDC39',
]

const SYNC_DATA_KEYS = [
  'tasks', 'habits', 'habitCheckIns', 'timeEntries', 'pomodoroSessions',
  'projects', 'anniversaries', 'goals', 'tags', 'reminders',
  'journals', 'focusGoals', 'dailyReviewSettings',
] as const

function ProjectManager({ projects, addProject, updateProject, deleteProject, tasks }: {
  projects: { id: string; name: string; color: string; totalTime: number }[]
  addProject: (p: { name: string; color: string }) => void
  updateProject: (id: string, updates: { name?: string; color?: string }) => void
  deleteProject: (id: string) => void
  tasks: { project?: string; status: string }[]
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const handleAdd = () => {
    if (!newName.trim()) return
    addProject({ name: newName.trim(), color: newColor })
    setNewName('')
    setNewColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)])
    toast.success('项目已创建')
  }

  const handleStartEdit = (id: string, name: string, color: string) => {
    setEditingId(id)
    setEditName(name)
    setEditColor(color)
  }

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateProject(editingId, { name: editName.trim(), color: editColor })
    setEditingId(null)
    toast.success('项目已更新')
  }

  const handleDelete = (id: string, name: string) => {
    const taskCount = tasks.filter(t => t.project === name).length
    if (taskCount > 0) {
      toast.error(`该项目下有 ${taskCount} 个任务，请先移动或删除任务`)
      return
    }
    deleteProject(id)
    toast.success('项目已删除')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="新项目名称..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 h-9"
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
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 text-chart-2" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
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
                      onClick={() => handleStartEdit(project.id, project.name, project.color)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(project.id, project.name)}
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
  
  const syncStore = useSyncStore()
  const s3SyncStore = useS3SyncStore()
  const [firebaseConfigForm, setFirebaseConfigForm] = useState<FirebaseConfigInput>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  })
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // 统一的云同步面板状态
  const [selectedProvider, setSelectedProvider] = useState<'none' | 'firebase' | 's3'>(() => {
    if (typeof window === 'undefined') return 'none'
    return (localStorage.getItem('sync-provider-selected') as 'none' | 'firebase' | 's3') || 'none'
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
  })
  const [showS3Config, setShowS3Config] = useState(false)
  const [showS3Secret, setShowS3Secret] = useState(false)
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    const config = getFirebaseConfig()
    if (config) {
      setFirebaseConfigForm(config)
    }
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
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sync-provider-selected', selectedProvider)
    }
  }, [selectedProvider])

  // Show the enabled provider's status, or fall back to selected provider
  const activeSyncStore = s3SyncStore.isEnabled
    ? s3SyncStore
    : syncStore.isEnabled
      ? syncStore
      : selectedProvider === 's3'
        ? s3SyncStore
        : syncStore

  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [autoStart, setAutoStart] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [calendarPermission, setCalendarPermission] = useState(false)
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null)
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false)
  const { confirm: showConfirm, DialogComponent: ConfirmDialog } = useConfirm()

  useEffect(() => {
    const savedSound = localStorage.getItem('sound-enabled')
    const savedNotif = localStorage.getItem('notification-enabled')
    const savedAutoStart = localStorage.getItem('auto-start')
    const savedCalendarSync = localStorage.getItem('calendar-sync-enabled')
    const savedCalendarId = localStorage.getItem('calendar-sync-id')
    if (savedSound !== null) setSoundEnabled(savedSound === 'true')
    if (savedNotif !== null) setNotificationEnabled(savedNotif === 'true')
    if (savedAutoStart !== null) setAutoStart(savedAutoStart === 'true')
    if (savedCalendarSync !== null) setCalendarSyncEnabled(savedCalendarSync === 'true')
    if (savedCalendarId !== null) setSelectedCalendarId(Number(savedCalendarId))
    setThemeModeState(getStoredTheme())
    setIsElectron(!!window.electronAPI)
    setIsNative(isNativePlatform())

    if (isNativePlatform()) {
      CalendarBridge.checkPermission().then(res => {
        setCalendarPermission(res.granted)
        if (res.granted) {
          CalendarBridge.getCalendars().then(data => {
            setCalendars(data.calendars)
          })
        }
      })
    }
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

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground mt-0.5">管理你的应用偏好</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                    ;(window as any).__openDailyReview?.()
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
                  <p className="text-[11px] text-muted-foreground mt-2">
                    💡 设置工作时间有助于系统为你推荐最佳专注时段和智能提醒
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                          <Badge variant="outline" className="text-[10px] shrink-0">
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
            </div>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              云同步
              <Badge variant={activeSyncStore.isEnabled ? 'default' : 'outline'} className="ml-auto text-[10px]">
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
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedProvider === 'none' && '未配置'}
                    {selectedProvider === 'firebase' && 'Firebase'}
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
                        (selectedProvider === 'firebase' && !getIsFirebaseConfigured()) ||
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

            {/* 提供方选择器：3 列分段控件 */}
            <div>
              <p className="text-sm font-medium mb-2">服务提供商</p>
              <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/20 p-1">
                {[
                  { key: 'none' as const, label: '未配置', Icon: Power },
                  { key: 'firebase' as const, label: 'Firebase', Icon: Flame },
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 p-4 space-y-2 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                    <p className="text-sm font-semibold">Firebase</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Google 旗下，匿名或 Google 账号登录，实时推送
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">Google账号</Badge>
                    <Badge variant="secondary" className="text-[10px]">实时</Badge>
                    <Badge variant="secondary" className="text-[10px]">适合个人</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1" onClick={() => setSelectedProvider('firebase')}>
                    配置 Firebase
                  </Button>
                </div>

                <div className="rounded-xl border border-border/50 p-4 space-y-2 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <HardDrive className="h-4 w-4 text-sky-500" />
                    </div>
                    <p className="text-sm font-semibold">S3</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    S3 兼容存储（阿里云 OSS / MinIO / AWS），AccessKey 认证，定时轮询
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">S3兼容</Badge>
                    <Badge variant="secondary" className="text-[10px]">AccessKey</Badge>
                    <Badge variant="secondary" className="text-[10px]">轮询</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1" onClick={() => setSelectedProvider('s3')}>
                    配置 S3
                  </Button>
                </div>
              </div>
            )}

            {/* === Firebase === */}
            {selectedProvider === 'firebase' && (
              <div className="space-y-4">
                {!getIsFirebaseConfigured() && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Firebase 未配置</p>
                    <p className="text-[11px] text-muted-foreground mt-1">请填写下方 Firebase 配置信息后保存</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowFirebaseConfig(!showFirebaseConfig)}
                >
                  <Settings className="h-3.5 w-3.5" />
                  {showFirebaseConfig ? '收起配置' : (getIsFirebaseConfigured() ? '修改 Firebase 配置' : '填写 Firebase 配置')}
                </Button>

                {showFirebaseConfig && (
                  <div className="space-y-3 rounded-xl border border-border/50 p-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">API Key *</label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="AIzaSy..."
                          value={firebaseConfigForm.apiKey}
                          onChange={(e) => setFirebaseConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                          className="h-8 text-xs pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Auth Domain *</label>
                      <Input
                        placeholder="your-project.firebaseapp.com"
                        value={firebaseConfigForm.authDomain}
                        onChange={(e) => setFirebaseConfigForm(prev => ({ ...prev, authDomain: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Project ID *</label>
                      <Input
                        placeholder="your-project-id"
                        value={firebaseConfigForm.projectId}
                        onChange={(e) => setFirebaseConfigForm(prev => ({ ...prev, projectId: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Storage Bucket</label>
                      <Input
                        placeholder="your-project.appspot.com"
                        value={firebaseConfigForm.storageBucket}
                        onChange={(e) => setFirebaseConfigForm(prev => ({ ...prev, storageBucket: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Messaging Sender ID</label>
                      <Input
                        placeholder="123456789"
                        value={firebaseConfigForm.messagingSenderId}
                        onChange={(e) => setFirebaseConfigForm(prev => ({ ...prev, messagingSenderId: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">App ID</label>
                      <Input
                        placeholder="1:123...:web:abc..."
                        value={firebaseConfigForm.appId}
                        onChange={(e) => setFirebaseConfigForm(prev => ({ ...prev, appId: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={async () => {
                        if (!firebaseConfigForm.apiKey || !firebaseConfigForm.authDomain || !firebaseConfigForm.projectId) {
                          toast.error('请填写 API Key、Auth Domain 和 Project ID')
                          return
                        }
                        const success = await syncStore.saveConfig(firebaseConfigForm)
                        if (success) {
                          toast.success('配置已保存，Firebase 已初始化')
                          setShowFirebaseConfig(false)
                        } else {
                          toast.error('配置保存失败，请检查输入')
                        }
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      保存配置
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      💡 配置信息来自 Firebase 控制台 → 项目设置 → 常规 → 您的应用 → SDK 设置和配置
                    </p>
                  </div>
                )}

                {getIsFirebaseConfigured() && (
                  <>
                    <Separator />

                    {syncStore.authProvider === 'google' && syncStore.userName && (
                      <div className="flex items-center justify-between rounded-xl bg-chart-1/8 p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-chart-1/20 flex items-center justify-center text-xs font-bold text-chart-1">
                            {syncStore.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{syncStore.userName}</p>
                            <p className="text-xs text-muted-foreground">{syncStore.userEmail}</p>
                          </div>
                        </div>
                        <Badge variant="default" className="text-[10px] gap-1">
                          <svg className="h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                          Google
                        </Badge>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={async () => {
                          try {
                            await syncStore.forceSync()
                            toast.success('数据已推送到云端')
                          } catch {
                            toast.error('推送失败')
                          }
                        }}
                        disabled={syncStore.status === 'syncing' || !syncStore.isEnabled}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', syncStore.status === 'syncing' && 'animate-spin')} />
                        推送数据
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={async () => {
                          try {
                            const cloudData = await pullDataFromCloud()
                            if (cloudData) {
                              const store = useAppStore.getState()
                              const localData: Record<string, unknown> = {}
                              SYNC_DATA_KEYS.forEach(key => {
                                if ((store as any)[key] !== undefined) localData[key] = (store as any)[key]
                              })
                              const merged = await resolveConflict(localData)
                              const keys = Object.keys(merged) as string[]
                              keys.forEach(key => {
                                if (typeof (useAppStore.getState() as any)[key] !== 'function') {
                                  (useAppStore.setState as any)({ [key]: merged[key] })
                                }
                              })
                              toast.success('已从云端拉取并合并数据')
                            } else {
                              toast.info('云端暂无数据')
                            }
                          } catch {
                            toast.error('拉取失败')
                          }
                        }}
                        disabled={syncStore.status === 'syncing' || !syncStore.isEnabled}
                      >
                        <Download className="h-3.5 w-3.5" />
                        拉取数据
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-sm font-medium">同步方式</p>
                      {syncStore.authProvider === 'google' ? (
                        <div className="flex items-center justify-between rounded-xl border border-chart-1/20 bg-chart-1/5 p-3">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            <span className="text-sm">Google 账号同步</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7 text-xs"
                            onClick={async () => {
                              await syncStore.logout()
                              toast.success('已退出登录')
                            }}
                          >
                            退出登录
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />
                              <span className="text-sm text-muted-foreground">匿名同步</span>
                            </div>
                            <Badge variant="outline" className="text-[10px]">当前</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={async () => {
                              try {
                                await syncStore.loginWithGoogle()
                                toast.success('Google 登录成功')
                              } catch {
                                toast.error('Google 登录失败')
                              }
                            }}
                            disabled={syncStore.status === 'syncing'}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            切换为 Google 账号同步
                          </Button>
                          <p className="text-[11px] text-muted-foreground/70">
                            💡 使用 Google 账号可在不同设备间同步数据，匿名同步仅限当前设备
                          </p>
                        </>
                      )}
                    </div>

                    {syncStore.userId && syncStore.authProvider !== 'google' && (
                      <div className="rounded-xl bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          用户 ID：{syncStore.userId.slice(0, 8)}...
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          数据通过匿名认证存储，更换设备时需使用同一账号
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* === S3 === */}
            {selectedProvider === 's3' && (
              <div className="space-y-4">
                {!getIsS3Configured() && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">S3 未配置</p>
                    <p className="text-[11px] text-muted-foreground mt-1">请填写下方 S3 配置信息后保存</p>
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
                      <label className="text-xs font-medium">Endpoint *</label>
                      <Input
                        type="text"
                        placeholder="https://s3.amazonaws.com"
                        value={s3ConfigForm.endpoint}
                        onChange={(e) => setS3ConfigForm((p) => ({ ...p, endpoint: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Region *</label>
                        <Input
                          type="text"
                          placeholder="us-east-1"
                          value={s3ConfigForm.region}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, region: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Bucket *</label>
                        <Input
                          type="text"
                          placeholder="my-bucket"
                          value={s3ConfigForm.bucket}
                          onChange={(e) => setS3ConfigForm((p) => ({ ...p, bucket: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">AccessKey ID *</label>
                      <Input
                        type="text"
                        placeholder="LTAI5t..."
                        value={s3ConfigForm.accessKeyId}
                        onChange={(e) => setS3ConfigForm((p) => ({ ...p, accessKeyId: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">Secret Access Key *</label>
                      <div className="relative">
                        <Input
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
                        <p className="text-[10px] text-muted-foreground">0 = 仅手动</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">Path Style 访问</label>
                      <Switch
                        checked={s3ConfigForm.forcePathStyle ?? true}
                        onCheckedChange={(checked) => setS3ConfigForm((p) => ({ ...p, forcePathStyle: checked }))}
                      />
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

                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
                      ⚠ Secret Access Key 明文存储在本地，建议使用 RAM 子账号 + 只读权限以提升安全性
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
                        <Badge variant="default" className="text-[10px]">S3</Badge>
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
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        • S3 同步依赖 AccessKey，请妥善保管<br />
                        • 首次推送会自动创建远端对象；支持手动推送/拉取<br />
                        • 与 Firebase 互不影响，可任选其一或同时使用
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
                onClick={() => {
                  const icsContent = generateICS(tasks, anniversaries)
                  downloadICS(icsContent)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                导出 ICS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isNative && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Android 日历同步
            </CardTitle>
            <CardDescription>将任务同步到手机系统日历</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-chart-2" />
                <div>
                  <p className="text-sm font-medium">启用日历同步</p>
                  <p className="text-xs text-muted-foreground">将任务自动写入系统日历</p>
                </div>
              </div>
              <Switch
                checked={calendarSyncEnabled}
                onCheckedChange={async (checked) => {
                  if (checked && !calendarPermission) {
                    const res = await CalendarBridge.requestPermission()
                    if (res.granted) {
                      setCalendarPermission(true)
                      const data = await CalendarBridge.getCalendars()
                      setCalendars(data.calendars)
                      setCalendarSyncEnabled(true)
                      localStorage.setItem('calendar-sync-enabled', 'true')
                      toast.success('日历权限已获取')
                    } else {
                      toast.error('需要日历权限才能同步')
                      return
                    }
                  } else {
                    setCalendarSyncEnabled(checked)
                    localStorage.setItem('calendar-sync-enabled', String(checked))
                    if (checked) toast.success('日历同步已启用')
                    else toast.info('日历同步已关闭')
                  }
                }}
              />
            </div>

            {calendarSyncEnabled && calendarPermission && (
              <>
                <Separator />
                <div className="space-y-2">
                  <label className="text-xs font-medium">选择同步日历</label>
                  {calendars.length === 0 ? (
                    <p className="text-xs text-muted-foreground">未找到系统日历</p>
                  ) : (
                    <div className="space-y-1.5">
                      {calendars.map(cal => (
                        <button
                          key={cal.id}
                          onClick={() => {
                            setSelectedCalendarId(cal.id)
                            localStorage.setItem('calendar-sync-id', String(cal.id))
                            toast.success(`已选择：${cal.name}`)
                          }}
                          className={cn(
                            "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all",
                            selectedCalendarId === cal.id
                              ? "border-chart-2 bg-chart-2/5"
                              : "border-border/40 hover:border-primary/20 hover:bg-muted/30"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium">{cal.name}</p>
                            <p className="text-[11px] text-muted-foreground">{cal.account}</p>
                          </div>
                          {selectedCalendarId === cal.id && (
                            <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    💡 启用后，新建的任务将自动同步到所选日历。已有任务不会自动回溯同步。
                  </p>
                </div>
              </>
            )}

            {!calendarPermission && isNative && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  需要日历权限
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  点击上方开关申请权限，以便读写系统日历
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <p className="text-sm text-muted-foreground">版本 1.0.0</p>
            </div>
            <Badge variant="secondary">Next.js 16</Badge>
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
                  localStorage.removeItem('productivity-app-storage')
                  window.location.reload()
                }
              }}
            >
              清除数据
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {ConfirmDialog}
    </div>
  )
}
