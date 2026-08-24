'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { COLOR_PALETTE } from '@/lib/palette'
import type { Habit } from '@/lib/types'
import { useHabitStats, useLast30Days } from '@/lib/hooks'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useDataLink } from '@/lib/data-link-service'
import { HabitBatchCheckIn } from '@/components/habit-batch-checkin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
  Plus,
  Check,
  X,
  TrendingUp,
  Calendar,
  Target,
  Flame,
  Trash2,
  Edit,
  Bell,
  BarChart3,
  PieChart,
  Clock,
  Award,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WEEKDAY_NAMES, habitFrequencyLabel, isHabitScheduledOn } from '@/lib/habit-frequency'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

const habitIcons = ['🌅', '🏃', '📚', '🧘', '💧', '💪', '🎯', '✍️', '🛏️', '🥗', '💊', '🎵']
const habitColors = COLOR_PALETTE

import { CHART_TOOLTIP_STYLE } from '@/lib/config'

const habitCategories = [
  { id: 'health', name: '健康', icon: '💪' },
  { id: 'learning', name: '学习', icon: '📚' },
  { id: 'work', name: '工作', icon: '🎯' },
  { id: 'life', name: '生活', icon: '🏠' },
  { id: 'fitness', name: '运动', icon: '🏃' },
  { id: 'mindfulness', name: '冥想', icon: '🧘' },
]

