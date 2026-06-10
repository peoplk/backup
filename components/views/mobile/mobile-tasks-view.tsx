'use client'

import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { MobileTaskCard } from '@/components/mobile/mobile-task-card'
import { MobileEmptyState } from '@/components/mobile/mobile-empty-state'
import { MobilePriorityDot } from '@/components/mobile/mobile-priority-dot'
import { MobileAddTaskSheet } from '@/components/mobile/mobile-add-task-sheet'
import type { AddTaskData } from '@/components/mobile/mobile-add-task-sheet'
import { MobileTaskDetailSheet } from '@/components/mobile/mobile-task-detail-sheet'
import {
  CheckCircle2, Calendar, CalendarDays, Star, Inbox, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Plus, Flag, FolderOpen, LayoutGrid, List, Play, ClipboardList, Archive, Search, X, Trash2, Tag as TagIcon, CheckSquare, Square
} from 'lucide-react'

type FilterType = 'all' | 'today' | 'week' | 'starred' | 'done'
type PriorityType = 'urgent' | 'high' | 'medium' | 'low'
type SortMode = 'default' | 'priority' | 'date' | 'project'

const PRIORITY_OPTIONS: PriorityType[] = ['urgent', 'high', 'medium', 'low']

type ViewMode = 'list' | 'kanban'
type KanbanColumnId = 'todo' | 'in-progress' | 'done'

