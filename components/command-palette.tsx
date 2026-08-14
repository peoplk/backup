'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Clock,
  CheckSquare,
  Timer,
  Target,
  Calendar,
  Settings,
  BarChart3,
  Trophy,
  Heart,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Keyboard,
  Command,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  title: string
  description?: string
  icon: React.ReactNode
  action: () => void
  category: 'navigation' | 'actions' | 'tasks' | 'search'
  shortcut?: string[]
}

export function CommandPalette() {
  const {
    tasks,
    activeView,
    setActiveView,
    addTask,
    updatePomodoroTimerState,
    pomodoroSettings,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    activeView: s.activeView,
    setActiveView: s.setActiveView,
    addTask: s.addTask,
    updatePomodoroTimerState: s.updatePomodoroTimerState,
    pomodoroSettings: s.pomodoroSettings,
  })))

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done').slice(0, 5)
  }, [tasks])

  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-dashboard',
        title: '前往仪表板',
        icon: <BarChart3 className="h-4 w-4" />,
        action: () => setActiveView('dashboard'),
        category: 'navigation',
        shortcut: ['G', 'D'],
      },
      {
        id: 'nav-tasks',
        title: '前往任务',
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => setActiveView('tasks'),
        category: 'navigation',
        shortcut: ['G', 'T'],
      },
      {
        id: 'nav-pomodoro',
        title: '前往专注',
        icon: <Timer className="h-4 w-4" />,
        action: () => setActiveView('focus'),
        category: 'navigation',
        shortcut: ['G', 'P'],
      },
      {
        id: 'nav-time-tracking',
        title: '前往时间追踪',
        icon: <Clock className="h-4 w-4" />,
        action: () => setActiveView('analytics'),
        category: 'navigation',
        shortcut: ['G', 'K'],
      },
      {
        id: 'nav-goals',
        title: '前往目标',
        icon: <Target className="h-4 w-4" />,
        action: () => setActiveView('goals'),
        category: 'navigation',
        shortcut: ['G', 'G'],
      },
      {
        id: 'nav-schedule',
        title: '前往日程',
        icon: <Calendar className="h-4 w-4" />,
        action: () => setActiveView('tasks'),
        category: 'navigation',
        shortcut: ['G', 'S'],
      },
      {
        id: 'nav-habits',
        title: '前往习惯',
        icon: <Trophy className="h-4 w-4" />,
        action: () => setActiveView('habits'),
        category: 'navigation',
        shortcut: ['G', 'H'],
      },
      {
        id: 'nav-analytics',
        title: '前往分析',
        icon: <BarChart3 className="h-4 w-4" />,
        action: () => setActiveView('analytics'),
        category: 'navigation',
        shortcut: ['G', 'A'],
      },
      {
        id: 'nav-settings',
        title: '前往设置',
        icon: <Settings className="h-4 w-4" />,
        action: () => setActiveView('settings'),
        category: 'navigation',
        shortcut: ['G', ','],
      },
      {
        id: 'action-new-task',
        title: '新建任务',
        icon: <Plus className="h-4 w-4" />,
        action: () => {
          setActiveView('tasks')
        },
        category: 'actions',
        shortcut: ['N', 'T'],
      },
      {
        id: 'action-start-focus',
        title: '开始专注',
        icon: <Play className="h-4 w-4" />,
        action: () => {
          setActiveView('focus')
          updatePomodoroTimerState({ isRunning: true })
        },
        category: 'actions',
        shortcut: ['P'],
      },
      {
        id: 'action-quick-task',
        title: '快速添加任务',
        description: '添加一个新任务',
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => {
          if (search.startsWith('add ') || search.startsWith('添加 ')) {
            const title = search.replace(/^(add |添加 )/, '')
            if (title.trim()) {
              addTask({
                title: title.trim(),
                priority: 'medium',
                status: 'todo',
                tags: [],
                type: 'task',
              })
            }
          }
        },
        category: 'actions',
        shortcut: ['A'],
      },
    ]

    activeTasks.forEach((task) => {
      items.push({
        id: `task-${task.id}`,
        title: task.title,
        description: task.project || undefined,
        icon: task.priority === 'urgent' ? (
          <AlertCircle className="h-4 w-4 text-destructive" />
        ) : task.priority === 'high' ? (
          <ArrowUp className="h-4 w-4 text-chart-3" />
        ) : task.priority === 'medium' ? (
          <ArrowRight className="h-4 w-4 text-chart-1" />
        ) : (
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        ),
        action: () => {
          setActiveView('tasks')
        },
        category: 'tasks',
      })
    })

    return items
  }, [setActiveView, updatePomodoroTimerState, addTask, activeTasks, search])

  const filteredCommands = useMemo(() => {
    if (!search) return commands

    const searchLower = search.toLowerCase()
    return commands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(searchLower)) return true
      if (cmd.description?.toLowerCase().includes(searchLower)) return true
      return false
    })
  }, [commands, search])

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}

    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })

    return groups
  }, [filteredCommands])

  const categoryLabels: Record<string, string> = {
    navigation: '导航',
    actions: '操作',
    tasks: '任务',
    search: '搜索',
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setOpen((open) => !open)
      }

      if (open) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const selected = filteredCommands[selectedIndex]
          if (selected) {
            selected.action()
            setOpen(false)
            setSearch('')
          }
        } else if (e.key === 'Escape') {
          setOpen(false)
          setSearch('')
        }
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, filteredCommands, selectedIndex])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  const handleSelect = (command: CommandItem) => {
    command.action()
    setOpen(false)
    setSearch('')
  }

  let itemIndex = 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-lg">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="搜索命令或输入任务..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-11 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {Object.entries(groupedCommands).map(([category, items]) => (
            <div key={category}>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {categoryLabels[category] || category}
              </div>
              {items.map((command) => {
                const currentIndex = itemIndex++
                const isSelected = currentIndex === selectedIndex

                return (
                  <div
                    key={command.id}
                    className={cn(
                      'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                      isSelected && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => handleSelect(command)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className="mr-2 flex h-4 w-4 items-center justify-center">
                      {command.icon}
                    </div>
                    <span className="flex-1 truncate">{command.title}</span>
                    {command.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {command.description}
                      </span>
                    )}
                    {command.shortcut && (
                      <div className="flex items-center gap-1 ml-auto">
                        {command.shortcut.map((key, i) => (
                          <kbd
                            key={i}
                            className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              未找到匹配的命令
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="h-4 rounded border bg-muted px-1 text-[10px]">↑↓</kbd>
              <span>选择</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="h-4 rounded border bg-muted px-1 text-[10px]">↵</kbd>
              <span>确认</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="h-4 rounded border bg-muted px-1 text-[10px]">
              <Command className="h-3 w-3" />
            </kbd>
            <kbd className="h-4 rounded border bg-muted px-1 text-[10px]">⇧</kbd>
            <kbd className="h-4 rounded border bg-muted px-1 text-[10px]">P</kbd>
            <span>打开命令面板</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
