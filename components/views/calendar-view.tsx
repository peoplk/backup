'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import type { TimeBlock } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  Timer,
  Plus,
  CalendarClock,
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
    completeTask, uncompleteTask,
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
    uncompleteTask: s.uncompleteTask,
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
      date: currentDate,
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
    const events: { type: string; title: string; colorClass: string; bgClass: string; time?: string; id?: string; status?: string; priority?: string }[] = []

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
                    <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-1.5">{eventCount}</span>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden flex-1">
                  {events.slice(0, 2).map((event, i) => (
                    <div
                      key={i}
                      className={cn('truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-medium', event.colorClass, event.bgClass)}
                    >
                      {event.time && <span className="opacity-60">{event.time.slice(0, 5)} </span>}
                      {event.title}
                    </div>
                  ))}
                  {eventCount > 2 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{eventCount - 2} 更多</div>
                  )}
                </div>
                {(stats.completedTasks > 0 || stats.dayPomodoros > 0) && (
                  <div className="mt-auto pt-1 flex gap-1.5 shrink-0">
                    {stats.completedTasks > 0 && (
                      <span className="text-[10px] text-chart-2 bg-chart-2/8 rounded-md px-1">✓{stats.completedTasks}</span>
                    )}
                    {stats.dayPomodoros > 0 && (
                      <span className="text-[10px] text-chart-3 bg-chart-3/8 rounded-md px-1">🍅{stats.dayPomodoros}</span>
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
                <Badge className="text-[10px] h-5">今天</Badge>
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
                    <span className="text-[10px] text-muted-foreground">{stat.label}</span>
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
                  <div key={i} className={cn('flex items-center gap-2.5 rounded-lg border border-border/40 p-2.5')}>
                    <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', event.bgClass)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {event.time && <p className="text-[11px] text-muted-foreground">{event.time}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 h-5">
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
                <Badge variant="secondary" className="text-[10px] h-5 ml-auto">{selectedDayTasks.length}</Badge>
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
                      <Badge variant="outline" className={cn('text-[10px] shrink-0 h-5',
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
    const currentHour = new Date().getHours()
    const currentMinute = new Date().getMinutes()
    
    const getEventsForDateDetailed = (date: Date) => {
      const dateStr = date.toDateString()
      const events: Array<{
        id: string
        title: string
        time: string
        endTime?: string
        type: string
        colorClass: string
        bgClass: string
        borderClass: string
        status?: string
        priority?: string
        description?: string
        completed?: boolean
        task?: typeof tasks[0]
      }> = []
      
      tasks.forEach((task) => {
        if (task.dueDate && new Date(task.dueDate).toDateString() === dateStr) {
          const dueDate = new Date(task.dueDate)
          const isUrgent = task.priority === 'urgent'
          const isHigh = task.priority === 'high'
          const isEvent = task.type === 'event'
          events.push({
            id: task.id,
            title: task.title,
            time: dueDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            type: task.type || 'task',
            colorClass: isUrgent ? 'text-destructive' : isHigh ? 'text-chart-3' : isEvent ? 'text-chart-4' : 'text-chart-1',
            bgClass: isUrgent ? 'bg-destructive/10' : isHigh ? 'bg-chart-3/10' : isEvent ? 'bg-chart-4/10' : 'bg-chart-1/10',
            borderClass: isUrgent ? 'border-l-destructive' : isHigh ? 'border-l-chart-3' : isEvent ? 'border-l-chart-4' : 'border-l-chart-1',
            status: task.status,
            priority: task.priority,
            description: task.description,
            task: task,
          })
        }
      })
      
      const dateBlocks = timeBlocks.filter(b => new Date(b.date).toDateString() === dateStr)
      dateBlocks.forEach(block => {
        const config = categoryConfig[block.category]
        events.push({
          id: block.id,
          title: block.title,
          time: block.startTime,
          endTime: block.endTime,
          type: 'timeBlock',
          colorClass: config.colorClass,
          bgClass: config.bgClass,
          borderClass: `border-l-${block.category}`,
          description: block.description,
          completed: block.completed,
        })
      })
      
      const dayPomodoros = pomodoroSessions.filter(
        s => new Date(s.completedAt).toDateString() === dateStr && s.type === 'work'
      )
      if (dayPomodoros.length > 0) {
        events.push({
          id: `pomodoro-${dateStr}`,
          title: `${dayPomodoros.length} 个番茄钟`,
          time: '',
          type: 'pomodoro',
          colorClass: 'text-chart-3',
          bgClass: 'bg-chart-3/10',
          borderClass: 'border-l-chart-3',
        })
      }
      
      return events.sort((a, b) => {
        if (!a.time) return 1
        if (!b.time) return -1
        return a.time.localeCompare(b.time)
      })
    }
    
    const getWeekStats = () => {
      let totalPomodoros = 0
      let totalTasks = 0
      let totalHours = 0
      let totalHabits = 0
      
      weekDaysArr.forEach(day => {
        const stats = getStatsForDate(day)
        totalPomodoros += stats.dayPomodoros
        totalTasks += stats.completedTasks
        totalHours += stats.totalHours
        totalHabits += stats.completedHabits
      })
      
      return { totalPomodoros, totalTasks, totalHours, totalHabits }
    }
    
    const weekStats = getWeekStats()
    const selectedEvents = getEventsForDateDetailed(selectedDate)
    const selectedStats = getStatsForDate(selectedDate)
    const isSelectedToday = selectedDate.toDateString() === today.toDateString()
    
    const morningEvents = selectedEvents.filter(e => {
      if (!e.time) return false
      const hour = parseInt(e.time.split(':')[0])
      return hour < 12
    })
    const afternoonEvents = selectedEvents.filter(e => {
      if (!e.time) return false
      const hour = parseInt(e.time.split(':')[0])
      return hour >= 12 && hour < 18
    })
    const eveningEvents = selectedEvents.filter(e => {
      if (!e.time) return false
      const hour = parseInt(e.time.split(':')[0])
      return hour >= 18
    })
    const allDayEvents = selectedEvents.filter(e => !e.time)
    
    const renderEventItem = (event: typeof selectedEvents[0], showTime = true) => {
      const isTask = event.type === 'task' || event.type === 'event'
      const isTimeBlock = event.type === 'timeBlock'
      
      return (
        <div
          key={event.id}
          className={cn(
            'group relative flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-all cursor-pointer',
            isTask && 'border-l-[3px]',
            event.priority === 'urgent' && isTask && 'border-l-destructive',
            event.priority === 'high' && isTask && 'border-l-chart-3',
            event.type === 'event' && isTask && 'border-l-chart-4',
            (!event.priority || event.priority === 'medium') && isTask && 'border-l-chart-1',
            isTimeBlock && 'border-l-[3px] border-l-chart-5',
            event.completed && 'opacity-50'
          )}
        >
          {showTime && event.time && (
            <div className="flex flex-col items-center shrink-0 w-14 pt-0.5">
              <span className="text-xs font-semibold text-foreground tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                {event.time}
              </span>
              {event.endTime && (
                <span className="text-[10px] text-muted-foreground">
                  {event.endTime}
                </span>
              )}
            </div>
          )}
          
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
            event.type === 'task' && event.priority === 'urgent' && 'bg-destructive/10 text-destructive',
            event.type === 'task' && event.priority === 'high' && 'bg-chart-3/10 text-chart-3',
            event.type === 'task' && (!event.priority || event.priority === 'medium') && 'bg-chart-1/10 text-chart-1',
            event.type === 'event' && 'bg-chart-4/10 text-chart-4',
            event.type === 'timeBlock' && 'bg-chart-5/10 text-chart-5',
            event.type === 'pomodoro' && 'bg-chart-3/10 text-chart-3',
          )}>
            {event.type === 'task' && <ListTodo className="h-4 w-4" />}
            {event.type === 'event' && <Calendar className="h-4 w-4" />}
            {event.type === 'timeBlock' && <Clock className="h-4 w-4" />}
            {event.type === 'pomodoro' && <Timer className="h-4 w-4" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-medium truncate', event.completed && 'line-through')}>
                {event.title}
              </p>
              {event.priority === 'urgent' && (
                <Badge className="text-[9px] h-4 bg-destructive shrink-0">紧急</Badge>
              )}
              {event.priority === 'high' && (
                <Badge className="text-[9px] h-4 bg-chart-3 shrink-0">高优</Badge>
              )}
            </div>
            {event.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {event.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {event.task && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (event.status === 'done') {
                    uncompleteTask(event.task!.id)
                  } else {
                    handleCompleteTask(event.task!.id)
                  }
                }}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                  event.status === 'done' 
                    ? 'bg-chart-2 text-white' 
                    : 'border-2 border-muted-foreground/30 hover:border-chart-2'
                )}
              >
                {event.status === 'done' && <CheckCircle2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      )
    }
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">
              {weekDaysArr[0].toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              <span className="text-muted-foreground mx-2">-</span>
              {weekDaysArr[6].toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </h2>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()) }} className="text-xs h-7">
                本周
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-4 mr-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-chart-2" />{weekStats.totalTasks} 任务</span>
              <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-chart-3" />{weekStats.totalPomodoros} 番茄</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-chart-1" />{weekStats.totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek('prev')} aria-label="上一周">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()) }} className="text-xs h-8 px-3">
                本周
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateWeek('next')} aria-label="下一周">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-7">
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              <div className="p-1">
                <div className="grid grid-cols-7 lg:grid-cols-1 gap-1">
                  {weekDaysArr.map((day) => {
                    const isToday = day.toDateString() === today.toDateString()
                    const isSelected = day.toDateString() === selectedDate.toDateString()
                    const dayEvents = getEventsForDateDetailed(day)
                    const taskEvents = dayEvents.filter(e => e.type === 'task' || e.type === 'event')
                    const hasEvents = dayEvents.length > 0
                    
                    return (
                      <button
                        key={day.toISOString()}
                        className={cn(
                          'relative flex items-center gap-3 p-3 rounded-xl transition-all text-left',
                          isSelected && 'bg-primary text-primary-foreground shadow-md',
                          isToday && !isSelected && 'bg-primary/10 ring-1 ring-primary/30',
                          !isToday && !isSelected && 'hover:bg-muted/50'
                        )}
                        onClick={() => setSelectedDate(day)}
                      >
                        <div className={cn(
                          'flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0',
                          isSelected ? 'bg-primary-foreground/20' : 'bg-muted/50'
                        )}>
                          <span className={cn(
                            'text-[9px] font-medium',
                            isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}>
                            {WEEK_DAYS[day.getDay()]}
                          </span>
                          <span className={cn(
                            'text-base font-bold leading-none mt-0.5 tabular-nums',
                            isToday && !isSelected && 'text-primary'
                          )} style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                            {day.getDate()}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {taskEvents.length > 0 ? (
                            <div className="space-y-1">
                              {taskEvents.slice(0, 2).map((event, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 min-w-0">
                                  <div className={cn(
                                    'w-1.5 h-1.5 rounded-full shrink-0',
                                    event.priority === 'urgent' ? 'bg-destructive' :
                                    event.priority === 'high' ? 'bg-chart-3' :
                                    event.type === 'event' ? 'bg-chart-4' : 'bg-chart-1'
                                  )} />
                                  <span className={cn(
                                    'text-xs truncate',
                                    isSelected ? 'text-primary-foreground/90' : 'text-foreground',
                                    event.status === 'done' && 'line-through opacity-50'
                                  )}>
                                    {event.title}
                                  </span>
                                </div>
                              ))}
                              {taskEvents.length > 2 && (
                                <span className={cn(
                                  'text-[10px]',
                                  isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground'
                                )}>
                                  +{taskEvents.length - 2} 更多
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={cn(
                              'text-xs',
                              isSelected ? 'text-primary-foreground/50' : 'text-muted-foreground'
                            )}>
                              无日程
                            </span>
                          )}
                        </div>
                        
                        {hasEvents && (
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            {taskEvents.filter(e => e.status === 'done').length > 0 && (
                              <span className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded-full',
                                isSelected ? 'bg-primary-foreground/20 text-primary-foreground/80' : 'bg-chart-2/10 text-chart-2'
                              )}>
                                ✓{taskEvents.filter(e => e.status === 'done').length}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>
            
            <Card className="overflow-hidden">
              <div className="p-4 bg-gradient-to-br from-chart-4/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-chart-4/10">
                    <Target className="h-4 w-4 text-chart-4" />
                  </div>
                  <p className="text-sm font-semibold">本周概览</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '完成任务', value: weekStats.totalTasks, icon: CheckCircle2, color: 'text-chart-2', bg: 'bg-chart-2/10' },
                    { label: '番茄钟', value: weekStats.totalPomodoros, icon: Timer, color: 'text-chart-3', bg: 'bg-chart-3/10' },
                    { label: '工作时长', value: `${weekStats.totalHours.toFixed(1)}h`, icon: Clock, color: 'text-chart-1', bg: 'bg-chart-1/10' },
                    { label: '习惯打卡', value: weekStats.totalHabits, icon: Target, color: 'text-chart-4', bg: 'bg-chart-4/10' },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2 p-2 rounded-lg bg-background/60">
                      <div className={cn('p-1.5 rounded-md', stat.bg)}>
                        <stat.icon className={cn('h-3.5 w-3.5', stat.color)} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        <p className="text-sm font-bold">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 via-transparent to-chart-1/5 px-5 py-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex flex-col items-center justify-center w-16 h-16 rounded-2xl shadow-sm',
                        isSelectedToday ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
                      )}>
                        <span className="text-[10px] font-medium opacity-70">{WEEK_DAYS[selectedDate.getDay()]}</span>
                        <span className="text-2xl font-bold leading-none mt-0.5 tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{selectedDate.getDate()}</span>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">
                          {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {WEEK_DAYS_FULL[selectedDate.getDay()]}
                          {isSelectedToday && (
                            <Badge className="ml-2 text-[10px] h-5">今天</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-3xl font-bold">{selectedEvents.length}</p>
                      <p className="text-xs text-muted-foreground">日程安排</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center px-4 py-2 rounded-xl bg-chart-2/10 border border-chart-2/20">
                        <p className="text-lg font-bold text-chart-2">{selectedStats.completedTasks}</p>
                        <p className="text-[10px] text-muted-foreground">已完成</p>
                      </div>
                      <div className="text-center px-4 py-2 rounded-xl bg-chart-3/10 border border-chart-3/20">
                        <p className="text-lg font-bold text-chart-3">{selectedStats.dayPomodoros}</p>
                        <p className="text-[10px] text-muted-foreground">番茄钟</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto">
                {selectedEvents.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                      <Calendar className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">暂无日程安排</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">点击右上角添加任务或时间块</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {isSelectedToday && (
                      <div className="relative">
                        <div 
                          className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                          style={{ top: `${Math.min((currentHour + currentMinute / 60) / 24 * 100, 95)}%` }}
                        >
                          <div className="h-2 w-2 rounded-full bg-destructive shrink-0 ml-4" />
                          <div className="flex-1 h-px bg-destructive/40" />
                          <span className="text-[10px] text-destructive font-mono ml-2 mr-4 tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                            {currentHour.toString().padStart(2, '0')}:{currentMinute.toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {allDayEvents.length > 0 && (
                      <div className="px-4 py-2 bg-muted/20">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">全天</p>
                      </div>
                    )}
                    {allDayEvents.map(event => renderEventItem(event, false))}
                    
                    {morningEvents.length > 0 && (
                      <div className="px-4 py-2 bg-muted/20">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-chart-4/20 flex items-center justify-center text-[10px]">☀</span>
                          上午
                        </p>
                      </div>
                    )}
                    {morningEvents.map(event => renderEventItem(event))}
                    
                    {afternoonEvents.length > 0 && (
                      <div className="px-4 py-2 bg-muted/20">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-chart-1/20 flex items-center justify-center text-[10px]">🌤</span>
                          下午
                        </p>
                      </div>
                    )}
                    {afternoonEvents.map(event => renderEventItem(event))}
                    
                    {eveningEvents.length > 0 && (
                      <div className="px-4 py-2 bg-muted/20">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-chart-5/20 flex items-center justify-center text-[10px]">🌙</span>
                          晚上
                        </p>
                      </div>
                    )}
                    {eveningEvents.map(event => renderEventItem(event))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="p-4 bg-gradient-to-br from-chart-1/5 to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-chart-1/10">
                      <ListTodo className="h-4 w-4 text-chart-1" />
                    </div>
                    <p className="text-sm font-semibold">本周待办</p>
                  </div>
                </div>
                {(() => {
                  const pendingTasks = tasks.filter(t => 
                    t.status !== 'done' && 
                    t.dueDate && 
                    new Date(t.dueDate) >= weekDaysArr[0] && 
                    new Date(t.dueDate) <= weekDaysArr[6]
                  ).slice(0, 4)
                  
                  if (pendingTasks.length === 0) {
                    return (
                      <div className="py-4 text-center">
                        <CheckCircle2 className="h-6 w-6 text-chart-2/30 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">本周无待办任务</p>
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-1.5">
                      {pendingTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/60 hover:bg-background/80 transition-colors">
                          <Checkbox
                            checked={task.status === 'done'}
                            onCheckedChange={() => handleCompleteTask(task.id)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs truncate flex-1">{task.title}</span>
                          {task.priority === 'urgent' && (
                            <Badge className="text-[9px] h-4 bg-destructive">紧急</Badge>
                          )}
                          {task.priority === 'high' && (
                            <Badge className="text-[9px] h-4 bg-chart-3">高优</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const renderDayView = () => {
    const events = getEventsForDate(currentDate)
    const stats = getStatsForDate(currentDate)
    const activeTasks = tasks.filter(t => t.status !== 'done')

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
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                  setIsAddDialogOpen(open)
                  if (!open) { setEditingBlock(null); resetNewBlock() }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 h-8 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      时间块
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
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
                                <span className="text-[10px]">{config.label}</span>
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
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
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
                        <div className={cn('w-14 py-1.5 text-[11px] shrink-0 tabular-nums', isCurrentHour ? 'text-primary font-bold' : 'text-muted-foreground font-semibold')} style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
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
                      <span className="text-[10px] text-muted-foreground">{stat.label}</span>
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
                  <Badge variant="secondary" className="text-[10px] h-5 ml-auto">{completedBlocks}/{dayBlocks.length}</Badge>
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
                          <p className="text-[10px] text-muted-foreground tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
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
                        {event.time && <p className="text-[11px] text-muted-foreground tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{event.time}</p>}
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
                      <Badge variant="outline" className={cn('text-[10px] shrink-0 h-5',
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

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">日历</h1>
          <p className="text-sm text-muted-foreground mt-0.5">查看和管理你的日程安排</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Object.entries(typeConfig).map(([key, config]) => (
              <Badge key={key} variant="outline" className="gap-1.5 text-[11px] h-6">
                <div className={cn('h-1.5 w-1.5 rounded-full', config.bg)} />
                <span className={config.color}>{config.label}</span>
              </Badge>
            ))}
          </div>
          <CalendarSubscriptionsManager />
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="month" className="gap-1.5 text-xs">
              <LayoutGrid className="h-3.5 w-3.5" />
              月
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1.5 text-xs">
              <Columns3 className="h-3.5 w-3.5" />
              周
            </TabsTrigger>
            <TabsTrigger value="day" className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              日
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="month" className="mt-4">
          {renderMonthView()}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          {renderWeekView()}
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          {renderDayView()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
