'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDuration } from '@/lib/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Timer,
  Target,
  Flame,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  ListTodo,
  Award,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function WeeklyReview() {
  const { tasks, pomodoroSessions, timeEntries, habits, habitCheckIns, focusGoals } = useAppStore()

  const review = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const thisWeekTasks = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= startOfWeek
    )
    const lastWeekTasks = tasks.filter(
      (t) =>
        t.completedAt &&
        new Date(t.completedAt) >= startOfLastWeek &&
        new Date(t.completedAt) < startOfWeek
    )

    const thisWeekPomodoros = pomodoroSessions.filter(
      (s) => new Date(s.completedAt) >= startOfWeek && s.type === 'work'
    )
    const lastWeekPomodoros = pomodoroSessions.filter(
      (s) =>
        new Date(s.completedAt) >= startOfLastWeek &&
        new Date(s.completedAt) < startOfWeek &&
        s.type === 'work'
    )

    const thisWeekFocusSeconds = thisWeekPomodoros.reduce((acc, s) => acc + s.duration, 0)
    const lastWeekFocusSeconds = lastWeekPomodoros.reduce((acc, s) => acc + s.duration, 0)

    const thisWeekTimeEntries = timeEntries.filter(
      (e) => new Date(e.startTime) >= startOfWeek
    )
    const lastWeekTimeEntries = timeEntries.filter(
      (e) =>
        new Date(e.startTime) >= startOfLastWeek &&
        new Date(e.startTime) < startOfWeek
    )

    const thisWeekTotalSeconds =
      thisWeekFocusSeconds +
      thisWeekTimeEntries.reduce((acc, e) => acc + e.duration, 0)
    const lastWeekTotalSeconds =
      lastWeekFocusSeconds +
      lastWeekTimeEntries.reduce((acc, e) => acc + e.duration, 0)

    const thisWeekHabitCheckIns = habitCheckIns.filter(
      (c) => new Date(c.date) >= startOfWeek && c.completed
    )
    const lastWeekHabitCheckIns = habitCheckIns.filter(
      (c) =>
        new Date(c.date) >= startOfLastWeek &&
        new Date(c.date) < startOfWeek &&
        c.completed
    )

    const activeHabitCount = habits.filter((h) => !h.archived).length
    const thisWeekHabitRate =
      activeHabitCount > 0
        ? Math.round(
            (thisWeekHabitCheckIns.length /
              (activeHabitCount * 7)) *
              100
          )
        : 0
    const lastWeekHabitRate =
      activeHabitCount > 0
        ? Math.round(
            (lastWeekHabitCheckIns.length /
              (activeHabitCount * 7)) *
              100
          )
        : 0

    const weeklyGoalProgress = Math.min(
      (thisWeekTotalSeconds / 60 / focusGoals.weeklyMinutes) * 100,
      100
    )

    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < today &&
        t.status !== 'done' &&
        new Date(t.dueDate) >= startOfWeek
    )

    const urgentPending = tasks.filter(
      (t) => t.priority === 'urgent' && t.status !== 'done'
    )

    const getChange = (current: number, previous: number) => {
      if (previous === 0 && current === 0) return 0
      if (previous === 0) return 100
      return Math.round(((current - previous) / previous) * 100)
    }

    const focusChange = getChange(thisWeekTotalSeconds, lastWeekTotalSeconds)
    const taskChange = getChange(thisWeekTasks.length, lastWeekTasks.length)
    const habitChange = thisWeekHabitRate - lastWeekHabitRate

    const dayData = []
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateStr = date.toDateString()
      const dayPomodoros = thisWeekPomodoros.filter(
        (s) => new Date(s.completedAt).toDateString() === dateStr
      )
      const dayTasks = thisWeekTasks.filter(
        (t) => new Date(t.completedAt!).toDateString() === dateStr
      )
      dayData.push({
        name: weekDays[i],
        pomodoros: dayPomodoros.length,
        tasks: dayTasks.length,
        isToday: date.toDateString() === today.toDateString(),
      })
    }

    const bestDay = dayData.reduce(
      (best, day) => (day.pomodoros > best.pomodoros ? day : best),
      dayData[0]
    )

    const insights: string[] = []
    if (focusChange > 0) {
      insights.push(`📈 专注时间比上周增加了 ${focusChange}%，继续保持！`)
    } else if (focusChange < 0) {
      insights.push(`📉 专注时间比上周减少了 ${Math.abs(focusChange)}%，试试增加番茄钟数量`)
    }
    if (thisWeekTasks.length >= lastWeekTasks.length && thisWeekTasks.length > 0) {
      insights.push(`✅ 本周完成了 ${thisWeekTasks.length} 个任务，效率不错！`)
    }
    if (overdueTasks.length > 0) {
      insights.push(`⚠️ 有 ${overdueTasks.length} 个任务已逾期，请优先处理`)
    }
    if (urgentPending.length > 0) {
      insights.push(`🔴 还有 ${urgentPending.length} 个紧急任务待处理`)
    }
    if (thisWeekHabitRate >= 80) {
      insights.push(`🌟 习惯完成率 ${thisWeekHabitRate}%，非常棒！`)
    } else if (thisWeekHabitRate >= 50) {
      insights.push(`💪 习惯完成率 ${thisWeekHabitRate}%，还有提升空间`)
    }
    if (weeklyGoalProgress >= 100) {
      insights.push(`🏆 本周专注目标已达成！`)
    }
    if (bestDay.pomodoros > 0) {
      insights.push(`💡 ${bestDay.name}是你最高效的一天，建议在${bestDay.name}安排重要工作`)
    }
    const avgDailyFocus = thisWeekTotalSeconds / 7
    if (avgDailyFocus > 0) {
      const avgMinutes = Math.round(avgDailyFocus / 60)
      insights.push(`📊 日均专注 ${avgMinutes} 分钟`)
    }
    if (thisWeekPomodoros.length > 0) {
      const avgPomodoroDuration = thisWeekFocusSeconds / thisWeekPomodoros.length / 60
      insights.push(`🍅 平均每个番茄钟 ${Math.round(avgPomodoroDuration)} 分钟`)
    }
    const completedHighPriority = thisWeekTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length
    if (completedHighPriority > 0) {
      insights.push(`🎯 完成了 ${completedHighPriority} 个高优先级任务`)
    }
    if (insights.length === 0) {
      insights.push('🎯 新的一周开始了，设定目标并开始行动吧！')
    }

    const projectBreakdown = thisWeekTasks.reduce((acc, t) => {
      const project = t.project || '未分类'
      acc[project] = (acc[project] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topProject = Object.entries(projectBreakdown).sort((a, b) => b[1] - a[1])[0]

    return {
      thisWeekTasks: thisWeekTasks.length,
      lastWeekTasks: lastWeekTasks.length,
      thisWeekTotalSeconds,
      lastWeekTotalSeconds,
      thisWeekPomodoros: thisWeekPomodoros.length,
      lastWeekPomodoros: lastWeekPomodoros.length,
      thisWeekHabitRate,
      lastWeekHabitRate,
      weeklyGoalProgress,
      overdueTasks: overdueTasks.length,
      urgentPending: urgentPending.length,
      focusChange,
      taskChange,
      habitChange,
      dayData,
      insights,
      bestDay,
      projectBreakdown,
      topProject,
    }
  }, [tasks, pomodoroSessions, timeEntries, habits, habitCheckIns, focusGoals])

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value > 0) {
      return (
        <div className="flex items-center gap-0.5 text-chart-2">
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">+{value}%</span>
        </div>
      )
    }
    if (value < 0) {
      return (
        <div className="flex items-center gap-0.5 text-destructive">
          <ArrowDownRight className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{value}%</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">0%</span>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-5 w-5 text-chart-1" />
            周回顾
          </CardTitle>
          <Badge variant="outline" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />
            本周
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-chart-1/10 to-chart-1/3 p-3">
            <div className="flex items-center justify-between mb-1">
              <Timer className="h-4 w-4 text-chart-1" />
              <ChangeIndicator value={review.focusChange} />
            </div>
            <p className="text-xl font-bold tracking-tight">
              {formatDuration(review.thisWeekTotalSeconds)}
            </p>
            <p className="text-xs text-muted-foreground">专注时间</p>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-chart-2/10 to-chart-2/3 p-3">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle2 className="h-4 w-4 text-chart-2" />
              <ChangeIndicator value={review.taskChange} />
            </div>
            <p className="text-xl font-bold tracking-tight">{review.thisWeekTasks}</p>
            <p className="text-xs text-muted-foreground">完成任务</p>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-chart-3/10 to-chart-3/3 p-3">
            <div className="flex items-center justify-between mb-1">
              <Target className="h-4 w-4 text-chart-3" />
              <ChangeIndicator value={review.habitChange} />
            </div>
            <p className="text-xl font-bold tracking-tight">{review.thisWeekHabitRate}%</p>
            <p className="text-xs text-muted-foreground">习惯完成率</p>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-chart-4/10 to-chart-4/3 p-3">
            <div className="flex items-center justify-between mb-1">
              <Flame className="h-4 w-4 text-chart-4" />
            </div>
            <p className="text-xl font-bold tracking-tight">{review.thisWeekPomodoros}</p>
            <p className="text-xs text-muted-foreground">番茄钟</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">每周目标进度</span>
            <span className="font-medium">{Math.round(review.weeklyGoalProgress)}%</span>
          </div>
          <Progress value={review.weeklyGoalProgress} className="h-2" />
        </div>

        <div className="grid grid-cols-7 gap-1">
          {review.dayData.map((day) => (
            <div
              key={day.name}
              className={cn(
                'rounded-lg p-2 text-center transition-all',
                day.isToday ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'
              )}
            >
              <p className={cn('text-[10px] text-muted-foreground', day.isToday && 'text-primary font-medium')}>
                {day.name}
              </p>
              <p className="text-sm font-bold mt-0.5">{day.pomodoros}</p>
              <p className="text-[10px] text-muted-foreground">{day.tasks}✓</p>
            </div>
          ))}
        </div>

        {review.bestDay.pomodoros > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
            <Award className="h-4 w-4 text-chart-2 shrink-0" />
            <p className="text-xs text-muted-foreground">
              最佳专注日：<span className="font-medium text-foreground">{review.bestDay.name}</span>
              ，完成 {review.bestDay.pomodoros} 个番茄钟
            </p>
          </div>
        )}

        {review.topProject && review.topProject[1] > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">项目分布</p>
            {Object.entries(review.projectBreakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([project, count]) => (
                <div key={project} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1">{project}</span>
                  <div className="w-24 bg-muted/50 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-chart-1 transition-all"
                      style={{ width: `${Math.min((count / review.thisWeekTasks) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              ))}
          </div>
        )}

        <div className="space-y-1.5">
          {review.insights.map((insight, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {insight}
            </p>
          ))}
        </div>

        {(review.overdueTasks > 0 || review.urgentPending > 0) && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <ListTodo className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">待处理</span>
            </div>
            <div className="flex gap-3">
              {review.overdueTasks > 0 && (
                <span className="text-xs text-muted-foreground">
                  {review.overdueTasks} 个逾期
                </span>
              )}
              {review.urgentPending > 0 && (
                <span className="text-xs text-muted-foreground">
                  {review.urgentPending} 个紧急
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
