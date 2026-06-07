'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppStore, Task, RepeatRule, SubTask, ScheduleItemType, TaskReminder } from '@/lib/store'
import { isRepeatTaskCompletedToday } from '@/lib/hooks'
import { useSmartLists } from '@/lib/smart-lists'
import { WEEK_DAYS, MONTH_NAMES, PRIORITY_CONFIG, TIME_SLOTS } from '@/lib/config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { TaskReminders } from '@/components/task-reminders'
import { TaskEfficiencyCard } from '@/components/task-efficiency-card'
import { QuickDatePresets } from '@/components/quick-date-presets'
import { SavedFiltersBar } from '@/components/saved-filters-bar'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  Filter,
  Timer,
  Calendar,
  Tag,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Trash2,
  Play,
  GripVertical,
  Repeat,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Edit,
  X,
  ListTodo,
  ArrowUpRight,
  MoreHorizontal,
  Clock,
  FileText,
  LayoutGrid,
  List,
  LayoutList,
  Bell,
  Coffee,
  Briefcase,
  User,
  Sun,
  Moon,
  CalendarClock,
  CalendarDays,
  Link2,
  SkipForward,
  Pause,
  RotateCcw,
  Star,
  Archive,
  Zap,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { TaskTemplates, TaskTemplate } from '@/components/task-templates'
import { BatchOperations, TaskSelectionWrapper } from '@/components/batch-operations'
import { TaskDependencyManager, TaskDependencyBadge } from '@/components/task-dependencies'
import { QuickAddTask } from '@/components/quick-add-task'
import { TaskQuickActions } from '@/components/task-quick-actions'
import { parseSmartInput } from '@/lib/smart-input'
import { useDataLink } from '@/lib/data-link-service'
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const priorityConfig = {
  urgent: { label: PRIORITY_CONFIG.urgent.label, color: 'bg-destructive', icon: AlertCircle, textColor: 'text-destructive' },
  high: { label: PRIORITY_CONFIG.high.label, color: 'bg-chart-3', icon: ArrowUp, textColor: 'text-chart-3' },
  medium: { label: PRIORITY_CONFIG.medium.label, color: 'bg-chart-1', icon: ArrowRight, textColor: 'text-chart-1' },
  low: { label: PRIORITY_CONFIG.low.label, color: 'bg-muted-foreground', icon: ArrowDown, textColor: 'text-muted-foreground' },
}

const typeConfig = {
  task: { label: '任务', icon: ListTodo, color: '#4A90E2', bgColor: 'bg-chart-1/20' },
  event: { label: '日程', icon: CalendarClock, color: '#9B59B6', bgColor: 'bg-purple-100 dark:bg-purple-900/20' },
  reminder: { label: '提醒', icon: Bell, color: '#F5A623', bgColor: 'bg-orange-100 dark:bg-orange-900/20' },
}

const repeatLabels: Record<RepeatRule['type'], string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  custom: '自定义',
}

const weekDays = WEEK_DAYS
const monthNames = MONTH_NAMES

