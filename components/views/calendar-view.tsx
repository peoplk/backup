'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import type { TimeBlock, ExternalCalendarEvent } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ViewTabs, ViewTabsContent, ViewTabsList, ViewTabsTrigger } from '@/components/ui/view-tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  Timer,
  Plus,
  CalendarClock,
  Import,
  ListTodo,
  LayoutGrid,
  Columns3,
  Brain,
  Users,
  Coffee,
  Heart,
  Briefcase,
  Target,
  CircleDot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarSubscriptionsManager } from '@/components/calendar-subscriptions-manager'
import { Textarea } from '@/components/ui/textarea'
import { WEEK_DAYS, WEEK_DAYS_FULL, MONTH_NAMES, TIME_SLOTS, TASK_TYPE_CONFIG, TIME_BLOCK_CATEGORY_CONFIG } from '@/lib/config'

const typeConfig = TASK_TYPE_CONFIG

const categoryIconMap: Record<string, typeof Brain> = {
  focus: Brain,
  meeting: Users,
  break: Coffee,
  personal: Heart,
  work: Briefcase,
}

const categoryConfig: Record<string, { label: string; icon: typeof Brain; colorClass: string; bgClass: string; borderClass: string }> = Object.fromEntries(
  Object.entries(TIME_BLOCK_CATEGORY_CONFIG).map(([key, val]) => [
    key,
    { ...val, icon: categoryIconMap[key] },
  ])
)

