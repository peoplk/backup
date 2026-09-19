'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import {
  useStats,
  useStreak,
  formatDuration,
  useTodayTasks,
  type TodayTask,
  useUrgentTasks,
} from '@/lib/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { ViewTabs, ViewTabsList, ViewTabsTrigger, ViewTabsContent } from '@/components/ui/view-tabs'
import {
  CheckCircle2,
  Timer,
  TrendingUp,
  Target,
  Flame,
  Sparkles,
  Plus,
  Play,
  ListTodo,
  CircleDot,
  Coffee,
  Sun,
  Moon,
  Activity,
  ChevronRight,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  ArrowUpRight,
  Sparkle,
  TrendingDown,
  LayoutDashboard,
} from 'lucide-react'
import { SmartQuickAddTask } from '@/components/smart-quick-add-task'
import { GoalCelebration } from '@/components/goal-celebration'
import { useDailyGoalWatcher } from '@/lib/hooks/use-daily-goal'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/components/ui/use-mobile'


const GREETINGS = [
  { start: 0, end: 6, text: '夜深了', subtext: '注意休息，明天继续', icon: Moon, accent: 'from-indigo-500/20 to-purple-500/10' },
  { start: 6, end: 9, text: '早上好', subtext: '新的一天，从一杯水开始', icon: Sun, accent: 'from-amber-400/20 to-orange-400/10' },
  { start: 9, end: 12, text: '上午好', subtext: '精力最旺盛的时段', icon: Coffee, accent: 'from-amber-400/20 to-orange-300/10' },
  { start: 12, end: 14, text: '中午好', subtext: '记得按时吃饭', icon: Sun, accent: 'from-yellow-400/20 to-amber-300/10' },
  { start: 14, end: 18, text: '下午好', subtext: '保持节奏，继续前进', icon: Activity, accent: 'from-sky-400/20 to-cyan-300/10' },
  { start: 18, end: 22, text: '晚上好', subtext: '整理今天的收获', icon: Moon, accent: 'from-violet-400/20 to-fuchsia-300/10' },
  { start: 22, end: 24, text: '夜深了', subtext: '准备休息吧', icon: Moon, accent: 'from-indigo-500/20 to-purple-500/10' },
]