function SortableKanbanCard({ task, today }: { task: Task; today: Date }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className={cn(
        'rounded-xl border bg-card p-3 cursor-grab transition-all duration-200 hover:shadow-md hover:border-primary/25',
        isDragging && 'shadow-lg ring-2 ring-primary/30'
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className={cn('h-2 w-2 rounded-full', priorityConfig[task.priority].color)} />
          <p className="font-medium text-sm truncate flex-1">{task.title}</p>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {task.project && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{task.project}</Badge>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              <Tag className="mr-0.5 h-2.5 w-2.5" />{tag}
            </Badge>
          ))}
          {task.estimatedPomodoros && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Timer className="h-2.5 w-2.5" />{task.completedPomodoros}/{task.estimatedPomodoros}
            </span>
          )}
          {task.timeSpent && task.timeSpent > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {Math.round(task.timeSpent / 60)}m
            </span>
          )}
          {task.dueDate && (() => {
            const dueDate = new Date(task.dueDate)
            dueDate.setHours(0, 0, 0, 0)
            const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            
            let dateText = ''
            if (diffDays === 0) dateText = '今天'
            else if (diffDays === 1) dateText = '明天'
            else if (diffDays === -1) dateText = '昨天'
            else if (diffDays === 2) dateText = '后天'
            else if (diffDays === -2) dateText = '前天'
            else if (diffDays > 7) dateText = dueDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
            else if (diffDays > 0) dateText = `${diffDays}天后`
            else dateText = `${Math.abs(diffDays)}天前`
            
            return (
              <span className={cn(
                "flex items-center gap-0.5 text-[10px]",
                diffDays < 0 && task.status !== 'done' ? "text-destructive" : diffDays === 0 ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                <Calendar className="h-2.5 w-2.5" />
                {dateText}
              </span>
            )
          })()}
        </div>
        {task.subTasks && task.subTasks.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <Progress
              value={(task.subTasks.filter(st => st.completed).length / task.subTasks.length) * 100}
              className="h-1 flex-1"
            />
            <span className="text-[10px] text-muted-foreground">
              {task.subTasks.filter(st => st.completed).length}/{task.subTasks.length}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const timeSlots = TIME_SLOTS

export function TasksView() {
  const { 
    tasks, 
    addTask, 
    updateTask, 
    deleteTask, 
    toggleTaskStar,
    archiveTask,
    unarchiveTask,
    completeTask, 
    uncompleteTask,
    skipRepeatTask,
    pauseRepeatTask,
    resumeRepeatTask,
    addSubTask, 
    updateSubTask,
    toggleSubTask, 
    deleteSubTask,
    reorderSubTasks,
    convertSubTaskToTask,
    convertTaskToEvent,
    convertEventToTask,
    batchCompleteTasks,
    batchDeleteTasks,
    batchUpdateTaskPriority,
    batchAddTagToTasks,
    projects,
    timeEntries,
    pomodoroSessions,
    anniversaries,
    setActiveView,
    taskOrder,
    updateTaskOrder,
    repeatCompletions,
    undoLastDelete,
    activeSmartList,
    setActiveSmartList,
    addTaskComment,
    deleteTaskComment,
    savedFilters,
  } = useAppStore(useShallow((state) => ({
    tasks: state.tasks,
    addTask: state.addTask,
    updateTask: state.updateTask,
    deleteTask: state.deleteTask,
    toggleTaskStar: state.toggleTaskStar,
    archiveTask: state.archiveTask,
    unarchiveTask: state.unarchiveTask,
    completeTask: state.completeTask,
    uncompleteTask: state.uncompleteTask,
    skipRepeatTask: state.skipRepeatTask,
    pauseRepeatTask: state.pauseRepeatTask,
    resumeRepeatTask: state.resumeRepeatTask,
    addSubTask: state.addSubTask,
    updateSubTask: state.updateSubTask,
    toggleSubTask: state.toggleSubTask,
    deleteSubTask: state.deleteSubTask,
    reorderSubTasks: state.reorderSubTasks,
    convertSubTaskToTask: state.convertSubTaskToTask,
    convertTaskToEvent: state.convertTaskToEvent,
    convertEventToTask: state.convertEventToTask,
    batchCompleteTasks: state.batchCompleteTasks,
    batchDeleteTasks: state.batchDeleteTasks,
    batchUpdateTaskPriority: state.batchUpdateTaskPriority,
    batchAddTagToTasks: state.batchAddTagToTasks,
    projects: state.projects,
    timeEntries: state.timeEntries,
    pomodoroSessions: state.pomodoroSessions,
    anniversaries: state.anniversaries,
    setActiveView: state.setActiveView,
    taskOrder: state.taskOrder,
    updateTaskOrder: state.updateTaskOrder,
    repeatCompletions: state.repeatCompletions,
    undoLastDelete: state.undoLastDelete,
    activeSmartList: state.activeSmartList,
    setActiveSmartList: state.setActiveSmartList,
    addTaskComment: state.addTaskComment,
    deleteTaskComment: state.deleteTaskComment,
    savedFilters: state.savedFilters,
  })))
  
  const dataLink = useDataLink()
  
  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task && task.status !== 'done') {
      completeTask(taskId)
      dataLink.handleTaskCompletion(taskId)
    }
  }
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<Date | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [subTaskInputs, setSubTaskInputs] = useState<Record<string, string>>({})
  const [editingSubTask, setEditingSubTask] = useState<{ taskId: string; subTaskId: string; title: string } | null>(null)
  const [draggedSubTask, setDraggedSubTask] = useState<{ taskId: string; subTaskId: string; index: number } | null>(null)
  const [dragOverSubTask, setDragOverSubTask] = useState<{ taskId: string; index: number } | null>(null)
  const [highlightedDate, setHighlightedDate] = useState<Date | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'matrix'>('list')
  const [showTemplates, setShowTemplates] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'task' as ScheduleItemType,
    priority: 'medium' as Task['priority'],
    project: '',
    tags: [] as string[],
    estimatedPomodoros: 1,
    estimatedMinutes: undefined as number | undefined,
    dueDate: '',
    dueTime: '',
    startTime: '',
    endTime: '',
    isAllDay: false,
    repeat: false,
    repeatType: 'daily' as RepeatRule['type'],
    repeatInterval: 1,
    repeatEndType: 'never' as 'never' | 'date' | 'count',
    repeatEndDate: '',
    repeatEndCount: 10,
    reminders: [] as TaskReminder[],
    color: '#4A90E2',
    energy: 'medium' as Task['energy'],
  })
  const [newTag, setNewTag] = useState('')
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [contextMenu, setContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null)

  const allTags = [...new Set(tasks.flatMap((t) => t.tags))]
  const { smartLists, getSmartListTasks } = useSmartLists()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus
      const matchesTag = filterTag === 'all' || task.tags.includes(filterTag)
      const matchesType = filterType === 'all' || task.type === filterType
      const matchesDate = !filterDate || 
        (task.dueDate && new Date(task.dueDate).toDateString() === filterDate.toDateString())
      return matchesSearch && matchesPriority && matchesStatus && matchesTag && matchesType && matchesDate
    })
    
    if (activeSmartList) {
      if (activeSmartList === 'starred') {
        filtered = filtered.filter(t => t.starred && t.status !== 'done')
      } else {
        const smartListTasks = getSmartListTasks(activeSmartList)
        const smartListTaskIds = new Set(smartListTasks.map(t => t.id))
        filtered = filtered.filter(t => smartListTaskIds.has(t.id))
      }
    }
    
    return filtered
  }, [tasks, searchQuery, filterPriority, filterStatus, filterTag, filterType, filterDate, activeSmartList, getSmartListTasks])

  const hasAnyFilter = () =>
    !!searchQuery ||
    filterPriority !== 'all' ||
    filterStatus !== 'all' ||
    filterTag !== 'all' ||
    filterType !== 'all' ||
    !!filterDate

  const groupedTasks = useMemo(() => {
    const sortTasks = (taskList: Task[]) => {
      if (taskOrder.length === 0) return taskList
      return [...taskList].sort((a, b) => {
        const aIndex = taskOrder.indexOf(a.id)
        const bIndex = taskOrder.indexOf(b.id)
        if (aIndex === -1 && bIndex === -1) return 0
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
    }

    const isActiveTask = (t: Task) => t.status !== 'done' || !!t.repeatRule
    
    return {
      urgent: sortTasks(filteredTasks.filter((t) => t.priority === 'urgent' && isActiveTask(t))),
      high: sortTasks(filteredTasks.filter((t) => t.priority === 'high' && isActiveTask(t))),
      medium: sortTasks(filteredTasks.filter((t) => t.priority === 'medium' && isActiveTask(t))),
      low: sortTasks(filteredTasks.filter((t) => t.priority === 'low' && isActiveTask(t))),
      done: filteredTasks.filter((t) => t.status === 'done' && !t.repeatRule),
    }
  }, [filteredTasks, taskOrder])

  const kanbanGroups = useMemo(() => {
    return {
      todo: filteredTasks.filter((t) => t.status === 'todo' || (t.status === 'done' && !!t.repeatRule)),
      'in-progress': filteredTasks.filter((t) => t.status === 'in-progress'),
      done: filteredTasks.filter((t) => t.status === 'done' && !t.repeatRule),
    }
  }, [filteredTasks])

  const matrixGroups = useMemo(() => {
    const activeTasks = filteredTasks.filter(t => t.status !== 'done' || !!t.repeatRule)
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const threeDaysLater = new Date(todayDate)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    const isUrgent = (t: Task) => {
      if (t.priority === 'urgent') return true
      if (t.dueDate) {
        const due = new Date(t.dueDate)
        due.setHours(0, 0, 0, 0)
        if (due <= todayDate) return true
      }
      return false
    }
    const isImportant = (t: Task) => t.priority === 'urgent' || t.priority === 'high'
    return {
      doFirst: activeTasks.filter(t => isUrgent(t) && isImportant(t)),
      schedule: activeTasks.filter(t => !isUrgent(t) && isImportant(t)),
      delegate: activeTasks.filter(t => isUrgent(t) && !isImportant(t)),
      eliminate: activeTasks.filter(t => !isUrgent(t) && !isImportant(t)),
    }
  }, [filteredTasks])

  const kanbanColumns = [
    { id: 'todo' as const, label: '待办', icon: ListTodo, color: 'border-t-chart-1', headerBg: 'bg-chart-1/5' },
    { id: 'in-progress' as const, label: '进行中', icon: Play, color: 'border-t-chart-3', headerBg: 'bg-chart-3/5' },
    { id: 'done' as const, label: '已完成', icon: CheckCircle2, color: 'border-t-chart-2', headerBg: 'bg-chart-2/5' },
  ]

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const [listDraggedTaskId, setListDraggedTaskId] = useState<string | null>(null)
  const [listDragOverTaskId, setListDragOverTaskId] = useState<string | null>(null)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )
  const [activeKanbanTaskId, setActiveKanbanTaskId] = useState<string | null>(null)

  const handleKanbanDragStart = (event: DragStartEvent) => {
    setActiveKanbanTaskId(event.active.id as string)
  }

  const handleKanbanDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    const activeTask = tasks.find(t => t.id === activeId)
    if (!activeTask) return
    const overColumn = kanbanColumns.find(col => col.id === overId)
    if (overColumn) {
      if (activeTask.status !== overColumn.id) {
        if (overColumn.id === 'done') {
          handleCompleteTask(activeId)
        } else {
          updateTask(activeId, { status: overColumn.id as Task['status'] })
        }
      }
      return
    }
    const overTask = tasks.find(t => t.id === overId)
    if (overTask && activeTask.status !== overTask.status) {
      if (overTask.status === 'done') {
        handleCompleteTask(activeId)
      } else {
        updateTask(activeId, { status: overTask.status })
      }
    }
  }

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    setActiveKanbanTaskId(null)
  }

  const handleListDragStart = (taskId: string) => {
    setListDraggedTaskId(taskId)
  }

  const handleListDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    if (listDraggedTaskId && listDraggedTaskId !== taskId) {
      setListDragOverTaskId(taskId)
    }
  }

  const handleListDragEnd = () => {
    if (listDraggedTaskId && listDragOverTaskId) {
      const currentOrder = taskOrder.length > 0 ? taskOrder : tasks.map(t => t.id)
      const fromIndex = currentOrder.indexOf(listDraggedTaskId)
      const toIndex = currentOrder.indexOf(listDragOverTaskId)
      if (fromIndex !== -1 && toIndex !== -1) {
        const newOrder = [...currentOrder]
        newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, listDraggedTaskId)
        updateTaskOrder(newOrder)
      }
    }
    setListDraggedTaskId(null)
    setListDragOverTaskId(null)
  }

  const handleTaskDragStart = (taskId: string) => {
    setDraggedTaskId(taskId)
  }

  const handleTaskDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleTaskDragEnd = () => {
    if (draggedTaskId && dragOverColumn) {
      const task = tasks.find(t => t.id === draggedTaskId)
      if (task && task.status !== dragOverColumn) {
        if (dragOverColumn === 'done') {
          handleCompleteTask(draggedTaskId)
        } else {
          updateTask(draggedTaskId, { status: dragOverColumn as Task['status'] })
        }
      }
    }
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  const handleAddTask = () => {
    if (!newTask.title.trim()) return
    
    let dueDate: Date | undefined
    if (newTask.dueDate) {
      dueDate = new Date(newTask.dueDate)
      if (newTask.dueTime) {
        const [hours, minutes] = newTask.dueTime.split(':')
        dueDate.setHours(parseInt(hours), parseInt(minutes))
      }
    }
    
    let repeatRule: RepeatRule | undefined
    if (newTask.repeat) {
      repeatRule = {
        type: newTask.repeatType,
        interval: newTask.repeatInterval,
      }
      if (newTask.repeatEndType === 'date' && newTask.repeatEndDate) {
        repeatRule.endDate = new Date(newTask.repeatEndDate)
      } else if (newTask.repeatEndType === 'count') {
        repeatRule.endAfterCount = newTask.repeatEndCount
      }
    }
    
    addTask({
      title: newTask.title,
      description: newTask.description,
      type: newTask.type,
      priority: newTask.priority,
      project: newTask.project,
      tags: newTask.tags,
      estimatedPomodoros: newTask.estimatedPomodoros,
      estimatedMinutes: newTask.estimatedMinutes,
      dueDate,
      startTime: newTask.type === 'event' ? newTask.startTime : undefined,
      endTime: newTask.type === 'event' ? newTask.endTime : undefined,
      isAllDay: newTask.isAllDay,
      repeatRule,
      reminders: newTask.reminders,
      color: newTask.color,
      energy: newTask.energy,
      status: 'todo',
    })
    resetNewTask()
    setIsAddDialogOpen(false)
  }

  const handleEditTask = () => {
    if (!editingTask || !newTask.title.trim()) return
    
    let dueDate: Date | undefined
    if (newTask.dueDate) {
      dueDate = new Date(newTask.dueDate)
      if (newTask.dueTime) {
        const [hours, minutes] = newTask.dueTime.split(':')
        dueDate.setHours(parseInt(hours), parseInt(minutes))
      }
    }
    
    let repeatRule: RepeatRule | undefined
    if (newTask.repeat) {
      repeatRule = {
        type: newTask.repeatType,
        interval: newTask.repeatInterval,
      }
      if (newTask.repeatEndType === 'date' && newTask.repeatEndDate) {
        repeatRule.endDate = new Date(newTask.repeatEndDate)
      } else if (newTask.repeatEndType === 'count') {
        repeatRule.endAfterCount = newTask.repeatEndCount
      }
    }
    
    updateTask(editingTask.id, {
      title: newTask.title,
      description: newTask.description,
      type: newTask.type,
      priority: newTask.priority,
      project: newTask.project,
      tags: newTask.tags,
      estimatedPomodoros: newTask.estimatedPomodoros,
      estimatedMinutes: newTask.estimatedMinutes,
      dueDate,
      startTime: newTask.type === 'event' ? newTask.startTime : undefined,
      endTime: newTask.type === 'event' ? newTask.endTime : undefined,
      isAllDay: newTask.isAllDay,
      repeatRule,
      reminders: newTask.reminders,
      color: newTask.color,
      energy: newTask.energy,
    })
    resetNewTask()
    setEditingTask(null)
    setIsAddDialogOpen(false)
  }

  const resetNewTask = () => {
    setNewTask({
      title: '',
      description: '',
      type: 'task',
      priority: 'medium',
      project: '',
      tags: [],
      estimatedPomodoros: 1,
      estimatedMinutes: undefined,
      dueDate: '',
      dueTime: '',
      startTime: '',
      endTime: '',
      isAllDay: false,
      repeat: false,
      repeatType: 'daily',
      repeatInterval: 1,
      repeatEndType: 'never',
      repeatEndDate: '',
      repeatEndCount: 10,
      reminders: [],
      color: '#4A90E2',
      energy: 'medium',
    })
    setNewTag('')
  }

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setNewTask({
      title: task.title,
      description: task.description || '',
      type: task.type || 'task',
      priority: task.priority,
      project: task.project || '',
      tags: task.tags,
      estimatedPomodoros: task.estimatedPomodoros || 1,
      estimatedMinutes: task.estimatedMinutes,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      dueTime: task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '',
      startTime: task.startTime || '',
      endTime: task.endTime || '',
      isAllDay: task.isAllDay || false,
      repeat: !!task.repeatRule,
      repeatType: task.repeatRule?.type || 'daily',
      repeatInterval: task.repeatRule?.interval || 1,
      repeatEndType: task.repeatRule?.endDate ? 'date' : task.repeatRule?.endAfterCount ? 'count' : 'never',
      repeatEndDate: task.repeatRule?.endDate ? new Date(task.repeatRule.endDate).toISOString().split('T')[0] : '',
      repeatEndCount: task.repeatRule?.endAfterCount || 10,
      reminders: task.reminders ? [...task.reminders] : [],
      color: task.color || '#4A90E2',
      energy: task.energy || 'medium',
    })
    setIsAddDialogOpen(true)
  }

  const toggleExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
  }

  const handleAddTag = () => {
    if (newTag.trim() && !newTask.tags.includes(newTag.trim())) {
      setNewTask({ ...newTask, tags: [...newTask.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setNewTask({ ...newTask, tags: newTask.tags.filter((t) => t !== tag) })
  }

  const handleAddSubTask = (taskId: string) => {
    const input = subTaskInputs[taskId] || ''
    if (input.trim()) {
      addSubTask(taskId, input.trim())
      setSubTaskInputs({ ...subTaskInputs, [taskId]: '' })
    }
  }

  const handleSubTaskKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSubTask(taskId)
    }
  }

  const handleEditSubTask = (taskId: string, subTaskId: string, newTitle: string) => {
    if (newTitle.trim()) {
      updateSubTask(taskId, subTaskId, { title: newTitle.trim() })
    }
    setEditingSubTask(null)
  }

  const handleDragStart = (taskId: string, subTaskId: string, index: number) => {
    setDraggedSubTask({ taskId, subTaskId, index })
  }

  const handleDragOver = (e: React.DragEvent, taskId: string, index: number) => {
    e.preventDefault()
    if (draggedSubTask && draggedSubTask.taskId === taskId) {
      setDragOverSubTask({ taskId, index })
    }
  }

  const handleDragEnd = () => {
    if (draggedSubTask && dragOverSubTask && draggedSubTask.taskId === dragOverSubTask.taskId) {
      const task = tasks.find(t => t.id === draggedSubTask.taskId)
      if (task && task.subTasks) {
        const subTaskIds = [...task.subTasks.map(st => st.id)]
        const [removed] = subTaskIds.splice(draggedSubTask.index, 1)
        subTaskIds.splice(dragOverSubTask.index, 0, removed)
        reorderSubTasks(draggedSubTask.taskId, subTaskIds)
      }
    }
    setDraggedSubTask(null)
    setDragOverSubTask(null)
  }

  const handleConvertToTask = (taskId: string, subTaskId: string) => {
    convertSubTaskToTask(taskId, subTaskId)
  }

  const handleTaskClick = (task: Task) => {
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      setHighlightedDate(dueDate)
      setTimeout(() => setHighlightedDate(null), 2000)
    }
  }

  const handleSelectTemplate = (template: TaskTemplate) => {
    setNewTask({
      title: template.title,
      description: template.description || '',
      type: 'task',
      priority: template.priority,
      project: template.project || '',
      tags: template.tags,
      estimatedPomodoros: template.estimatedPomodoros,
      estimatedMinutes: undefined,
      dueDate: '',
      dueTime: '',
      startTime: '',
      endTime: '',
      isAllDay: false,
      repeat: false,
      repeatType: 'daily',
      repeatInterval: 1,
      repeatEndType: 'never',
      repeatEndDate: '',
      repeatEndCount: 10,
      reminders: [],
      color: '#4A90E2',
      energy: 'medium',
    })
    setIsAddDialogOpen(true)
    setShowTemplates(false)
  }

  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTasks)
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId)
    } else {
      newSelection.add(taskId)
    }
    setSelectedTasks(newSelection)
  }

  const clearSelection = () => {
    setSelectedTasks(new Set())
  }

  useEffect(() => {
    if (editingSubTask && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingSubTask])

  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setContextMenu({ taskId: detail.taskId, x: detail.x, y: detail.y })
    }
    window.addEventListener('task-context-menu', handleContextMenu)
    return () => window.removeEventListener('task-context-menu', handleContextMenu)
  }, [])

  const TaskItem = ({ task }: { task: Task }) => {
    const priority = priorityConfig[task.priority]
    const PriorityIcon = priority.icon
    const taskType = typeConfig[task.type || 'task']
    const TypeIcon = taskType.icon
    const isExpanded = expandedTasks.has(task.id)
    const subTasks = task.subTasks || []
    const completedSubTasks = subTasks.filter((st) => st.completed).length
    const subTaskProgress = subTasks.length > 0 ? (completedSubTasks / subTasks.length) * 100 : 0
    const currentSubTaskInput = subTaskInputs[task.id] || ''
    const isSelected = selectedTasks.has(task.id)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return (
      <TaskSelectionWrapper
        taskId={task.id}
        isSelected={isSelected}
        onToggleSelection={toggleTaskSelection}
      >
        <div
          draggable
          onDragStart={() => handleListDragStart(task.id)}
          onDragOver={(e) => handleListDragOver(e, task.id)}
          onDragEnd={handleListDragEnd}
          className={cn(
            'group rounded-2xl border border-border/50 bg-card transition-all duration-200 hover:border-primary/25 hover:shadow-md cursor-pointer',
            task.status === 'done' && 'opacity-60',
            isSelected && 'ring-2 ring-primary/50',
            listDraggedTaskId === task.id && 'opacity-50',
            listDragOverTaskId === task.id && 'border-t-2 border-t-primary'
          )}
          onClick={() => handleTaskClick(task)}
        >
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(task.id)
            }}
            className="shrink-0"
          >
            {subTasks.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <div className="h-4 w-4" />
            )}
          </button>
          <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground md:opacity-0 md:transition-opacity md:group-hover:opacity-100 shrink-0" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleTaskStar(task.id)
            }}
            className="shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          >
            <Star className={cn(
              'h-4 w-4 transition-colors',
              task.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground hover:text-amber-400'
            )} />
          </button>
          <Checkbox
            checked={task.status === 'done' || (task.repeatRule ? isRepeatTaskCompletedToday(task, repeatCompletions) : false)}
            onCheckedChange={(checked) => {
              if (checked) {
                handleCompleteTask(task.id)
                toast.success('任务已完成', {
                  description: task.title,
                  action: {
                    label: '撤销',
                    onClick: () => uncompleteTask(task.id),
                  },
                  duration: 5000,
                })
              } else {
                uncompleteTask(task.id)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "h-5 w-5 shrink-0",
              task.repeatRule && isRepeatTaskCompletedToday(task, repeatCompletions) && "border-green-500/50 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            )}
          />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className={cn('font-medium truncate', (task.status === 'done' || (task.repeatRule && isRepeatTaskCompletedToday(task, repeatCompletions))) && 'line-through text-muted-foreground')}>
                {task.title}
              </p>
              {task.energy === 'high' && <span className="text-xs shrink-0">⚡</span>}
              {task.energy === 'low' && <span className="text-xs shrink-0">🌙</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeIcon className="h-3.5 w-3.5 shrink-0" style={{ color: taskType.color }} />
              <PriorityIcon className={cn('h-3.5 w-3.5 shrink-0', priority.textColor)} />
              {task.repeatRule && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] gap-0.5 h-4 px-1",
                    task.repeatRule.paused 
                      ? "text-yellow-600 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700"
                      : "text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700"
                  )}
                >
                  {task.repeatRule.paused ? <Pause className="h-2.5 w-2.5" /> : <Repeat className="h-2.5 w-2.5" />}
                  {task.repeatRule.paused ? '已暂停' : repeatLabels[task.repeatRule.type]}
                  {!task.repeatRule.paused && task.repeatRule.completedCount && task.repeatRule.completedCount > 0 && (
                    <span>·{task.repeatRule.completedCount}次</span>
                  )}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] gap-0.5 h-4 px-1" style={{ borderColor: taskType.color, color: taskType.color }}>
                {taskType.label}
              </Badge>
              {task.project && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {task.project}
                </Badge>
              )}
              {task.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1">
                  <Tag className="mr-0.5 h-2.5 w-2.5" />
                  {tag}
                </Badge>
              ))}
              {task.estimatedPomodoros && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Timer className="h-2.5 w-2.5" />
                  {task.completedPomodoros}/{task.estimatedPomodoros}
                </span>
              )}
              {task.estimatedMinutes && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {task.estimatedMinutes}分钟
                </span>
              )}
              {task.dueDate && (() => {
                const dueDate = new Date(task.dueDate)
                dueDate.setHours(0, 0, 0, 0)
                const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                
                let dateText = ''
                let isOverdue = false
                
                if (diffDays === 0) {
                  dateText = '今天'
                } else if (diffDays === 1) {
                  dateText = '明天'
                } else if (diffDays === -1) {
                  dateText = '昨天'
                  isOverdue = task.status !== 'done'
                } else if (diffDays === 2) {
                  dateText = '后天'
                } else if (diffDays === -2) {
                  dateText = '前天'
                  isOverdue = task.status !== 'done'
                } else if (diffDays > 7) {
                  dateText = dueDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
                } else if (diffDays > 0) {
                  dateText = `${diffDays}天后`
                } else {
                  dateText = `${Math.abs(diffDays)}天前`
                  isOverdue = task.status !== 'done'
                }
                
                return (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] h-4 px-1",
                      isOverdue && "text-destructive border-destructive/50",
                      diffDays === 0 && "text-primary border-primary/30 font-medium"
                    )}
                  >
                    <Calendar className="mr-0.5 h-2.5 w-2.5" />
                    {dateText}
                  </Badge>
                )
              })()}
              {subTasks.length > 0 && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] gap-0.5 h-4 px-1",
                    completedSubTasks === subTasks.length && "bg-chart-2/10 text-chart-2 border-chart-2/30"
                  )}
                >
                  <ListTodo className="h-2.5 w-2.5" />
                  {completedSubTasks}/{subTasks.length}
                </Badge>
              )}
              <TaskDependencyBadge taskId={task.id} />
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
            )}
            {subTasks.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Progress value={subTaskProgress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground w-8">{Math.round(subTaskProgress)}%</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 shrink-0">
            {task.repeatRule && !task.repeatRule.paused && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                title="跳过本次"
                onClick={(e) => {
                  e.stopPropagation()
                  skipRepeatTask(task.id)
                }}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            )}
            {task.repeatRule && (
              task.repeatRule.paused ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  title="恢复重复"
                  onClick={(e) => {
                    e.stopPropagation()
                    resumeRepeatTask(task.id)
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                  title="暂停重复"
                  onClick={(e) => {
                    e.stopPropagation()
                    pauseRepeatTask(task.id)
                  }}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )
            )}
            <>
                <TaskQuickActions taskId={task.id} compact />
                <TaskDependencyManager
                  taskId={task.id}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                openEditDialog(task)
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                archiveTask(task.id)
                toast.success('任务已归档', {
                  description: task.title,
                  action: {
                    label: '撤销',
                    onClick: () => unarchiveTask(task.id),
                  },
                  duration: 5000,
                })
              }}
              title="归档任务"
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                deleteTask(task.id)
                toast.success('任务已删除', {
                  description: task.title,
                  action: {
                    label: '撤销',
                    onClick: () => undoLastDelete(),
                  },
                  duration: 5000,
                })
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t px-4 py-3 bg-muted/20" onClick={(e) => e.stopPropagation()}>
            {task.description && (
              <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{task.description}</p>
            )}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">备注</span>
              </div>
              <Textarea
                placeholder="添加备注..."
                value={task.notes || ''}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                className="min-h-[60px] text-sm resize-none"
              />
            </div>
            {(task.estimatedMinutes || task.estimatedPomodoros || (task.timeSpent || 0) > 0) && (
              <div className="mb-3">
                <TaskEfficiencyCard taskId={task.id} />
              </div>
            )}
            {subTasks.length > 0 && (
              <div className="space-y-1 mb-3">
                {subTasks.map((subTask, index) => (
                  <SubTaskItem 
                    key={subTask.id} 
                    subTask={subTask} 
                    taskId={task.id}
                    index={index}
                    onToggle={() => toggleSubTask(task.id, subTask.id)}
                    onDelete={() => deleteSubTask(task.id, subTask.id)}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox 
                className="h-4 w-4 shrink-0 opacity-50" 
                disabled
              />
              <Input
                placeholder="添加子任务，按 Enter 保存..."
                value={currentSubTaskInput}
                onChange={(e) => setSubTaskInputs({ ...subTaskInputs, [task.id]: e.target.value })}
                onKeyDown={(e) => handleSubTaskKeyDown(e, task.id)}
                className="h-8 text-sm border-none shadow-none focus-visible:ring-0 bg-transparent px-0"
              />
              {currentSubTaskInput.trim() && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => handleAddSubTask(task.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {task.repeatRule && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground">
                    完成历史 ({repeatCompletions.filter(c => c.taskId === task.id).length})
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {repeatCompletions
                    .filter(c => c.taskId === task.id)
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .slice(0, 10)
                    .map(completion => (
                      <div key={completion.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-muted/50">
                        <CheckCircle2 className="h-3 w-3 text-chart-2" />
                        <span className="text-muted-foreground">
                          {new Date(completion.completedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {completion.note && (
                          <span className="truncate text-muted-foreground/70">{completion.note}</span>
                        )}
                      </div>
                    ))}
                  {repeatCompletions.filter(c => c.taskId === task.id).length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">暂无完成记录</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">
                  评论 ({task.comments?.length || 0})
                </span>
              </div>
              
              {task.comments && task.comments.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2 group">
                      <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-sm">{comment.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(comment.createdAt).toLocaleString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 md:opacity-0 md:group-hover:opacity-100 shrink-0"
                        onClick={() => deleteTaskComment(task.id, comment.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Input
                  placeholder="添加评论，按 Enter 保存..."
                  value={commentInputs[task.id] || ''}
                  onChange={(e) => setCommentInputs({ ...commentInputs, [task.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (commentInputs[task.id]?.trim())) {
                      addTaskComment(task.id, commentInputs[task.id].trim())
                      setCommentInputs({ ...commentInputs, [task.id]: '' })
                    }
                  }}
                  className="h-8 text-sm"
                />
                {(commentInputs[task.id]?.trim()) && (
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      addTaskComment(task.id, commentInputs[task.id].trim())
                      setCommentInputs({ ...commentInputs, [task.id]: '' })
                    }}
                  >
                    发送
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </TaskSelectionWrapper>
    )
  }

  const SubTaskItem = ({ 
    subTask, 
    taskId, 
    index,
    onToggle, 
    onDelete 
  }: { 
    subTask: SubTask
    taskId: string
    index: number
    onToggle: () => void
    onDelete: () => void
  }) => {
    const isEditing = editingSubTask?.subTaskId === subTask.id
    const isDragging = draggedSubTask?.subTaskId === subTask.id
    const isDragOver = dragOverSubTask?.taskId === taskId && dragOverSubTask?.index === index

    return (
      <div 
        className={cn(
          "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
          "hover:bg-muted/50",
          isDragging && "opacity-50",
          isDragOver && "border-t-2 border-primary"
        )}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          handleDragStart(taskId, subTask.id, index)
        }}
        onDragOver={(e) => handleDragOver(e, taskId, index)}
        onDragEnd={handleDragEnd}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab shrink-0" />
        <Checkbox
          checked={subTask.completed}
          onCheckedChange={onToggle}
          className="h-4 w-4 shrink-0"
        />
        {isEditing ? (
          <Input
            ref={editInputRef}
            value={editingSubTask?.title || ''}
            onChange={(e) => setEditingSubTask({ ...editingSubTask!, title: e.target.value })}
            onBlur={() => handleEditSubTask(taskId, subTask.id, editingSubTask?.title || subTask.title)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleEditSubTask(taskId, subTask.id, editingSubTask?.title || subTask.title)
              } else if (e.key === 'Escape') {
                setEditingSubTask(null)
              }
            }}
            className="h-6 text-sm flex-1"
          />
        ) : (
          <>
            <span
              className={cn(
                'flex-1 text-sm transition-all cursor-text',
                subTask.completed && 'line-through text-muted-foreground'
              )}
              onDoubleClick={() => setEditingSubTask({ taskId, subTaskId: subTask.id, title: subTask.title })}
            >
              {subTask.title}
            </span>
            {subTask.dueDate && (() => {
              const dueDate = new Date(subTask.dueDate)
              dueDate.setHours(0, 0, 0, 0)
              const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              
              let dateText = ''
              if (diffDays === 0) dateText = '今天'
              else if (diffDays === 1) dateText = '明天'
              else if (diffDays === -1) dateText = '昨天'
              else if (diffDays > 7) dateText = dueDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
              else if (diffDays > 0) dateText = `${diffDays}天后`
              else dateText = `${Math.abs(diffDays)}天前`
              
              return (
                <span className={cn(
                  "text-xs flex items-center gap-1",
                  diffDays < 0 && !subTask.completed ? "text-destructive" : diffDays === 0 ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  <Calendar className="h-3 w-3" />
                  {dateText}
                </span>
              )
            })()}
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 shrink-0"
            >
              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setEditingSubTask({ taskId, subTaskId: subTask.id, title: subTask.title })}>
              <Edit className="mr-2 h-3 w-3" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleConvertToTask(taskId, subTask.id)}>
              <ArrowUpRight className="mr-2 h-3 w-3" />
              转为任务
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-3 w-3" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      <QuickAddTask className="mb-2" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">任务与日程</h1>
            {activeSmartList && (
              <Badge 
                variant="secondary" 
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => setActiveSmartList(null)}
              >
                {activeSmartList === 'starred' ? '已收藏' : smartLists.find(l => l.id === activeSmartList)?.name}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5">
            {activeSmartList 
              ? `正在查看: ${activeSmartList === 'starred' ? '已收藏' : smartLists.find(l => l.id === activeSmartList)?.name}`
              : '任务管理与日程安排，高效规划每一天'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <FileText className="h-4 w-4" />
            模板
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) {
              setEditingTask(null)
              resetNewTask()
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新建
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingTask ? '编辑' : '创建'}{newTask.type === 'event' ? '日程' : newTask.type === 'reminder' ? '提醒' : '任务'}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">类型</label>
                <div className="flex gap-2">
                  {Object.entries(typeConfig).map(([key, config]) => {
                    const Icon = config.icon
                    return (
                      <button
                        key={key}
                        onClick={() => setNewTask({ ...newTask, type: key as ScheduleItemType })}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all',
                          newTask.type === key 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <Icon className="h-4 w-4" style={{ color: config.color }} />
                        <span className="text-sm">{config.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">标题</label>
                <div className="relative">
                  <Input
                    placeholder={newTask.type === 'event' ? '输入日程标题... (支持：明天3点开会 p1 #工作)' : '输入任务标题... (支持：明天3点开会 p1 #工作)'}
                    value={newTask.title}
                    onChange={(e) => {
                      const value = e.target.value
                      setNewTask({ ...newTask, title: value })
                      if (value && !editingTask) {
                        const parsed = parseSmartInput(value)
                        if (parsed.dueDate || parsed.priority || parsed.tags.length > 0 || parsed.project || parsed.startTime) {
                          const updates: Partial<typeof newTask> = {}
                          if (parsed.dueDate) {
                            updates.dueDate = parsed.dueDate.toISOString().split('T')[0]
                            const h = parsed.dueDate.getHours()
                            const m = parsed.dueDate.getMinutes()
                            if (h || m) {
                              updates.dueTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                            }
                          }
                          if (parsed.priority) updates.priority = parsed.priority
                          if (parsed.tags.length > 0) updates.tags = [...new Set([...newTask.tags, ...parsed.tags])]
                          if (parsed.project) updates.project = parsed.project
                          if (parsed.startTime) updates.startTime = parsed.startTime
                          if (parsed.endTime) updates.endTime = parsed.endTime
                          if (parsed.type) updates.type = parsed.type
                          if (Object.keys(updates).length > 0) {
                            setNewTask(prev => ({ ...prev, title: parsed.title || value, ...updates }))
                          }
                        }
                      }
                    }}
                  />
                  {newTask.title && !editingTask && parseSmartInput(newTask.title).dueDate && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        🤖 已解析
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Textarea
                  placeholder="添加描述..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">优先级</label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value: Task['priority']) =>
                      setNewTask({ ...newTask, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">紧急</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">能量级别</label>
                  <Select
                    value={newTask.energy}
                    onValueChange={(value) =>
                      setNewTask({ ...newTask, energy: value as Task['energy'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">⚡ 高能量</SelectItem>
                      <SelectItem value="medium">🔋 中能量</SelectItem>
                      <SelectItem value="low">🌙 低能量</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newTask.type === 'task' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">预估番茄钟</label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={newTask.estimatedPomodoros}
                      onChange={(e) =>
                        setNewTask({ ...newTask, estimatedPomodoros: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                )}
                {newTask.type === 'task' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">预估时间 (分钟)</label>
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      placeholder="可选"
                      value={newTask.estimatedMinutes || ''}
                      onChange={(e) =>
                        setNewTask({ ...newTask, estimatedMinutes: e.target.value ? parseInt(e.target.value) : undefined })
                      }
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">项目</label>
                  <Select
                    value={newTask.project}
                    onValueChange={(value) => setNewTask({ ...newTask, project: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <QuickDatePresets
                    value={newTask.dueDate ? new Date(newTask.dueDate) : undefined}
                    onChange={(d) => {
                      if (!d) {
                        setNewTask({ ...newTask, dueDate: '' })
                      } else {
                        const local = new Date(d)
                        local.setHours(0, 0, 0, 0)
                        setNewTask({ ...newTask, dueDate: local.toISOString().split('T')[0] })
                      }
                    }}
                  />
                </div>
              </div>
              {newTask.type === 'event' ? (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newTask.isAllDay}
                      onCheckedChange={(checked) => setNewTask({ ...newTask, isAllDay: !!checked })}
                    />
                    <label className="text-sm font-medium">全天</label>
                  </div>
                  {!newTask.isAllDay && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">开始时间</label>
                        <Select
                          value={newTask.startTime}
                          onValueChange={(value) => setNewTask({ ...newTask, startTime: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择时间" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">结束时间</label>
                        <Select
                          value={newTask.endTime}
                          onValueChange={(value) => setNewTask({ ...newTask, endTime: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择时间" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">截止时间（可选）</label>
                  <Input
                    type="time"
                    value={newTask.dueTime}
                    onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                  />
                </div>
              )}
              {newTask.type !== 'event' && (
                <TaskReminders
                  reminders={newTask.reminders}
                  onChange={(r) => setNewTask({ ...newTask, reminders: r })}
                  hasDueDate={!!newTask.dueDate}
                />
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">标签</label>
                <div className="flex flex-wrap gap-2">
                  {newTask.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="添加标签..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="sm" variant="outline" onClick={handleAddTag}>
                    添加
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newTask.repeat}
                      onCheckedChange={(checked) => setNewTask({ ...newTask, repeat: !!checked })}
                    />
                    <label className="text-sm font-medium">重复任务</label>
                  </div>
                </div>
                {newTask.repeat && (
                  <div className="space-y-3 pl-6 border-l-2 border-purple-200 dark:border-purple-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">重复周期</label>
                        <Select
                          value={newTask.repeatType}
                          onValueChange={(value: RepeatRule['type']) =>
                            setNewTask({ ...newTask, repeatType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">每天</SelectItem>
                            <SelectItem value="weekly">每周</SelectItem>
                            <SelectItem value="monthly">每月</SelectItem>
                            <SelectItem value="yearly">每年</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">间隔</label>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={newTask.repeatInterval}
                          onChange={(e) => setNewTask({ ...newTask, repeatInterval: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">结束条件</label>
                      <Select
                        value={newTask.repeatEndType}
                        onValueChange={(value: 'never' | 'date' | 'count') =>
                          setNewTask({ ...newTask, repeatEndType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">永不结束</SelectItem>
                          <SelectItem value="date">指定日期结束</SelectItem>
                          <SelectItem value="count">重复次数后结束</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newTask.repeatEndType === 'date' && (
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">结束日期</label>
                        <Input
                          type="date"
                          value={newTask.repeatEndDate}
                          onChange={(e) => setNewTask({ ...newTask, repeatEndDate: e.target.value })}
                        />
                      </div>
                    )}
                    {newTask.repeatEndType === 'count' && (
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">重复次数</label>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={newTask.repeatEndCount}
                          onChange={(e) => setNewTask({ ...newTask, repeatEndCount: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button onClick={editingTask ? handleEditTask : handleAddTask} className="w-full">
                {editingTask ? '保存修改' : '创建任务'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <div className="relative flex-1 min-w-[160px] sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索任务..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="优先级" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">全部优先级</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="todo">待办</SelectItem>
                  <SelectItem value="in-progress">进行中</SelectItem>
                  <SelectItem value="done">已完成</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allTags.length > 0 && (
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <Tag className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="标签" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="all">全部标签</SelectItem>
                    {allTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filterDate && (
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => setFilterDate(null)}
                >
                  <Calendar className="h-3 w-3" />
                  {filterDate.toLocaleDateString('zh-CN')}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {savedFilters.length > 0 || hasAnyFilter() ? (
                <div className="w-full">
                  <SavedFiltersBar
                    criteria={{
                      search: searchQuery || undefined,
                      priority: filterPriority !== 'all' ? filterPriority : undefined,
                      status: filterStatus !== 'all' ? filterStatus : undefined,
                      tag: filterTag !== 'all' ? filterTag : undefined,
                      type: filterType !== 'all' ? filterType : undefined,
                      date: filterDate ? filterDate.toISOString().split('T')[0] : undefined,
                    }}
                    onApply={(c) => {
                      setSearchQuery(c.search || '')
                      setFilterPriority(c.priority || 'all')
                      setFilterStatus(c.status || 'all')
                      setFilterTag(c.tag || 'all')
                      setFilterType(c.type || 'all')
                      setFilterDate(c.date ? new Date(c.date) : null)
                    }}
                  />
                </div>
              ) : null}
              <div className="flex rounded-lg border p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('list')}
                  title="列表视图"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('kanban')}
                  title="看板视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('matrix')}
                  title="四象限视图"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {viewMode === 'kanban' ? (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCorners}
              onDragStart={handleKanbanDragStart}
              onDragOver={handleKanbanDragOver}
              onDragEnd={handleKanbanDragEnd}
            >
              <div className="grid gap-4 md:grid-cols-3">
                {kanbanColumns.map((column) => {
                  const ColumnIcon = column.icon
                  const columnTasks = kanbanGroups[column.id]
                  return (
                    <div
                      key={column.id}
                      className={cn(
                        'rounded-2xl border border-t-4 bg-muted/30 p-4 transition-all duration-200 min-h-[300px]',
                        column.color
                      )}
                    >
                      <div className={cn('flex items-center gap-2 rounded-xl p-2 mb-3', column.headerBg)}>
                        <ColumnIcon className="h-4 w-4" />
                        <span className="font-semibold text-sm">{column.label}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {columnTasks.length}
                        </Badge>
                      </div>
                      <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {columnTasks.map((task) => (
                            <SortableKanbanCard key={task.id} task={task} today={today} />
                          ))}
                          {columnTasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                              <ColumnIcon className="h-8 w-8 opacity-30 mb-2" />
                              <p className="text-xs">拖拽任务到此处</p>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </div>
                  )
                })}
              </div>
              <DragOverlay>
                {activeKanbanTaskId ? (
                  <div className="rounded-xl border bg-card p-3 shadow-xl ring-2 ring-primary/30">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={cn('h-2 w-2 rounded-full', priorityConfig[tasks.find(t => t.id === activeKanbanTaskId)?.priority || 'medium'].color)} />
                      <p className="font-medium text-sm truncate flex-1">{tasks.find(t => t.id === activeKanbanTaskId)?.title}</p>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : viewMode === 'matrix' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-destructive/20 border border-destructive/30" />
                  <span>紧急且重要</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-chart-1/20 border border-chart-1/30" />
                  <span>重要不紧急</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-chart-3/20 border border-chart-3/30" />
                  <span>紧急不重要</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-muted/30 border border-border" />
                  <span>不紧急不重要</span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <div className="h-16 w-16 rounded-full bg-muted/50 border-2 border-border flex items-center justify-center">
                    <Zap className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                </div>
                <Card className="border-2 border-destructive/30 bg-destructive/5 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <CardTitle className="text-base font-semibold">立即执行</CardTitle>
                      <Badge variant="destructive" className="ml-auto">{matrixGroups.doFirst.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">紧急且重要 · 马上处理</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {matrixGroups.doFirst.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                    {matrixGroups.doFirst.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <CheckCircle2 className="h-6 w-6 opacity-30 mb-1" />
                        <p className="text-xs">暂无紧急重要任务</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-2 border-chart-1/30 bg-chart-1/5 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-5 w-5 text-chart-1" />
                      <CardTitle className="text-base font-semibold">计划安排</CardTitle>
                      <Badge className="ml-auto bg-chart-1">{matrixGroups.schedule.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">重要不紧急 · 规划时间做</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {matrixGroups.schedule.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                    {matrixGroups.schedule.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <Calendar className="h-6 w-6 opacity-30 mb-1" />
                        <p className="text-xs">暂无计划安排任务</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-2 border-chart-3/30 bg-chart-3/5 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-chart-3" />
                      <CardTitle className="text-base font-semibold">委托他人</CardTitle>
                      <Badge className="ml-auto bg-chart-3">{matrixGroups.delegate.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">紧急不重要 · 尽量委托</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {matrixGroups.delegate.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                    {matrixGroups.delegate.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <User className="h-6 w-6 opacity-30 mb-1" />
                        <p className="text-xs">暂无委托任务</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-2 border-border bg-muted/20 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base font-semibold">考虑删除</CardTitle>
                      <Badge variant="secondary" className="ml-auto">{matrixGroups.eliminate.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">不紧急不重要 · 减少或消除</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {matrixGroups.eliminate.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                    {matrixGroups.eliminate.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <CheckCircle2 className="h-6 w-6 opacity-30 mb-1" />
                        <p className="text-xs">没有可删除的任务</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
          <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-l-4 border-l-destructive overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-base font-semibold">紧急</CardTitle>
                  <Badge variant="destructive" className="ml-auto">
                    {groupedTasks.urgent.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">立即处理</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupedTasks.urgent.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
                {groupedTasks.urgent.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">暂无紧急任务</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-3 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-5 w-5 text-chart-3" />
                  <CardTitle className="text-base font-semibold">高优先级</CardTitle>
                  <Badge className="ml-auto bg-chart-3">
                    {groupedTasks.high.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">优先安排</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupedTasks.high.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
                {groupedTasks.high.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">暂无高优先级任务</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-1 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-chart-1" />
                  <CardTitle className="text-base font-semibold">中优先级</CardTitle>
                  <Badge className="ml-auto bg-chart-1">
                    {groupedTasks.medium.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">正常安排</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupedTasks.medium.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
                {groupedTasks.medium.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">暂无中优先级任务</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-muted-foreground overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">低优先级</CardTitle>
                  <Badge variant="secondary" className="ml-auto">
                    {groupedTasks.low.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">有空时处理</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupedTasks.low.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
                {groupedTasks.low.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">暂无低优先级任务</p>
                )}
              </CardContent>
            </Card>
          </div>

          {groupedTasks.done.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-chart-2" />
                  <CardTitle className="text-lg">已完成</CardTitle>
                  <Badge className="ml-auto bg-chart-2 text-chart-2-foreground">
                    {groupedTasks.done.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupedTasks.done.slice(0, 5).map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
                {groupedTasks.done.length > 5 && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    还有 {groupedTasks.done.length - 5} 个已完成任务
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          </>
          )}
      </div>

      {showTemplates && (
        <TaskTemplates onSelectTemplate={handleSelectTemplate} />
      )}

      <BatchOperations
        selectedTasks={selectedTasks}
        tasks={tasks}
        onBatchComplete={batchCompleteTasks}
        onBatchDelete={batchDeleteTasks}
        onBatchUpdatePriority={batchUpdateTaskPriority}
        onBatchAddTag={batchAddTagToTasks}
        onClearSelection={clearSelection}
      />

      {contextMenu && (() => {
        const ctxTask = tasks.find(t => t.id === contextMenu.taskId)
        if (!ctxTask) return null
        return (
          <>
            <div
              className="fixed inset-0 z-50"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
            />
            <div
              className="fixed z-50 min-w-[180px] rounded-xl border bg-popover p-1.5 shadow-xl animate-fade-in-up"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => {
                  if (ctxTask.status === 'done') uncompleteTask(ctxTask.id)
                  else handleCompleteTask(ctxTask.id)
                  setContextMenu(null)
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                {ctxTask.status === 'done' ? '标记未完成' : '标记完成'}
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => {
                  toggleTaskStar(ctxTask.id)
                  setContextMenu(null)
                }}
              >
                <Star className="h-4 w-4" />
                {ctxTask.starred ? '取消收藏' : '收藏'}
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => {
                  setEditingTask(ctxTask)
                  setNewTask({
                    title: ctxTask.title,
                    description: ctxTask.description || '',
                    type: ctxTask.type,
                    priority: ctxTask.priority,
                    project: ctxTask.project || '',
                    tags: ctxTask.tags,
                    estimatedPomodoros: ctxTask.estimatedPomodoros || 1,
                    estimatedMinutes: ctxTask.estimatedMinutes,
                    dueDate: ctxTask.dueDate ? new Date(ctxTask.dueDate).toISOString().split('T')[0] : '',
                    dueTime: ctxTask.dueDate ? new Date(ctxTask.dueDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                    startTime: ctxTask.startTime || '',
                    endTime: ctxTask.endTime || '',
                    isAllDay: ctxTask.isAllDay || false,
                    repeat: !!ctxTask.repeatRule,
                    repeatType: ctxTask.repeatRule?.type || 'daily',
                    repeatInterval: ctxTask.repeatRule?.interval || 1,
                    repeatEndType: ctxTask.repeatRule?.endAfterCount ? 'count' : ctxTask.repeatRule?.endDate ? 'date' : 'never',
                    repeatEndDate: ctxTask.repeatRule?.endDate ? new Date(ctxTask.repeatRule.endDate).toISOString().split('T')[0] : '',
                    repeatEndCount: ctxTask.repeatRule?.endAfterCount || 10,
                    reminders: ctxTask.reminders ? [...ctxTask.reminders] : [],
                    color: ctxTask.color || '#4A90E2',
                    energy: ctxTask.energy || 'medium',
                  })
                  setIsAddDialogOpen(true)
                  setContextMenu(null)
                }}
              >
                <Edit className="h-4 w-4" />
                编辑任务
              </button>
              <div className="my-1 h-px bg-border" />
              <div className="px-3 py-1.5 text-xs text-muted-foreground">优先级</div>
              {(['urgent', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-muted transition-colors",
                    ctxTask.priority === p && "bg-muted"
                  )}
                  onClick={() => {
                    updateTask(ctxTask.id, { priority: p })
                    setContextMenu(null)
                  }}
                >
                  <div className={cn('h-2 w-2 rounded-full', priorityConfig[p].color)} />
                  {priorityConfig[p].label}
                </button>
              ))}
              <div className="my-1 h-px bg-border" />
              {ctxTask.status !== 'done' && (
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => {
                    archiveTask(ctxTask.id)
                    setContextMenu(null)
                  }}
                >
                  <Archive className="h-4 w-4" />
                  归档任务
                </button>
              )}
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => {
                  deleteTask(ctxTask.id)
                  toast.success('任务已删除', {
                    description: ctxTask.title,
                    action: { label: '撤销', onClick: () => undoLastDelete() },
                    duration: 5000,
                  })
                  setContextMenu(null)
                }}
              >
                <Trash2 className="h-4 w-4" />
                删除任务
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