export function HabitsView() {
  const { habits, habitCheckIns, addHabit, updateHabit, deleteHabit, checkInHabit, useStreakFreeze, undoLastDelete } = useAppStore(useShallow((state) => ({
    habits: state.habits,
    habitCheckIns: state.habitCheckIns,
    addHabit: state.addHabit,
    updateHabit: state.updateHabit,
    deleteHabit: state.deleteHabit,
    checkInHabit: state.checkInHabit,
    useStreakFreeze: state.useStreakFreeze,
    undoLastDelete: state.undoLastDelete,
  })))
  const habitStats = useHabitStats()
  const last30Days = useLast30Days()
  const dataLink = useDataLink()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [newHabit, setNewHabit] = useState({
    name: '',
    icon: '🌅',
    color: COLOR_PALETTE[0],
    frequency: 'daily' as Habit['frequency'],
    category: 'health',
    reminderTime: '',
    reminderEnabled: false,
    trackingType: 'boolean' as 'boolean' | 'quantity',
    targetValue: 1,
    unit: '',
    weeklyPattern: [] as number[],
    intervalDays: 2,
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toDateString()

  const handleAddHabit = () => {
    if (!newHabit.name.trim()) return
    addHabit({
      name: newHabit.name,
      icon: newHabit.icon,
      color: newHabit.color,
      frequency: newHabit.frequency,
      category: newHabit.category,
      reminderTime: newHabit.reminderTime || undefined,
      reminderEnabled: newHabit.reminderEnabled,
      trackingType: newHabit.trackingType,
      targetValue: newHabit.trackingType === 'quantity' ? newHabit.targetValue : undefined,
      unit: newHabit.trackingType === 'quantity' ? newHabit.unit || undefined : undefined,
      weeklyPattern: newHabit.frequency === 'custom' && newHabit.weeklyPattern.length > 0 ? [...newHabit.weeklyPattern] : undefined,
      intervalDays: newHabit.frequency === 'custom' && newHabit.weeklyPattern.length === 0 ? newHabit.intervalDays : undefined,
    } as Omit<Habit, 'id' | 'createdAt' | 'archived'>)
    resetNewHabit()
    setIsAddDialogOpen(false)
  }

  const handleEditHabit = () => {
    if (!editingHabit || !newHabit.name.trim()) return
    updateHabit(editingHabit.id, {
      name: newHabit.name,
      icon: newHabit.icon,
      color: newHabit.color,
      frequency: newHabit.frequency,
      category: newHabit.category,
      reminderTime: newHabit.reminderTime || undefined,
      reminderEnabled: newHabit.reminderEnabled,
      trackingType: newHabit.trackingType,
      targetValue: newHabit.trackingType === 'quantity' ? newHabit.targetValue : undefined,
      unit: newHabit.trackingType === 'quantity' ? newHabit.unit || undefined : undefined,
      weeklyPattern: newHabit.frequency === 'custom' && newHabit.weeklyPattern.length > 0 ? [...newHabit.weeklyPattern] : undefined,
      intervalDays: newHabit.frequency === 'custom' && newHabit.weeklyPattern.length === 0 ? newHabit.intervalDays : undefined,
    })
    setEditingHabit(null)
    resetNewHabit()
  }

  const resetNewHabit = () => {
    setNewHabit({ name: '', icon: '🌅', color: COLOR_PALETTE[0], frequency: 'daily', category: 'health', reminderTime: '', reminderEnabled: false, trackingType: 'boolean', targetValue: 1, unit: '', weeklyPattern: [], intervalDays: 2 })
  }

  const handleCheckIn = (habitId: string, completed: boolean, value?: number) => {
    checkInHabit(habitId, today, completed, undefined, value)
    dataLink.handleHabitCheck(habitId, today, completed)
  }

  const filteredHabits = selectedCategory === 'all' 
    ? habitStats.activeHabits 
    : habitStats.activeHabits.filter(h => h.category === selectedCategory)

  const weeklyChartData = useMemo(() => {
    const data = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toDateString()
      const dayCheckIns = habitCheckIns.filter(c => new Date(c.date).toDateString() === dateStr)
      const completed = dayCheckIns.filter(c => c.completed).length
      const total = habitStats.activeHabits.length
      data.push({
        name: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
        完成率: total > 0 ? Math.round((completed / total) * 100) : 0,
        完成: completed,
      })
    }
    return data
  }, [habitCheckIns, habitStats.activeHabits])

  const categoryData = useMemo(() => {
    const categoryCount: Record<string, number> = {}
    habitStats.activeHabits.forEach(h => {
      let category = '其他'
      if (['💧', '💊', '🥗', '🛏️'].includes(h.icon)) category = '健康'
      else if (['📚', '✍️'].includes(h.icon)) category = '学习'
      else if (['🎯'].includes(h.icon)) category = '工作'
      else if (['🌅', '🎵'].includes(h.icon)) category = '生活'
      else if (['🏃', '💪'].includes(h.icon)) category = '运动'
      else if (['🧘'].includes(h.icon)) category = '冥想'
      
      categoryCount[category] = (categoryCount[category] || 0) + 1
    })
    return Object.entries(categoryCount).map(([name, value], index) => ({
      name,
      value,
      color: habitColors[index % habitColors.length],
    }))
  }, [habitStats.activeHabits])

  const monthlyTrendData = useMemo(() => {
    const data = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toDateString()
      const dayCheckIns = habitCheckIns.filter(c => new Date(c.date).toDateString() === dateStr)
      const completed = dayCheckIns.filter(c => c.completed).length
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        完成: completed,
      })
    }
    return data
  }, [habitCheckIns])

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">习惯打卡</h1>
          <p className="text-muted-foreground mt-0.5">培养良好习惯，记录每日进步</p>
        </div>
        <div className="flex items-center gap-2">
          <HabitBatchCheckIn />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              添加习惯
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHabit ? '编辑习惯' : '添加新习惯'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">习惯名称</label>
                <Input
                  placeholder="例如：早起、运动、阅读..."
                  value={newHabit.name}
                  onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">追踪方式</label>
                <div className="flex gap-2">
                  <button
                    className={cn(
                      'flex-1 rounded-lg border p-3 text-center text-sm transition-all',
                      newHabit.trackingType === 'boolean'
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/30'
                    )}
                    onClick={() => setNewHabit({ ...newHabit, trackingType: 'boolean' })}
                  >
                    <div className="text-lg mb-1">✓</div>
                    打卡式
                  </button>
                  <button
                    className={cn(
                      'flex-1 rounded-lg border p-3 text-center text-sm transition-all',
                      newHabit.trackingType === 'quantity'
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/30'
                    )}
                    onClick={() => setNewHabit({ ...newHabit, trackingType: 'quantity' })}
                  >
                    <div className="text-lg mb-1">📊</div>
                    量化式
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {newHabit.trackingType === 'boolean'
                    ? '打卡式：每天完成或未完成（如早起、冥想）'
                    : '量化式：记录具体数值（如喝8杯水、跑步5公里）'}
                </p>
              </div>
              {newHabit.trackingType === 'quantity' && (
                <div className="space-y-3 rounded-xl bg-muted/30 p-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-medium">目标值</label>
                      <Input
                        type="number"
                        min={1}
                        value={newHabit.targetValue}
                        onChange={(e) => setNewHabit({ ...newHabit, targetValue: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="mt-1"
                        placeholder="例如：8"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium">单位</label>
                      <Input
                        value={newHabit.unit}
                        onChange={(e) => setNewHabit({ ...newHabit, unit: e.target.value })}
                        className="mt-1"
                        placeholder="例如：杯、公里、分钟"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 设定目标值后，打卡时可记录进度，达到目标值即视为完成
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">分类</label>
                <Select
                  value={newHabit.category}
                  onValueChange={(value) => setNewHabit({ ...newHabit, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {habitCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">图标</label>
                <div className="flex flex-wrap gap-2">
                  {habitIcons.map((icon) => (
                    <button
                      key={icon}
                      className={cn(
                        'h-10 w-10 rounded-lg text-xl transition-all',
                        newHabit.icon === icon
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                      onClick={() => setNewHabit({ ...newHabit, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">颜色</label>
                <div className="flex flex-wrap gap-2">
                  {habitColors.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all',
                        newHabit.color === color && 'ring-2 ring-offset-2 ring-primary'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewHabit({ ...newHabit, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">频率</label>
                <Select
                  value={newHabit.frequency}
                  onValueChange={(value: Habit['frequency']) =>
                    setNewHabit({ ...newHabit, frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
                {newHabit.frequency === 'custom' && (
                  <div className="space-y-2 rounded-xl border border-border/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">按星期</span>
                      <div className="flex gap-1">
                        {WEEKDAY_NAMES.map((day, idx) => {
                          const selected = newHabit.weeklyPattern.includes(idx)
                          return (
                            <button
                              key={idx}
                              className={cn(
                                'h-7 w-7 rounded-full text-xs font-medium transition-all',
                                selected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                              )}
                              onClick={() =>
                                setNewHabit({
                                  ...newHabit,
                                  weeklyPattern: selected
                                    ? newHabit.weeklyPattern.filter((d) => d !== idx)
                                    : [...newHabit.weeklyPattern, idx],
                                })
                              }
                            >
                              {day}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">或每隔 N 天</span>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        value={newHabit.intervalDays}
                        onChange={(e) =>
                          setNewHabit({
                            ...newHabit,
                            intervalDays: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-20 h-8"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">提醒时间（可选）</label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={newHabit.reminderTime}
                    onChange={(e) => setNewHabit({ ...newHabit, reminderTime: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <Button
                onClick={editingHabit ? handleEditHabit : handleAddHabit}
                className="w-full"
              >
                {editingHabit ? '保存修改' : '添加习惯'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-1/10 p-3">
                <Target className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">今日完成</p>
                <p className="text-xl font-bold tracking-tight">{habitStats.completedToday}/{habitStats.totalHabits}</p>
              </div>
            </div>
            <Progress value={habitStats.completionRate} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-2/10 p-3">
                <Flame className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">最长连续</p>
                <p className="text-xl font-bold tracking-tight">
                  {habitStats.maxStreak} 天
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-3/10 p-3">
                <TrendingUp className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均完成率</p>
                <p className="text-xl font-bold tracking-tight">
                  {habitStats.avgCompletionRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-4/10 p-3">
                <Award className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">成就解锁</p>
                <p className="text-xl font-bold tracking-tight">
                  {Math.floor(habitStats.maxStreak / 7)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="habits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="habits" className="gap-2">
            <Target className="h-4 w-4" />
            习惯列表
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            日历视图
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            统计分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="habits" className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              全部
            </Button>
            {habitCategories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="gap-1"
              >
                {cat.icon} {cat.name}
              </Button>
            ))}
          </div>

          {filteredHabits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Target className="mx-auto h-12 w-12 opacity-50 mb-3" />
                <p className="text-sm">暂无习惯</p>
                <p className="text-xs mt-1">点击上方"添加习惯"开始培养好习惯</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredHabits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  habitStats={habitStats}
                  habitCheckIns={habitCheckIns}
                  todayStr={todayStr}
                  today={today}
                  onEdit={(h) => {
                    setEditingHabit(h)
                    setNewHabit({
                      name: h.name,
                      icon: h.icon,
                      color: h.color,
                      frequency: h.frequency,
                      category: h.category || 'health',
                      reminderTime: h.reminderTime || '',
                      reminderEnabled: h.reminderEnabled || false,
                      trackingType: h.trackingType || 'boolean',
                      targetValue: h.targetValue || 1,
                      unit: h.unit || '',
                      weeklyPattern: h.weeklyPattern ? [...h.weeklyPattern] : [],
                      intervalDays: h.intervalDays || 2,
                    })
                    setIsAddDialogOpen(true)
                  }}
                  onDelete={(id, name) => {
                    deleteHabit(id)
                    toast.success('习惯已删除', {
                      description: name,
                      action: {
                        label: '撤销',
                        onClick: () => undoLastDelete(),
                      },
                      duration: 5000,
                    })
                  }}
                  onCheckIn={handleCheckIn}
                  onStreakFreeze={useStreakFreeze}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">习惯日历</CardTitle>
            </CardHeader>
            <CardContent>
              {habitStats.activeHabits.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Target className="mx-auto h-12 w-12 opacity-50 mb-3" />
                  <p className="text-sm">暂无习惯</p>
                  <p className="text-xs mt-1">点击上方"添加习惯"创建第一个习惯</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-[120px_repeat(30,1fr)] gap-1 text-center">
                      <div className="text-sm font-medium text-muted-foreground">习惯</div>
                      {last30Days.map((date, i) => (
                        <div
                          key={i}
                          className={cn(
                            'text-xs text-muted-foreground',
                            date.toDateString() === todayStr && 'font-bold text-primary'
                          )}
                        >
                          {date.getDate()}
                        </div>
                      ))}
                      {habitStats.activeHabits.map((habit) => (
                        <div key={habit.id} className="contents">
                          <div
                            className="flex items-center gap-2 text-sm font-medium"
                          >
                            <span>{habit.icon}</span>
                            <span className="truncate">{habit.name}</span>
                          </div>
                          {last30Days.map((date, i) => {
                            const dateStr = date.toDateString()
                            const checkIn = habitCheckIns.find(
                              (c) =>
                                c.habitId === habit.id &&
                                new Date(c.date).toDateString() === dateStr
                            )
                            const isToday = date.toDateString() === todayStr
                            return (
                              <button
                                key={i}
                                className={cn(
                                  'h-6 w-full rounded-sm transition-all',
                                  checkIn?.completed
                                    ? 'bg-chart-2'
                                    : isToday
                                    ? 'bg-muted hover:bg-muted/80'
                                    : 'bg-muted/50'
                                )}
                                style={{
                                  backgroundColor: checkIn?.completed ? habit.color : undefined,
                                }}
                                onClick={() =>
                                  isToday &&
                                  handleCheckIn(habit.id, !checkIn?.completed)
                                }
                              />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                📊 习惯热力图
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="inline-flex flex-col gap-[3px] min-w-[680px]">
                  <div className="flex items-center gap-[3px] mb-1">
                    <span className="w-8 text-[10px] text-muted-foreground" />
                    {Array.from({ length: 15 }, (_, i) => {
                      const d = new Date()
                      d.setDate(d.getDate() - (14 - i) * 7)
                      return (
                        <span key={i} className="flex-1 text-center text-[10px] text-muted-foreground">
                          {d.getMonth() + 1}/{d.getDate()}
                        </span>
                      )
                    })}
                  </div>
                  {['一', '二', '三', '四', '五', '六', '日'].map((dayLabel, dayIdx) => {
                    const jsDay = dayIdx < 5 ? dayIdx + 1 : dayIdx === 5 ? 6 : 0
                    return (
                      <div key={dayIdx} className="flex items-center gap-[3px]">
                        <span className="w-8 text-[10px] text-muted-foreground">{dayLabel}</span>
                        {Array.from({ length: 15 }, (_, weekIdx) => {
                          const d = new Date()
                          d.setDate(d.getDate() - ((14 - weekIdx) * 7 + (d.getDay() - jsDay + 7) % 7))
                          if (d > new Date()) return <div key={weekIdx} className="flex-1 h-[14px] rounded-sm" />
                          const dateStr = d.toDateString()
                          const dayCheckIns = habitCheckIns.filter(c => new Date(c.date).toDateString() === dateStr && c.completed)
                          const intensity = habitStats.activeHabits.length > 0 ? dayCheckIns.length / habitStats.activeHabits.length : 0
                          return (
                            <div
                              key={weekIdx}
                              className={cn(
                                'flex-1 h-[14px] rounded-sm transition-all hover:ring-1 hover:ring-primary/50 cursor-default',
                                intensity === 0 && 'bg-muted/40',
                                intensity > 0 && intensity <= 0.25 && 'bg-chart-2/25',
                                intensity > 0.25 && intensity <= 0.5 && 'bg-chart-2/50',
                                intensity > 0.5 && intensity <= 0.75 && 'bg-chart-2/75',
                                intensity > 0.75 && 'bg-chart-2',
                              )}
                              title={`${d.getMonth() + 1}/${d.getDate()} ${dayCheckIns.length > 0 ? `完成${dayCheckIns.length}个习惯` : '无打卡'}`}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <span className="text-[10px] text-muted-foreground">少</span>
                    <div className="h-[10px] w-[10px] rounded-sm bg-muted/40" />
                    <div className="h-[10px] w-[10px] rounded-sm bg-chart-2/25" />
                    <div className="h-[10px] w-[10px] rounded-sm bg-chart-2/50" />
                    <div className="h-[10px] w-[10px] rounded-sm bg-chart-2/75" />
                    <div className="h-[10px] w-[10px] rounded-sm bg-chart-2" />
                    <span className="text-[10px] text-muted-foreground">多</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">本周完成率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.5 0.02 260)', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.5 0.02 260)', fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [`${value}%`, '完成率']} />
                      <Bar dataKey="完成率" fill={COLOR_PALETTE[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">习惯分类</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${value}`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">30天趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.5 0.02 260)', fontSize: 10 }} interval={4} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'oklch(0.5 0.02 260)', fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="完成" stroke={COLOR_PALETTE[1]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface HabitCardProps {
  habit: Habit
  habitStats: ReturnType<typeof useHabitStats>
  habitCheckIns: import('@/lib/types').HabitCheckIn[]
  todayStr: string
  today: Date
  onEdit: (habit: Habit) => void
  onDelete: (id: string, name: string) => void
  onCheckIn: (habitId: string, completed: boolean, value?: number) => void
  onStreakFreeze: (habitId: string) => void
}

function HabitCard({
  habit,
  habitStats,
  habitCheckIns,
  todayStr,
  today,
  onEdit,
  onDelete,
  onCheckIn,
  onStreakFreeze,
}: HabitCardProps) {
  const [inputValue, setInputValue] = useState('')
  const streak = habitStats.getHabitStreak(habit.id)
  const completionRate = habitStats.getHabitCompletionRate(habit.id)
  const isCompleted = habitStats.todayCheckIns.some((c) => c.habitId === habit.id && c.completed)
  const currentValue = habitStats.todayCheckIns.find((c) => c.habitId === habit.id)?.value || 0
  const isQuantity = habit.trackingType === 'quantity'
  const targetValue = habit.targetValue || 1
  const quantityProgress = isQuantity ? Math.min((currentValue / targetValue) * 100, 100) : 0

  return (
    <Card className="overflow-hidden">
      <div
        className="h-1"
        style={{ backgroundColor: habit.color }}
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${habit.color}20` }}
            >
              {habit.icon}
            </div>
            <div>
              <h3 className="font-semibold">{habit.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{habitFrequencyLabel(habit)}</span>
                {!isHabitScheduledOn(habit, today) && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
                    今日休息
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-3 w-3" style={{ color: habit.color }} />
                <span>{streak} 天连续</span>
                {(habit.streakFreezes || 0) > 0 && (
                  <span className="text-xs text-blue-500" title={`连续冻结 ×${habit.streakFreezes}`}>
                    🧊 ×{habit.streakFreezes}
                  </span>
                )}
                {!isCompleted && (habit.streakFreezes || 0) < (habit.maxStreakFreezes || 3) && (
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStreakFreeze(habit.id)
                    }}
                    title={`使用连续冻结 (${habit.streakFreezes || 0}/${habit.maxStreakFreezes || 3})`}
                  >
                    🧊+1
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(habit)}
              aria-label="编辑习惯"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(habit.id, habit.name)}
              aria-label="删除习惯"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isQuantity && (
          <div className="mt-3 rounded-xl bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">今日进度</span>
              <span className="text-sm font-semibold" style={{ color: habit.color }}>
                {currentValue} / {targetValue} {habit.unit || ''}
              </span>
            </div>
            <Progress value={quantityProgress} className="h-2" />
          </div>
        )}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">30天完成率</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>最近14天</span>
            <span>{streak > 0 ? `🔥 连续${streak}天` : '开始打卡吧'}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 14 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - (13 - i))
              const dateStr = d.toDateString()
              const checkIn = habitCheckIns.find(
                c => c.habitId === habit.id && new Date(c.date).toDateString() === dateStr
              )
              const isToday = dateStr === todayStr
              const fillPercent = isQuantity && checkIn?.value && habit.targetValue
                ? Math.min((checkIn.value / habit.targetValue) * 100, 100)
                : (checkIn?.completed ? 100 : 0)
              return (
                <div
                  key={i}
                  className={cn(
                    'h-5 flex-1 rounded-sm transition-all relative overflow-hidden',
                    !checkIn?.completed && !isToday && 'bg-muted/40',
                    isToday && !checkIn?.completed && 'border-2 border-dashed border-muted-foreground/30'
                  )}
                  title={`${d.getMonth() + 1}/${d.getDate()} ${checkIn?.completed ? (checkIn.value ? `${checkIn.value}/${habit.targetValue || ''}${habit.unit || ''}` : '✓') : ''}`}
                >
                  {(checkIn?.completed || (isQuantity && checkIn?.value)) && (
                    <div
                      className="absolute inset-0 transition-all"
                      style={{
                        backgroundColor: habit.color,
                        opacity: fillPercent >= 100 ? 1 : 0.4 + (fillPercent / 100) * 0.6,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {isQuantity ? (
          <div className="mt-4 flex gap-2">
            <Input
              type="number"
              min={0}
              placeholder={`输入${habit.unit || '数值'}...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt(inputValue) || 0
                  if (val > 0) {
                    const completed = val >= targetValue
                    onCheckIn(habit.id, completed, val)
                    setInputValue('')
                  }
                }
              }}
            />
            <Button
              className="gap-1.5 shrink-0"
              style={{ backgroundColor: isCompleted ? habit.color : undefined }}
              variant={isCompleted ? 'default' : 'default'}
              onClick={() => {
                const val = parseInt(inputValue) || (currentValue > 0 ? currentValue + 1 : 1)
                const completed = val >= targetValue
                onCheckIn(habit.id, completed, val)
                setInputValue('')
              }}
            >
              <Plus className="h-4 w-4" />
              记录
            </Button>
          </div>
        ) : (
          <Button
            className={cn(
              'mt-4 w-full gap-2 transition-all duration-300',
              isCompleted
                ? 'bg-chart-2 hover:bg-chart-2/90 scale-100'
                : 'bg-muted hover:bg-muted/80 hover:scale-[1.02]'
            )}
            style={{
              backgroundColor: isCompleted ? habit.color : undefined,
            }}
            onClick={() => onCheckIn(habit.id, !isCompleted)}
          >
            {isCompleted ? (
              <>
                <Check className="h-4 w-4 animate-bounce" />
                已完成 ✓
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                打卡
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