export function DashboardView() {
  const { setActiveView, tasks, habits, pomodoroSessions, focusGoals, completeTask, rescheduleTask, habitCheckIns, checkInHabit } = useAppStore(useShallow((state) => ({
    setActiveView: state.setActiveView,
    tasks: state.tasks,
    habits: state.habits,
    pomodoroSessions: state.pomodoroSessions,
    focusGoals: state.focusGoals,
    completeTask: state.completeTask,
    rescheduleTask: state.rescheduleTask,
    habitCheckIns: state.habitCheckIns,
    checkInHabit: state.checkInHabit,
  })))

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== 'done') {
      completeTask(taskId)
    }
  }

  const stats = useStats()
  const streak = useStreak()
  const todayTasks = useTodayTasks()
  const urgentTasks = useUrgentTasks()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayStr = useMemo(() => today.toDateString(), [today])

  const [hour, setHour] = useState(() => new Date().getHours())
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setHour(new Date().getHours())
      setNow(new Date())
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const greeting = useMemo(() => GREETINGS.find(g => hour >= g.start && hour < g.end) || GREETINGS[0], [hour])

  const todayMinutes = useMemo(() => Math.round(stats.todayFocusSeconds / 60), [stats.todayFocusSeconds])
  const dailyGoalProgress = useMemo(() => Math.min((todayMinutes / focusGoals.dailyMinutes) * 100, 100), [todayMinutes, focusGoals.dailyMinutes])

  const yesterdayFocusSeconds = useMemo(() => {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const yStr = y.toDateString()
    return pomodoroSessions
      .filter((s) => s.type === 'work' && new Date(s.completedAt).toDateString() === yStr)
      .reduce((acc, s) => acc + s.duration, 0)
  }, [pomodoroSessions, today])

  const dayOverDayPct = useMemo(() => {
    if (yesterdayFocusSeconds <= 0) return null
    return ((stats.todayFocusSeconds - yesterdayFocusSeconds) / yesterdayFocusSeconds) * 100
  }, [stats.todayFocusSeconds, yesterdayFocusSeconds])
  const isMobile = useIsMobile()

  const todayHabits = useMemo(() => {
    const activeHabits = habits.filter(h => !h.archived)
    return activeHabits.map(habit => {
      const checkIn = habitCheckIns.find(
        c => c.habitId === habit.id && new Date(c.date).toDateString() === todayStr
      )
      return { ...habit, completed: checkIn?.completed || false }
    })
  }, [habits, habitCheckIns, todayStr])

  const completedHabitsCount = todayHabits.filter(h => h.completed).length
  const habitProgress = todayHabits.length > 0 ? (completedHabitsCount / todayHabits.length) * 100 : 0

  const isFirstTime = useMemo(() => {
    return tasks.length === 0 && habits.length === 0 && pomodoroSessions.length === 0
  }, [tasks, habits, pomodoroSessions])

  const goalWatch = useDailyGoalWatcher()

  const overdueTasks = useMemo(() => {
    return tasks.filter(t =>
      t.status !== 'done' && !t.archived && t.dueDate &&
      new Date(t.dueDate) < today && new Date(t.dueDate).toDateString() !== todayStr
    )
  }, [tasks, today, todayStr])

  const completedTodayCount = useMemo(() => {
    return todayTasks.filter((t: TodayTask) => t.completedToday).length
  }, [todayTasks])

  const upcomingTask = useMemo(() => {
    return todayTasks.find((t: TodayTask) => !t.completedToday)
  }, [todayTasks])

  const quickActions = useMemo(() => [
    { icon: Timer, label: '开始专注', view: 'focus' as const, color: 'from-blue-500 to-cyan-500', iconColor: 'text-white' },
    { icon: ListTodo, label: '添加任务', view: 'tasks' as const, color: 'from-emerald-500 to-teal-500', iconColor: 'text-white' },
    { icon: BarChart3, label: '数据分析', view: 'analytics' as const, color: 'from-violet-500 to-purple-500', iconColor: 'text-white' },
    { icon: Calendar, label: '日历视图', view: 'calendar' as const, color: 'from-amber-500 to-orange-500', iconColor: 'text-white' },
  ], [])

  const timeString = useMemo(() => {
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }, [now])

  const dayString = useMemo(() => {
    return now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })
  }, [now])

  const [dashTab, setDashTab] = useState('overview')

  return (
    <div className="h-full flex flex-col gap-4 view-enter pb-4">
      {isFirstTime && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-chart-2/5 overflow-hidden shrink-0">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 shrink-0">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">欢迎使用 FocusFlow！</h3>
                <p className="text-sm text-muted-foreground mt-1">开始你的高效生活，试试以下操作：</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {([
                    { icon: Plus, label: '创建第一个任务', view: 'tasks' as const },
                    { icon: Timer, label: '开始第一次专注', view: 'focus' as const },
                    { icon: Target, label: '养成好习惯', view: 'habits' as const },
                    { icon: TrendingUp, label: '设定目标', view: 'goals' as const },
                  ] as const).map((item) => (
                    <button
                      key={item.view}
                      onClick={() => setActiveView(item.view)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border/50 p-4 hover:bg-muted/50 hover:border-primary/30 transition-all"
                    >
                      <div className="rounded-xl bg-primary/10 p-2">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ViewTabs value={dashTab} onValueChange={setDashTab} className="flex-1 min-h-0">
        <ViewTabsList className="shrink-0">
          <ViewTabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4" />
            概览
          </ViewTabsTrigger>
          <ViewTabsTrigger value="tasks">
            <ListTodo className="h-4 w-4" />
            今日待办
          </ViewTabsTrigger>
          <ViewTabsTrigger value="habits">
            <Target className="h-4 w-4" />
            习惯打卡
          </ViewTabsTrigger>
        </ViewTabsList>

        <ViewTabsContent value="overview" className="flex flex-col gap-4 min-h-0 overflow-y-auto">
      {/* Hero Section（黑板报：与自习室同一套教室语言） */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        <Card className="lg:col-span-2 overflow-hidden relative border-border">
          <CardContent className="relative h-full flex flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{dayString}</p>
                <h1
                  className={cn('font-bold tracking-tight mt-1 text-foreground', isMobile ? 'text-3xl' : 'text-4xl')}
                >
                  {greeting.text}
                  <span
                    className="ml-3 text-xl font-normal text-muted-foreground tabular-nums"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
                  >
                    {timeString}
                  </span>
                </h1>
              </div>
              <Button
                onClick={() => setActiveView('focus')}
                className="gap-2 h-10 px-5 rounded-full"
                variant="outline"
                size="default"
              >
                <Play className="h-4 w-4 fill-current" />
                开始专注
              </Button>
            </div>

            <div className="mt-auto pt-5 border-t border-border flex items-end justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">今日专注</p>
                <div className="flex items-baseline gap-2.5 flex-wrap mt-1">
                  <span className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatDuration(stats.todayFocusSeconds)}
                  </span>
                  {dayOverDayPct !== null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 text-2xs font-medium shrink-0',
                        dayOverDayPct >= 0
                          ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-rose-600 border-rose-500/30 bg-rose-500/10'
                      )}
                    >
                      {dayOverDayPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(Math.round(dayOverDayPct))}% 较昨日
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-6 sm:gap-8 pb-0.5 shrink-0">
                <div className="px-3 py-2">
                  <p className="text-2xs text-muted-foreground">完成任务</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">{stats.completedToday} 项</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-2xs text-muted-foreground">连续专注</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">{streak} 天</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-2xs text-muted-foreground">效率评分</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {stats.todayFocusSeconds > 0 || stats.completedToday > 0 ? `${stats.efficiencyScore}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Goal Ring */}
        <Card className="border-border/40 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent" />
          <CardContent className="p-5 sm:p-6 relative h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">今日目标</p>
                <p className="text-sm font-semibold mt-0.5">专注 {focusGoals.dailyMinutes} 分钟</p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Target className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="relative">
                <svg className="w-32 h-32 -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                  <circle
                    cx="64" cy="64" r="56" fill="none" stroke="url(#goal-gradient)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - Math.min(dailyGoalProgress / 100, 1))}`}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="goal-gradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums">{Math.round(dailyGoalProgress)}%</span>
                  <span className="text-2xs text-muted-foreground mt-0.5">{todayMinutes} / {focusGoals.dailyMinutes} 分钟</span>
                </div>
              </div>
            </div>
            <Progress value={dailyGoalProgress} className="h-1.5" />
            <p className="text-2xs text-muted-foreground text-center mt-2">
              {dailyGoalProgress >= 100 ? '🎉 今日目标已完成' : dailyGoalProgress >= 50 ? '保持节奏，加油' : '开始你的第一次专注'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        {quickActions.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className="group relative overflow-hidden rounded-xl border border-border/40 bg-card hover:border-border/80 transition-all hover:shadow-md p-3.5 flex items-center gap-3 text-left"
            >
              <div className={cn('rounded-lg p-2 shrink-0 bg-gradient-to-br shadow-sm', item.color)}>
                <Icon className={cn('h-4 w-4', item.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>
          )
        })}
      </div>
        </ViewTabsContent>

        <ViewTabsContent value="tasks" className={cn(
          'grid gap-4 flex-1 min-h-0',
          isMobile ? 'grid-cols-1' : 'lg:grid-cols-3'
        )}>
      {/* Main Content Grid: Today's Tasks */}
      <Card className="lg:col-span-2 border-border/40 flex flex-col min-h-0">
          <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" />
                今日待办
                {todayTasks.length > 0 && (
                  <Badge variant="secondary" className="text-2xs h-5 px-1.5 font-normal">
                    {completedTodayCount}/{todayTasks.length}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedTodayCount === todayTasks.length && todayTasks.length > 0
                  ? '今日任务全部完成 🎉'
                  : `还有 ${todayTasks.length - completedTodayCount} 项待处理`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveView('tasks')} className="text-xs h-7 px-2.5">
              全部
              <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Button>
          </div>
          <CardContent className="px-5 pb-4 flex-1 min-h-0 overflow-y-auto">
            {overdueTasks.length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-600">{overdueTasks.length} 个任务已过期</span>
                </div>
                <div className="space-y-1.5">
                  {overdueTasks.slice(0, 2).map(task => (
                    <div key={task.id} className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate flex-1 text-muted-foreground">{task.title}</span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="text-2xs px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                          onClick={(e) => { e.stopPropagation(); rescheduleTask(task.id, new Date()) }}
                        >
                          今天
                        </button>
                        <button
                          className="text-2xs px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                          onClick={(e) => {
                            e.stopPropagation()
                            const tomorrow = new Date()
                            tomorrow.setDate(tomorrow.getDate() + 1)
                            rescheduleTask(task.id, tomorrow)
                          }}
                        >
                          明天
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {urgentTasks.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 p-4 mb-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-semibold">今天没有待办任务</p>
                <p className="text-xs text-muted-foreground mt-1">享受一段轻松时光，或添加新任务</p>
                <Button variant="outline" size="sm" onClick={() => setActiveView('tasks')} className="mt-4">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加任务
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {urgentTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 hover:bg-destructive/10 transition-colors"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleCompleteTask(task.id)}
                      className="border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive h-4 w-4"
                    />
                    <p className="text-sm font-medium truncate flex-1">{task.title}</p>
                    <Badge variant="destructive" className="text-2xs h-4 shrink-0 px-1.5">紧急</Badge>
                  </div>
                ))}
                {todayTasks.slice(0, urgentTasks.length > 0 ? 5 : 8).map((task: TodayTask) => {
                  const isOverdue = task.isOverdue
                  const completedToday = task.completedToday
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all",
                        completedToday
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : isOverdue
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-border/40 hover:border-primary/30 hover:bg-muted/30"
                      )}
                    >
                      <Checkbox
                        checked={completedToday}
                        onCheckedChange={() => { if (!completedToday) handleCompleteTask(task.id) }}
                        className={cn(
                          "h-4 w-4",
                          completedToday
                            ? "border-emerald-500/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            : isOverdue
                              ? "border-amber-500/50 data-[state=checked]:bg-amber-500"
                              : ""
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", completedToday && "line-through text-muted-foreground")}>{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {task.repeatRule && (
                            <Badge variant="outline" className="text-3xs h-3.5 px-1 border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400">
                              {task.repeatRule.type === 'daily' ? '每天' : task.repeatRule.type === 'weekly' ? '每周' : task.repeatRule.type === 'monthly' ? '每月' : '每年'}
                            </Badge>
                          )}
                          {task.project && (
                            <Badge variant="secondary" className="text-3xs h-3.5 px-1">{task.project}</Badge>
                          )}
                          {task.estimatedPomodoros && task.estimatedPomodoros > 0 && (
                            <span className="text-2xs text-muted-foreground">🍅 {task.estimatedPomodoros}</span>
                          )}
                        </div>
                      </div>
                      {completedToday && (
                        <Badge variant="outline" className="text-3xs h-4 border-emerald-500/50 text-emerald-600 shrink-0 px-1.5">
                          已完成
                        </Badge>
                      )}
                      {isOverdue && !completedToday && (
                        <Badge variant="outline" className="text-3xs h-4 border-amber-500/50 text-amber-600 shrink-0 px-1.5">
                          过期
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-3 sticky bottom-0 bg-card pt-2 -mx-1">
              <SmartQuickAddTask />
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Habits + Next Up */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Next Up Highlight */}
          {upcomingTask && (
            <Card className="border-border/40 shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">下一个任务</span>
                </div>
                <p className="text-sm font-semibold line-clamp-2">{upcomingTask.title}</p>
                <Button
                  onClick={() => setActiveView('focus')}
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 h-8 text-xs gap-1.5"
                >
                  <Play className="h-3 w-3 fill-current" />
                  开始专注这个任务
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        </ViewTabsContent>

        <ViewTabsContent value="habits" className="flex-1 min-h-0">
        <div className="h-full min-h-0">
          {/* Habits */}
          <Card className="border-border/40 flex flex-col min-h-0 h-full">
            <div className="px-5 pt-4 pb-3 shrink-0 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  今日习惯
                </h2>
                {todayHabits.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-2xs text-muted-foreground mb-1">
                      <span>完成进度</span>
                      <span className="font-medium">{Math.round(habitProgress)}%</span>
                    </div>
                    <Progress value={habitProgress} className="h-1" />
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveView('habits')} className="text-xs h-7 px-2 ml-2">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardContent className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">
              {todayHabits.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="rounded-2xl bg-muted/50 p-3 w-fit mx-auto mb-2">
                    <Target className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-xs text-muted-foreground">还没有设置习惯</p>
                  <Button variant="link" size="sm" onClick={() => setActiveView('habits')} className="mt-1 h-6 text-2xs">
                    添加第一个习惯
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {todayHabits.map(habit => (
                    <button
                      key={habit.id}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all text-left',
                        habit.completed
                          ? 'bg-emerald-500/8 border border-emerald-500/15'
                          : 'bg-muted/30 hover:bg-muted/60 border border-transparent'
                      )}
                      onClick={() => {
                        if (!habit.completed) {
                          checkInHabit(habit.id, new Date(), true)
                        }
                      }}
                    >
                      <span className="text-base shrink-0">{habit.icon}</span>
                      <span className={cn(
                        'text-xs flex-1 truncate font-medium',
                        habit.completed && 'line-through text-muted-foreground'
                      )}>
                        {habit.name}
                      </span>
                      {habit.completed ? (
                        <div className="rounded-full bg-emerald-500/15 p-0.5 shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        </div>
                      ) : (
                        <CircleDot className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </ViewTabsContent>
      </ViewTabs>

      <GoalCelebration
        open={goalWatch.show}
        onClose={() => goalWatch.setShow(false)}
        streakDays={goalWatch.streakDays}
      />
    </div>
  )
}
