'use client'

import { useState, useEffect, useRef } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { DashboardView } from '@/components/views/dashboard-view'
import { TasksView } from '@/components/views/tasks-view'
import { FocusView } from '@/components/views/focus-view'
import { AnalyticsView } from '@/components/views/analytics-view'
import { HabitsView } from '@/components/views/habits-view'
import { AnniversariesView } from '@/components/views/anniversaries-view'
import { SettingsView } from '@/components/views/settings-view'
import { GoalsView } from '@/components/views/goals-view'
import { CalendarView } from '@/components/views/calendar-view'
import { TimeBlockView } from '@/components/views/time-block-view'
import { GlobalSearch } from '@/components/global-search'
import { NotificationBell } from '@/components/notification-bell'
import { SyncStatusIndicator } from '@/components/sync-status-indicator'
import { useModKeyLabels } from '@/lib/platform'
import { useOnboardingComplete } from '@/lib/onboarding'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { MiniTimer } from '@/components/mini-timer'
import { QuickCapture } from '@/components/quick-capture'
import { LevelUpModal } from '@/components/level-up-modal'
import { PrivacyLockOverlay } from '@/components/privacy-lock-overlay'
import { DailyReviewTrigger } from '@/lib/hooks/use-daily-review-trigger'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { useAutoNotifications } from '@/lib/use-auto-notifications'
import { useMainReminderSync } from '@/lib/main-reminder-sync'
import { useAutoBackup } from '@/lib/auto-backup'
import { ensurePomodoroEngine } from '@/lib/pomodoro-engine'
import { useAutoCleanup } from '@/lib/hooks'
import { useDarkModeSchedule } from '@/lib/use-dark-mode-schedule'
import { useIdleDetector } from '@/lib/use-idle-detector'
import { useActivityTracker } from '@/lib/use-activity-tracker'
import { useShieldSchedule } from '@/lib/use-shield-schedule'
import { useCalendarSubscriptions } from '@/lib/use-calendar-subscriptions'
import { VIEW_TITLES } from '@/lib/config'
import { parseEnhancedInput, buildParsedTaskFields } from '@/lib/smart-input-enhanced'
import { useKeyboardShortcuts } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Search, Menu, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/error-boundary'
import { Spinner } from '@/components/ui/spinner'

