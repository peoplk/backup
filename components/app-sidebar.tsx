'use client'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { APP_CONFIG, USER_CONFIG, NAV_ITEMS } from '@/lib/config'
import { getStoredTheme, setTheme, type ThemeMode } from '@/lib/theme'
import { useSmartLists } from '@/lib/smart-lists'
import { useShallow } from 'zustand/react/shallow'
import {
  LayoutDashboard,
  CheckSquare,
  Timer,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Moon,
  Sun,
  User,
  Heart,
  Trophy,
  Target,
  Calendar,
  Star,
  Inbox,
  AlertCircle,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ListTodo,
  BookOpen,
  Zap,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Project } from '@/lib/types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const iconMap = {
  dashboard: LayoutDashboard,
  tasks: CheckSquare,
  focus: Timer,
  goals: Target,
  habits: Trophy,
  calendar: CalendarDays,
  'time-block': CalendarClock,
  anniversaries: Heart,
  analytics: BarChart3,
}

const navItems = NAV_ITEMS.map(item => ({
  ...item,
  icon: iconMap[item.id as keyof typeof iconMap],
}))

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar, activeView, setActiveView, tasks, activeSmartList, setActiveSmartList, projects } = useAppStore(useShallow((state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    toggleSidebar: state.toggleSidebar,
    activeView: state.activeView,
    setActiveView: state.setActiveView,
    tasks: state.tasks,
    activeSmartList: state.activeSmartList,
    setActiveSmartList: state.setActiveSmartList,
    projects: state.projects,
  })))
  const { smartLists } = useSmartLists()
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [isElectron, setIsElectron] = useState(false)
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null)

  // 选中项目：持久化 + 广播事件，任务页监听后按项目过滤
  const selectProject = (project: Project | null) => {
    try {
      if (project) window.localStorage.setItem('focusflow-active-project', project.name)
      else window.localStorage.removeItem('focusflow-active-project')
    } catch { /* ignore */ }
    setActiveProjectName(project?.name || null)
    window.dispatchEvent(new CustomEvent('focusflow-project-select', { detail: project?.name || '' }))
  }

  const starredCount = useMemo(() => tasks.filter(t => t.starred && t.status !== 'done').length, [tasks])

  const projectTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const project of projects) {
      counts[project.name] = tasks.filter(t => t.project === project.name && t.status !== 'done').length
    }
    return counts
  }, [tasks, projects])

  useEffect(() => {
    setThemeMode(getStoredTheme())
    setIsElectron(!!window.electronAPI)
    try {
      setActiveProjectName(window.localStorage.getItem('focusflow-active-project') || null)
    } catch { /* ignore */ }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      setActiveProjectName(detail || null)
    }
    window.addEventListener('focusflow-project-select', handler)
    return () => window.removeEventListener('focusflow-project-select', handler)
  }, [])

  const cycleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light'
    setThemeMode(next)
    setTheme(next)
  }

  const themeIcon = themeMode === 'dark' ? Moon : themeMode === 'light' ? Sun : Monitor
  const ThemeIcon = themeIcon

  const NavButton = ({ item, isActive }: { item: typeof navItems[number]; isActive: boolean }) => {
    const Icon = item.icon
    const button = (
      <button
        onClick={() => {
          selectProject(null)
          setActiveView(item.id)
        }}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
          isActive
            ? 'bg-gradient-to-r from-sidebar-primary to-sidebar-primary/90 text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25'
            : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
          sidebarCollapsed && 'justify-center px-0'
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-sidebar-primary-foreground rounded-r-full" />
        )}
        <Icon className={cn(
          'h-5 w-5 shrink-0 transition-transform duration-200',
          isActive && 'drop-shadow-sm',
          'group-hover:scale-110',
          isActive && 'group-hover:scale-100'
        )} />
        {!sidebarCollapsed && (
          <span className="animate-grow tracking-wide">{item.label}</span>
        )}
      </button>
    )

    if (!sidebarCollapsed) return button

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'fixed left-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]',
          isElectron ? 'top-9 h-[calc(100vh-2.25rem)]' : 'top-0 h-screen'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border/60 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 shadow-lg shadow-sidebar-primary/25">
              <Sparkles className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            {!sidebarCollapsed && (
              <div className="animate-grow">
                <h1 className="font-semibold text-lg tracking-tight">{APP_CONFIG.name}</h1>
                <p className="text-xs text-sidebar-muted/80">{APP_CONFIG.description}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            className="h-8 w-8 text-sidebar-muted hover:bg-sidebar-accent/80 hover:text-sidebar-foreground transition-all duration-200"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className={cn('mb-3', !sidebarCollapsed && 'px-3')}>
            {!sidebarCollapsed && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-muted/60">
                主菜单
              </span>
            )}
          </div>
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} isActive={activeView === item.id} />
          ))}

          {!sidebarCollapsed && (
            <>
              <div className="mt-4 mb-3 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-muted/60">
                  智能列表
                </span>
              </div>

              <button
                onClick={() => {
                  selectProject(null)
                  setActiveSmartList('starred')
                  setActiveView('tasks')
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200',
                  activeSmartList === 'starred'
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  starredCount > 0 && 'text-amber-500'
                )}
              >
                <Star className={cn('h-4 w-4 shrink-0', starredCount > 0 && 'fill-amber-500')} />
                <span className="flex-1 text-left">已收藏</span>
                {starredCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {starredCount}
                  </Badge>
                )}
              </button>

              {smartLists.map((list) => {
                const listIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                  'today': CalendarDays,
                  'tomorrow': CalendarClock,
                  'next7days': Calendar,
                  'overdue': AlertCircle,
                  'inbox': Inbox,
                  'completed': CheckCircle2,
                  'all': ListTodo,
                }
                const ListIcon = listIconMap[list.id] || ListTodo
                const isOverdue = list.id === 'overdue' && list.count > 0

                return (
                  <button
                    key={list.id}
                    onClick={() => {
                      selectProject(null)
                      setActiveSmartList(list.id)
                      setActiveView('tasks')
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200',
                      activeSmartList === list.id
                        ? 'bg-sidebar-accent text-sidebar-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                      isOverdue && 'text-destructive'
                    )}
                  >
                    <span style={{ color: isOverdue ? undefined : list.color }}>
                      <ListIcon className={cn("h-4 w-4 shrink-0", isOverdue && "text-destructive")} />
                    </span>
                    <span className="flex-1 text-left">{list.name}</span>
                    {list.count > 0 && (
                      <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-[10px] h-5 px-1.5">
                        {list.count}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </>
          )}

          {!sidebarCollapsed && projects.length > 0 && (
            <>
              <div className="mt-4 mb-3 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-muted/60">
                  项目
                </span>
              </div>
              <ProjectTree
                projects={projects}
                taskCounts={projectTaskCounts}
                activeProjectName={activeView === 'tasks' ? activeProjectName : null}
                onSelect={(project) => {
                  setActiveSmartList(null)
                  selectProject(project)
                  setActiveView('tasks')
                }}
              />
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border/60 p-3">
          <div className="space-y-1">
            <button
              onClick={cycleTheme}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                sidebarCollapsed && 'justify-center px-0'
              )}
            >
              <ThemeIcon className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />
              {!sidebarCollapsed && (
                <span>{themeMode === 'light' ? '浅色模式' : themeMode === 'dark' ? '深色模式' : '跟随系统'}</span>
              )}
            </button>
            {isElectron && (
              <button
                onClick={() => {
                  if (window.electronAPI?.toggleWidget) {
                    window.electronAPI.toggleWidget()
                  }
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  sidebarCollapsed && 'justify-center px-0'
                )}
                title="打开桌面小组件"
              >
                <Monitor className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                {!sidebarCollapsed && <span>桌面小组件</span>}
              </button>
            )}
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                   window.__openQuickCapture?.()
                }
              }}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                sidebarCollapsed && 'justify-center px-0'
              )}
              title="快速捕获任务 (Ctrl+Shift+A)"
            >
              <Zap className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              {!sidebarCollapsed && <span>快速捕获</span>}
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-all duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                activeView === 'settings' && 'bg-sidebar-accent text-sidebar-foreground',
                sidebarCollapsed && 'justify-center px-0'
              )}
            >
              <Settings className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
              {!sidebarCollapsed && <span>设置</span>}
            </button>
          </div>

          <div
            className={cn(
              'mt-3 flex items-center gap-3 rounded-xl bg-sidebar-accent/50 p-3 border border-sidebar-border/30',
              sidebarCollapsed && 'justify-center p-2'
            )}
          >
            <Avatar className="h-9 w-9 ring-2 ring-sidebar-primary/30">
              <AvatarImage src={USER_CONFIG.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-sidebar-primary-foreground text-xs">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <div className="animate-grow flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{USER_CONFIG.name}</p>
                <p className="truncate text-xs text-sidebar-muted/70">{USER_CONFIG.plan}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function ProjectTree({
  projects,
  taskCounts,
  onSelect,
  activeProjectName,
}: {
  projects: Project[]
  taskCounts: Record<string, number>
  onSelect: (project: Project) => void
  activeProjectName: string | null
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const projectById = useMemo(() => {
    const map = new Map<string, Project>()
    for (const p of projects) map.set(p.id, p)
    return map
  }, [projects])

  const rootProjects = projects.filter((p) => {
    if (!p.parentId) return true
    return !projectById.has(p.parentId)
  })

  const countSubtree = (project: Project): number => {
    let total = taskCounts[project.name] ?? 0
    for (const child of projects) {
      if (child.parentId === project.id) {
        total += countSubtree(child)
      }
    }
    return total
  }

  const renderNode = (project: Project, depth: number) => {
    const children = projects.filter((p) => p.parentId === project.id)
    const isCollapsed = collapsed.has(project.id)
    const totalCount = countSubtree(project)
    return (
      <div key={project.id}>
        <button
          onClick={() => onSelect(project)}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200',
            activeProjectName === project.name
              ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
              : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
          )}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          {children.length > 0 ? (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((prev) => {
                  const next = new Set(prev)
                  if (next.has(project.id)) next.delete(project.id)
                  else next.add(project.id)
                  return next
                })
              }}
              className="shrink-0 cursor-pointer text-sidebar-muted/60 hover:text-sidebar-foreground"
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <div
            className="h-3 w-3 rounded-sm shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <span className="flex-1 text-left truncate">{project.name}</span>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {totalCount}
            </Badge>
          )}
        </button>
        {children.length > 0 && !isCollapsed && (
          <div>{children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return <>{rootProjects.map((project) => renderNode(project, 0))}</>
}
