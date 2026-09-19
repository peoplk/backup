'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import {
  useStats,
  useStreak,
  useWeekStats,
  useHabitStats,
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
  ChevronDown,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  CalendarDays,
  Sparkle,
  TrendingDown,
  LayoutDashboard,
} from 'lucide-react'
import { SmartQuickAddTask } from '@/components/smart-quick-add-task'
import { GoalCelebration } from '@/components/goal-celebration'
import { useDailyGoalWatcher } from '@/lib/hooks/use-daily-goal'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/components/ui/use-mobile'


const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

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
  const { setActiveView, tasks, habits, pomodoroSessions, focusGoals, completeTask, rescheduleTask, habitCheckIns, checkInHabit, timeBlocks, externalEvents } = useAppStore(useShallow((state) => ({
    setActiveView: state.setActiveView,
    tasks: state.tasks,
    habits: state.habits,
    pomodoroSessions: state.pomodoroSessions,
    focusGoals: state.focusGoals,
    completeTask: state.completeTask,
    rescheduleTask: state.rescheduleTask,
    habitCheckIns: state.habitCheckIns,
    checkInHabit: state.checkInHabit,
    timeBlocks: state.timeBlocks,
    externalEvents: state.externalEvents,
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

  const timeString = useMemo(() => {
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }, [now])

  const dayString = useMemo(() => {
    return now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })
  }, [now])

  const weekStats = useWeekStats()

  const weekFocusDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - i))
      const minutes = Math.round(
        pomodoroSessions
          .filter((s) => s.type === 'work' && new Date(s.completedAt).toDateString() === d.toDateString())
          .reduce((acc, s) => acc + s.duration, 0) / 60
      )
      return { date: d, minutes, isToday: i === 6 }
    })
  }, [pomodoroSessions, today])

  const maxDayMinutes = useMemo(
    () => Math.max(focusGoals.dailyMinutes, ...weekFocusDays.map((d) => d.minutes), 1),
    [weekFocusDays, focusGoals.dailyMinutes]
  )

  const todaySchedule = useMemo(() => {
    const hhmm = (dt: Date) =>
      dt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const blocks = timeBlocks
      .filter((tb) => new Date(tb.date).toDateString() === todayStr)
      .map((tb) => ({
        id: `block-${tb.id}`,
        kind: 'block' as const,
        start: tb.startTime,
        end: tb.endTime,
        allDay: false,
        title: tb.title,
        color: tb.color as string | undefined,
      }))
    const events = externalEvents
      .filter((ev) => new Date(ev.start).toDateString() === todayStr)
      .map((ev) => ({
        id: `event-${ev.id}`,
        kind: 'event' as const,
        start: hhmm(new Date(ev.start)),
        end: ev.allDay ? '' : hhmm(new Date(ev.end)),
        allDay: ev.allDay,
        title: ev.title,
        color: undefined as string | undefined,
      }))
    return [...blocks, ...events].sort((a, b) => a.start.localeCompare(b.start))
  }, [timeBlocks, externalEvents, todayStr])

  const nextTask = useMemo(() => {
    const urgent = urgentTasks[0]
    if (urgent) return { title: urgent.title, isUrgent: true }
    const pending = todayTasks.find((t: TodayTask) => !t.completedToday)
    return pending ? { title: pending.title, isUrgent: false } : null
  }, [urgentTasks, todayTasks])

  const habitStats = useHabitStats()
  const [showCompletedToday, setShowCompletedToday] = useState(false)

  const pendingTodayTasks = useMemo(
    () => todayTasks.filter((t: TodayTask) => !t.completedToday && !t.isOverdue),
    [todayTasks]
  )
  const completedTodayTasks = useMemo(
    () => todayTasks.filter((t: TodayTask) => t.completedToday),
    [todayTasks]
  )

  const pendingPomodoros = useMemo(
    () => pendingTodayTasks.reduce((acc, t) => acc + (t.estimatedPomodoros ?? 0), 0),
    [pendingTodayTasks]
  )
  const remainingGoalMinutes = Math.max(focusGoals.dailyMinutes - todayMinutes, 0)

  const dueSoonTasks = useMemo(() => {
    const start = new Date(today)
    start.setDate(start.getDate() + 1)
    const end = new Date(today)
    end.setDate(end.getDate() + 3)
    end.setHours(23, 59, 59, 999)
    return tasks
      .filter(t => t.status !== 'done' && !t.archived && t.dueDate)
      .map(t => {
        const due = new Date(t.dueDate!)
        due.setHours(0, 0, 0, 0)
        return { id: t.id, title: t.title, due, diffDays: Math.round((due.getTime() - start.getTime()) / 86_400_000) + 1 }
      })
      .filter(x => x.due >= start && x.due <= end)
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 6)
      .map(x => ({
        id: x.id,
        title: x.title,
        label: x.diffDays === 1 ? '明天' : x.diffDays === 2 ? '后天' : `周${WEEKDAYS[x.due.getDay()]}`,
      }))
  }, [tasks, today])

  const weekDates = useMemo(() => {
    const start = new Date(today)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [today])

  const checkInSet = useMemo(() => {
    const set = new Set<string>()
    habitCheckIns.filter(c => c.completed).forEach(c => set.add(`${c.habitId}|${new Date(c.date).toDateString()}`))
    return set
  }, [habitCheckIns])

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
      {/* 指挥区：问候 + 快速捕捉 + 开始专注 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center shrink-0">
        <div className="min-w-0 lg:shrink-0">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h1 className={cn('font-bold tracking-tight text-foreground', isMobile ? 'text-2xl' : 'text-3xl')}>
              {greeting.text}
            </h1>
            <span className="text-xs text-muted-foreground tabular-nums">
              {dayString} · {timeString}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{greeting.subtext}</p>
        </div>
        <div className="flex-1 min-w-0 lg:max-w-md">
          <SmartQuickAddTask />
        </div>
        <Button
          onClick={() => setActiveView('focus')}
          className="gap-2 h-10 px-5 rounded-full shrink-0 self-start lg:self-auto"
          variant="outline"
        >
          <Play className="h-4 w-4 fill-current" />
          开始专注
        </Button>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground font-medium">今日专注</p>
              {dayOverDayPct !== null && (
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1 text-3xs font-medium shrink-0',
                    dayOverDayPct >= 0
                      ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                      : 'text-rose-600 border-rose-500/30 bg-rose-500/10'
                  )}
                >
                  {dayOverDayPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(Math.round(dayOverDayPct))}%
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
              {formatDuration(stats.todayFocusSeconds)}
            </p>
            <div className="flex items-end gap-1 h-7 mt-2" aria-hidden>
              {weekFocusDays.map((d) => (
                <div
                  key={d.date.toDateString()}
                  title={`周${WEEKDAYS[d.date.getDay()]}：${d.minutes} 分钟`}
                  className={cn('flex-1 rounded-sm', d.isToday ? 'bg-primary' : 'bg-primary/25')}
                  style={{ height: `${Math.max((d.minutes / maxDayMinutes) * 100, 10)}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" />
              今日目标
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
              {todayMinutes}
              <span className="text-sm font-medium text-muted-foreground ml-1.5">/ {focusGoals.dailyMinutes} 分钟</span>
            </p>
            <Progress value={dailyGoalProgress} className="h-1.5 mt-3" />
            <p className="text-2xs text-muted-foreground mt-1.5">
              {dailyGoalProgress >= 100 ? '🎉 今日目标已完成' : `还差 ${Math.max(focusGoals.dailyMinutes - todayMinutes, 0)} 分钟`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5 text-primary" />
              今日任务
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
              {completedTodayCount}
              <span className="text-sm font-medium text-muted-foreground ml-1.5">/ {todayTasks.length} 项</span>
            </p>
            <Progress
              value={todayTasks.length > 0 ? (completedTodayCount / todayTasks.length) * 100 : 0}
              className="h-1.5 mt-3"
            />
            <p className="text-2xs mt-1.5">
              {overdueTasks.length > 0 ? (
                <span className="text-amber-600 dark:text-amber-500">{overdueTasks.length} 项已过期</span>
              ) : (
                <span className="text-muted-foreground">
                  {todayTasks.length > 0 && completedTodayCount === todayTasks.length
                    ? '全部完成 🎉'
                    : `还有 ${Math.max(todayTasks.length - completedTodayCount, 0)} 项待处理`}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              连续专注
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
              {streak}
              <span className="text-sm font-medium text-muted-foreground ml-1.5">天</span>
            </p>
            <p className="text-2xs text-muted-foreground mt-3">
              效率评分{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {stats.todayFocusSeconds > 0 || stats.completedToday > 0 ? `${stats.efficiencyScore}%` : '—'}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主体两栏：日程与趋势 / 行动入口 */}
      <div className="grid gap-4 lg:grid-cols-3 shrink-0">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* 今日安排：时间块 + 订阅日程合并 */}
          <Card>
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                今日安排
                {todaySchedule.length > 0 && (
                  <Badge variant="secondary" className="text-2xs h-5 px-1.5 font-normal">{todaySchedule.length}</Badge>
                )}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveView('time-block')} className="text-xs h-7 px-2.5">
                规划时间
                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Button>
            </div>
            <CardContent className="px-4 pb-4">
              {todaySchedule.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  今天还没有安排，去「时间块」规划你的一天
                </p>
              ) : (
                <div className="space-y-0.5">
                  {todaySchedule.map((item) => {
                    const past = !item.allDay && item.end !== '' && item.end <= timeString
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/30 transition-colors',
                          past && 'opacity-45'
                        )}
                      >
                        <span className="text-2xs text-muted-foreground tabular-nums w-24 shrink-0" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                          {item.allDay ? '全天' : `${item.start}${item.end ? ` – ${item.end}` : ''}`}
                        </span>
                        {item.kind === 'block' ? (
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        ) : (
                          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm truncate flex-1">{item.title}</span>
                        <Badge variant="outline" className="text-3xs h-4 px-1.5 shrink-0 text-muted-foreground font-normal">
                          {item.kind === 'block' ? '时间块' : '日程'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 近7日专注趋势 */}
          <Card>
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                近7日专注
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveView('analytics')} className="text-xs h-7 px-2.5">
                数据分析
                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Button>
            </div>
            <CardContent className="px-5 pb-4">
              <div className="flex items-end gap-2 sm:gap-3">
                {weekFocusDays.map((d) => {
                  const pct = (d.minutes / maxDayMinutes) * 100
                  return (
                    <div key={d.date.toDateString()} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-3xs tabular-nums text-muted-foreground h-4">
                        {d.minutes > 0 ? d.minutes : ''}
                      </span>
                      <div className="relative h-24 w-full flex items-end rounded-md bg-muted/30 overflow-hidden">
                        <div
                          className="absolute inset-x-0 border-t border-dashed border-primary/40 z-10"
                          style={{ bottom: `${(focusGoals.dailyMinutes / maxDayMinutes) * 100}%` }}
                        />
                        <div
                          title={`周${WEEKDAYS[d.date.getDay()]}：${d.minutes} 分钟`}
                          className={cn('w-full rounded-t-md', d.isToday ? 'bg-primary' : 'bg-primary/30')}
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className={cn('text-2xs', d.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                        周{WEEKDAYS[d.date.getDay()]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-2xs text-muted-foreground mt-3 text-center tabular-nums">
                本周合计 {weekStats.weekHours.toFixed(1)} 小时 · {weekStats.weekPomodoros} 个番茄 · 虚线为每日目标 {focusGoals.dailyMinutes} 分钟
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          {/* 下一步 */}
          {nextTask && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">下一步</span>
                  {nextTask.isUrgent && (
                    <Badge variant="destructive" className="text-3xs h-4 px-1.5">紧急</Badge>
                  )}
                </div>
                <p className="text-sm font-semibold line-clamp-2">{nextTask.title}</p>
                <div className="flex gap-2 mt-3">
                  <Button onClick={() => setActiveView('focus')} size="sm" className="flex-1 h-8 text-xs gap-1.5">
                    <Play className="h-3 w-3 fill-current" />
                    开始专注
                  </Button>
                  <Button onClick={() => setDashTab('tasks')} variant="outline" size="sm" className="h-8 text-xs">
                    今日待办
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 习惯速览 */}
          <Card>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                今日习惯
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setDashTab('habits')} className="text-xs h-7 px-2.5">
                {todayHabits.length > 0 ? `${completedHabitsCount}/${todayHabits.length}` : '管理'}
                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Button>
            </div>
            <CardContent className="px-4 pb-4">
              {todayHabits.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  还没有习惯，去「习惯」页面添加第一个
                </p>
              ) : (
                <>
                  <Progress value={habitProgress} className="h-1 mb-3" />
                  <div className="space-y-1">
                    {todayHabits.slice(0, 5).map((habit) => (
                      <button
                        key={habit.id}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-all text-left',
                          habit.completed
                            ? 'bg-emerald-500/8 border border-emerald-500/15'
                            : 'bg-muted/30 hover:bg-muted/60 border border-transparent'
                        )}
                        onClick={() => {
                          if (!habit.completed) checkInHabit(habit.id, new Date(), true)
                        }}
                      >
                        <span className="text-sm shrink-0">{habit.icon}</span>
                        <span className={cn('text-xs flex-1 truncate font-medium', habit.completed && 'line-through text-muted-foreground')}>
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
                    {todayHabits.length > 5 && (
                      <p className="text-2xs text-muted-foreground text-center pt-1">
                        还有 {todayHabits.length - 5} 个习惯
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 本周摘要 */}
          <Card>
            <div className="px-4 pt-4 pb-2">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                本周摘要
              </h2>
            </div>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {[
                { label: '专注时长', value: `${weekStats.weekHours.toFixed(1)} 小时` },
                { label: '完成番茄', value: `${weekStats.weekPomodoros} 个` },
                { label: '完成任务', value: `${weekStats.weekTasks} 项` },
                { label: '时间记录', value: `${weekStats.weekTimeHours.toFixed(1)} 小时` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
        </ViewTabsContent>

        <ViewTabsContent value="tasks" className={cn(
          'grid gap-4 flex-1 min-h-0',
          isMobile ? 'grid-cols-1' : 'lg:grid-cols-3'
        )}>
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
                  {urgentTasks.length + overdueTasks.length > 0
                    ? `${urgentTasks.length + overdueTasks.length} 项需要优先处理`
                    : completedTodayCount === todayTasks.length && todayTasks.length > 0
                      ? '今日任务全部完成 🎉'
                      : todayTasks.length > 0
                        ? `还有 ${todayTasks.length - completedTodayCount} 项待处理`
                        : '今天没有待办任务'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveView('tasks')} className="text-xs h-7 px-2.5">
                任务管理
                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Button>
            </div>
            <CardContent className="px-5 pb-4 flex-1 min-h-0 overflow-y-auto">
              {urgentTasks.length === 0 && overdueTasks.length === 0 && todayTasks.length === 0 ? (
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
                  {urgentTasks.length > 0 && (
                    <>
                      <SectionLabel>紧急优先</SectionLabel>
                      {urgentTasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          urgent
                          onToggle={() => handleCompleteTask(task.id)}
                          right={<Badge variant="destructive" className="text-2xs h-4 shrink-0 px-1.5">紧急</Badge>}
                        />
                      ))}
                    </>
                  )}
                  {overdueTasks.length > 0 && (
                    <>
                      <SectionLabel className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        已过期 {overdueTasks.length} 项
                      </SectionLabel>
                      {overdueTasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={{ ...task, isOverdue: true }}
                          onToggle={() => handleCompleteTask(task.id)}
                          right={
                            <span className="flex gap-1 shrink-0">
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
                            </span>
                          }
                        />
                      ))}
                    </>
                  )}
                  {pendingTodayTasks.length > 0 && (
                    <>
                      <SectionLabel>今天</SectionLabel>
                      {pendingTodayTasks.map(task => (
                        <TaskRow key={task.id} task={task} onToggle={() => handleCompleteTask(task.id)} />
                      ))}
                    </>
                  )}
                  {completedTodayTasks.length > 0 && (
                    <div className="pt-2">
                      <button
                        className="w-full flex items-center gap-1.5 px-1 text-2xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowCompletedToday(v => !v)}
                      >
                        <ChevronDown className={cn('h-3 w-3 transition-transform', !showCompletedToday && '-rotate-90')} />
                        今日已完成（{completedTodayTasks.length}）
                      </button>
                      {showCompletedToday && (
                        <div className="space-y-1.5 mt-1.5">
                          {completedTodayTasks.map(task => (
                            <TaskRow key={task.id} task={task} onToggle={() => {}} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 sticky bottom-0 bg-card pt-2 -mx-1">
                <SmartQuickAddTask />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            <Card className="shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Timer className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">专注预估</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">待办任务</span>
                    <span className="text-sm font-semibold tabular-nums">{urgentTasks.length + overdueTasks.length + pendingTodayTasks.length} 项</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">预估番茄</span>
                    <span className="text-sm font-semibold tabular-nums">{pendingPomodoros > 0 ? `🍅 ${pendingPomodoros}` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">距今日目标</span>
                    <span className="text-sm font-semibold tabular-nums">{remainingGoalMinutes > 0 ? `${remainingGoalMinutes} 分钟` : '已达成 🎉'}</span>
                  </div>
                </div>
                <Button onClick={() => setActiveView('focus')} variant="outline" size="sm" className="w-full mt-3 h-8 text-xs gap-1.5">
                  <Play className="h-3 w-3 fill-current" />
                  开始专注
                </Button>
              </CardContent>
            </Card>

            <Card className="shrink-0">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  即将到期
                </h2>
                <span className="text-2xs text-muted-foreground">未来 3 天</span>
              </div>
              <CardContent className="px-4 pb-4">
                {dueSoonTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">未来 3 天没有到期任务</p>
                ) : (
                  <div className="space-y-0.5">
                    {dueSoonTasks.map(t => (
                      <button key={t.id} onClick={() => setActiveView('tasks')} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/40 text-left transition-colors">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-xs flex-1 truncate">{t.title}</span>
                        <span className="text-2xs text-muted-foreground shrink-0">{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ViewTabsContent>

        <ViewTabsContent value="habits" className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">今日完成</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                    {habitStats.completedToday}
                    <span className="text-sm font-medium text-muted-foreground ml-1">/ {habitStats.totalHabits}</span>
                  </p>
                  <Progress value={habitStats.completionRate} className="h-1 mt-2" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    当前最长连续
                  </p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                    {habitStats.maxStreak}
                    <span className="text-sm font-medium text-muted-foreground ml-1">天</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium">近30天平均完成率</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                    {habitStats.avgCompletionRate}
                    <span className="text-sm font-medium text-muted-foreground ml-1">%</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3 flex flex-col min-h-0">
                <div className="px-5 pt-4 pb-2 shrink-0 flex items-center justify-between">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" />
                    今日打卡
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setActiveView('habits')} className="text-xs h-7 px-2.5">
                    管理习惯
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
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
                      {todayHabits.map(habit => {
                        const habitStreak = habitStats.getHabitStreak(habit.id)
                        const rate30 = habitStats.getHabitCompletionRate(habit.id)
                        return (
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
                              'text-sm flex-1 truncate font-medium',
                              habit.completed && 'line-through text-muted-foreground'
                            )}>
                              {habit.name}
                            </span>
                            {habitStreak > 0 && (
                              <span className="text-2xs text-orange-500 font-medium flex items-center gap-0.5 shrink-0 tabular-nums">
                                <Flame className="h-3 w-3" />
                                {habitStreak}
                              </span>
                            )}
                            <span className="text-2xs text-muted-foreground tabular-nums shrink-0 w-9 text-right">{rate30}%</span>
                            {habit.completed ? (
                              <div className="rounded-full bg-emerald-500/15 p-0.5 shrink-0">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                            ) : (
                              <CircleDot className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 flex flex-col min-h-0">
                <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />
                    本周打卡
                  </h2>
                  <span className="text-2xs text-muted-foreground">仅今天可打卡</span>
                </div>
                <CardContent className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">
                  {todayHabits.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">添加习惯后，这里会显示整周打卡轨迹</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_repeat(7,1.25rem)] gap-1">
                        <span />
                        {weekDates.map(d => (
                          <span
                            key={`head-${d.toDateString()}`}
                            className={cn(
                              'text-3xs text-center text-muted-foreground',
                              d.toDateString() === todayStr && 'font-semibold text-foreground'
                            )}
                          >
                            {d.toDateString() === todayStr ? '今' : WEEKDAYS[d.getDay()]}
                          </span>
                        ))}
                      </div>
                      {todayHabits.map(habit => (
                        <div key={habit.id} className="grid grid-cols-[minmax(0,1fr)_repeat(7,1.25rem)] items-center gap-1">
                          <span className="text-xs truncate flex items-center gap-1 min-w-0">
                            <span className="shrink-0">{habit.icon}</span>
                            <span className="truncate">{habit.name}</span>
                          </span>
                          {weekDates.map(d => {
                            const isToday = d.toDateString() === todayStr
                            const done = checkInSet.has(`${habit.id}|${d.toDateString()}`)
                            const future = d.getTime() > today.getTime()
                            return (
                              <span key={`${habit.id}-${d.toDateString()}`} className="flex justify-center">
                                <button
                                  disabled={!isToday || done}
                                  title={`${habit.name} · 周${WEEKDAYS[d.getDay()]}`}
                                  onClick={() => {
                                    if (isToday && !habit.completed) checkInHabit(habit.id, new Date(), true)
                                  }}
                                  className={cn(
                                    'h-3.5 w-3.5 rounded-full border transition-colors',
                                    done
                                      ? 'bg-emerald-500 border-emerald-500'
                                      : isToday
                                        ? 'border-primary hover:bg-primary/20 cursor-pointer'
                                        : future
                                          ? 'border-border/40'
                                          : 'border-border/70'
                                  )}
                                />
                              </span>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('px-1 pt-2.5 pb-1 text-2xs font-semibold text-muted-foreground', className)}>
      {children}
    </p>
  )
}

function TaskRow({
  task,
  urgent = false,
  onToggle,
  right,
}: {
  task: TodayTask
  urgent?: boolean
  onToggle: () => void
  right?: ReactNode
}) {
  const completed = !!task.completedToday
  const overdue = !urgent && !!task.isOverdue
  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all',
        urgent
          ? 'border-destructive/20 bg-destructive/5 hover:bg-destructive/10'
          : completed
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : overdue
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border/40 hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      <Checkbox
        checked={completed}
        onCheckedChange={() => { if (!completed) onToggle() }}
        className={cn(
          'h-4 w-4',
          urgent && 'border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive',
          completed && 'border-emerald-500/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500',
          overdue && 'border-amber-500/50 data-[state=checked]:bg-amber-500'
        )}
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', completed && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
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
      {completed && (
        <Badge variant="outline" className="text-3xs h-4 border-emerald-500/50 text-emerald-600 shrink-0 px-1.5">
          已完成
        </Badge>
      )}
      {overdue && !completed && (
        <Badge variant="outline" className="text-3xs h-4 border-amber-500/50 text-amber-600 shrink-0 px-1.5">
          过期
        </Badge>
      )}
      {right}
    </div>
  )
}
