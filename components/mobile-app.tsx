'use client'

import { useState, useEffect } from 'react'
import { MobileDashboardView } from '@/components/views/mobile/mobile-dashboard-view'
import { MobileTasksView } from '@/components/views/mobile/mobile-tasks-view'
import { MobileFocusView } from '@/components/views/mobile/mobile-focus-view'
import { MobileHabitsView } from '@/components/views/mobile/mobile-habits-view'
import { MobileSettingsView } from '@/components/views/mobile/mobile-settings-view'
import { MobileCalendarView } from '@/components/views/mobile/mobile-calendar-view'
import { MobileGoalsView } from '@/components/views/mobile/mobile-goals-view'
import { MobileAnniversariesView } from '@/components/views/mobile/mobile-anniversaries-view'
import { MobileAnalyticsView } from '@/components/views/mobile/mobile-analytics-view'
import { JournalView } from '@/components/views/journal-view'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useAutoNotifications } from '@/lib/use-auto-notifications'
import { useAutoCleanup } from '@/lib/hooks'
import { useDarkModeSchedule } from '@/lib/use-dark-mode-schedule'
import {
  LayoutDashboard, CheckSquare, Timer, Trophy,
  MoreHorizontal, Calendar, Target, Heart, BarChart3,
  Settings, X, ChevronLeft, BookOpen
} from 'lucide-react'

const TAB_ITEMS = [
  { id: 'dashboard', label: '概览', icon: LayoutDashboard },
  { id: 'tasks', label: '任务', icon: CheckSquare },
  { id: 'focus', label: '专注', icon: Timer },
  { id: 'habits', label: '习惯', icon: Trophy },
  { id: 'more', label: '更多', icon: MoreHorizontal },
] as const

const MORE_ITEMS = [
  { id: 'calendar', label: '日历', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'goals', label: '目标', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'anniversaries', label: '纪念日', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'journal', label: '日记', icon: BookOpen, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'analytics', label: '统计', icon: BarChart3, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { id: 'settings', label: '设置', icon: Settings, color: 'text-gray-500', bg: 'bg-gray-500/10' },
] as const

type TabId = typeof TAB_ITEMS[number]['id']
type MoreId = typeof MORE_ITEMS[number]['id']
type ViewId = TabId | MoreId

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: '概览',
  tasks: '任务',
  focus: '专注',
  habits: '习惯',
  calendar: '日历',
  goals: '目标',
  anniversaries: '纪念日',
  journal: '日记',
  analytics: '统计',
  settings: '设置',
  more: '更多',
}

export function MobileApp() {
  const { setActiveView } = useAppStore()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [moreView, setMoreView] = useState<MoreId | null>(null)
  const [showMorePanel, setShowMorePanel] = useState(false)

  useAutoNotifications()
  useAutoCleanup()
  useDarkModeSchedule()

  useEffect(() => {
    useAppStore.getState().refreshRepeatTasks()
  }, [])

  const handleTabClick = (tabId: TabId) => {
    if (tabId === 'more') {
      setShowMorePanel(true)
      return
    }
    setActiveTab(tabId)
    setMoreView(null)
    setShowMorePanel(false)
    setActiveView(tabId)
  }

  const handleMoreItemClick = (itemId: MoreId) => {
    setShowMorePanel(false)
    setActiveTab('more')
    setMoreView(itemId)
    setActiveView(itemId)
  }

  const handleBackFromMore = () => {
    setMoreView(null)
    setActiveTab('dashboard')
    setActiveView('dashboard')
  }

  const handleNavigate = (view: string) => {
    const tabViews: string[] = ['dashboard', 'tasks', 'focus', 'habits']
    const moreViews: string[] = ['calendar', 'goals', 'anniversaries', 'journal', 'analytics', 'settings']
    // 'stats' is an alias for 'analytics'
    const resolvedView = view === 'stats' ? 'analytics' : view

    if (tabViews.includes(resolvedView)) {
      setActiveTab(resolvedView as TabId)
      setMoreView(null)
      setShowMorePanel(false)
      setActiveView(resolvedView)
    } else if (moreViews.includes(resolvedView)) {
      setActiveTab('more')
      setMoreView(resolvedView as MoreId)
      setShowMorePanel(false)
      setActiveView(resolvedView)
    }
  }

  const renderView = () => {
    if (activeTab === 'more' && moreView) {
      switch (moreView) {
        case 'calendar':
          return <MobileCalendarView />
        case 'goals':
          return <MobileGoalsView />
        case 'anniversaries':
          return <MobileAnniversariesView />
        case 'journal':
          return <JournalView />
        case 'analytics':
          return <MobileAnalyticsView />
        case 'settings':
          return <MobileSettingsView />
        default:
          return <MobileDashboardView onNavigate={handleNavigate} />
      }
    }
    switch (activeTab) {
      case 'dashboard':
        return <MobileDashboardView onNavigate={handleNavigate} />
      case 'tasks':
        return <MobileTasksView />
      case 'focus':
        return <MobileFocusView />
      case 'habits':
        return <MobileHabitsView />
      default:
        return <MobileDashboardView onNavigate={handleNavigate} />
    }
  }

  const pageTitle = activeTab === 'more' && moreView ? VIEW_TITLES[moreView] : VIEW_TITLES[activeTab]

  return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden touch-manipulation">
      {!(activeTab === 'focus' || activeTab === 'tasks') && (
        <header className="shrink-0 flex h-12 items-center justify-between px-4 z-20 safe-area-top glass-header">
          <div className="flex items-center gap-1.5">
            {activeTab === 'more' && moreView && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full active:scale-90 transition-transform"
                onClick={handleBackFromMore}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-[15px] font-semibold tracking-tight">{pageTitle}</h1>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderView()}
      </main>

      <nav className="shrink-0 safe-area-bottom glass-nav border-t border-border/30">
        <div className="flex items-center justify-around h-14 px-1">
          {TAB_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id || (activeTab === 'more' && item.id === 'more' && !moreView)
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 h-12 w-14 rounded-2xl transition-all duration-200 active:scale-90',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-xl transition-all duration-200',
                  isActive && 'bg-primary/12'
                )}>
                  <Icon className={cn('h-[18px] w-[18px]', isActive && 'stroke-[2.5]')} />
                </div>
                <span className={cn(
                  'text-[10px] leading-none transition-all',
                  isActive ? 'font-semibold' : 'font-medium'
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {showMorePanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMorePanel(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden glass-sheet animate-fade-in-up safe-area-bottom">
            <div className="flex items-center justify-between p-4 pb-2">
              <h3 className="text-sm font-semibold">更多功能</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => setShowMorePanel(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 pt-2">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMoreItemClick(item.id)}
                    className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl hover:bg-muted/30 active:scale-95 transition-all"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', item.bg)}>
                      <Icon className={cn('h-5 w-5', item.color)} />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
