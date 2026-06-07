'use client'

import { useState, useEffect } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
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
import { JournalView } from '@/components/views/journal-view'
import { GlobalSearch } from '@/components/global-search'
import { NotificationBell } from '@/components/notification-bell'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { MiniTimer } from '@/components/mini-timer'
import { QuickCapture } from '@/components/quick-capture'
import { DailyReviewTrigger } from '@/lib/hooks/use-daily-review-trigger'
import { useAppStore } from '@/lib/store'
import { useAutoNotifications } from '@/lib/use-auto-notifications'
import { useAutoCleanup } from '@/lib/hooks'
import { useDarkModeSchedule } from '@/lib/use-dark-mode-schedule'
import { VIEW_TITLES } from '@/lib/config'
import { useKeyboardShortcuts } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { Search, Menu, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DesktopApp() {
  const { sidebarCollapsed, activeView, toggleSidebar } = useAppStore()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useKeyboardShortcuts()
  useAutoNotifications()
  useAutoCleanup()
  useDarkModeSchedule()

  useEffect(() => {
    setIsElectron(!!window.electronAPI)
  }, [])

  useEffect(() => {
    useAppStore.getState().refreshRepeatTasks()
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onMenuNavigate?.((view: string) => {
      const validViews = ['focus', 'tasks', 'habits', 'dashboard', 'goals', 'calendar', 'anniversaries', 'analytics', 'settings', 'time-block', 'journal'] as const
      if (validViews.includes(view as typeof validViews[number])) {
        useAppStore.getState().setActiveView(view as typeof validViews[number])
      }
    })
    window.electronAPI.onMenuNewTask?.(() => {
      useAppStore.getState().setActiveView('tasks')
    })
    window.electronAPI.onMenuQuickAdd?.(() => {
      useAppStore.getState().setActiveView('tasks')
    })
    window.electronAPI.onMenuStartFocus?.(() => {
      useAppStore.getState().setActiveView('focus')
    })
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

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />
      case 'tasks':
        return <TasksView />
      case 'focus':
        return <FocusView />
      case 'goals':
        return <GoalsView />
      case 'calendar':
        return <CalendarView />
      case 'analytics':
        return <AnalyticsView />
      case 'habits':
        return <HabitsView />
      case 'anniversaries':
        return <AnniversariesView />
      case 'time-block':
        return <TimeBlockView />
      case 'journal':
        return <JournalView />
      case 'settings':
        return <SettingsView />
      default:
        return <DashboardView />
    }
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
        <header className="shrink-0 sticky top-0 z-20 flex h-14 items-center justify-between px-5 lg:px-8 bg-transparent">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setShowMobileMenu(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden sm:block">
              <h2 className="text-base font-semibold tracking-tight">{VIEW_TITLES[activeView]}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex gap-2 text-muted-foreground hover:text-foreground h-9 rounded-xl px-3"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  ;(window as any).__openQuickCapture?.()
                }
              }}
              title="快速捕获任务 (Ctrl+Shift+A)"
            >
              <Zap className="h-4 w-4" />
              <span className="text-sm">快速添加</span>
              <kbd className="pointer-events-none ml-0.5 hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded-md border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-[10px]">⌘</span>⇧A
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  ;(window as any).__openQuickCapture?.()
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
              <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-1 rounded-md border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl"
              onClick={() => setShowSearch(true)}
              data-search-trigger
            >
              <Search className="h-5 w-5" />
            </Button>

            <NotificationBell />
          </div>
        </header>

        <div className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          activeView === 'dashboard' ? 'p-3 lg:p-4' : 'p-5 lg:p-8'
        )}>
          {renderView()}
        </div>
      </main>

      <GlobalSearch open={showSearch} onOpenChange={setShowSearch} />
      <CommandPalette />
      <KeyboardShortcutsDialog />
      <MiniTimer />
      <QuickCapture />
      <DailyReviewTrigger />
    </div>
  )
}