export function DesktopApp() {
  const { sidebarCollapsed, activeView, toggleSidebar } = useAppStore(
    useShallow((s) => ({ sidebarCollapsed: s.sidebarCollapsed, activeView: s.activeView, toggleSidebar: s.toggleSidebar }))
  )
  const modKeys = useModKeyLabels()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [manualOnboarding, setManualOnboarding] = useState(false)
  const onboardingDone = useOnboardingComplete()
  const [isElectron, setIsElectron] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: 0 })
  }, [activeView])

  useKeyboardShortcuts()
  useAutoNotifications()
  useMainReminderSync()
  useAutoBackup()
  useAutoCleanup()
  useDarkModeSchedule()
  useIdleDetector()
  useActivityTracker()
  useShieldSchedule()
  useCalendarSubscriptions()

  useEffect(() => {
    setIsElectron(!!window.electronAPI)
  }, [])

  // 设置页「重新查看引导」入口
  useEffect(() => {
    window.__openOnboarding = () => setManualOnboarding(true)
    return () => {
      window.__openOnboarding = undefined
    }
  }, [])

  useEffect(() => {
    ensurePomodoroEngine()
    useAppStore.getState().refreshRepeatTasks()
    // 网络状态监听（离线模式 / 恢复在线自动重连）
    import('@/lib/network-monitor').then(({ initNetworkMonitor }) => initNetworkMonitor()).catch(() => {})
    // 启动时恢复加密存储的 LLM API Key（safeStorage 可用时系统级解密）
    void import('@/lib/llm-assistant')
      .then(({ initLLMConfig }) => initLLMConfig())
      .catch(() => {
        // 密钥恢复失败时静默降级，不阻塞启动
      })
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return

    const cleanups: Array<() => void> = []
    const off = (fn: (() => void) | undefined) => {
      if (typeof fn === 'function') cleanups.push(fn)
    }

    off(window.electronAPI.onMenuNavigate?.((view: string) => {
      const validViews = ['focus', 'tasks', 'habits', 'dashboard', 'goals', 'calendar', 'anniversaries', 'analytics', 'settings', 'time-block'] as const
      if (validViews.includes(view as typeof validViews[number])) {
        useAppStore.getState().setActiveView(view as typeof validViews[number])
      }
    }))
    off(window.electronAPI.onMenuNewTask?.(() => {
      useAppStore.getState().setActiveView('tasks')
    }))
    off(window.electronAPI.onMenuQuickAdd?.(() => {
      useAppStore.getState().setActiveView('tasks')
    }))
    off(window.electronAPI.onMenuStartFocus?.(() => {
      useAppStore.getState().setActiveView('focus')
    }))
    off(window.electronAPI.onTrayTogglePomodoro?.(() => {
      useAppStore.getState().setActiveView('focus')
      window.dispatchEvent(new CustomEvent('focusflow:toggle-pomodoro'))
    }))
    off(window.electronAPI.onClipboardCapture?.((data: { text: string; type: string }) => {
      const raw = data.text.trim()
      if (!raw) return
      let title = raw
      let parsedFields: ReturnType<typeof buildParsedTaskFields> | null = null
      let estimatedPomodoros: number | undefined
      try {
        const hostname = new URL(raw).hostname.replace(/^www\./, '')
        title = hostname || raw
      } catch {
        // 非 URL 文本走智能解析；过长或多行文本视为参考材料，仅保留原文不做 NLP
        if (raw.length <= 200 && !data.text.includes('\n')) {
          const parsed = parseEnhancedInput(raw)
          if (parsed.title) title = parsed.title
          parsedFields = buildParsedTaskFields(parsed)
          estimatedPomodoros = parsed.estimatedPomodoros
        }
      }
      useAppStore.getState().addTask({
        title,
        type: 'task',
        status: 'todo',
        notes: data.text,
        ...(parsedFields ?? { priority: 'medium' as const, tags: [] }),
        ...(estimatedPomodoros ? { estimatedPomodoros } : {}),
      })
      useAppStore.getState().setActiveView('tasks')
      toast.success('已从剪贴板创建任务', { description: title })
    }))
    return () => cleanups.forEach((fn) => fn())
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.reportTrayState) return
    let last = ''
    const report = () => {
      const { tasks, pomodoroTimerState, pomodoroSessions } = useAppStore.getState()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const todayCount = tasks.filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false
        if (!t.dueDate) return false
        const due = new Date(t.dueDate)
        return due >= today && due < tomorrow
      }).length
      const todayWork = pomodoroSessions.filter((s) => {
        if (s.type !== 'work') return false
        const at = new Date(s.completedAt)
        return at >= today && at < tomorrow
      })
      const todaySessions = todayWork.length
      const todayFocusMinutes = Math.round(todayWork.reduce((acc, s) => acc + (s.duration || 0), 0) / 60)
      const isRunning = pomodoroTimerState.isRunning
      const status = isRunning
        ? pomodoroTimerState.mode === 'work'
          ? '专注中'
          : '休息中'
        : '空闲'
      const key = `${todayCount}|${status}|${todaySessions}|${todayFocusMinutes}`
      if (key !== last) {
        last = key
        api.reportTrayState({ todayCount, pomodoroStatus: status, todaySessions, todayFocusMinutes })
      }
    }
    report()
    const unsubscribe = useAppStore.subscribe(() => report())
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.sendPomodoroState) return
    const interval = setInterval(() => {
      const p = useAppStore.getState().pomodoroTimerState
      // 未运行时无需高频广播；仅在计时真正运行时上报，降低 IPC 开销
      if (!p.isRunning) return
      const s = useAppStore.getState().pomodoroSettings
      const totalDuration =
        p.mode === 'work'
          ? s.workDuration
          : p.mode === 'short-break'
          ? s.shortBreakDuration
          : s.longBreakDuration
      api.sendPomodoroState({
        timeLeft: p.timeLeft,
        totalDuration,
        isRunning: p.isRunning,
        mode: p.mode,
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // 专注时保持屏幕常亮（设置项开启 + work 计时运行中才持有 blocker）
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.setKeepAwake) return
    let last = false
    const sync = () => {
      const { pomodoroTimerState, pomodoroSettings } = useAppStore.getState()
      const should = !!pomodoroSettings.keepScreenAwake && pomodoroTimerState.isRunning && pomodoroTimerState.mode === 'work'
      if (should !== last) {
        last = should
        api.setKeepAwake!(should)
      }
    }
    sync()
    const unsubscribe = useAppStore.subscribe(sync)
    return () => {
      unsubscribe()
      if (last) api.setKeepAwake!(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
        e.preventDefault()
      }
    }
    const handleDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return
      e.preventDefault()
      const store = useAppStore.getState()
      const created = files.map((f) => {
        const name = f.name.replace(/\.[^.]+$/, '') || f.name
        // 文件名仅提取显式标记（#标签 / @项目 / 优先级 / 能量），忽略日期时间类解析，避免截图等文件名误判
        const parsed = parseEnhancedInput(name)
        store.addTask({
          title: name,
          type: 'task',
          status: 'todo',
          priority: parsed.priority || 'medium',
          tags: parsed.tags || [],
          ...(parsed.project ? { project: parsed.project } : {}),
          ...(parsed.energy ? { energy: parsed.energy } : {}),
          notes: f.name,
        })
        return name
      })
      store.setActiveView('tasks')
      toast.success(`已拖放创建 ${created.length} 个任务`, {
        description: created.slice(0, 3).join('、') + (created.length > 3 ? '…' : ''),
      })
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const viewFallback = (title: string) => (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <p className="text-lg font-medium text-muted-foreground">{title}加载出错</p>
      <button
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        onClick={() => window.location.reload()}
      >
        刷新页面
      </button>
    </div>
  )

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <ErrorBoundary fallback={viewFallback('仪表盘')}><DashboardView /></ErrorBoundary>
      case 'tasks':
        return <ErrorBoundary fallback={viewFallback('任务')}><TasksView /></ErrorBoundary>
      case 'focus':
        return <ErrorBoundary fallback={viewFallback('专注')}><FocusView /></ErrorBoundary>
      case 'goals':
        return <ErrorBoundary fallback={viewFallback('目标')}><GoalsView /></ErrorBoundary>
      case 'calendar':
        return <ErrorBoundary fallback={viewFallback('日历')}><CalendarView /></ErrorBoundary>
      case 'analytics':
        return <ErrorBoundary fallback={viewFallback('分析')}><AnalyticsView /></ErrorBoundary>
      case 'habits':
        return <ErrorBoundary fallback={viewFallback('习惯')}><HabitsView /></ErrorBoundary>
      case 'anniversaries':
        return <ErrorBoundary fallback={viewFallback('纪念日')}><AnniversariesView /></ErrorBoundary>
      case 'time-block':
        return <ErrorBoundary fallback={viewFallback('时间块')}><TimeBlockView /></ErrorBoundary>
      case 'settings':
        return <ErrorBoundary fallback={viewFallback('设置')}><SettingsView /></ErrorBoundary>
      default:
        return <ErrorBoundary fallback={viewFallback('仪表盘')}><DashboardView /></ErrorBoundary>
    }
  }

  if (!mounted) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {showMobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      <div
        className={cn(
          'fixed left-0 z-40 h-full transform transition-transform duration-300 lg:hidden',
          showMobileMenu ? 'translate-x-0' : '-translate-x-full',
          isElectron && 'top-9 h-[calc(100vh-2.25rem)]'
        )}
      >
        <AppSidebar />
      </div>

      <main
        className={cn(
          'h-screen flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]',
          isElectron && 'pt-9 h-[calc(100vh-2.25rem)]'
        )}
      >
        <header className="shrink-0 z-20 flex h-14 items-center justify-between px-5 lg:px-8 bg-background/80 backdrop-blur-md border-b border-border/40">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setShowMobileMenu(true)}
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden sm:block">
              <h2 key={activeView} className="text-base font-semibold tracking-tight animate-fade-in-up">{VIEW_TITLES[activeView]}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex gap-2 text-muted-foreground hover:text-foreground h-9 rounded-xl px-3"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.__openQuickCapture?.()
                }
              }}
              title={`快速捕获任务 (${modKeys.mod}${modKeys.shift}A)`}
            >
              <Zap className="h-4 w-4" />
              <span className="text-sm">快速添加</span>
              <kbd className="pointer-events-none ml-0.5 hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded-md border bg-muted/50 px-1.5 font-mono text-2xs font-medium text-muted-foreground">
                {modKeys.mod}
                {modKeys.shift}A
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.__openQuickCapture?.()
                }
              }}
              title="快速捕获"
            >
              <Zap className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex gap-2 text-muted-foreground hover:text-foreground h-9 rounded-xl px-3"
              onClick={() => setShowSearch(true)}
              data-search-trigger
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">搜索...</span>
              <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-1 rounded-md border bg-muted/50 px-1.5 font-mono text-2xs font-medium text-muted-foreground">
                {modKeys.mod}K
              </kbd>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl"
              onClick={() => setShowSearch(true)}
              data-search-trigger
              aria-label="搜索"
            >
              <Search className="h-5 w-5" />
            </Button>

            <SyncStatusIndicator />

            <NotificationBell />
          </div>
        </header>

        <div ref={scrollAreaRef} className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden pb-24',
          activeView === 'dashboard' ? 'p-3 lg:p-4' : 'p-5 lg:p-8'
        )}>
          {renderView()}
        </div>
      </main>

      <MobileBottomNav onOpenMenu={() => setShowMobileMenu(true)} />

      <GlobalSearch open={showSearch} onOpenChange={setShowSearch} />
      <CommandPalette />
      <KeyboardShortcutsDialog />
      <MiniTimer />
      <QuickCapture />
      <DailyReviewTrigger />
      <OnboardingDialog
        open={manualOnboarding || !onboardingDone}
        onOpenChange={(open) => {
          if (!open) setManualOnboarding(false)
        }}
      />
      <PrivacyLockOverlay />
      <LevelUpModal />
    </div>
  )
}
