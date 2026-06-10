'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar, CheckCircle2, Heart, LayoutGrid, List, Trash2, CalendarDays } from 'lucide-react'
import type { TimeBlockCategory, TimeBlock } from '@/lib/types'
import { MobileBottomSheet } from '@/components/mobile/mobile-bottom-sheet'
import { MobileEmptyState } from '@/components/mobile/mobile-empty-state'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']
const CATEGORY_CONFIG: Record<TimeBlockCategory, { label: string; color: string; bg: string }> = {
  focus: { label: '专注', color: 'text-blue-500', bg: 'bg-blue-500/15' },
  meeting: { label: '会议', color: 'text-orange-500', bg: 'bg-orange-500/15' },
  break: { label: '休息', color: 'text-green-500', bg: 'bg-green-500/15' },
  personal: { label: '个人', color: 'text-purple-500', bg: 'bg-purple-500/15' },
  work: { label: '工作', color: 'text-primary', bg: 'bg-primary/15' },
}
const PRIORITY_COLORS: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-blue-400' }
const TYPE_LABELS: Record<string, string> = { birthday: '生日', anniversary: '纪念日', countdown: '倒计时', festival: '节日', custom: '自定义' }
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => i + 7)

function isSameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString() }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m, 1).getDay() }

export function MobileCalendarView() {
  const { tasks, timeBlocks, addTimeBlock, updateTimeBlock, deleteTimeBlock, anniversaries, completeTask } = useAppStore(
    useShallow((s) => ({ tasks: s.tasks, timeBlocks: s.timeBlocks, addTimeBlock: s.addTimeBlock, updateTimeBlock: s.updateTimeBlock, deleteTimeBlock: s.deleteTimeBlock, anniversaries: s.anniversaries, completeTask: s.completeTask }))
  )
  const today = new Date()
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(today))
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStartTime, setNewStartTime] = useState('09:00')
  const [newEndTime, setNewEndTime] = useState('10:00')
  const [newCategory, setNewCategory] = useState<TimeBlockCategory>('work')
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth)
  const prevMonthDays = getDaysInMonth(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1)

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = []
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, prevMonthDays - i), isCurrentMonth: false })
    }
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: new Date(currentYear, currentMonth, i), isCurrentMonth: true })
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, i), isCurrentMonth: false })
    }
    return days
  }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek, prevMonthDays])

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1))
    startOfWeek.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [selectedDate])

  const dateEventMap = useMemo(() => {
    const map = new Map<string, { hasTasks: boolean; hasTimeBlocks: boolean; hasAnniversaries: boolean }>()
    const allDays = viewMode === 'month' ? calendarDays : weekDays.map(d => ({ date: d, isCurrentMonth: true }))
    allDays.forEach(({ date }) => {
      const key = date.toDateString()
      map.set(key, {
        hasTasks: tasks.some((t) => t.dueDate && isSameDay(new Date(t.dueDate), date) && t.status !== 'done'),
        hasTimeBlocks: timeBlocks.some((b) => isSameDay(new Date(b.date), date)),
        hasAnniversaries: anniversaries.some((a) => { const d = new Date(a.date); return a.repeat ? d.getMonth() === date.getMonth() && d.getDate() === date.getDate() : isSameDay(d, date) }),
      })
    })
    return map
  }, [calendarDays, weekDays, viewMode, tasks, timeBlocks, anniversaries])

  const selectedTasks = useMemo(() => tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), selectedDate) && !t.archived), [tasks, selectedDate])
  const selectedTimeBlocks = useMemo(() => timeBlocks.filter((b) => isSameDay(new Date(b.date), selectedDate)), [timeBlocks, selectedDate])
  const selectedAnniversaries = useMemo(() => anniversaries.filter((a) => { const d = new Date(a.date); return a.repeat ? d.getMonth() === selectedDate.getMonth() && d.getDate() === selectedDate.getDate() : isSameDay(d, selectedDate) }), [anniversaries, selectedDate])

  const goToPrevMonth = useCallback(() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1) } else setCurrentMonth((m) => m - 1) }, [currentMonth])
  const goToNextMonth = useCallback(() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1) } else setCurrentMonth((m) => m + 1) }, [currentMonth])
  const goToToday = useCallback(() => { const n = new Date(); setCurrentYear(n.getFullYear()); setCurrentMonth(n.getMonth()); setSelectedDate(new Date(n)) }, [])

  const goToPrevWeek = useCallback(() => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 7)
    setSelectedDate(d)
    setCurrentMonth(d.getMonth())
    setCurrentYear(d.getFullYear())
  }, [selectedDate])

  const goToNextWeek = useCallback(() => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 7)
    setSelectedDate(d)
    setCurrentMonth(d.getMonth())
    setCurrentYear(d.getFullYear())
  }, [selectedDate])

  const goToPrevDay = useCallback(() => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d)
    setCurrentMonth(d.getMonth())
    setCurrentYear(d.getFullYear())
  }, [selectedDate])

  const goToNextDay = useCallback(() => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d)
    setCurrentMonth(d.getMonth())
    setCurrentYear(d.getFullYear())
  }, [selectedDate])

  const handleSwipeStart = useCallback((e: React.TouchEvent) => setSwipeStartX(e.touches[0].clientX), [])
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (swipeStartX === null) return
    const diff = e.changedTouches[0].clientX - swipeStartX
    if (Math.abs(diff) > 60) {
      if (viewMode === 'month') { diff > 0 ? goToPrevMonth() : goToNextMonth() }
      else if (viewMode === 'week') { diff > 0 ? goToPrevWeek() : goToNextWeek() }
      else { diff > 0 ? goToPrevDay() : goToNextDay() }
    }
    setSwipeStartX(null)
  }, [swipeStartX, goToPrevMonth, goToNextMonth, goToPrevWeek, goToNextWeek, goToPrevDay, goToNextDay, viewMode])

  const handleAddTimeBlock = useCallback(() => {
    if (!newTitle.trim()) return
    addTimeBlock({ title: newTitle.trim(), date: selectedDate, startTime: newStartTime, endTime: newEndTime, category: newCategory, color: '' })
    setNewTitle(''); setNewStartTime('09:00'); setNewEndTime('10:00'); setNewCategory('work'); setShowAddSheet(false)
  }, [newTitle, selectedDate, newStartTime, newEndTime, newCategory, addTimeBlock])

  const openEditSheet = useCallback((block: TimeBlock) => {
    setEditingBlock(block)
    setNewTitle(block.title)
    setNewStartTime(block.startTime)
    setNewEndTime(block.endTime)
    setNewCategory(block.category)
    setShowDeleteConfirm(false)
    setShowAddSheet(true)
  }, [])

  const handleEditTimeBlock = useCallback(() => {
    if (!editingBlock || !newTitle.trim()) return
    updateTimeBlock(editingBlock.id, { title: newTitle.trim(), startTime: newStartTime, endTime: newEndTime, category: newCategory, color: '' })
    setNewTitle(''); setNewStartTime('09:00'); setNewEndTime('10:00'); setNewCategory('work'); setEditingBlock(null); setShowAddSheet(false)
  }, [editingBlock, newTitle, newStartTime, newEndTime, newCategory, updateTimeBlock])

  const handleDeleteTimeBlock = useCallback(() => {
    if (!editingBlock) return
    deleteTimeBlock(editingBlock.id)
    setNewTitle(''); setNewStartTime('09:00'); setNewEndTime('10:00'); setNewCategory('work'); setEditingBlock(null); setShowDeleteConfirm(false); setShowAddSheet(false)
  }, [editingBlock, deleteTimeBlock])

  const monthLabel = `${currentYear}年${currentMonth + 1}月`
  const selectedDateLabel = selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
  const hasAnyEvents = selectedTasks.length > 0 || selectedTimeBlocks.length > 0 || selectedAnniversaries.length > 0

  const allDayEvents = useMemo(() => {
    const events: { id: string; title: string; type: 'task' | 'anniversary'; color: string; data: any }[] = []
    selectedTasks.filter(t => !t.startTime).forEach(t => {
      events.push({ id: t.id, title: t.title, type: 'task', color: PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.low, data: t })
    })
    selectedAnniversaries.forEach(a => {
      events.push({ id: a.id, title: a.title, type: 'anniversary', color: 'bg-pink-500', data: a })
    })
    return events
  }, [selectedTasks, selectedAnniversaries])

  const timedEvents = useMemo(() => {
    const events: { id: string; title: string; startTime: string; endTime?: string; type: 'task' | 'timeblock'; color: string; category?: string; data: any }[] = []
    selectedTimeBlocks.forEach(b => {
      const cat = CATEGORY_CONFIG[b.category] || CATEGORY_CONFIG.work
      events.push({ id: b.id, title: b.title, startTime: b.startTime, endTime: b.endTime, type: 'timeblock', color: '', category: cat.label, data: b })
    })
    selectedTasks.filter(t => t.startTime).forEach(t => {
      events.push({ id: t.id, title: t.title, startTime: t.startTime || '', endTime: t.endTime, type: 'task', color: PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.low, data: t })
    })
    return events.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [selectedTimeBlocks, selectedTasks])

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <div className="rounded-2xl glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={viewMode === 'month' ? goToPrevMonth : viewMode === 'week' ? goToPrevWeek : goToPrevDay}><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">{monthLabel}</h2>
            <button className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium active:scale-95 transition-transform" onClick={goToToday}>今天</button>
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
              <button className={cn('px-2 py-1 rounded-md text-[11px] font-medium transition-all', viewMode === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground')} onClick={() => setViewMode('month')}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button className={cn('px-2 py-1 rounded-md text-[11px] font-medium transition-all', viewMode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground')} onClick={() => setViewMode('week')}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button className={cn('px-2 py-1 rounded-md text-[11px] font-medium transition-all', viewMode === 'day' ? 'bg-background shadow-sm' : 'text-muted-foreground')} onClick={() => setViewMode('day')}>
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={viewMode === 'month' ? goToNextMonth : viewMode === 'week' ? goToNextWeek : goToNextDay}><ChevronRight className="h-5 w-5" /></button>
        </div>

        {viewMode === 'month' && (
          <>
            <div className="grid grid-cols-7 gap-0 mb-1">
              {WEEKDAYS.map((d) => <div key={d} className="h-8 flex items-center justify-center text-xs text-muted-foreground font-medium">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
              {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                const eventInfo = dateEventMap.get(date.toDateString())
                const isToday = isSameDay(date, today)
                const isSelected = isSameDay(date, selectedDate)
                const hasDots = eventInfo && (eventInfo.hasTasks || eventInfo.hasTimeBlocks || eventInfo.hasAnniversaries)
                return (
                  <button key={idx} className={cn('relative h-10 flex flex-col items-center justify-center rounded-xl transition-all active:scale-90', !isCurrentMonth && 'opacity-30', isSelected && 'bg-primary text-primary-foreground', !isSelected && isToday && 'bg-primary/10 text-primary font-semibold', !isSelected && !isToday && isCurrentMonth && 'hover:bg-muted/50')} onClick={() => setSelectedDate(new Date(date))}>
                    <span className={cn('text-sm leading-none', isSelected && 'font-bold', !isSelected && isToday && 'font-bold')}>{date.getDate()}</span>
                    {hasDots && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {eventInfo!.hasTasks && <div className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-primary')} />}
                        {eventInfo!.hasTimeBlocks && <div className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-blue-500')} />}
                        {eventInfo!.hasAnniversaries && <div className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-pink-500')} />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <div className="flex gap-1" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
            {weekDays.map(date => {
              const isToday = isSameDay(date, today)
              const isSelected = isSameDay(date, selectedDate)
              const eventInfo = dateEventMap.get(date.toDateString())
              const hasEvents = eventInfo && (eventInfo.hasTasks || eventInfo.hasTimeBlocks || eventInfo.hasAnniversaries)
              return (
                <button
                  key={date.toDateString()}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all active:scale-95',
                    isSelected && 'bg-primary text-primary-foreground',
                    !isSelected && isToday && 'bg-primary/10 text-primary',
                    !isSelected && !isToday && 'hover:bg-muted/50'
                  )}
                  onClick={() => setSelectedDate(new Date(date))}
                >
                  <span className="text-[10px] font-medium">{WEEKDAYS_SHORT[date.getDay()]}</span>
                  <span className={cn('text-sm font-semibold', isSelected && 'text-primary-foreground')}>{date.getDate()}</span>
                  {hasEvents && (
                    <div className="flex items-center gap-0.5">
                      <div className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-primary-foreground' : 'bg-primary')} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {viewMode === 'day' && (
          <div className="flex items-center justify-center gap-4 py-3" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
            <span className="text-base font-semibold">{selectedDateLabel}</span>
            {isSameDay(selectedDate, today) && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">今天</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold">{selectedDateLabel}</h3>
          {hasAnyEvents && <span className="text-xs text-muted-foreground">{selectedTasks.length + selectedTimeBlocks.length + selectedAnniversaries.length} 项日程</span>}
        </div>

        {!hasAnyEvents && <MobileEmptyState icon={Calendar} title="暂无日程" description="点击下方按钮添加时间块" action={{ label: '添加时间块', onClick: () => setShowAddSheet(true) }} />}

        {allDayEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">全天</p>
            {allDayEvents.map(event => {
              if (event.type === 'task') {
                const task = event.data
                const isDone = task.status === 'done'
                return (
                  <div key={event.id} className={cn('rounded-2xl border p-3 flex items-center gap-3 transition-all', isDone ? 'bg-muted/30 border-border/20' : 'bg-card border-border/40')}>
                    <button className={cn('shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all active:scale-90', isDone ? 'bg-primary text-primary-foreground' : 'border-2 border-muted-foreground/25')} onClick={() => { if (!isDone) completeTask(task.id) }}>
                      {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isDone && 'line-through text-muted-foreground')}>{task.title}</p>
                    </div>
                    <div className={cn('shrink-0 h-2 w-2 rounded-full', event.color)} />
                  </div>
                )
              }
              const a = event.data
              const aDate = new Date(a.date)
              const thisYearDate = new Date(selectedDate.getFullYear(), aDate.getMonth(), aDate.getDate())
              const diff = Math.floor((thisYearDate.getTime() - today.getTime()) / 86400000)
              const dayText = diff === 0 ? '今天' : diff === 1 ? '明天' : diff > 0 ? `${diff}天后` : '已过'
              return (
                <div key={event.id} className="rounded-2xl border bg-gradient-to-r from-pink-500/5 to-rose-500/5 border-pink-500/20 p-3 flex items-center gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-pink-500/15 flex items-center justify-center"><Heart className="h-4 w-4 text-pink-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[a.type] || '自定义'}<span className="ml-1.5 text-pink-500">{dayText}</span></p>
                  </div>
                  <span className="text-lg">{a.icon}</span>
                </div>
              )
            })}
          </div>
        )}

        {timedEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">时间安排</p>
            <div className="relative">
              {TIME_SLOTS.map(hour => {
                const hourStr = hour.toString().padStart(2, '0')
                const hourEvents = timedEvents.filter(e => e.startTime.startsWith(hourStr))
                return (
                  <div key={hour} className="flex items-start min-h-[48px]">
                    <div className="w-12 shrink-0 text-[10px] text-muted-foreground pt-1 text-right pr-3">{hour}:00</div>
                    <div className="flex-1 border-l border-border/20 pl-3 py-1 space-y-1">
                      {hourEvents.map(event => (
                        <div key={event.id} className={cn(
                          'rounded-lg px-2.5 py-1.5 text-xs',
                          event.type === 'timeblock' ? 'bg-primary/10 border border-primary/20 active:bg-primary/20' : 'bg-muted/30',
                          event.type === 'timeblock' && 'cursor-pointer active:scale-[0.98] transition-transform'
                        )} onClick={() => { if (event.type === 'timeblock') openEditSheet(event.data) }}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{event.startTime}</span>
                            {event.endTime && <span className="text-muted-foreground">- {event.endTime}</span>}
                            {event.category && <span className="text-muted-foreground">· {event.category}</span>}
                          </div>
                          <p className="font-medium mt-0.5">{event.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button className="fixed bottom-24 right-4 z-30 h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center active:scale-90 transition-transform" onClick={() => { setEditingBlock(null); setNewTitle(''); setNewStartTime('09:00'); setNewEndTime('10:00'); setNewCategory('work'); setShowAddSheet(true) }}>
        <Plus className="h-6 w-6" />
      </button>

      <MobileBottomSheet open={showAddSheet} onClose={() => { setShowAddSheet(false); setEditingBlock(null); setShowDeleteConfirm(false) }} title={editingBlock ? '编辑时间块' : '添加时间块'} action={{ label: editingBlock ? '保存' : '添加', onClick: editingBlock ? handleEditTimeBlock : handleAddTimeBlock, disabled: !newTitle.trim() }}>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">标题</label>
            <input type="text" placeholder="时间块名称" className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (editingBlock ? handleEditTimeBlock() : handleAddTimeBlock())} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">开始时间</label>
              <input type="time" className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">结束时间</label>
              <input type="time" className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">类型</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_CONFIG) as TimeBlockCategory[]).map((cat) => {
                const cfg = CATEGORY_CONFIG[cat]
                return <button key={cat} className={cn('px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform', newCategory === cat ? cn(cfg.bg, cfg.color, 'ring-2 ring-current/20') : 'bg-muted/50 text-muted-foreground')} onClick={() => setNewCategory(cat)}>{cfg.label}</button>
              })}
            </div>
          </div>
          {editingBlock && (
            <div className="pt-2 border-t border-border/30">
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">确定删除此时间块？</p>
                  <div className="flex gap-3">
                    <button className="flex-1 h-10 rounded-xl bg-muted/50 text-sm font-medium active:scale-95 transition-transform" onClick={() => setShowDeleteConfirm(false)}>取消</button>
                    <button className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium active:scale-95 transition-transform" onClick={handleDeleteTimeBlock}>确认删除</button>
                  </div>
                </div>
              ) : (
                <button className="w-full h-10 rounded-xl border border-destructive/30 text-destructive text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      </MobileBottomSheet>
    </div>
  )
}