export function CalendarView() {
  const {
    tasks, timeEntries, pomodoroSessions, habits, habitCheckIns, anniversaries,
    completeTask, addTask,
    timeBlocks, addTimeBlock, updateTimeBlock, deleteTimeBlock,
    subscribedCalendars, externalEvents,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    timeEntries: s.timeEntries,
    pomodoroSessions: s.pomodoroSessions,
    habits: s.habits,
    habitCheckIns: s.habitCheckIns,
    anniversaries: s.anniversaries,
    completeTask: s.completeTask,
    addTask: s.addTask,
    timeBlocks: s.timeBlocks,
    addTimeBlock: s.addTimeBlock,
    updateTimeBlock: s.updateTimeBlock,
    deleteTimeBlock: s.deleteTimeBlock,
    subscribedCalendars: s.subscribedCalendars,
    externalEvents: s.externalEvents,
  })))
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [newBlock, setNewBlock] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    category: 'focus' as TimeBlock['category'],
    taskId: '',
  })

  // 稳定 today 引用，避免每次渲染新建 Date 击穿 memo/比较逻辑
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const resetNewBlock = () => {
    setNewBlock({
      title: '',
      description: '',
      startTime: '09:00',
      endTime: '10:00',
      category: 'focus',
      taskId: '',
    })
  }

  const openEditDialog = (block: TimeBlock) => {
    setEditingBlock(block)
    setNewBlock({
      title: block.title,
      description: block.description || '',
      startTime: block.startTime,
      endTime: block.endTime,
      category: block.category,
      taskId: block.taskId || '',
    })
    setIsAddDialogOpen(true)
  }

  const handleAddBlock = () => {
    if (!newBlock.title.trim()) return
    addTimeBlock({
      title: newBlock.title,
      description: newBlock.description,
      date: blockDialogDate || currentDate,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
      category: newBlock.category,
      color: '',
      taskId: newBlock.taskId || undefined,
    })
    resetNewBlock()
    setIsAddDialogOpen(false)
  }

  const handleEditBlock = () => {
    if (!editingBlock || !newBlock.title.trim()) return
    updateTimeBlock(editingBlock.id, {
      title: newBlock.title,
      description: newBlock.description,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
      category: newBlock.category,
      color: '',
      taskId: newBlock.taskId || undefined,
    })
    resetNewBlock()
    setEditingBlock(null)
    setIsAddDialogOpen(false)
  }

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== 'done') {
      completeTask(taskId)
    }
  }

  /** 双向桥（导入方向）：把订阅日历中的外部事件落为本地日程/任务 */
  const handleImportExternalEvent = (ev: ExternalCalendarEvent) => {
    const start = new Date(ev.start)
    const dup = tasks.find(
      (t) => t.title === ev.title && t.dueDate && new Date(t.dueDate).toDateString() === start.toDateString()
    )
    if (dup) {
      toast.info(`「${ev.title}」已存在于本地日程`)
      return
    }
    const calName = subscribedCalendars.find((c) => c.id === ev.calendarId)?.name || '订阅日历'
    const pad = (n: number) => String(n).padStart(2, '0')
    addTask({
      title: ev.title,
      type: ev.allDay ? 'task' : 'event',
      priority: 'medium',
      status: 'todo',
      tags: [],
      dueDate: start,
      ...(ev.allDay
        ? { isAllDay: true }
        : {
            startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
            endTime: (() => {
              const end = new Date(ev.end)
              return `${pad(end.getHours())}:${pad(end.getMinutes())}`
            })(),
          }),
      description: `来自「${calName}」`,
    })
    toast.success(`已导入为${ev.allDay ? '任务' : '日程'}：${ev.title}`)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
    return days
  }

  const getWeekDays = (date: Date) => {
    const days: Date[] = []
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    const events: { type: string; title: string; colorClass: string; bgClass: string; time?: string; id?: string; status?: string; priority?: string; extEvent?: ExternalCalendarEvent }[] = []

    tasks.forEach((task) => {
      if (task.dueDate && new Date(task.dueDate).toDateString() === dateStr) {
        const isUrgent = task.priority === 'urgent'
        const isHigh = task.priority === 'high'
        const isEvent = task.type === 'event'
        events.push({
          type: task.type || 'task',
          title: task.title,
          colorClass: isUrgent ? 'text-destructive' : isHigh ? 'text-chart-3' : isEvent ? 'text-chart-4' : 'text-chart-1',
          bgClass: isUrgent ? 'bg-destructive/10' : isHigh ? 'bg-chart-3/10' : isEvent ? 'bg-chart-4/10' : 'bg-chart-1/10',
          time: new Date(task.dueDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          id: task.id,
          status: task.status,
          priority: task.priority,
        })
      }
    })

    timeEntries.forEach((entry) => {
      if (new Date(entry.startTime).toDateString() === dateStr) {
        events.push({
          type: 'timeEntry',
          title: entry.description || entry.project,
          colorClass: 'text-chart-2',
          bgClass: 'bg-chart-2/10',
          time: new Date(entry.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        })
      }
    })

    anniversaries.forEach((anniversary) => {
      if (new Date(anniversary.date).toDateString() === dateStr) {
        events.push({
          type: 'anniversary',
          title: anniversary.title,
          colorClass: 'text-chart-5',
          bgClass: 'bg-chart-5/10',
        })
      }
    })

    const dayPomodoros = pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === dateStr && s.type === 'work'
    )
    if (dayPomodoros.length > 0) {
      events.push({
        type: 'pomodoro',
        title: `${dayPomodoros.length} 个番茄钟`,
        colorClass: 'text-chart-3',
        bgClass: 'bg-chart-3/10',
      })
    }

    // 外部订阅日历（ICS 只读聚合）：按所属日历配色展示
    if (externalEvents.length > 0) {
      const calById = new Map(subscribedCalendars.map((c) => [c.id, c]))
      externalEvents.forEach((ev) => {
        if (new Date(ev.start).toDateString() !== dateStr) return
        const cal = calById.get(ev.calendarId)
        events.push({
          type: 'external',
          title: ev.title,
          colorClass: 'text-violet-600 dark:text-violet-400',
          bgClass: 'bg-violet-500/10 border-l-2',
          time: ev.allDay
            ? undefined
            : new Date(ev.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          id: `ext:${ev.calendarId}:${ev.id}`,
          extEvent: ev,
        })
        void cal // 配色由日历管理面板维护，列表内统一紫色系以区分本地事件
      })
    }

    return events.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }

  const getStatsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    const completedTasks = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt).toDateString() === dateStr
    ).length
    const dayEntries = timeEntries.filter(
      (e) => new Date(e.startTime).toDateString() === dateStr
    )
    const totalHours = dayEntries.reduce((acc, e) => acc + e.duration, 0) / 3600
    const dayPomodoros = pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === dateStr && s.type === 'work'
    ).length
    const completedHabits = habitCheckIns.filter(
      (c) => new Date(c.date).toDateString() === dateStr && c.completed
    ).length
    return { completedTasks, totalHours, dayPomodoros, completedHabits }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
    // 同步选中日期，避免网格与侧栏/头部日期脱节
    setSelectedDate(newDate)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
    setSelectedDate(newDate)
  }

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
    setSelectedDate(newDate)
  }

  const days = useMemo(() => getDaysInMonth(currentDate), [currentDate])
  const weekDaysArr = useMemo(() => getWeekDays(currentDate), [currentDate])
  const selectedDateEvents = useMemo(
    () => getEventsForDate(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, tasks, timeEntries, pomodoroSessions, anniversaries, externalEvents, subscribedCalendars]
  )
  const selectedDateStats = useMemo(() => getStatsForDate(selectedDate), [selectedDate, tasks, timeEntries, pomodoroSessions, habitCheckIns])

  const selectedDayTasks = useMemo(() => {
    const dateStr = selectedDate.toDateString()
    return tasks.filter(t =>
      t.dueDate && new Date(t.dueDate).toDateString() === dateStr && t.status !== 'done'
    )
  }, [tasks, selectedDate])

  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()

  const currentDateStr = currentDate.toDateString()
  const currentHour = new Date().getHours()
  const currentMinute = new Date().getMinutes()
  const isViewingToday = currentDate.toDateString() === today.toDateString()

  const dayBlocks = useMemo(() => {
    return timeBlocks
      .filter(b => new Date(b.date).toDateString() === currentDateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [timeBlocks, currentDateStr])

  const DEFAULT_START = 6
  const DEFAULT_END = 21

  const dayViewEvents = getEventsForDate(currentDate)

  const dynamicStartHour = useMemo(() => {
    let minHour = DEFAULT_START
    dayBlocks.forEach(b => {
      const h = parseInt(b.startTime.split(':')[0])
      if (h < minHour) minHour = h
    })
    dayViewEvents.forEach(e => {
      if (e.time) {
        const h = parseInt(e.time.split(':')[0])
        if (h < minHour) minHour = h
      }
    })
    return minHour
  }, [dayBlocks, dayViewEvents])

  const dynamicEndHour = useMemo(() => {
    let maxHour = DEFAULT_END
    dayBlocks.forEach(b => {
      const h = parseInt(b.endTime.split(':')[0])
      if (h > maxHour) maxHour = h
    })
    dayViewEvents.forEach(e => {
      if (e.time) {
        const h = parseInt(e.time.split(':')[0])
        if (h > maxHour) maxHour = h
      }
    })
    return maxHour
  }, [dayBlocks, dayViewEvents])

  const dayHours = useMemo(() =>
    Array.from({ length: dynamicEndHour - dynamicStartHour + 1 }, (_, i) => i + dynamicStartHour),
    [dynamicStartHour, dynamicEndHour]
  )
  const HOUR_HEIGHT = 52

  const timelineRef = useRef<HTMLDivElement>(null)

  // ===== 周视图 7 列时间网格：组件级状态与拖拽逻辑 =====
  const [blockDialogDate, setBlockDialogDate] = useState<Date | null>(null)
  const WEEK_WH = 48
  const WEEK_GUTTER = 56
  const weekGridRef = useRef<HTMLDivElement>(null)
  const [weekDrag, setWeekDrag] = useState<{
    id: string
    blockId: string
    grabOffsetMin: number
    durationMin: number
    origStart: number
    origDayIdx: number
  } | null>(null)
  const [weekPreview, setWeekPreview] = useState<{ id: string; start: number; end: number; dayIdx: number } | null>(null)
  const [weekDrop, setWeekDrop] = useState<{ dayIdx: number; min: number } | null>(null)
  const weekSuppressClickRef = useRef(false)

  const wToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const wToHM = (mm: number) => `${String(Math.floor(mm / 60) % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`

  const weekGrid = useMemo(() => {
    type WeekChip = {
      id: string
      kind: 'block' | 'timed' | 'allDay'
      title: string
      start: number
      end: number
      timeLabel?: string
      cls: string
      blockId?: string
      taskId?: string
      completed?: boolean
    }
    const days = weekDaysArr.map((day) => {
      const dateStr = day.toDateString()
      const chips: WeekChip[] = []
      timeBlocks
        .filter(b => new Date(b.date).toDateString() === dateStr)
        .forEach(b => {
          const cfg = categoryConfig[b.category] || categoryConfig.focus
          chips.push({
            id: `blk-${b.id}`,
            kind: 'block',
            title: b.title,
            start: wToMin(b.startTime),
            end: wToMin(b.endTime),
            timeLabel: b.startTime,
            cls: `${cfg.bgClass} ${cfg.borderClass} border`,
            blockId: b.id,
            completed: b.completed,
          })
        })
      tasks.forEach(t => {
        if (!t.dueDate || new Date(t.dueDate).toDateString() !== dateStr) return
        const due = new Date(t.dueDate)
        const cls = t.priority === 'urgent' ? 'bg-destructive/10 border border-destructive/40'
          : t.priority === 'high' ? 'bg-chart-3/10 border border-chart-3/40'
          : t.type === 'event' ? 'bg-chart-4/10 border border-chart-4/40'
          : 'bg-chart-1/10 border border-chart-1/40'
        const hasTime = !!t.startTime || !(due.getHours() === 0 && due.getMinutes() === 0)
        if (hasTime) {
          const startMin = t.startTime ? wToMin(t.startTime) : due.getHours() * 60 + due.getMinutes()
          const endMin = t.endTime ? wToMin(t.endTime) : startMin + 60
          chips.push({
            id: `task-${t.id}`,
            kind: 'timed',
            title: t.title,
            start: startMin,
            end: Math.max(endMin, startMin + 30),
            timeLabel: t.startTime || wToHM(startMin),
            cls,
            taskId: t.id,
            completed: t.status === 'done',
          })
        } else {
          chips.push({ id: `task-${t.id}`, kind: 'allDay', title: t.title, start: 0, end: 0, cls, taskId: t.id, completed: t.status === 'done' })
        }
      })
      externalEvents.forEach((ev, ei) => {
        const s = new Date(ev.start)
        if (s.toDateString() !== dateStr) return
        if (ev.allDay) {
          chips.push({ id: `ext-${dateStr}-${ei}`, kind: 'allDay', title: ev.title, start: 0, end: 0, cls: 'bg-muted border border-border/60' })
        } else {
          const e = new Date(ev.end)
          const startMin = s.getHours() * 60 + s.getMinutes()
          const endMin = e.toDateString() === dateStr ? e.getHours() * 60 + e.getMinutes() : startMin + 60
          chips.push({
            id: `ext-${dateStr}-${ei}`,
            kind: 'timed',
            title: ev.title,
            start: startMin,
            end: Math.max(endMin, startMin + 30),
            timeLabel: wToHM(startMin),
            cls: 'bg-secondary border border-border/60',
          })
        }
      })
      return { day, chips }
    })

    let minH = 7
    let maxH = 21
    days.forEach(({ chips }) => chips.forEach(c => {
      if (c.kind === 'allDay') return
      minH = Math.min(minH, Math.floor(c.start / 60))
      maxH = Math.max(maxH, Math.ceil(c.end / 60))
    }))
    const nowD = new Date()
    if (weekDaysArr.some(d => d.toDateString() === nowD.toDateString())) {
      minH = Math.min(minH, nowD.getHours() - 1)
      maxH = Math.max(maxH, nowD.getHours() + 1)
    }
    minH = Math.max(0, minH)
    maxH = Math.min(23, maxH)
    const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => i + minH)
    return { days, minH, maxH, hours }
  }, [weekDaysArr, timeBlocks, tasks, externalEvents])

  const weekMinFromClientY = (clientY: number): number | null => {
    const rect = weekGridRef.current?.getBoundingClientRect()
    if (!rect) return null
    return Math.max(0, Math.min(24 * 60 - 15, (clientY - rect.top) / WEEK_WH * 60 + weekGrid.minH * 60))
  }
  const weekDayFromClientX = (clientX: number): number => {
    const rect = weekGridRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const colW = (rect.width - WEEK_GUTTER) / 7
    return Math.max(0, Math.min(6, Math.floor((clientX - rect.left - WEEK_GUTTER) / colW)))
  }

  const onWeekBlockPointerDown = (e: React.PointerEvent, chip: { id: string; blockId?: string; start: number; end: number }, dayIdx: number) => {
    if (e.button !== 0 || !chip.blockId) return
    if ((e.target as HTMLElement).closest('button')) return
    const raw = weekMinFromClientY(e.clientY)
    if (raw === null) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setWeekDrag({
      id: chip.id,
      blockId: chip.blockId,
      grabOffsetMin: raw - chip.start,
      durationMin: chip.end - chip.start,
      origStart: chip.start,
      origDayIdx: dayIdx,
    })
  }

  const onWeekGridPointerMove = (e: React.PointerEvent) => {
    if (!weekDrag) return
    const raw = weekMinFromClientY(e.clientY)
    if (raw === null) return
    const start = Math.max(0, Math.min(24 * 60 - weekDrag.durationMin, Math.round((raw - weekDrag.grabOffsetMin) / 15) * 15))
    setWeekPreview({ id: weekDrag.id, start, end: start + weekDrag.durationMin, dayIdx: weekDayFromClientX(e.clientX) })
  }

  const onWeekGridPointerUp = () => {
    if (weekDrag && weekPreview && weekPreview.id === weekDrag.id) {
      if (weekPreview.start !== weekDrag.origStart || weekPreview.dayIdx !== weekDrag.origDayIdx) {
        updateTimeBlock(weekDrag.blockId, {
          date: weekDaysArr[weekPreview.dayIdx],
          startTime: wToHM(weekPreview.start),
          endTime: wToHM(weekPreview.end),
        })
        weekSuppressClickRef.current = true
      }
    }
    setWeekDrag(null)
    setWeekPreview(null)
  }

  const openWeekAddDialog = (date: Date, hour: number) => {
    const h = Math.max(0, Math.min(22, hour))
    setBlockDialogDate(date)
    setEditingBlock(null)
    setNewBlock(prev => ({ ...prev, title: '', description: '', taskId: '', startTime: `${String(h).padStart(2, '0')}:00`, endTime: `${String(h + 1).padStart(2, '0')}:00` }))
    setIsAddDialogOpen(true)
  }

  const onWeekColumnClick = (e: React.MouseEvent, day: Date) => {
    if (weekSuppressClickRef.current) {
      weekSuppressClickRef.current = false
      return
    }
    const min = weekMinFromClientY(e.clientY)
    if (min === null) return
    openWeekAddDialog(day, Math.floor(min / 60))
  }

  const onWeekColDragOver = (di: number) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-focusflow-task')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const min = weekMinFromClientY(e.clientY)
    if (min !== null) setWeekDrop({ dayIdx: di, min: Math.round(min / 30) * 30 })
  }

  const onWeekColDrop = (di: number) => (e: React.DragEvent) => {
    setWeekDrop(null)
    const raw = e.dataTransfer.getData('application/x-focusflow-task')
    if (!raw) return
    e.preventDefault()
    let payload: { taskId: string; title: string; pomodoros?: number }
    try {
      payload = JSON.parse(raw)
    } catch {
      return
    }
    const min = weekMinFromClientY(e.clientY)
    if (min === null) return
    const startMin = Math.round(min / 30) * 30
    const duration = Math.min(Math.max((payload.pomodoros || 0) * 25, 30), 240)
    addTimeBlock({
      title: payload.title,
      description: '',
      date: weekDaysArr[di],
      startTime: wToHM(startMin),
      endTime: wToHM(Math.min(24 * 60, startMin + duration)),
      category: 'focus',
      color: '',
      taskId: payload.taskId,
    })
    toast.success(`已将「${payload.title}」排入 ${weekDaysArr[di].toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${wToHM(startMin)}`)
  }

  useEffect(() => {
    if (isViewingToday && timelineRef.current) {
      const currentScrollTop = (currentHour - dynamicStartHour + currentMinute / 60) * HOUR_HEIGHT - 120
      timelineRef.current.scrollTo({ top: Math.max(0, currentScrollTop), behavior: 'smooth' })
    }
  }, [isViewingToday, currentHour, currentMinute, dynamicStartHour, HOUR_HEIGHT])

  const renderMonthView = () => (
    <div className="grid gap-5 lg:grid-cols-4">
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">
              {currentDate.getFullYear()}年 {MONTH_NAMES[currentDate.getMonth()]}
            </h2>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()) }} className="text-xs h-7">
                回到今天
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')} aria-label="上一个月">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()) }} className="text-xs h-8 px-3">
              今天
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')} aria-label="下一个月">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="min-h-[100px]" />
            const isToday = day.toDateString() === today.toDateString()
            const isSelected = day.toDateString() === selectedDate.toDateString()
            const events = getEventsForDate(day)
            const eventCount = events.length
            const stats = getStatsForDate(day)
            return (
              <button
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] p-2 text-left transition-all rounded-xl flex flex-col group',
                  isSelected && 'bg-primary/8 ring-1 ring-primary/20',
                  !isSelected && isToday && 'bg-primary/5 ring-1 ring-primary/15',
                  !isSelected && !isToday && 'hover:bg-muted/40'
                )}
                onClick={() => setSelectedDate(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'inline-flex items-center justify-center text-sm font-medium h-7 w-7 rounded-full transition-colors',
                    isToday && 'bg-primary text-primary-foreground',
                    isSelected && !isToday && 'bg-primary/15 text-primary',
                    !isToday && !isSelected && 'text-foreground group-hover:text-primary'
                  )}>
                    {day.getDate()}
                  </span>
                  {eventCount > 0 && !isToday && (
                    <span className="text-2xs text-muted-foreground bg-muted/50 rounded-full px-1.5">{eventCount}</span>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden flex-1">
                  {events.slice(0, 2).map((event, i) => (
                    <div
                      key={i}
                      className={cn('truncate rounded-md px-1.5 py-0.5 text-2xs leading-tight font-medium', event.colorClass, event.bgClass)}
                    >
                      {event.time && <span className="opacity-60">{event.time.slice(0, 5)} </span>}
                      {event.title}
                    </div>
                  ))}
                  {eventCount > 2 && (
                    <div className="text-2xs text-muted-foreground pl-1">+{eventCount - 2} 更多</div>
                  )}
                </div>
                {(stats.completedTasks > 0 || stats.dayPomodoros > 0) && (
                  <div className="mt-auto pt-1 flex gap-1.5 shrink-0">
                    {stats.completedTasks > 0 && (
                      <span className="text-2xs text-chart-2 bg-chart-2/8 rounded-md px-1">✓{stats.completedTasks}</span>
                    )}
                    {stats.dayPomodoros > 0 && (
                      <span className="text-2xs text-chart-3 bg-chart-3/8 rounded-md px-1">🍅{stats.dayPomodoros}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/5 to-transparent px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {selectedDate.toLocaleDateString('zh-CN', { weekday: 'long' })}
                </p>
                <p className="text-xl font-bold mt-0.5">
                  {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </p>
              </div>
              {selectedDate.toDateString() === today.toDateString() && (
                <Badge className="text-2xs h-5">今天</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '完成任务', value: selectedDateStats.completedTasks, icon: CheckCircle2, color: 'text-chart-2' },
                { label: '番茄钟', value: selectedDateStats.dayPomodoros, icon: Timer, color: 'text-chart-1' },
                { label: '工作时长', value: `${selectedDateStats.totalHours.toFixed(1)}h`, icon: Clock, color: 'text-chart-3' },
                { label: '习惯打卡', value: selectedDateStats.completedHabits, icon: Target, color: 'text-chart-4' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-background/60 p-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <stat.icon className={cn('h-3 w-3', stat.color)} />
                    <span className="text-2xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-chart-4" />
              日程
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {selectedDateEvents.length === 0 ? (
              <div className="py-6 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">暂无日程</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {selectedDateEvents.map((event, i) => (
                  <div key={i} className={cn('group flex items-center gap-2.5 rounded-lg border border-border/40 p-2.5')}>
                    <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', event.bgClass)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {event.time && <p className="text-2xs text-muted-foreground">{event.time}</p>}
                    </div>
                    {event.extEvent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-2xs shrink-0 hover-reveal transition-opacity"
                        onClick={() => handleImportExternalEvent(event.extEvent!)}
                      >
                        <Import className="h-3 w-3 mr-1" />
                        导入
                      </Button>
                    )}
                    <Badge variant="outline" className="text-2xs shrink-0 h-5">
                      {event.type === 'task' ? '任务' : event.type === 'event' ? '日程' : '提醒'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedDayTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-chart-1" />
                待办任务
                <Badge variant="secondary" className="text-2xs h-5 ml-auto">{selectedDayTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-1.5">
                {selectedDayTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 rounded-lg border border-border/40 px-2.5 py-2 hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={() => handleCompleteTask(task.id)}
                    />
                    <span className="text-sm truncate flex-1">{task.title}</span>
                    {task.priority && (
                      <Badge variant="outline" className={cn('text-2xs shrink-0 h-5',
                        task.priority === 'urgent' && 'border-destructive/50 text-destructive',
                        task.priority === 'high' && 'border-chart-3/50 text-chart-3',
                      )}>
                        {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : '中'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  const renderWeekView = () => {
    const isCurrentWeek = weekDaysArr.some(d => d.toDateString() === today.toDateString())
    const { days, minH, hours } = weekGrid
    const now = new Date()

    const columnChips: { id: string; chip: (typeof days)[0]['chips'][0] }[][] = Array.from({ length: 7 }, () => [])
    days.forEach((d, di) => {
      d.chips.forEach(chip => {
        if (chip.kind === 'allDay') return
        if (weekPreview && chip.id === weekPreview.id) {
          columnChips[weekPreview.dayIdx].push({ id: `${chip.id}-preview`, chip: { ...chip, start: weekPreview.start, end: weekPreview.end } })
        } else {
          columnChips[di].push({ id: chip.id, chip })
        }
      })
    })

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">
              {weekDaysArr[0].toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              <span className="text-muted-foreground mx-2">-</span>
              {weekDaysArr[6].toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </h2>
            <span className="hidden md:inline text-2xs text-muted-foreground/70">拖动时间块跨日改期 · 点击空档新建 · 任务可拖入排程</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek('prev')} aria-label="上一周">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()) }} className={cn('text-xs h-8 px-3', !isCurrentWeek && 'font-medium text-primary')}>
              本周
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek('next')} aria-label="下一周">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          {/* 表头：星期 + 日期 + 全天事项 */}
          <div className="grid border-b border-border/50" style={{ gridTemplateColumns: `${WEEK_GUTTER}px repeat(7, minmax(0, 1fr))` }}>
            <div className="p-1.5 text-3xs text-muted-foreground text-center border-r border-border/30">
              <div>全天</div>
            </div>
            {weekDaysArr.map((day) => {
              const di = weekDaysArr.indexOf(day)
              const isTodayCol = day.toDateString() === today.toDateString()
              const allDay = days[di].chips.filter(c => c.kind === 'allDay')
              return (
                <div
                  key={day.toISOString()}
                  className={cn('p-1.5 border-r border-border/30 min-w-0 cursor-pointer hover:bg-muted/30 transition-colors', isTodayCol && 'bg-primary/5')}
                  onClick={() => { setCurrentDate(day); setSelectedDate(day); setViewMode('day') }}
                  onDragOver={onWeekColDragOver(di)}
                  onDrop={onWeekColDrop(di)}
                  title="点击进入日视图"
                >
                  <div className="text-3xs text-muted-foreground">{WEEK_DAYS[day.getDay()]}</div>
                  <div className={cn('text-base font-bold leading-none tabular-nums', isTodayCol && 'text-primary')}>{day.getDate()}</div>
                  <div className="mt-1 space-y-0.5">
                    {allDay.slice(0, 2).map(c => (
                      <div key={c.id} className={cn('truncate rounded px-1 py-0.5 text-3xs leading-tight', c.cls, c.completed && 'line-through opacity-60')} title={c.title}>
                        {c.title}
                      </div>
                    ))}
                    {allDay.length > 2 && (
                      <div className="text-3xs text-muted-foreground pl-1">+{allDay.length - 2} 项全天</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 时间网格 */}
          <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
            <div
              ref={weekGridRef}
              className="relative grid"
              style={{ gridTemplateColumns: `${WEEK_GUTTER}px repeat(7, minmax(0, 1fr))` }}
              onPointerMove={onWeekGridPointerMove}
              onPointerUp={onWeekGridPointerUp}
              onPointerCancel={onWeekGridPointerUp}
            >
              <div className="border-r border-border/30">
                {hours.map(h => (
                  <div key={h} className="text-2xs font-mono text-muted-foreground text-right pr-2 -translate-y-1.5 tabular-nums" style={{ height: WEEK_WH }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {weekDaysArr.map((day, di) => {
                const isTodayCol = day.toDateString() === today.toDateString()
                return (
                  <div
                    key={day.toISOString()}
                    className={cn('relative border-r border-border/30 last:border-r-0', isTodayCol && 'bg-primary/[0.03]')}
                    style={{ height: hours.length * WEEK_WH }}
                    onClick={(e) => onWeekColumnClick(e, day)}
                    onDragOver={onWeekColDragOver(di)}
                    onDrop={onWeekColDrop(di)}
                  >
                    {hours.map(h => (
                      <div key={h} className="border-b border-border/15" style={{ height: WEEK_WH }} />
                    ))}
                    {isTodayCol && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: (now.getHours() + now.getMinutes() / 60 - minH) * WEEK_WH }}
                      >
                        <div className="h-px bg-destructive/60" />
                      </div>
                    )}
                    {weekDrop && weekDrop.dayIdx === di && (
                      <div
                        className="absolute left-0.5 right-0.5 z-30 pointer-events-none rounded border-2 border-dashed border-primary/70"
                        style={{ top: (weekDrop.min / 60 - minH) * WEEK_WH, height: WEEK_WH / 2 }}
                      />
                    )}
                    {columnChips[di].map(({ id, chip }) => {
                      const top = (chip.start / 60 - minH) * WEEK_WH
                      const height = Math.max(((chip.end - chip.start) / 60) * WEEK_WH - 2, 22)
                      const isDragging = weekDrag?.id === chip.id && (!weekPreview || weekPreview.id === chip.id)
                      return (
                        <div
                          key={id}
                          className={cn(
                            'absolute left-0.5 right-0.5 z-10 rounded-md px-1.5 py-1 overflow-hidden select-none touch-none',
                            chip.cls,
                            chip.blockId ? 'cursor-grab' : 'cursor-pointer',
                            isDragging && 'opacity-80 ring-2 ring-primary/50 shadow-md cursor-grabbing',
                            chip.completed && 'opacity-50',
                          )}
                          style={{ top, height }}
                          draggable={!!chip.taskId}
                          onDragStart={chip.taskId ? (e) => {
                            const t = tasks.find(x => x.id === chip.taskId)
                            if (!t) return
                            e.dataTransfer.setData('application/x-focusflow-task', JSON.stringify({
                              taskId: t.id,
                              title: t.title,
                              pomodoros: t.estimatedPomodoros,
                            }))
                            e.dataTransfer.effectAllowed = 'copy'
                          } : undefined}
                          onPointerDown={(e) => chip.blockId && onWeekBlockPointerDown(e, chip, di)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (weekSuppressClickRef.current) {
                              weekSuppressClickRef.current = false
                              return
                            }
                            const b = chip.blockId ? timeBlocks.find(x => x.id === chip.blockId) : null
                            if (b) {
                              setCurrentDate(day)
                              openEditDialog(b)
                            } else if (chip.taskId) {
                              setCurrentDate(day)
                              setSelectedDate(day)
                              setViewMode('day')
                            }
                          }}
                        >
                          <p className={cn('text-3xs font-medium leading-tight truncate', chip.completed && 'line-through')}>{chip.title}</p>
                          {height >= 34 && chip.timeLabel && (
                            <p className="text-3xs text-muted-foreground leading-tight tabular-nums">{chip.timeLabel}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>
    )
  }


  const renderDayView = () => {
    const events = getEventsForDate(currentDate)
    const stats = getStatsForDate(currentDate)
    const getBlockStyle = (startTime: string, endTime: string) => {
      const startHour = parseInt(startTime.split(':')[0])
      const startMinute = parseInt(startTime.split(':')[1])
      const endHour = parseInt(endTime.split(':')[0])
      const endMinute = parseInt(endTime.split(':')[1])
      const startOffset = startHour - dynamicStartHour + startMinute / 60
      const duration = (endHour - startHour) + (endMinute - startMinute) / 60
      return {
        top: `${startOffset * HOUR_HEIGHT}px`,
        height: `${Math.max(duration * HOUR_HEIGHT - 2, 28)}px`,
      }
    }

    const getEventHour = (time: string | undefined) => {
      if (!time) return -1
      return parseInt(time.split(':')[0])
    }

    const totalPlannedMinutes = dayBlocks.reduce((acc, b) => {
      const sh = parseInt(b.startTime.split(':')[0])
      const sm = parseInt(b.startTime.split(':')[1])
      const eh = parseInt(b.endTime.split(':')[0])
      const em = parseInt(b.endTime.split(':')[1])
      return acc + (eh - sh) * 60 + (em - sm)
    }, 0)

    const completedBlocks = dayBlocks.filter(b => b.completed).length

    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-chart-1" />
                  日程安排
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => openWeekAddDialog(currentDate, new Date().getHours())}>
                  <Plus className="h-3.5 w-3.5" />
                  时间块
                </Button>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay('prev')} aria-label="前一天">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()) }} className="text-xs h-8 px-3">
                    今天
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay('next')} aria-label="后一天">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="relative max-h-[560px] overflow-y-auto rounded-xl border border-border/40 p-1" id="day-timeline-scroll" ref={timelineRef}>
              {isViewingToday && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${(currentHour - dynamicStartHour + currentMinute / 60) * HOUR_HEIGHT + 4}px` }}
                >
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0 ml-0.5" />
                    <div className="h-px flex-1 bg-destructive/40 mr-2" />
                  </div>
                </div>
              )}

              <div className="relative">
                {dayBlocks.map(block => {
                  const config = categoryConfig[block.category]
                  const Icon = config.icon
                  const style = getBlockStyle(block.startTime, block.endTime)
                  return (
                    <div
                      key={block.id}
                      className={cn(
                        'absolute left-14 right-2 rounded-xl border px-3 py-1.5 transition-all cursor-pointer z-10 hover:shadow-md group',
                        config.bgClass,
                        config.borderClass,
                        block.completed && 'opacity-50'
                      )}
                      style={style}
                      onClick={() => openEditDialog(block)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', config.colorClass)} />
                          <span className={cn('text-sm font-medium truncate', block.completed && 'line-through')}>{block.title}</span>
                        </div>
                        <span className="text-2xs text-muted-foreground shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                          {block.startTime}-{block.endTime}
                        </span>
                      </div>
                    </div>
                  )
                })}

                <div className="space-y-0">
                  {dayHours.map((hour) => {
                    const hourEvents = events.filter((e) => {
                      const eh = getEventHour(e.time)
                      return eh === hour
                    })
                    const isCurrentHour = hour === currentHour && isViewingToday
                    return (
                      <div key={hour} className={cn('flex rounded-lg transition-colors', isCurrentHour && 'bg-primary/5')} style={{ height: `${HOUR_HEIGHT}px` }}>
                        <div className={cn('w-14 py-1.5 text-2xs shrink-0 tabular-nums', isCurrentHour ? 'text-primary font-bold' : 'text-muted-foreground font-semibold')} style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div className="flex-1 py-1 space-y-0.5 border-b border-border/20">
                          {hourEvents.map((event, i) => (
                            <div
                              key={i}
                              className={cn('rounded-lg px-2.5 py-1 border-l-2 text-xs', event.bgClass, event.colorClass)}
                              style={{ borderLeftColor: 'currentColor' }}
                            >
                              <span className="font-medium">{event.title}</span>
                              {event.time && <span className="opacity-50 ml-1.5">{event.time}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary/5 to-transparent p-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '完成任务', value: stats.completedTasks, icon: CheckCircle2, color: 'text-chart-2', bg: 'bg-chart-2/10' },
                  { label: '工作时间', value: `${stats.totalHours.toFixed(1)}h`, icon: Clock, color: 'text-chart-1', bg: 'bg-chart-1/10' },
                  { label: '番茄钟', value: stats.dayPomodoros, icon: Timer, color: 'text-chart-3', bg: 'bg-chart-3/10' },
                  { label: '习惯打卡', value: stats.completedHabits, icon: Target, color: 'text-chart-4', bg: 'bg-chart-4/10' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-background/60 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={cn('rounded-md p-1', stat.bg)}>
                        <stat.icon className={cn('h-3 w-3', stat.color)} />
                      </div>
                      <span className="text-2xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {dayBlocks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-chart-1" />
                  时间块
                  <Badge variant="secondary" className="text-2xs h-5 ml-auto">{completedBlocks}/{dayBlocks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {dayBlocks.map(block => {
                    const config = categoryConfig[block.category]
                    const Icon = config.icon
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-all cursor-pointer hover:shadow-sm',
                          config.bgClass,
                          config.borderClass,
                          block.completed && 'opacity-50'
                        )}
                        onClick={() => openEditDialog(block)}
                      >
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', config.colorClass)} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium truncate', block.completed && 'line-through')}>{block.title}</p>
                          <p className="text-2xs text-muted-foreground tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                            {block.startTime} - {block.endTime}
                          </p>
                        </div>
                        {block.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                        ) : (
                          <CircleDot className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>已规划 {Math.round(totalPlannedMinutes / 60 * 10) / 10} 小时</span>
                    <div className="flex gap-2">
                      {Object.entries(categoryConfig).map(([key, config]) => {
                        const count = dayBlocks.filter(b => b.category === key).length
                        if (count === 0) return null
                        return (
                          <span key={key} className={cn('flex items-center gap-1', config.colorClass)}>
                            <config.icon className="h-3 w-3" />
                            {count}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-semibold">今日事件</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {events.length === 0 ? (
                <div className="py-6 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground/15 mb-2" />
                  <p className="text-sm text-muted-foreground">暂无事件</p>
                  <p className="text-xs text-muted-foreground mt-1">点击任务设置截止时间</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {events.map((event, i) => (
                    <div key={i} className={cn('flex items-center gap-2.5 rounded-lg border border-border/40 p-2.5')}>
                      <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', event.bgClass)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        {event.time && <p className="text-2xs text-muted-foreground tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{event.time}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedDayTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  待办任务
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {selectedDayTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center gap-2.5 rounded-lg border border-border/40 px-2.5 py-2 hover:bg-muted/30 transition-colors">
                      <Checkbox
                        checked={task.status === 'done'}
                        onCheckedChange={() => handleCompleteTask(task.id)}
                      />
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      <Badge variant="outline" className={cn('text-2xs shrink-0 h-5',
                        task.priority === 'urgent' && 'border-destructive/50 text-destructive',
                        task.priority === 'high' && 'border-chart-3/50 text-chart-3',
                      )}>
                        {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : '中'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  const activeTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks])

  return (
    <div className="space-y-5 view-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">日历</h1>
          <p className="text-sm text-muted-foreground mt-0.5">查看和管理你的日程安排</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Object.entries(typeConfig).map(([key, config]) => (
              <Badge key={key} variant="outline" className="gap-1.5 text-2xs h-6">
                <div className={cn('h-1.5 w-1.5 rounded-full', config.bg)} />
                <span className={config.color}>{config.label}</span>
              </Badge>
            ))}
          </div>
          <CalendarSubscriptionsManager />
        </div>
      </div>

      <ViewTabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
        <ViewTabsList>
          <ViewTabsTrigger value="month">
            <LayoutGrid className="h-4 w-4" />
            月视图
          </ViewTabsTrigger>
          <ViewTabsTrigger value="week">
            <Columns3 className="h-4 w-4" />
            周视图
          </ViewTabsTrigger>
          <ViewTabsTrigger value="day">
            <Clock className="h-4 w-4" />
            日视图
          </ViewTabsTrigger>
        </ViewTabsList>

        <ViewTabsContent value="month" className="mt-4">
          {renderMonthView()}
        </ViewTabsContent>

        <ViewTabsContent value="week" className="mt-4">
          {renderWeekView()}
        </ViewTabsContent>

        <ViewTabsContent value="day" className="mt-4">
          {renderDayView()}
        </ViewTabsContent>
      </ViewTabs>

            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) { setEditingBlock(null); resetNewBlock(); setBlockDialogDate(null) }
            }}>
              <DialogContent aria-describedby={undefined} className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingBlock ? '编辑' : '创建'}时间块</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">标题</label>
                    <Input
                      placeholder="输入时间块标题..."
                      value={newBlock.title}
                      onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">描述</label>
                    <Textarea
                      placeholder="添加描述..."
                      value={newBlock.description}
                      onChange={(e) => setNewBlock({ ...newBlock, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">开始时间</label>
                      <Select
                        value={newBlock.startTime}
                        onValueChange={(value) => setNewBlock({ ...newBlock, startTime: value })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot) => (
                            <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">结束时间</label>
                      <Select
                        value={newBlock.endTime}
                        onValueChange={(value) => setNewBlock({ ...newBlock, endTime: value })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot) => (
                            <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">类型</label>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(categoryConfig).map(([key, config]) => {
                        const Icon = config.icon
                        return (
                          <button
                            key={key}
                            onClick={() => setNewBlock({ ...newBlock, category: key as TimeBlock['category'] })}
                            className={cn(
                              'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                              newBlock.category === key
                                ? cn('border-primary/50', config.bgClass)
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            <Icon className={cn('h-4 w-4', config.colorClass)} />
                            <span className="text-2xs">{config.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">关联任务 (可选)</label>
                    <Select
                      value={newBlock.taskId || 'none'}
                      onValueChange={(value) => setNewBlock({ ...newBlock, taskId: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger><SelectValue placeholder="选择任务..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无</SelectItem>
                        {activeTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={editingBlock ? handleEditBlock : handleAddBlock}
                    className="w-full"
                  >
                    {editingBlock ? '保存修改' : '创建时间块'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
    </div>
  )
}