interface KanbanColumn {
  id: KanbanColumnId
  label: string
  icon: typeof Inbox
  color: string
  bg: string
  accent: string
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'todo', label: '待办', icon: ClipboardList, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-500/20', accent: 'bg-slate-500' },
  { id: 'in-progress', label: '进行中', icon: Play, color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/20', accent: 'bg-blue-500' },
  { id: 'done', label: '已完成', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/20', accent: 'bg-emerald-500' },
]

const SMART_LISTS: { id: FilterType; label: string; icon: typeof Inbox; iconColor: string; iconBg: string }[] = [
  { id: 'all', label: '全部', icon: Inbox, iconColor: 'text-blue-500', iconBg: 'bg-blue-500/10' },
  { id: 'today', label: '今天', icon: CalendarDays, iconColor: 'text-green-500', iconBg: 'bg-green-500/10' },
  { id: 'week', label: '最近7天', icon: Calendar, iconColor: 'text-violet-500', iconBg: 'bg-violet-500/10' },
  { id: 'starred', label: '星标', icon: Star, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10' },
  { id: 'done', label: '已完成', icon: CheckCircle2, iconColor: 'text-gray-400', iconBg: 'bg-gray-500/10' },
]

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'default', label: '默认' },
  { id: 'priority', label: '按优先级' },
  { id: 'date', label: '按日期' },
  { id: 'project', label: '按项目' },
]

export function MobileTasksView() {
  const { tasks, addTask, deleteTask, completeTask, uncompleteTask, toggleTaskStar, archiveTask, projects, tags, updateTask, batchCompleteTasks, batchDeleteTasks, batchUpdateTaskPriority, batchAddTagToTasks } = useAppStore(
    useShallow(state => ({
      tasks: state.tasks, addTask: state.addTask, deleteTask: state.deleteTask,
      completeTask: state.completeTask, uncompleteTask: state.uncompleteTask,
      toggleTaskStar: state.toggleTaskStar, archiveTask: state.archiveTask,
      projects: state.projects, tags: state.tags, updateTask: state.updateTask,
      batchCompleteTasks: state.batchCompleteTasks, batchDeleteTasks: state.batchDeleteTasks,
      batchUpdateTaskPriority: state.batchUpdateTaskPriority, batchAddTagToTasks: state.batchAddTagToTasks,
    }))
  )

  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [sortMode, setSortMode] = useState<SortMode>('default')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showProjectFilter, setShowProjectFilter] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [addPriority, setAddPriority] = useState<PriorityType>('medium')
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [addTitle, setAddTitle] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchPriority, setShowBatchPriority] = useState(false)
  const [showBatchTag, setShowBatchTag] = useState(false)

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const tomorrow = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d }, [today])
  const nextWeek = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 7); return d }, [today])

  const isTaskForToday = useCallback((t: typeof tasks[number]) => {
    if (t.repeatRule) {
      if (!t.repeatRule.paused && t.repeatRule.endDate && new Date(t.repeatRule.endDate) < today) return false
      if (t.dueDate) { const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0); return d.getTime() <= today.getTime() }
      return true
    }
    if (t.status === 'done') return false
    if (t.dueDate) { const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0); return d.getTime() <= today.getTime() }
    return t.priority === 'urgent'
  }, [today])

  const isTaskForWeek = useCallback((t: typeof tasks[number]) => {
    if (t.status === 'done' || !t.dueDate) return false
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0)
    return d.getTime() >= today.getTime() && d.getTime() <= nextWeek.getTime()
  }, [today, nextWeek])

  const filteredTasks = useMemo(() => {
    let result: typeof tasks = []
    switch (activeFilter) {
      case 'today': result = tasks.filter(isTaskForToday); break
      case 'week': result = tasks.filter(isTaskForWeek); break
      case 'starred': result = tasks.filter(t => t.starred && t.status !== 'done'); break
      case 'done': result = tasks.filter(t => t.status === 'done'); break
      default: result = tasks.filter(t => t.status !== 'done')
    }
    if (selectedProjectId !== 'all') result = result.filter(t => t.project === selectedProjectId)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    }
    return result
  }, [tasks, activeFilter, selectedProjectId, isTaskForToday, isTaskForWeek, searchQuery])

  const sortedTasks = useMemo(() => {
    const po: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    return [...filteredTasks].sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1
      switch (sortMode) {
        case 'priority': return (po[a.priority] ?? 3) - (po[b.priority] ?? 3)
        case 'date': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          return da - db
        }
        case 'project': return (a.project || '').localeCompare(b.project || '')
        default: return (po[a.priority] ?? 3) - (po[b.priority] ?? 3)
      }
    })
  }, [filteredTasks, sortMode])

  const groupedTasks = useMemo(() => {
    if (activeFilter === 'done' || sortMode === 'priority' || sortMode === 'project') {
      return [{ key: 'all', label: '', tasks: sortedTasks }]
    }
    const groups: { key: string; label: string; tasks: typeof tasks }[] = []
    const overdue: typeof tasks = []
    const todayTasks: typeof tasks = []
    const tomorrowTasks: typeof tasks = []
    const upcoming: typeof tasks = []
    const noDate: typeof tasks = []

    for (const t of sortedTasks) {
      if (!t.dueDate) { noDate.push(t); continue }
      const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0)
      if (d.getTime() < today.getTime()) overdue.push(t)
      else if (d.getTime() === today.getTime()) todayTasks.push(t)
      else if (d.getTime() === tomorrow.getTime()) tomorrowTasks.push(t)
      else upcoming.push(t)
    }

    if (overdue.length) groups.push({ key: 'overdue', label: '逾期', tasks: overdue })
    if (todayTasks.length) groups.push({ key: 'today', label: '今天', tasks: todayTasks })
    if (tomorrowTasks.length) groups.push({ key: 'tomorrow', label: '明天', tasks: tomorrowTasks })
    if (upcoming.length) groups.push({ key: 'upcoming', label: '即将到来', tasks: upcoming })
    if (noDate.length) groups.push({ key: 'nodate', label: '无日期', tasks: noDate })
    return groups.length ? groups : [{ key: 'all', label: '', tasks: [] }]
  }, [sortedTasks, activeFilter, sortMode, today, tomorrow])

  const filterCounts = useMemo(() => ({
    all: tasks.filter(t => t.status !== 'done').length,
    today: tasks.filter(isTaskForToday).length,
    week: tasks.filter(isTaskForWeek).length,
    starred: tasks.filter(t => t.starred && t.status !== 'done').length,
    done: tasks.filter(t => t.status === 'done').length,
  }), [tasks, isTaskForToday, isTaskForWeek])

  const kanbanGroups = useMemo(() => {
    const map: Record<KanbanColumnId, Task[]> = {
      'todo': [],
      'in-progress': [],
      'done': [],
    }
    for (const t of sortedTasks) {
      if (t.status === 'in-progress') map['in-progress'].push(t)
      else if (t.status === 'done') map['done'].push(t)
      else map['todo'].push(t)
    }
    return map
  }, [sortedTasks])

  const moveToColumn = useCallback((taskId: string, target: KanbanColumnId) => {
    if (target === 'done') {
      completeTask(taskId)
    } else {
      uncompleteTask(taskId)
      updateTask(taskId, { status: target })
    }
  }, [completeTask, uncompleteTask, updateTask])

  const getLeftColumn = useCallback((current: KanbanColumnId) => {
    const idx = KANBAN_COLUMNS.findIndex(c => c.id === current)
    if (idx <= 0) return undefined
    return (taskId: string) => moveToColumn(taskId, KANBAN_COLUMNS[idx - 1].id)
  }, [moveToColumn])

  const getRightColumn = useCallback((current: KanbanColumnId) => {
    const idx = KANBAN_COLUMNS.findIndex(c => c.id === current)
    if (idx === -1 || idx >= KANBAN_COLUMNS.length - 1) return undefined
    return (taskId: string) => moveToColumn(taskId, KANBAN_COLUMNS[idx + 1].id)
  }, [moveToColumn])

  const formatDate = useCallback((date: Date | string | undefined) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
  }, [])

  const isOverdue = useCallback((date: Date | string | undefined) => {
    if (!date) return false
    const d = new Date(date); d.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
  }, [today])

  const getProjectName = useCallback((id: string | undefined) => {
    if (!id) return ''
    return projects.find(p => p.id === id || p.name === id)?.name || id
  }, [projects])

  const getProjectColor = useCallback((id: string | undefined) => {
    if (!id) return ''
    return projects.find(p => p.id === id || p.name === id)?.color || '#6b7280'
  }, [projects])

  const handleFullAdd = useCallback((data: AddTaskData) => {
    addTask({
      title: data.title, priority: data.priority, status: 'todo', type: 'task',
      tags: data.tags, dueDate: data.dueDate, project: data.project,
      notes: data.notes || undefined, description: data.notes || undefined,
      repeatRule: data.repeatRule !== 'none' ? { type: data.repeatRule as 'daily' | 'weekly' | 'monthly', interval: 1 } : undefined,
      estimatedPomodoros: data.pomodoros,
    })
    setAddPriority('medium')
  }, [addTask])

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectTask = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedTasks.length && sortedTasks.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedTasks.map(t => t.id)))
    }
  }

  const exitBatchMode = () => {
    setBatchMode(false)
    setSelectedIds(new Set())
    setShowBatchPriority(false)
    setShowBatchTag(false)
  }

  const handleBatchComplete = () => {
    if (selectedIds.size === 0) return
    batchCompleteTasks(Array.from(selectedIds))
    exitBatchMode()
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return
    batchDeleteTasks(Array.from(selectedIds))
    exitBatchMode()
  }

  const handleBatchPriority = (priority: PriorityType) => {
    if (selectedIds.size === 0) return
    batchUpdateTaskPriority(Array.from(selectedIds), priority)
    setShowBatchPriority(false)
    exitBatchMode()
  }

  const handleBatchAddTag = (tag: string) => {
    if (selectedIds.size === 0) return
    batchAddTagToTasks(Array.from(selectedIds), tag)
    setShowBatchTag(false)
    exitBatchMode()
  }

  const activeSmartList = useMemo(() => SMART_LISTS.find(s => s.id === activeFilter)!, [activeFilter])
  const ActiveIcon = activeSmartList.icon

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background status-bar-safe">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', activeSmartList.iconBg)}>
            <ActiveIcon className={cn('h-4 w-4', activeSmartList.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{activeSmartList.label}</h2>
            <p className="text-[10px] text-muted-foreground">{filterCounts[activeFilter]} 个任务</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              className={cn('flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95',
                showSearch ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery('') }}
              title="搜索"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn('flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95',
                batchMode ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => { if (batchMode) exitBatchMode(); else setBatchMode(true) }}
              title="批量操作"
            >
              {batchMode ? '退出选择' : '选择'}
            </button>
            <button
              className={cn('flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95',
                viewMode === 'list' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn('flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95',
                viewMode === 'kanban' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => setViewMode('kanban')}
              title="看板视图"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95',
                showSortMenu ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              排序
            </button>
            <button
              className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95',
                selectedProjectId !== 'all' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => setShowProjectFilter(!showProjectFilter)}
            >
              <FolderOpen className="h-3 w-3" />
              筛选
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-4 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SMART_LISTS.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95',
                  activeFilter === item.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground'
                )}
                onClick={() => { setActiveFilter(item.id); setShowSortMenu(false); setShowProjectFilter(false) }}
              >
                <Icon className="h-3 w-3" />
                {item.label}
                {filterCounts[item.id] > 0 && (
                  <span className={cn('min-w-[16px] h-[16px] rounded-full text-[9px] flex items-center justify-center px-0.5',
                    activeFilter === item.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {filterCounts[item.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {showSearch && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              className="flex-1 h-8 px-2 rounded-lg bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="shrink-0 h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => setSearchQuery('')}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {showSortMenu && (
        <div className="px-4 py-2.5 border-b border-border/30 bg-muted/20">
          <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.id} className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95',
                sortMode === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
              )} onClick={() => { setSortMode(opt.id); setShowSortMenu(false) }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showProjectFilter && (
        <div className="px-4 py-2.5 border-b border-border/30 bg-muted/20">
          <div className="flex flex-wrap gap-1.5">
            <button className={cn('px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95',
              selectedProjectId === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
            )} onClick={() => { setSelectedProjectId('all'); setShowProjectFilter(false) }}>全部项目</button>
            {projects.map(p => (
              <button key={p.id} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95',
                selectedProjectId === p.id || selectedProjectId === p.name ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
              )} onClick={() => { setSelectedProjectId(p.id); setShowProjectFilter(false) }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />{p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pb-24">
        {viewMode === 'kanban' ? (
          <KanbanView
            columns={KANBAN_COLUMNS}
            kanbanGroups={kanbanGroups}
            getProjectColor={getProjectColor}
            getProjectName={getProjectName}
            isOverdue={isOverdue}
            formatDate={formatDate}
            onTaskClick={setDetailTaskId}
            getLeftColumn={getLeftColumn}
            getRightColumn={getRightColumn}
            onToggleComplete={(taskId, isDone) => isDone ? uncompleteTask(taskId) : completeTask(taskId)}
          />
        ) : sortedTasks.length > 0 ? (
          groupedTasks.map(group => (
            <div key={group.key}>
              {group.label && (
                <div
                  className="flex items-center gap-2 w-full px-4 py-2 bg-muted/30 border-b border-border/20"
                  onClick={() => toggleGroup(group.key)}
                >
                  {collapsedGroups.has(group.key) ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={cn(
                    'text-[11px] font-semibold uppercase tracking-wider',
                    group.key === 'overdue' ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {group.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">{group.tasks.length}</span>
                </div>
              )}
              {!collapsedGroups.has(group.key) && group.tasks.map(task => (
                <div key={task.id} className="flex items-center">
                  {batchMode && (
                    <button
                      className="shrink-0 pl-3 active:scale-90 transition-transform"
                      onClick={(e) => { e.stopPropagation(); toggleSelectTask(task.id) }}
                    >
                      {selectedIds.has(task.id) ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </button>
                  )}
                  <div className="flex-1">
                    <MobileTaskCard
                      task={task}
                      projectColor={getProjectColor(task.project)}
                      projectName={getProjectName(task.project)}
                      isOverdue={isOverdue(task.dueDate)}
                      formatDate={formatDate}
                      onToggleComplete={() => task.status === 'done' ? uncompleteTask(task.id) : completeTask(task.id)}
                      onToggleStar={() => toggleTaskStar(task.id)}
                      onClick={() => batchMode ? toggleSelectTask(task.id) : setDetailTaskId(task.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <MobileEmptyState icon={CheckCircle2} title={activeFilter === 'done' ? '还没有已完成的任务' : '没有任务'} />
        )}
      </div>

      {batchMode && (
        <div className="fixed bottom-[56px] left-0 right-0 z-30 bg-background border-t border-border/40 px-4 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <button
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-muted/50 text-muted-foreground active:scale-95 transition-all"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === sortedTasks.length && sortedTasks.length > 0 ? '取消全选' : '全选'}
            </button>
            <span className="text-[11px] text-muted-foreground">已选 {selectedIds.size} 项</span>
            <button
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-muted/50 text-muted-foreground active:scale-95 transition-all"
              onClick={exitBatchMode}
            >
              退出选择
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex-1 h-9 rounded-xl bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-40"
              onClick={handleBatchComplete} disabled={selectedIds.size === 0}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> 完成
            </button>
            <button
              className="flex-1 h-9 rounded-xl bg-red-500/10 text-red-500 text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-40"
              onClick={handleBatchDelete} disabled={selectedIds.size === 0}
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </button>
            <button
              className="flex-1 h-9 rounded-xl bg-amber-500/10 text-amber-600 text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-40"
              onClick={() => setShowBatchPriority(!showBatchPriority)} disabled={selectedIds.size === 0}
            >
              <Flag className="h-3.5 w-3.5" /> 改优先级
            </button>
            <button
              className="flex-1 h-9 rounded-xl bg-violet-500/10 text-violet-600 text-[11px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-40"
              onClick={() => setShowBatchTag(!showBatchTag)} disabled={selectedIds.size === 0}
            >
              <TagIcon className="h-3.5 w-3.5" /> 添加标签
            </button>
          </div>
          {showBatchPriority && (
            <div className="flex gap-1.5 pt-1">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p} className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 text-[11px] font-medium active:scale-95 transition-all" onClick={() => handleBatchPriority(p)}>
                  {p === 'urgent' ? '紧急' : p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
                </button>
              ))}
            </div>
          )}
          {showBatchTag && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map(tag => (
                <button key={tag.id} className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-muted/50 text-[11px] font-medium active:scale-95 transition-all" onClick={() => handleBatchAddTag(tag.name)}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-[56px] right-4 z-30">
        <button
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all active:scale-90"
          onClick={() => { setAddTitle(''); setAddPriority('medium'); setShowAddSheet(true) }}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <MobileAddTaskSheet open={showAddSheet} onClose={() => { setShowAddSheet(false); setAddTitle('') }}
        initialTitle={addTitle} initialPriority={addPriority} onAdd={handleFullAdd}
        projects={projects} tags={tags} formatDate={formatDate} />

      <MobileTaskDetailSheet open={detailTaskId !== null} onClose={() => setDetailTaskId(null)}
        taskId={detailTaskId} projects={projects} tags={tags} today={today} />
    </div>
  )
}

interface KanbanViewProps {
  columns: KanbanColumn[]
  kanbanGroups: Record<KanbanColumnId, Task[]>
  getProjectColor: (id: string | undefined) => string
  getProjectName: (id: string | undefined) => string
  isOverdue: (date: Date | string | undefined) => boolean
  formatDate: (date: Date | string | undefined) => string
  onTaskClick: (taskId: string) => void
  getLeftColumn: (current: KanbanColumnId) => ((taskId: string) => void) | undefined
  getRightColumn: (current: KanbanColumnId) => ((taskId: string) => void) | undefined
  onToggleComplete: (taskId: string, isDone: boolean) => void
}

function KanbanView({ columns, kanbanGroups, getProjectColor, getProjectName, isOverdue, formatDate, onTaskClick, getLeftColumn, getRightColumn, onToggleComplete }: KanbanViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeColumnIdx, setActiveColumnIdx] = useState(0)
  const [canScroll, setCanScroll] = useState(false)

  const totalTasks = useMemo(
    () => columns.reduce((sum, c) => sum + kanbanGroups[c.id].length, 0),
    [columns, kanbanGroups]
  )
  const doneTasks = kanbanGroups['done'].length

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanScroll(max > 4)
    if (max <= 4) {
      setActiveColumnIdx(0)
      return
    }
    const colWidth = el.scrollWidth / columns.length
    const idx = Math.round(el.scrollLeft / colWidth)
    setActiveColumnIdx(Math.min(columns.length - 1, Math.max(0, idx)))
  }, [columns.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, columns, kanbanGroups])

  const scrollToColumn = (idx: number) => {
    const el = scrollRef.current
    if (!el) return
    const colWidth = el.scrollWidth / columns.length
    el.scrollTo({ left: colWidth * idx, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col">
      {/* 顶部进度概览 */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">完成进度</span>
            <span className="text-[11px] font-semibold tabular-nums">
              <span className="text-foreground">{doneTasks}</span>
              <span className="text-muted-foreground"> / {totalTasks}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 看板横向滚动区 */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-3 py-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {columns.map((column) => {
          const list = kanbanGroups[column.id]
          return (
            <KanbanColumn
              key={column.id}
              column={column}
              list={list}
              isActive={activeColumnIdx === columns.findIndex(c => c.id === column.id)}
              getProjectColor={getProjectColor}
              getProjectName={getProjectName}
              isOverdue={isOverdue}
              formatDate={formatDate}
              onTaskClick={onTaskClick}
              getLeftColumn={getLeftColumn(column.id)}
              getRightColumn={getRightColumn(column.id)}
              onToggleComplete={onToggleComplete}
            />
          )
        })}
      </div>

      {/* 底部点状指示器 - 仅在需要滚动时显示 */}
      {canScroll && (
        <div className="flex items-center justify-center gap-1.5 pb-3 pt-1">
          {columns.map((col, idx) => (
            <button
              key={col.id}
              onClick={() => scrollToColumn(idx)}
              aria-label={`切换到${col.label}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200 active:scale-90',
                activeColumnIdx === idx ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface KanbanColumnProps {
  column: KanbanColumn
  list: Task[]
  isActive: boolean
  getProjectColor: (id: string | undefined) => string
  getProjectName: (id: string | undefined) => string
  isOverdue: (date: Date | string | undefined) => boolean
  formatDate: (date: Date | string | undefined) => string
  onTaskClick: (taskId: string) => void
  getLeftColumn?: (taskId: string) => void
  getRightColumn?: (taskId: string) => void
  onToggleComplete: (taskId: string, isDone: boolean) => void
}

const KanbanColumn = memo(function KanbanColumn({ column, list, isActive, getProjectColor, getProjectName, isOverdue, formatDate, onTaskClick, getLeftColumn, getRightColumn, onToggleComplete }: KanbanColumnProps) {
  const Icon = column.icon
  return (
    <div className={cn(
      'shrink-0 w-[78vw] max-w-[300px] flex flex-col snap-center transition-opacity duration-200',
      !isActive && 'opacity-70'
    )}>
      {/* 列头 */}
      <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-2xl relative overflow-hidden', column.bg)}>
        <div className={cn('absolute left-0 top-0 bottom-0 w-1', column.accent)} />
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', column.color)} />
          <span className={cn('text-[13px] font-semibold tracking-tight', column.color)}>{column.label}</span>
        </div>
        <span className={cn(
          'text-[10px] font-semibold rounded-full min-w-[20px] h-[18px] flex items-center justify-center px-1.5',
          column.color, 'bg-background/70'
        )}>
          {list.length}
        </span>
      </div>

      {/* 列表区 */}
      <div className="flex-1 space-y-2 p-2 rounded-b-2xl bg-muted/30 min-h-[200px]">
        {list.length > 0 ? (
          list.map(task => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              projectColor={getProjectColor(task.project)}
              projectName={getProjectName(task.project)}
              isOverdue={isOverdue(task.dueDate)}
              formatDate={formatDate}
              onClick={() => onTaskClick(task.id)}
              onMoveLeft={getLeftColumn}
              onMoveRight={getRightColumn}
              onToggleComplete={() => onToggleComplete(task.id, task.status === 'done')}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center mb-1.5', column.bg)}>
              <Archive className="h-4 w-4" />
            </div>
            <span className="text-[10px]">无任务</span>
          </div>
        )}
      </div>
    </div>
  )
})

interface KanbanTaskCardProps {
  task: Task
  projectColor: string
  projectName: string
  isOverdue: boolean
  formatDate: (date: Date | string | undefined) => string
  onClick: () => void
  onMoveLeft?: (taskId: string) => void
  onMoveRight?: (taskId: string) => void
  onToggleComplete: () => void
}

const PRIORITY_BAR_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-300 dark:bg-gray-600',
}

const KanbanTaskCard = memo(function KanbanTaskCard({ task, projectColor, projectName, isOverdue, formatDate, onClick, onMoveLeft, onMoveRight, onToggleComplete }: KanbanTaskCardProps) {
  const isDone = task.status === 'done'
  const subtitle = task.description || task.notes
  const tagCount = task.tags?.length || 0
  const subtaskCount = task.subtasks?.length || 0
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0

  return (
    <div
      className={cn(
        'relative rounded-xl bg-background p-2.5 pl-3 border border-border/40 active:scale-[0.98] transition-all cursor-pointer shadow-sm overflow-hidden',
        isDone && 'opacity-60 bg-muted/20'
      )}
      onClick={onClick}
    >
      {/* 左侧优先级色条 */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', PRIORITY_BAR_COLORS[task.priority] || 'bg-gray-300')} />

      <div className="flex items-start gap-1.5 mb-1">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete() }}
          className={cn(
            'shrink-0 mt-0.5 h-4 w-4 rounded-full border-[1.5px] flex items-center justify-center transition-all active:scale-90',
            isDone ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-primary'
          )}
        >
          {isDone && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
        </button>
        <p className={cn(
          'text-[12.5px] font-medium leading-snug flex-1 min-w-0 break-words',
          isDone && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
      </div>

      {/* 描述/备注（如果存在） */}
      {subtitle && (
        <p className="text-[10px] text-muted-foreground line-clamp-1 ml-5 mb-1.5">{subtitle}</p>
      )}

      {/* 子任务进度 */}
      {subtaskCount > 0 && (
        <div className="ml-5 mb-1.5 flex items-center gap-1.5">
          <div className="flex-1 h-0.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(completedSubtasks / subtaskCount) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{completedSubtasks}/{subtaskCount}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-1 mt-1 ml-5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {projectName && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />
              <span className="truncate">{projectName}</span>
            </span>
          )}
          {task.dueDate && (
            <span className={cn(
              'flex items-center gap-0.5 text-[10px] shrink-0',
              isOverdue && !isDone ? 'text-red-500 font-medium' : 'text-muted-foreground'
            )}>
              <CalendarDays className="h-2.5 w-2.5" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {tagCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
              <TagIcon className="h-2.5 w-2.5" />
              {tagCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onMoveLeft && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveLeft(task.id) }}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-90 transition-all"
              title="上一列"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          )}
          {onMoveRight && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveRight(task.id) }}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-90 transition-all"
              title="下一列"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
