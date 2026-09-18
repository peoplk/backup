'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import type { TimeBlock } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
  Clock,
  Plus,
  Brain,
  Users,
  Coffee,
  Heart,
  Briefcase,
  CheckCircle2,
  CircleDot,
  Trash2,
  Edit3,
  Calendar,
  GripVertical,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { TIME_SLOTS, TIME_BLOCK_CATEGORY_CONFIG } from '@/lib/config'
import { useConfirm } from '@/components/ui/confirm-dialog'

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

export function TimeBlockView() {
  const {
    tasks,
    timeBlocks,
    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
    completeTask,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    timeBlocks: s.timeBlocks,
    addTimeBlock: s.addTimeBlock,
    updateTimeBlock: s.updateTimeBlock,
    deleteTimeBlock: s.deleteTimeBlock,
    completeTask: s.completeTask,
  })))

  const [currentDate, setCurrentDate] = useState(new Date())
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ hour: number; minute: number } | null>(null)
  const { confirm: showConfirm, DialogComponent: ConfirmDialog } = useConfirm()

  const [newBlock, setNewBlock] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    category: 'focus' as TimeBlock['category'],
    taskId: '',
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const currentDateStr = currentDate.toDateString()

  const dayBlocks = useMemo(() => {
    return timeBlocks
      .filter(b => new Date(b.date).toDateString() === currentDateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [timeBlocks, currentDateStr])

  const activeTasks = tasks.filter(t => t.status !== 'done')

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

  const openAddDialog = useCallback((hour?: number, minute?: number) => {
    const startHour = hour !== undefined ? hour : 9
    const startMinute = minute || 0
    const endHour = startHour + 1
    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`
    const endTime = `${String(endHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`

    setNewBlock(prev => ({
      ...prev,
      startTime,
      endTime,
    }))
    setEditingBlock(null)
    setIsAddDialogOpen(true)
  }, [])

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

  const handleDeleteBlock = async (block: TimeBlock) => {
    const confirmed = await showConfirm({
      title: '删除时间块',
      description: `确定要删除 "${block.title}" 吗？`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive',
    })
    if (confirmed) {
      deleteTimeBlock(block.id)
    }
  }

  const toggleBlockComplete = (block: TimeBlock) => {
    updateTimeBlock(block.id, { completed: !block.completed })
  }

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
  }

  const isToday = currentDate.toDateString() === today.toDateString()

  const DEFAULT_START = 6
  const DEFAULT_END = 22

  const dynamicStartHour = useMemo(() => {
    let minHour = DEFAULT_START
    dayBlocks.forEach(b => {
      const h = parseInt(b.startTime.split(':')[0])
      if (h < minHour) minHour = h
    })
    return Math.max(0, minHour - 1)
  }, [dayBlocks])

  const dynamicEndHour = useMemo(() => {
    let maxHour = DEFAULT_END
    dayBlocks.forEach(b => {
      const h = parseInt(b.endTime.split(':')[0])
      if (h > maxHour) maxHour = h
    })
    return Math.min(23, maxHour + 1)
  }, [dayBlocks])

  const hours = useMemo(() =>
    Array.from({ length: dynamicEndHour - dynamicStartHour + 1 }, (_, i) => i + dynamicStartHour),
    [dynamicStartHour, dynamicEndHour]
  )

  const HOUR_HEIGHT = 64

  const getBlockStyle = (startTime: string, endTime: string) => {
    const startHour = parseInt(startTime.split(':')[0])
    const startMinute = parseInt(startTime.split(':')[1])
    const endHour = parseInt(endTime.split(':')[0])
    const endMinute = parseInt(endTime.split(':')[1])
    const startOffset = startHour - dynamicStartHour + startMinute / 60
    const duration = (endHour - startHour) + (endMinute - startMinute) / 60
    return {
      top: `${startOffset * HOUR_HEIGHT}px`,
      height: `${Math.max(duration * HOUR_HEIGHT - 2, 32)}px`,
    }
  }

  const currentHour = new Date().getHours()
  const currentMinute = new Date().getMinutes()

  const totalPlannedMinutes = dayBlocks.reduce((acc, b) => {
    const sh = parseInt(b.startTime.split(':')[0])
    const sm = parseInt(b.startTime.split(':')[1])
    const eh = parseInt(b.endTime.split(':')[0])
    const em = parseInt(b.endTime.split(':')[1])
    return acc + (eh - sh) * 60 + (em - sm)
  }, 0)

  const completedBlocks = dayBlocks.filter(b => b.completed).length

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    dayBlocks.forEach(b => {
      const sh = parseInt(b.startTime.split(':')[0])
      const sm = parseInt(b.startTime.split(':')[1])
      const eh = parseInt(b.endTime.split(':')[0])
      const em = parseInt(b.endTime.split(':')[1])
      const mins = (eh - sh) * 60 + (em - sm)
      breakdown[b.category] = (breakdown[b.category] || 0) + mins
    })
    return breakdown
  }, [dayBlocks])

  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const getWeekDayBlocks = (offset: number) => {
    const date = new Date(currentDate)
    date.setDate(date.getDate() + offset)
    const dateStr = date.toDateString()
    return timeBlocks.filter(b => new Date(b.date).toDateString() === dateStr).length
  }

  const currentDayIndex = (currentDate.getDay() + 6) % 7

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">时间块规划</h1>
          <p className="text-sm text-muted-foreground mt-0.5">把今天划成时间段，给每件事安排位置</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => openAddDialog()}
          >
            <Plus className="h-4 w-4" />
            添加时间块
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay('prev')} aria-label="前一天">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs h-8 px-3">
              今天
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay('next')} aria-label="后一天">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {currentDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {currentDate.toLocaleDateString('zh-CN', { weekday: 'long' })}
              {isToday && <span className="ml-1 text-primary font-medium">· 今天</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {weekDays.map((day, i) => {
            const offset = i - currentDayIndex
            const date = new Date(currentDate)
            date.setDate(date.getDate() + offset)
            const isSelected = offset === 0
            const isPast = date < today && !isSelected
            const blockCount = getWeekDayBlocks(offset)
            return (
              <button
                key={day}
                onClick={() => setCurrentDate(date)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-all min-w-[52px]',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isPast
                    ? 'text-muted-foreground/50 hover:bg-muted/30'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className="text-[10px]">{day}</span>
                <span className="text-sm font-bold">{date.getDate()}</span>
                {blockCount > 0 && !isSelected && (
                  <span className={cn(
                    'text-[9px] rounded-full px-1',
                    isPast ? 'bg-muted' : 'bg-primary/10 text-primary'
                  )}>
                    {blockCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-chart-1" />
                日程时间线
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>已规划 {Math.round(totalPlannedMinutes / 60 * 10) / 10} 小时</span>
                <span className="text-chart-2">{completedBlocks}/{dayBlocks.length} 完成</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="relative max-h-[600px] overflow-y-auto rounded-xl border border-border/40" id="time-block-scroll">
              {isToday && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${(currentHour - dynamicStartHour + currentMinute / 60) * HOUR_HEIGHT + 8}px` }}
                >
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0 ml-1" />
                    <div className="h-px flex-1 bg-destructive/40 mr-2" />
                  </div>
                </div>
              )}

              <div className="relative">
                {dayBlocks.map(block => {
                  const config = categoryConfig[block.category]
                  const Icon = config.icon
                  const style = getBlockStyle(block.startTime, block.endTime)
                  const linkedTask = block.taskId ? tasks.find(t => t.id === block.taskId) : null

                  return (
                    <div
                      key={block.id}
                      className={cn(
                        'absolute left-16 right-3 rounded-xl border px-3 py-2 transition-all cursor-pointer z-10 hover:shadow-md group',
                        config.bgClass,
                        config.borderClass,
                        block.completed && 'opacity-50'
                      )}
                      style={style}
                      onClick={() => openEditDialog(block)}
                    >
                      <div className="flex items-center justify-between gap-2 h-full">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleBlockComplete(block)
                            }}
                            className="shrink-0"
                          >
                            {block.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-chart-2" />
                            ) : (
                              <CircleDot className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" />
                            )}
                          </button>
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', config.colorClass)} />
                          <div className="min-w-0">
                            <span className={cn('text-sm font-medium truncate block', block.completed && 'line-through')}>
                              {block.title}
                            </span>
                            {linkedTask && (
                              <span className="text-[10px] text-muted-foreground truncate block">
                                关联: {linkedTask.title}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {block.startTime}-{block.endTime}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(block)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background/50 rounded"
                          >
                            <Edit3 className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteBlock(block)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div className="space-y-0">
                  {hours.map((hour) => {
                    const isCurrentHour = hour === currentHour && isToday
                    const hourBlocks = dayBlocks.filter(b => {
                      const sh = parseInt(b.startTime.split(':')[0])
                      return sh === hour
                    })

                    return (
                      <div
                        key={hour}
                        className={cn('flex rounded-lg transition-colors relative', isCurrentHour && 'bg-primary/5')}
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        <div className={cn('w-14 py-2 text-[11px] font-mono shrink-0 tabular-nums text-right pr-2', isCurrentHour ? 'text-primary font-bold' : 'text-muted-foreground')}>
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div
                          className="flex-1 border-b border-border/20 relative"
                          onClick={() => openAddDialog(hour, 0)}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                            <div className="flex items-center gap-1 text-muted-foreground/50">
                              <Plus className="h-3 w-3" />
                              <span className="text-[10px]">添加</span>
                            </div>
                          </div>
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
                <div className="rounded-xl bg-background/60 p-3">
                  <p className="text-2xl font-bold">{dayBlocks.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">时间块</p>
                </div>
                <div className="rounded-xl bg-background/60 p-3">
                  <p className="text-2xl font-bold">{completedBlocks}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">已完成</p>
                </div>
                <div className="rounded-xl bg-background/60 p-3">
                  <p className="text-2xl font-bold">{Math.round(totalPlannedMinutes / 60 * 10) / 10}h</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">已规划</p>
                </div>
                <div className="rounded-xl bg-background/60 p-3">
                  <p className="text-2xl font-bold">{dayBlocks.filter(b => !b.completed).length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">待完成</p>
                </div>
              </div>
            </div>
          </Card>

          {dayBlocks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-chart-1" />
                  时间块列表
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {dayBlocks.map(block => {
                    const config = categoryConfig[block.category]
                    const Icon = config.icon
                    const linkedTask = block.taskId ? tasks.find(t => t.id === block.taskId) : null
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleBlockComplete(block)
                          }}
                        >
                          {block.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-chart-2" />
                          ) : (
                            <CircleDot className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </button>
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', config.colorClass)} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium truncate', block.completed && 'line-through')}>{block.title}</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {block.startTime} - {block.endTime}
                            {linkedTask && ` · ${linkedTask.title}`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(categoryBreakdown).length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold">时间分布</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-2">
                  {Object.entries(categoryBreakdown).map(([key, minutes]) => {
                    const config = categoryConfig[key]
                    const percentage = (minutes / totalPlannedMinutes) * 100
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <config.icon className={cn('h-3 w-3', config.colorClass)} />
                            <span>{config.label}</span>
                          </div>
                          <span className="text-muted-foreground">{Math.round(minutes / 60 * 10) / 10}h ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', config.bgClass.replace('/12', ''))}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold">可关联任务</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {activeTasks.slice(0, 5).map(task => (
                    <button
                      key={task.id}
                      onClick={() => {
                        setNewBlock(prev => ({ ...prev, taskId: task.id, title: task.title }))
                        openAddDialog()
                      }}
                      className="w-full text-left flex items-center gap-2 rounded-lg border border-border/40 px-2.5 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{task.title}</span>
                      {task.priority && (
                        <Badge variant="outline" className={cn('text-[10px] shrink-0 h-5 ml-auto',
                          task.priority === 'urgent' && 'border-destructive/50 text-destructive',
                          task.priority === 'high' && 'border-chart-3/50 text-chart-3',
                        )}>
                          {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : '中'}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open)
        if (!open) { setEditingBlock(null); resetNewBlock() }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBlock ? '编辑时间块' : '创建时间块'}</DialogTitle>
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
            <div className="flex gap-2">
              <Button
                onClick={editingBlock ? handleEditBlock : handleAddBlock}
                className="flex-1"
              >
                {editingBlock ? '保存修改' : '创建时间块'}
              </Button>
              {editingBlock && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    if (editingBlock) handleDeleteBlock(editingBlock)
                    setIsAddDialogOpen(false)
                  }}
                  aria-label="删除时间块"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  )
}
