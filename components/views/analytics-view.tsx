'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FocusReport } from '@/components/focus-report'
import { ReportExportDialog } from '@/components/report-export-dialog'
import {
  Target,
  CheckCircle2,
  Timer,
  BarChart3,
  PieChart as PieChartIcon,
  Lightbulb,
  Zap,
  Coffee,
  Calendar,
  Flame,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  Brain,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Layers,
  Sunrise,
  Sunset,
  Play,
  ListChecks,
  Gauge,
  Hourglass,
  Quote,
  LayoutDashboard,
  TrendingUp as TrendIcon,
  List,
  ClipboardList,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { APP_COLORS, CHART_TOOLTIP_STYLE, WEEK_DAYS_FULL } from '@/lib/config'
import { subDays, startOfWeek, format, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'

// ============ 类型定义 ============

type TabKey = 'overview' | 'trends' | 'details' | 'report'
type TrendPeriod = 7 | 14 | 28 | 90

interface DayStatsType {
  focusMinutes: number
  focusHours: string
  pomodoros: number
  pomodorosShortBreak: number
  pomodorosLongBreak: number
  tasksCompleted: number
  tasksWorkedOn: number
  breakMinutes: number
  distractions: number
  productivityScore: number
  firstSession: Date | null
  lastSession: Date | null
  activeHours: number
  dailyHeatmap: Array<{ hour: number; label: string; minutes: number; intensity: number }>
  sessionList: Array<{
    id: string
    startTime: Date
    type: 'work' | 'short-break' | 'long-break'
    duration: number
    taskTitle?: string
    projectName?: string
    projectColor: string
  }>
  dayProjectBreakdown: Array<{ name: string; color: string; minutes: number; sessions: number }>
  dayTasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    focusedMinutes: number
    projectName?: string
    projectColor: string
    completed: boolean
  }>
  prevDayMinutes: number
  focusVsYesterday: number
  weekAvgMinutes: number
  focusVsWeekAvg: number
  hasData: boolean
}

// ============ 主组件 ============

export function AnalyticsView() {
  const { tasks, pomodoroSessions, timeEntries, projects, distractions, habits, habitCheckIns } = useAppStore(useShallow((state) => ({
    tasks: state.tasks,
    pomodoroSessions: state.pomodoroSessions,
    timeEntries: state.timeEntries,
    projects: state.projects,
    distractions: state.distractions,
    habits: state.habits,
    habitCheckIns: state.habitCheckIns,
  })))

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(7)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 30s 自动刷新
  const [now, setNow] = useState<Date>(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // ============ 数据计算 ============

  const weeklyData = useMemo(() => {
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const today = new Date(now)
    const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 })
    return days.map((day, index) => {
      const date = addDays(startOfWeekDate, index)
      const dateStr = date.toDateString()
      const dayPomodoros = pomodoroSessions.filter(s => new Date(s.completedAt).toDateString() === dateStr && s.type === 'work')
      const focusMinutes = dayPomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
      const dayTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === dateStr).length
      return { day, date: format(date, 'MM/dd'), focusMinutes: Math.round(focusMinutes), tasks: dayTasks, pomodoros: dayPomodoros.length, isToday: date.toDateString() === today.toDateString() }
    })
  }, [pomodoroSessions, tasks, now])

  const trendData = useMemo(() => {
    const result = []
    const today = new Date(now)
    for (let i = trendPeriod - 1; i >= 0; i--) {
      const date = subDays(today, i)
      const dateStr = date.toDateString()
      const dayPomodoros = pomodoroSessions.filter(s => new Date(s.completedAt).toDateString() === dateStr && s.type === 'work')
      const focusMinutes = dayPomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
      const dayTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === dateStr).length
      result.push({ date: format(date, 'MM/dd'), day: format(date, 'E', { locale: zhCN }), focusMinutes: Math.round(focusMinutes), tasks: dayTasks, fullDate: date })
    }
    return result
  }, [pomodoroSessions, tasks, now, trendPeriod])

  // 上一周期对比数据
  const prevTrendData = useMemo(() => {
    const result: Array<{ focusMinutes: number; tasks: number }> = []
    const today = new Date(now)
    for (let i = trendPeriod * 2 - 1; i >= trendPeriod; i--) {
      const date = subDays(today, i)
      const dateStr = date.toDateString()
      const dayPomodoros = pomodoroSessions.filter(s => new Date(s.completedAt).toDateString() === dateStr && s.type === 'work')
      const focusMinutes = dayPomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
      const dayTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === dateStr).length
      result.push({ focusMinutes: Math.round(focusMinutes), tasks: dayTasks })
    }
    return result
  }, [pomodoroSessions, tasks, now, trendPeriod])

  const trendWithComparison = useMemo(() =>
    trendData.map((d, i) => ({
      ...d,
      prevFocusMinutes: prevTrendData[i]?.focusMinutes ?? 0,
      prevTasks: prevTrendData[i]?.tasks ?? 0,
    }))
  , [trendData, prevTrendData])

  const hourlyDistribution = useMemo(() => {
    const hourCounts: Record<number, number> = {}
    for (let i = 0; i < 24; i++) hourCounts[i] = 0
    const rangeStart = startOfWeek(new Date(now), { weekStartsOn: 1 })
    pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart).forEach(s => {
      hourCounts[new Date(s.completedAt).getHours()] += s.duration / 60
    })
    return Object.entries(hourCounts).map(([hour, minutes]) => ({
      hour: `${hour.padStart(2, '0')}:00`, minutes: Math.round(minutes), hourNum: parseInt(hour),
    }))
  }, [pomodoroSessions, now])

  const categoryData = useMemo(() => {
    if (projects.length === 0) return [{ name: '未分类', value: 100, color: '#94a3b8' }]
    const projectTimes = projects.map(p => ({ name: p.name, value: Math.round(p.totalTime / 60), color: p.color }))
    const total = projectTimes.reduce((acc, p) => acc + p.value, 0)
    if (total === 0) return projectTimes.map(p => ({ ...p, value: 0 }))
    return projectTimes.map(p => ({ ...p, value: Math.round((p.value / total) * 100) }))
  }, [projects])

  const summaryStats = useMemo(() => {
    const rangeStart = startOfWeek(new Date(now), { weekStartsOn: 1 })
    const rangePomodoros = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart)
    const totalFocusMinutes = rangePomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
    const totalFocusHours = totalFocusMinutes / 60
    const rangeTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt) >= rangeStart).length

    const allWorkSessions = pomodoroSessions.filter(s => s.type === 'work')
    const dates = [...new Set(allWorkSessions.map(s => new Date(s.completedAt).toDateString()))]
    let streak = 0
    const checkDate = new Date()
    for (let i = 0; i < dates.length; i++) {
      const dateStr = checkDate.toDateString()
      if (dates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1) }
      else if (i === 0) { checkDate.setDate(checkDate.getDate() - 1); i-- }
      else break
    }

    const lastWeekStart = subDays(rangeStart, 7)
    const lastWeekPomodoros = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= lastWeekStart && new Date(s.completedAt) < rangeStart)
    const lastWeekMinutes = lastWeekPomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
    const weeklyTrend = lastWeekMinutes > 0 ? Math.round(((totalFocusMinutes - lastWeekMinutes) / lastWeekMinutes) * 100) : (totalFocusMinutes > 0 ? 100 : 0)

    const activeHabits = habits.filter(h => !h.archived).length
    const habitCheckInsInRange = habitCheckIns.filter(c => new Date(c.date) >= rangeStart && c.completed).length
    const habitCompletionRate = activeHabits > 0 ? Math.min(100, Math.round((habitCheckInsInRange / (activeHabits * 7)) * 100)) : 0

    // 深度工作：>= 45min 的 session 数量
    const deepWorkSessions = rangePomodoros.filter(s => s.duration >= 45 * 60).length

    // 碎片化指数：< 15min 的 session 占比
    const shortSessions = rangePomodoros.filter(s => s.duration < 15 * 60).length
    const fragmentationIndex = rangePomodoros.length > 0 ? Math.round((shortSessions / rangePomodoros.length) * 100) : 0

    // 任务完成率
    const totalTasksInRange = tasks.filter(t => new Date(t.createdAt) <= new Date(now) || t.status !== 'todo').length
    const completedInRange = tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= rangeStart).length
    const taskCompletionRate = totalTasksInRange > 0 ? Math.round((completedInRange / totalTasksInRange) * 100) : 0

    return {
      totalFocusHours: totalFocusHours.toFixed(1),
      totalFocusMinutes: Math.round(totalFocusMinutes),
      totalPomodoros: rangePomodoros.length,
      totalTasks: rangeTasks,
      streak,
      weeklyTrend,
      habitCompletionRate,
      avgDailyHours: (totalFocusHours / 7).toFixed(1),
      deepWorkSessions,
      fragmentationIndex,
      taskCompletionRate,
    }
  }, [pomodoroSessions, tasks, habits, habitCheckIns, now])

  // 每日目标达成率
  const dailyGoalAchievement = useMemo(() => {
    const today = new Date(now)
    const todayStr = today.toDateString()
    const todayPomodoros = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt).toDateString() === todayStr)
    const todayMinutes = todayPomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
    // 目标：8个番茄 + 200分钟
    const pomodoroGoal = 8
    const minuteGoal = 200
    const pomodoroRate = Math.min(100, (todayPomodoros.length / pomodoroGoal) * 100)
    const minuteRate = Math.min(100, (todayMinutes / minuteGoal) * 100)
    return { rate: Math.round((pomodoroRate + minuteRate) / 2), pomodoroRate: Math.round(pomodoroRate), minuteRate: Math.round(minuteRate), pomodoros: todayPomodoros.length, minutes: Math.round(todayMinutes) }
  }, [pomodoroSessions, now])

  const efficiencyScore = useMemo(() => {
    const focusScore = Math.min(100, summaryStats.totalFocusMinutes / 480 * 100)
    const taskScore = Math.min(100, summaryStats.totalTasks / 35 * 100)
    const streakScore = Math.min(100, summaryStats.streak / 7 * 100)
    const habitScore = summaryStats.habitCompletionRate
    return Math.round(focusScore * 0.4 + taskScore * 0.25 + streakScore * 0.2 + habitScore * 0.15)
  }, [summaryStats])

  // 7x24 时段热力图
  const heatmapData = useMemo(() => {
    const today = new Date(now)
    const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 })
    const grid: Array<Array<{ hour: number; minutes: number; intensity: number }>> = []

    for (let d = 0; d < 7; d++) {
      const date = addDays(startOfWeekDate, d)
      const dateStr = date.toDateString()
      const row: Array<{ hour: number; minutes: number; intensity: number }> = []
      const daySessions = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt).toDateString() === dateStr)
      const hourMinutes: Record<number, number> = {}
      for (let h = 0; h < 24; h++) hourMinutes[h] = 0
      daySessions.forEach(s => { hourMinutes[new Date(s.completedAt).getHours()] += s.duration / 60 })
      const maxMin = Math.max(...Object.values(hourMinutes), 1)
      for (let h = 0; h < 24; h++) {
        row.push({ hour: h, minutes: Math.round(hourMinutes[h]), intensity: hourMinutes[h] / maxMin })
      }
      grid.push(row)
    }
    return grid
  }, [pomodoroSessions, now])

  const productivityInsight = useMemo(() => {
    const workSessions = pomodoroSessions.filter(s => s.type === 'work')
    const last30Days = workSessions.filter(s => new Date(s.completedAt) > subDays(new Date(now), 30))
    const hourCounts: Record<number, { total: number; count: number }> = {}
    for (let i = 0; i < 24; i++) hourCounts[i] = { total: 0, count: 0 }
    last30Days.forEach(s => { const hour = new Date(s.completedAt).getHours(); hourCounts[hour].total += s.duration; hourCounts[hour].count++ })
    const peakHours = Object.entries(hourCounts).map(([hour, data]) => ({ hour: parseInt(hour), score: data.count > 0 ? Math.round(data.total / 60) : 0 })).sort((a, b) => b.score - a.score)
    const dayCounts: Record<string, number> = {}
    WEEK_DAYS_FULL.forEach(d => dayCounts[d] = 0)
    last30Days.forEach(s => { dayCounts[WEEK_DAYS_FULL[new Date(s.completedAt).getDay()]]++ })
    const mostProductiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '周一'
    const topPeakHour = peakHours.find(h => h.score > 0)
    const suggestedFocusTime = topPeakHour ? `${topPeakHour.hour.toString().padStart(2, '0')}:00 - ${(topPeakHour.hour + 1).toString().padStart(2, '0')}:00` : '09:00 - 10:00'
    return { peakHours, mostProductiveDay, suggestedFocusTime, bestHour: topPeakHour?.hour ?? 9 }
  }, [pomodoroSessions, now])

  // 项目趋势（堆叠面积图）
  const projectTrendData = useMemo(() => {
    const today = new Date(now)
    const result = []
    for (let i = 27; i >= 0; i--) {
      const date = subDays(today, i)
      const dateStr = date.toDateString()
      const entry: Record<string, number | string> = { date: format(date, 'MM/dd') }
      projects.forEach(p => {
        const daySessions = pomodoroSessions.filter(s => {
          if (s.type !== 'work' || new Date(s.completedAt).toDateString() !== dateStr) return false
          const t = s.taskId ? tasks.find(tk => tk.id === s.taskId) : undefined
          return t?.project === p.name
        })
        entry[p.name] = Math.round(daySessions.reduce((acc, s) => acc + s.duration, 0) / 60)
      })
      result.push(entry)
    }
    return result
  }, [pomodoroSessions, tasks, projects, now])

  // 习惯趋势（周完成率）
  const habitTrendData = useMemo(() => {
    const result: { week: string; rate: number }[] = []
    const today = new Date(now)
    const activeHabits = habits.filter(h => !h.archived).length
    if (activeHabits === 0) return result
    for (let w = 7; w >= 0; w--) {
      const weekEnd = subDays(today, w * 7)
      const weekStart = subDays(weekEnd, 6)
      const checkIns = habitCheckIns.filter(c => {
        const d = new Date(c.date)
        return d >= weekStart && d <= weekEnd && c.completed
      }).length
      const rate = Math.min(100, Math.round((checkIns / (activeHabits * 7)) * 100))
      result.push({ week: format(weekEnd, 'MM/dd'), rate })
    }
    return result
  }, [habits, habitCheckIns, now])

  // ============ 单日分析数据 ============
  const dayRange = useMemo(() => {
    const start = new Date(selectedDate); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setHours(23, 59, 59, 999)
    return { start, end }
  }, [selectedDate, now])

  const isSelectedToday = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const sel = new Date(selectedDate); sel.setHours(0, 0, 0, 0)
    return sel.getTime() === today.getTime()
  }, [selectedDate, now])

  const isSelectedFuture = useMemo(() => {
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const sel = new Date(selectedDate); sel.setHours(0, 0, 0, 0)
    return sel.getTime() > today.getTime()
  }, [selectedDate, now])

  const dailyStats: DayStatsType = useMemo(() => {
    const dayStart = dayRange.start
    const dayEnd = dayRange.end
    const dayAllSessions = pomodoroSessions.filter(s => { const d = new Date(s.completedAt); return d >= dayStart && d <= dayEnd })
    const dayWork = dayAllSessions.filter(s => s.type === 'work')
    const dayShortBreak = dayAllSessions.filter(s => s.type === 'short-break')
    const dayLongBreak = dayAllSessions.filter(s => s.type === 'long-break')
    const focusMinutes = dayWork.reduce((acc, s) => acc + s.duration, 0) / 60
    const breakMinutes = dayShortBreak.length * 5 + dayLongBreak.length * 15
    const dayDistractions = distractions.filter(d => { const dt = new Date(d.timestamp); return dt >= dayStart && dt <= dayEnd }).length
    const dayTasksCompleted = tasks.filter(t => { if (!t.completedAt) return false; const c = new Date(t.completedAt); return c >= dayStart && c <= dayEnd })
    const dayTasksWorkedOn = new Set(dayWork.filter(s => s.taskId).map(s => s.taskId))
    const sessionsByHour: Record<number, number> = {}
    for (let h = 0; h < 24; h++) sessionsByHour[h] = 0
    dayWork.forEach(s => { sessionsByHour[new Date(s.completedAt).getHours()] += s.duration / 60 })
    const peakMinute = Math.max(...Object.values(sessionsByHour), 1)
    const dailyHeatmap = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h.toString().padStart(2, '0')}:00`, minutes: Math.round(sessionsByHour[h]), intensity: sessionsByHour[h] / peakMinute }))
    const focusScore = Math.min(100, (focusMinutes / 240) * 100)
    const taskScore = Math.min(100, dayTasksCompleted.length * 25)
    const pomodoroScore = Math.min(100, (dayWork.length / 6) * 100)
    const distractionPenalty = Math.max(0, dayDistractions * 8)
    const productivityScore = Math.max(0, Math.min(100, Math.round(focusScore * 0.4 + taskScore * 0.25 + pomodoroScore * 0.25 + Math.max(0, 100 - distractionPenalty) * 0.1)))
    const firstSession = dayAllSessions.length > 0 ? new Date(Math.min(...dayAllSessions.map(s => new Date(s.completedAt).getTime()))) : null
    const lastSession = dayAllSessions.length > 0 ? new Date(Math.max(...dayAllSessions.map(s => new Date(s.completedAt).getTime()))) : null
    const sessionList = dayAllSessions.map(s => {
      const t = s.taskId ? tasks.find(tk => tk.id === s.taskId) : undefined
      const projName = t?.project
      const proj = projName ? projects.find(p => p.name === projName) : undefined
      return { id: s.id, startTime: new Date(s.completedAt), type: s.type, duration: s.duration, taskTitle: t?.title, projectName: projName, projectColor: proj?.color || '#94a3b8' }
    }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    const projectMap: Record<string, { name: string; color: string; minutes: number; sessions: number }> = {}
    dayWork.forEach(s => {
      const t = s.taskId ? tasks.find(tk => tk.id === s.taskId) : undefined
      const key = t?.project || '未分类'
      const proj = key !== '未分类' ? projects.find(p => p.name === key) : undefined
      if (!projectMap[key]) projectMap[key] = { name: key, color: proj?.color || '#94a3b8', minutes: 0, sessions: 0 }
      projectMap[key].minutes += s.duration / 60; projectMap[key].sessions += 1
    })
    const dayProjectBreakdown = Object.values(projectMap).map(p => ({ ...p, minutes: Math.round(p.minutes) })).sort((a, b) => b.minutes - a.minutes)
    const dayTasks = Array.from(new Set(dayWork.filter(s => s.taskId).map(s => s.taskId))).map(tid => {
      const t = tasks.find(tk => tk.id === tid)
      if (!t) return null
      const focused = dayWork.filter(s => s.taskId === tid).reduce((acc, s) => acc + s.duration / 60, 0)
      return { id: t.id, title: t.title, status: t.status, priority: t.priority, focusedMinutes: Math.round(focused), projectName: t.project, projectColor: t.project ? projects.find(p => p.name === t.project)?.color || '#94a3b8' : '#94a3b8', completed: t.status === 'done' }
    }).filter((t): t is NonNullable<typeof t> => t !== null).sort((a, b) => b.focusedMinutes - a.focusedMinutes)
    const prevDayStart = new Date(dayStart); prevDayStart.setDate(prevDayStart.getDate() - 1)
    const prevDayEnd = new Date(prevDayStart); prevDayEnd.setHours(23, 59, 59, 999)
    const prevDayMinutes = pomodoroSessions.filter(s => { const d = new Date(s.completedAt); return s.type === 'work' && d >= prevDayStart && d <= prevDayEnd }).reduce((acc, s) => acc + s.duration, 0) / 60
    const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 6)
    const weekDayMinutes: number[] = []
    for (let i = 0; i < 7; i++) {
      const ds = new Date(weekStart); ds.setDate(ds.getDate() + i); ds.setHours(0, 0, 0, 0)
      const de = new Date(ds); de.setHours(23, 59, 59, 999)
      weekDayMinutes.push(pomodoroSessions.filter(s => { const d = new Date(s.completedAt); return s.type === 'work' && d >= ds && d <= de }).reduce((acc, s) => acc + s.duration, 0) / 60)
    }
    const todayInWeek = weekDayMinutes[6]
    const weekAvgExcludingToday = (weekDayMinutes.reduce((a, b) => a + b, 0) - todayInWeek) / 6
    return {
      focusMinutes: Math.round(focusMinutes), focusHours: (focusMinutes / 60).toFixed(1),
      pomodoros: dayWork.length, pomodorosShortBreak: dayShortBreak.length, pomodorosLongBreak: dayLongBreak.length,
      tasksCompleted: dayTasksCompleted.length, tasksWorkedOn: dayTasksWorkedOn.size,
      breakMinutes: Math.round(breakMinutes), distractions: dayDistractions, productivityScore,
      firstSession, lastSession, activeHours: Object.values(sessionsByHour).filter(m => m > 0).length,
      dailyHeatmap, sessionList, dayProjectBreakdown, dayTasks,
      prevDayMinutes: Math.round(prevDayMinutes),
      focusVsYesterday: prevDayMinutes > 0 ? Math.round(((focusMinutes - prevDayMinutes) / prevDayMinutes) * 100) : focusMinutes > 0 ? 100 : 0,
      weekAvgMinutes: Math.round(weekAvgExcludingToday),
      focusVsWeekAvg: weekAvgExcludingToday > 0 ? Math.round(((focusMinutes - weekAvgExcludingToday) / weekAvgExcludingToday) * 100) : focusMinutes > 0 ? 100 : 0,
      hasData: dayAllSessions.length > 0 || dayTasksCompleted.length > 0,
    }
  }, [pomodoroSessions, tasks, distractions, projects, dayRange])

  const goPrevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }
  const goNextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }
  const goToday = () => setSelectedDate(new Date())

  // ============ 辅助组件 ============

  const ChangeIndicator = ({ value, showLabel = true }: { value: number; showLabel?: boolean }) => {
    if (value > 0) return <div className="flex items-center gap-1 text-emerald-500"><ArrowUpRight className="h-3.5 w-3.5" />{showLabel && <span className="text-xs font-medium">+{value}%</span>}</div>
    if (value < 0) return <div className="flex items-center gap-1 text-rose-500"><ArrowDownRight className="h-3.5 w-3.5" />{showLabel && <span className="text-xs font-medium">{value}%</span>}</div>
    return <div className="flex items-center gap-1 text-muted-foreground"><Minus className="h-3.5 w-3.5" />{showLabel && <span className="text-xs font-medium">0%</span>}</div>
  }

  const getEfficiencyLevel = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
    if (score >= 70) return { label: '良好', color: 'text-blue-500', bg: 'bg-blue-500/10' }
    if (score >= 50) return { label: '一般', color: 'text-amber-500', bg: 'bg-amber-500/10' }
    return { label: '待提升', color: 'text-rose-500', bg: 'bg-rose-500/10' }
  }

  const efficiencyLevel = getEfficiencyLevel(efficiencyScore)

  // 热力图颜色
  const heatCellColor = (intensity: number) => {
    if (intensity <= 0) return 'bg-muted/30'
    if (intensity < 0.2) return 'bg-blue-400/20'
    if (intensity < 0.4) return 'bg-blue-400/40'
    if (intensity < 0.6) return 'bg-blue-500/55'
    if (intensity < 0.8) return 'bg-blue-500/75'
    return 'bg-blue-500'
  }

  // ============ Tab 定义 ============

  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: '概览', icon: LayoutDashboard },
    { key: 'trends', label: '趋势', icon: TrendIcon },
    { key: 'details', label: '详情', icon: List },
    { key: 'report', label: '报表', icon: ClipboardList },
  ]

  // ============ 渲染 ============

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 顶部标题 + Tab 导航 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据分析</h1>
          <p className="text-sm text-muted-foreground mt-1">深入了解你的工作模式，优化时间管理</p>
        </div>
        <div className="flex items-center gap-3">
          <ReportExportDialog />
          <div className="flex items-center rounded-xl border bg-background p-1 shadow-sm">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                    activeTab === tab.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab 内容 */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'trends' && <TrendsTab />}
      {activeTab === 'details' && <DetailsTab />}
      {activeTab === 'report' && <FocusReport />}
    </div>
  )

  // ============ 概览 Tab ============
  function OverviewTab() {
    // Sparkline 数据：近7天专注分钟
    const sparklineData = useMemo(() =>
      weeklyData.map(d => d.focusMinutes)
    , [weeklyData])

    return (
      <div className="space-y-6">
        {/* 5 个核心指标卡片 */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* 1. 专注时长 */}
          <MetricCard
            icon={Timer} label="专注时长" color={APP_COLORS.blue}
            value={summaryStats.totalFocusHours} unit="h"
            subtext={`日均 ${summaryStats.avgDailyHours}h`}
            trend={summaryStats.weeklyTrend}
            sparkline={sparklineData}
          />
          {/* 2. 完成任务 */}
          <MetricCard
            icon={CheckCircle2} label="完成任务" color={APP_COLORS.green}
            value={summaryStats.totalTasks} unit="项"
            subtext={`完成率 ${summaryStats.taskCompletionRate}%`}
            sparkline={weeklyData.map(d => d.tasks)}
          />
          {/* 3. 深度工作 */}
          <MetricCard
            icon={Brain} label="深度工作" color={APP_COLORS.purple}
            value={summaryStats.deepWorkSessions} unit="次"
            subtext="≥45min 的专注时段"
            sparkline={sparklineData.map(v => v >= 45 ? 1 : 0)}
          />
          {/* 4. 连续专注 */}
          <MetricCard
            icon={Flame} label="连续专注" color={APP_COLORS.orange}
            value={summaryStats.streak} unit="天"
            subtext={summaryStats.streak >= 7 ? '🔥 状态极佳' : '保持专注'}
            sparkline={Array(7).fill(0).map((_, i) => i < summaryStats.streak ? 1 : 0)}
          />
          {/* 5. 效率评分 */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-purple-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="rounded-xl bg-purple-500/10 p-2.5"><Activity className="h-5 w-5 text-purple-500" /></div>
                <Badge className={cn("text-[10px] h-5", efficiencyLevel.bg, efficiencyLevel.color)}>{efficiencyLevel.label}</Badge>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">效率评分</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-3xl font-bold tracking-tight">{efficiencyScore}</p>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <Progress value={efficiencyScore} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
        </div>

        {/* 第二行：专注趋势 + 每日目标达成率 */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 专注趋势图 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">专注趋势</CardTitle>
                  <CardDescription>专注时长与完成任务变化</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
                    <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: APP_COLORS.blue }} /><span>本期</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: APP_COLORS.blue, backgroundColor: 'transparent' }} /><span>上期</span></div>
                  </div>
                  <div className="flex items-center rounded-lg border bg-background p-0.5">
                    {([7, 14, 28, 90] as const).map(p => (
                      <button key={p} onClick={() => setTrendPeriod(p)}
                        className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                          trendPeriod === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        {p}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendWithComparison}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={APP_COLORS.blue} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={APP_COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval={Math.max(0, Math.floor(trendPeriod / 7) - 1)} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `${v}m`} width={45} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number, name: string) => [name === 'focusMinutes' ? `${value} 分钟` : name === 'prevFocusMinutes' ? `${value} 分钟 (上期)` : `${value} 个`, name === 'focusMinutes' ? '专注时长' : name === 'prevFocusMinutes' ? '上期专注' : '完成任务']} />
                    <Area type="monotone" dataKey="prevFocusMinutes" stroke={APP_COLORS.blue} strokeDasharray="6 3" strokeWidth={1.5} fill="none" name="prevFocusMinutes" />
                    <Area type="monotone" dataKey="focusMinutes" stroke={APP_COLORS.blue} strokeWidth={2.5} fill="url(#focusGrad)" name="focusMinutes" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 每日目标达成率 */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-5 w-5" style={{ color: APP_COLORS.orange }} />
                每日目标达成率
              </CardTitle>
              <CardDescription>今日目标完成进度</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center py-4">
              <GoalRing rate={dailyGoalAchievement.rate} />
              <div className="grid grid-cols-2 gap-4 w-full mt-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">番茄钟</p>
                  <p className="text-lg font-bold tabular-nums">{dailyGoalAchievement.pomodoros}<span className="text-xs text-muted-foreground font-normal">/8</span></p>
                  <Progress value={dailyGoalAchievement.pomodoroRate} className="mt-1.5 h-1" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">专注分钟</p>
                  <p className="text-lg font-bold tabular-nums">{dailyGoalAchievement.minutes}<span className="text-xs text-muted-foreground font-normal">/200</span></p>
                  <Progress value={dailyGoalAchievement.minuteRate} className="mt-1.5 h-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 第三行：时段热力图 + 智能洞察 */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 时段热力图 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5" style={{ color: APP_COLORS.blue }} />
                    时段热力图
                  </CardTitle>
                  <CardDescription>7天 x 24小时专注分布</CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                  <span>少</span>
                  <div className="flex gap-0.5">
                    {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => <div key={v} className={cn('h-3 w-3 rounded-sm', heatCellColor(v))} />)}
                  </div>
                  <span>多</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  {/* 小时标签 */}
                  <div className="flex items-center mb-1 pl-10">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground/60 tabular-nums">{h % 3 === 0 ? `${h}` : ''}</div>
                    ))}
                  </div>
                  {/* 热力图网格 */}
                  {heatmapData.map((row, dayIdx) => {
                    const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
                    return (
                      <div key={dayIdx} className="flex items-center gap-1 mb-1">
                        <div className="w-8 text-right text-[10px] text-muted-foreground shrink-0">{dayLabels[dayIdx]}</div>
                        <div className="flex-1 flex gap-0.5">
                          {row.map(cell => (
                            <div key={cell.hour}
                              className={cn('flex-1 aspect-square rounded-sm transition-all duration-200 cursor-default', heatCellColor(cell.intensity))}
                              title={`${dayLabels[dayIdx]} ${cell.hour}:00 - ${cell.minutes}分钟`}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 智能洞察 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5" style={{ color: APP_COLORS.orange }} />
                智能洞察
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InsightItem icon={Clock} color={APP_COLORS.blue} label="黄金专注时段" value={productivityInsight.suggestedFocusTime} />
              <InsightItem icon={Calendar} color={APP_COLORS.green} label="最佳工作日" value={productivityInsight.mostProductiveDay} />
              <InsightItem icon={Zap} color={APP_COLORS.orange} label="碎片化指数" value={`${summaryStats.fragmentationIndex}%`} hint={summaryStats.fragmentationIndex <= 20 ? '专注质量优秀' : summaryStats.fragmentationIndex <= 40 ? '可以改善' : '建议增加长时专注'} />
              <InsightItem icon={CheckCircle2} color={APP_COLORS.purple} label="习惯完成率" value={`${summaryStats.habitCompletionRate}%`} />
            </CardContent>
          </Card>
        </div>

        {/* 项目时间分布 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" style={{ color: APP_COLORS.purple }} />
              项目时间分布
            </CardTitle>
            <CardDescription>各项目时间投入占比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="h-[200px] w-full lg:w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [`${value}%`, '占比']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full">
                <div className="grid grid-cols-2 gap-3">
                  {categoryData.map((category, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:border-primary/20 transition-colors">
                      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{category.name}</p>
                        <p className="text-xs text-muted-foreground">{category.value}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============ 趋势 Tab ============
  function TrendsTab() {
    return (
      <div className="space-y-6">
        {/* 28天专注趋势 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">28 天专注趋势</CardTitle>
            <CardDescription>近一个月专注时长与任务完成变化</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendWithComparison}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={APP_COLORS.blue} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={APP_COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="taskTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={APP_COLORS.green} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={APP_COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval={6} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${v}m`} width={45} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={30} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="prevFocusMinutes" stroke={APP_COLORS.blue} strokeDasharray="6 3" strokeWidth={1} fill="none" name="上期专注" />
                  <Area yAxisId="left" type="monotone" dataKey="focusMinutes" stroke={APP_COLORS.blue} strokeWidth={2} fill="url(#trendGrad)" name="专注时长" />
                  <Area yAxisId="right" type="monotone" dataKey="tasks" stroke={APP_COLORS.green} strokeWidth={2} fill="url(#taskTrendGrad)" name="完成任务" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 项目趋势 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">项目趋势</CardTitle>
              <CardDescription>各项目专注时长变化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {projects.length === 0 ? (
                  <EmptyState message="暂无项目数据" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `${v}m`} width={40} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend />
                      {projects.map(p => (
                        <Area key={p.id} type="monotone" dataKey={p.name} stroke={p.color} fill={p.color} fillOpacity={0.15} strokeWidth={1.5} stackId="1" />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 习惯趋势 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">习惯趋势</CardTitle>
              <CardDescription>每周习惯完成率</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {habitTrendData.length === 0 ? (
                  <EmptyState message="暂无习惯数据" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={habitTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} width={40} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [`${value}%`, '完成率']} />
                      <Line type="monotone" dataKey="rate" stroke={APP_COLORS.purple} strokeWidth={2.5} dot={{ r: 4, fill: APP_COLORS.purple }} name="完成率" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 时段分布 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5" style={{ color: APP_COLORS.blue }} />
              时段分布
            </CardTitle>
            <CardDescription>各时段专注时长统计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyDistribution.filter(h => h.minutes > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={2} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}m`} width={40} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [`${value} 分钟`, '专注时长']} />
                  <Bar dataKey="minutes" fill={APP_COLORS.blue} radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============ 详情 Tab ============
  function DetailsTab() {
    return (
      <DayAnalyticsSection
        selectedDate={selectedDate}
        isSelectedToday={isSelectedToday}
        isSelectedFuture={isSelectedFuture}
        dailyStats={dailyStats}
        onPrevDay={goPrevDay}
        onNextDay={goNextDay}
        onToday={goToday}
      />
    )
  }
}

// ============ 指标卡片组件 ============

function MetricCard({ icon: Icon, label, color, value, unit, subtext, trend, sparkline }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  value: string | number
  unit: string
  subtext?: string
  trend?: number
  sparkline?: number[]
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300" style={{ borderColor: `${color}33` }}>
      <div className="absolute inset-0 bg-gradient-to-br to-transparent" style={{ background: `linear-gradient(to bottom right, ${color}0D, transparent)` }} />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="rounded-xl p-2.5" style={{ backgroundColor: `${color}1A` }}>
            <Icon className="h-5 w-5" />
          </div>
          {typeof trend === 'number' && trend !== 0 && <ChangeIndicatorInline value={trend} />}
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold mt-1 tracking-tight">{value}<span className="text-lg font-normal text-muted-foreground">{unit}</span></p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        {sparkline && sparkline.length > 0 && (
          <div className="mt-3 h-8">
            <SparklineMini data={sparkline} color={color} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChangeIndicatorInline({ value }: { value: number }) {
  if (value > 0) return <div className="flex items-center gap-0.5 text-emerald-500"><ArrowUpRight className="h-3.5 w-3.5" /><span className="text-xs font-medium">+{value}%</span></div>
  if (value < 0) return <div className="flex items-center gap-0.5 text-rose-500"><ArrowDownRight className="h-3.5 w-3.5" /><span className="text-xs font-medium">{value}%</span></div>
  return <div className="flex items-center gap-0.5 text-muted-foreground"><Minus className="h-3.5 w-3.5" /><span className="text-xs font-medium">0%</span></div>
}

// ============ 迷你 Sparkline ============

function SparklineMini({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 100
  const h = 28
  const step = w / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} opacity={0.7} />
    </svg>
  )
}

// ============ 目标环 ============

function GoalRing({ rate }: { rate: number }) {
  const radius = 70
  const stroke = 8
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (rate / 100) * circumference
  const color = rate >= 80 ? APP_COLORS.success : rate >= 50 ? APP_COLORS.blue : APP_COLORS.orange

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle stroke="hsl(var(--muted))" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
        <circle stroke={color} fill="transparent" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference + ' ' + circumference} strokeDashoffset={strokeDashoffset} r={normalizedRadius} cx={radius} cy={radius} className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{rate}%</span>
        <span className="text-[10px] text-muted-foreground">达成率</span>
      </div>
    </div>
  )
}

// ============ 洞察项 ============

function InsightItem({ icon: Icon, color, label, value, hint }: {
  icon: React.ComponentType<{ className?: string }>
  color: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/20" style={{ backgroundColor: `${color}08`, borderColor: `${color}1A` }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A` }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}

// ============ 空状态 ============

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ============ 单日分析区块 ============

interface DayAnalyticsSectionProps {
  selectedDate: Date
  isSelectedToday: boolean
  isSelectedFuture: boolean
  dailyStats: DayStatsType
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
}

function DayAnalyticsSection({ selectedDate, isSelectedToday, isSelectedFuture, dailyStats, onPrevDay, onNextDay, onToday }: DayAnalyticsSectionProps) {
  const scoreLevel = (() => {
    if (dailyStats.productivityScore >= 85) return { label: '极佳', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
    if (dailyStats.productivityScore >= 70) return { label: '良好', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
    if (dailyStats.productivityScore >= 50) return { label: '一般', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
    return { label: '偏低', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
  })()

  const heatColor = (intensity: number) => {
    if (intensity <= 0) return 'bg-muted/40'
    if (intensity < 0.2) return 'bg-blue-500/15'
    if (intensity < 0.4) return 'bg-blue-500/30'
    if (intensity < 0.6) return 'bg-blue-500/50'
    if (intensity < 0.8) return 'bg-blue-500/75'
    return 'bg-blue-500'
  }

  const formatTime = (d: Date) => format(d, 'HH:mm')
  const totalProjectMinutes = dailyStats.dayProjectBreakdown.reduce((acc, p) => acc + p.minutes, 0)
  const totalSessionMinutes = dailyStats.sessionList.reduce((acc, s) => acc + s.duration, 0) / 60

  const allProjects = useAppStore((s) => s.projects)
  const allTasks = useAppStore((s) => s.tasks)
  const allSessions = useAppStore((s) => s.pomodoroSessions)
  const weekProjectMinutes = useMemo(() => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)
    const map: Record<string, number> = {}
    for (const s of allSessions) {
      if (s.type !== 'work') continue
      if (new Date(s.completedAt) < weekStart) continue
      const t = s.taskId ? allTasks.find((tk) => tk.id === s.taskId) : undefined
      const key = t?.project || '未分类'
      map[key] = (map[key] ?? 0) + s.duration / 60
    }
    return map
  }, [allSessions, allTasks])

  return (
    <div className="space-y-6">
      {/* 日期导航 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="icon" onClick={onPrevDay} className="shrink-0" aria-label="前一天"><ChevronLeft className="h-4 w-4" /></Button>
            <div className="flex-1 text-center min-w-0">
              <div className="text-xl sm:text-2xl font-bold tracking-tight truncate">{format(selectedDate, 'yyyy年M月d日', { locale: zhCN })}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-1 flex-wrap">
                <span>{format(selectedDate, 'EEEE', { locale: zhCN })}</span>
                {isSelectedToday && <Badge className="bg-primary/10 text-primary border-0 text-[10px] h-5">今天</Badge>}
                {isSelectedFuture && <Badge variant="secondary" className="text-[10px] h-5">未来</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isSelectedToday && !isSelectedFuture && <Button variant="ghost" size="sm" onClick={onToday} className="text-xs">回到今天</Button>}
              <Button variant="outline" size="icon" onClick={onNextDay} disabled={isSelectedFuture} aria-label="后一天"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 空状态 */}
      {isSelectedFuture ? (
        <Card><CardContent className="p-12 text-center"><Sunrise className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">未来日期，暂无数据</p></CardContent></Card>
      ) : !dailyStats.hasData ? (
        <Card><CardContent className="p-12 text-center"><Hourglass className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm font-medium mb-1">这一天还没有数据</p><p className="text-xs text-muted-foreground">开始一个番茄钟来记录你的专注</p></CardContent></Card>
      ) : (
        <>
          {/* 6 个核心指标 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <DayMetricCard icon={Clock} label="专注时长" value={dailyStats.focusHours} unit="h" trend={dailyStats.focusVsYesterday} color="blue" />
            <DayMetricCard icon={Timer} label="完成番茄" value={dailyStats.pomodoros} unit="个" subtext={`短休 ${dailyStats.pomodorosShortBreak} · 长休 ${dailyStats.pomodorosLongBreak}`} color="emerald" />
            <DayMetricCard icon={CheckCircle2} label="完成任务" value={dailyStats.tasksCompleted} unit="项" subtext={`处理 ${dailyStats.tasksWorkedOn} 项任务`} color="amber" />
            <DayMetricCard icon={Coffee} label="休息时长" value={Math.round(dailyStats.breakMinutes)} unit="m" color="cyan" />
            <DayMetricCard icon={Activity} label="干扰次数" value={dailyStats.distractions} unit="次" subtext={dailyStats.distractions === 0 ? '极佳状态' : undefined} color={dailyStats.distractions === 0 ? 'emerald' : 'rose'} />
            <Card className={cn('relative overflow-hidden', scoreLevel.border)}>
              <div className={cn('absolute inset-0 opacity-5', scoreLevel.bg.replace('/10', ''))} />
              <CardContent className="relative p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn('rounded-lg p-1.5', scoreLevel.bg)}><Gauge className={cn('h-4 w-4', scoreLevel.color)} /></div>
                  <Badge className={cn('text-[10px] h-5 border-0', scoreLevel.bg, scoreLevel.color)}>{scoreLevel.label}</Badge>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">生产效率</p>
                <p className="text-2xl font-bold mt-1 tracking-tight tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{dailyStats.productivityScore}<span className="text-xs font-normal text-muted-foreground" style={{ fontFamily: 'var(--font-sans)' }}>/100</span></p>
                <Progress value={dailyStats.productivityScore} className="mt-2 h-1" />
              </CardContent>
            </Card>
          </div>

          {/* 24小时热力图 + 会话时间线 */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-500" />24 小时专注分布</CardTitle>
                    <CardDescription>每小时专注时长热力图</CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                    <span>少</span>
                    <div className="flex gap-0.5">{[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => <div key={v} className={cn('h-3 w-3 rounded-sm', heatColor(v))} />)}</div>
                    <span>多</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {([{ title: '上午', icon: Sunrise, data: dailyStats.dailyHeatmap.slice(0, 12) }, { title: '下午', icon: Sunset, data: dailyStats.dailyHeatmap.slice(12, 24) }] as const).map(section => {
                    const sectionMinutes = section.data.reduce((acc, c) => acc + c.minutes, 0)
                    return (
                      <div key={section.title}>
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><section.icon className="h-3.5 w-3.5" />{section.title}</div>
                          <div className="text-[10px] text-muted-foreground/60 tabular-nums">{sectionMinutes > 0 ? `${sectionMinutes} 分钟` : '无专注'}</div>
                        </div>
                        <div className="grid grid-cols-12 gap-1.5">
                          {section.data.map(cell => {
                            const isActive = cell.minutes > 0
                            return (
                              <div key={cell.hour} className="flex flex-col items-center group" title={`${cell.label} - ${cell.minutes} 分钟`}>
                                <div className={cn('aspect-square w-full rounded-md transition-all duration-200',
                                  cell.intensity <= 0 && 'bg-slate-200/60 dark:bg-slate-800/60',
                                  cell.intensity > 0 && cell.intensity < 0.2 && 'bg-blue-500/20',
                                  cell.intensity >= 0.2 && cell.intensity < 0.4 && 'bg-blue-500/40',
                                  cell.intensity >= 0.4 && cell.intensity < 0.6 && 'bg-blue-500/60',
                                  cell.intensity >= 0.6 && cell.intensity < 0.8 && 'bg-blue-500/80',
                                  cell.intensity >= 0.8 && 'bg-blue-500',
                                  isActive && 'hover:scale-110 hover:shadow-md hover:z-10 cursor-pointer ring-1 ring-blue-500/20',
                                  !isActive && 'opacity-50'
                                )} />
                                <div className={cn('text-[9px] mt-1 tabular-nums transition-colors', isActive ? 'text-muted-foreground font-semibold' : 'text-muted-foreground/30')}>{cell.hour}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
                  <DayMiniStat icon={Sunrise} label="首次专注" value={dailyStats.firstSession ? formatTime(dailyStats.firstSession) : '—'} />
                  <DayMiniStat icon={Sunset} label="最后专注" value={dailyStats.lastSession ? formatTime(dailyStats.lastSession) : '—'} />
                  <DayMiniStat icon={Hourglass} label="活跃小时" value={`${dailyStats.activeHours}`} unit="h" />
                  <DayMiniStat icon={Clock} label="平均时长" value={dailyStats.pomodoros > 0 ? `${(totalSessionMinutes / dailyStats.sessionList.length).toFixed(1)}` : '0'} unit="m" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-purple-500" />会话时间线</CardTitle>
                <CardDescription>共 {dailyStats.sessionList.length} 个会话</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
                  {dailyStats.sessionList.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">暂无会话</p>}
                  {dailyStats.sessionList.map(s => {
                    const isWork = s.type === 'work'
                    const isLong = s.type === 'long-break'
                    const Icon = isWork ? Play : Coffee
                    const colorClass = isWork ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : isLong ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    return (
                      <div key={s.id} className="flex items-start gap-3 rounded-lg border p-2.5 hover:border-primary/30 transition-colors">
                        <div className={cn('rounded-md p-1.5 border', colorClass)}><Icon className="h-3.5 w-3.5" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{formatTime(s.startTime)}</span>
                            <span className="text-xs text-muted-foreground">{Math.round(s.duration / 60)} 分钟</span>
                          </div>
                          {s.taskTitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.taskTitle}</p>}
                        </div>
                        {s.projectName && <div className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: s.projectColor }}>{s.projectName}</div>}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 项目分布 + 任务 */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-purple-500" />项目时间分布</CardTitle>
                <CardDescription>各项目当日的专注时长</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyStats.dayProjectBreakdown.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p> : (
                  <div className="space-y-3">
                    {dailyStats.dayProjectBreakdown.map(p => {
                      const pct = totalProjectMinutes > 0 ? (p.minutes / totalProjectMinutes) * 100 : 0
                      const projectDef = allProjects.find(pr => pr.name === p.name)
                      const budget = projectDef?.budgetMinutes
                      const weekMinutes = Math.round(weekProjectMinutes[p.name] ?? 0)
                      const budgetPct = budget ? Math.min(100, (weekMinutes / budget) * 100) : null
                      const overBudget = budget !== undefined && weekMinutes > budget
                      return (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                              <span className="font-medium truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">· {p.sessions} 个番茄</span>
                            </div>
                            <div className="flex items-baseline gap-1 shrink-0">
                              <span className="font-semibold tabular-nums">{p.minutes}</span>
                              <span className="text-[10px] text-muted-foreground">m</span>
                              <span className="text-xs text-muted-foreground ml-1">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                          </div>
                          {budget !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                周预算 {weekMinutes}/{budget} 分钟
                              </span>
                              <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', overBudget ? 'bg-destructive' : 'bg-chart-2/70')}
                                  style={{ width: `${budgetPct}%` }}
                                />
                              </div>
                              {overBudget && <span className="text-[10px] text-destructive shrink-0">超预算</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-amber-500" />任务投入</CardTitle>
                <CardDescription>当日投入专注的任务</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyStats.dayTasks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">暂无任务</p> : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {dailyStats.dayTasks.map(t => {
                      const priorityColor = t.priority === 'urgent' ? 'text-rose-500' : t.priority === 'high' ? 'text-amber-500' : t.priority === 'medium' ? 'text-blue-500' : 'text-slate-400'
                      return (
                        <div key={t.id} className="flex items-center gap-3 rounded-lg border p-2.5 hover:border-primary/30 transition-colors">
                          <div className={cn('h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center', t.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40')}>
                            {t.completed && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium truncate', t.completed && 'line-through text-muted-foreground')}>{t.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn('text-[10px] font-medium uppercase', priorityColor)}>{t.priority}</span>
                              {t.projectName && <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.projectColor }} /><span className="text-[10px] text-muted-foreground">{t.projectName}</span></div>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">{t.focusedMinutes}</p>
                            <p className="text-[10px] text-muted-foreground">分钟</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 对比分析 */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><Quote className="h-5 w-5 rotate-180 text-blue-500" />较昨日对比</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">昨日专注</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{dailyStats.prevDayMinutes}<span className="text-sm font-normal text-muted-foreground ml-1" style={{ fontFamily: 'var(--font-sans)' }}>分钟</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">变化</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      {dailyStats.focusVsYesterday > 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : dailyStats.focusVsYesterday < 0 ? <ArrowDownRight className="h-5 w-5 text-rose-500" /> : <Minus className="h-5 w-5 text-muted-foreground" />}
                      <span className={cn('text-2xl font-bold tabular-nums', dailyStats.focusVsYesterday > 0 ? 'text-emerald-500' : dailyStats.focusVsYesterday < 0 ? 'text-rose-500' : 'text-muted-foreground')} style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                        {dailyStats.focusVsYesterday > 0 ? '+' : ''}{dailyStats.focusVsYesterday}%
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                  {dailyStats.focusVsYesterday > 20 ? '🔥 表现远超昨日，保持这股势头！' : dailyStats.focusVsYesterday > 0 ? '✨ 比昨天进步了一点点' : dailyStats.focusVsYesterday < -20 ? '📉 状态有所下滑，明天调整一下节奏' : dailyStats.focusVsYesterday < 0 ? '💪 略低于昨日，继续加油' : '📊 与昨日持平'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple-500" />较 7 日均值</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">近 6 日均值</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{dailyStats.weekAvgMinutes}<span className="text-sm font-normal text-muted-foreground ml-1" style={{ fontFamily: 'var(--font-sans)' }}>分钟</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">对比</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      {dailyStats.focusVsWeekAvg > 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-500" /> : dailyStats.focusVsWeekAvg < 0 ? <ArrowDownRight className="h-5 w-5 text-rose-500" /> : <Minus className="h-5 w-5 text-muted-foreground" />}
                      <span className={cn('text-2xl font-bold tabular-nums', dailyStats.focusVsWeekAvg > 0 ? 'text-emerald-500' : dailyStats.focusVsWeekAvg < 0 ? 'text-rose-500' : 'text-muted-foreground')} style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                        {dailyStats.focusVsWeekAvg > 0 ? '+' : ''}{dailyStats.focusVsWeekAvg}%
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                  {dailyStats.focusVsWeekAvg > 30 ? '🚀 高于周均 30% 以上，状态极佳' : dailyStats.focusVsWeekAvg > 0 ? '👍 略高于本周平均水平' : dailyStats.focusVsWeekAvg < -30 ? '🌧 远低于周均，注意休息调整' : '📈 接近本周平均水平'}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ============ 单日指标卡片 ============

function DayMetricCard({ icon: Icon, label, value, unit, trend, subtext, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  unit: string
  trend?: number
  subtext?: string
  color: 'blue' | 'emerald' | 'amber' | 'cyan' | 'rose'
}) {
  const colorMap = {
    blue: { border: 'border-blue-500/20', bg: 'bg-blue-500/10', text: 'text-blue-500', gradient: 'from-blue-500/5' },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-500', gradient: 'from-emerald-500/5' },
    amber: { border: 'border-amber-500/20', bg: 'bg-amber-500/10', text: 'text-amber-500', gradient: 'from-amber-500/5' },
    cyan: { border: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-500', gradient: 'from-cyan-500/5' },
    rose: { border: 'border-rose-500/20', bg: 'bg-rose-500/10', text: 'text-rose-500', gradient: 'from-rose-500/5' },
  }
  const c = colorMap[color]

  return (
    <Card className={cn('relative overflow-hidden group hover:shadow-lg transition-all duration-300', c.border)}>
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', c.gradient)} />
      <CardContent className="relative p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={cn('rounded-lg p-1.5', c.bg)}><Icon className={cn('h-4 w-4', c.text)} /></div>
          {typeof trend === 'number' && trend !== 0 && (
            <div className={cn('flex items-center gap-0.5 text-[10px] font-medium', trend > 0 ? 'text-emerald-500' : 'text-rose-500')}>
              {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
          {value}<span className="text-xs font-normal text-muted-foreground ml-0.5" style={{ fontFamily: 'var(--font-sans)' }}>{unit}</span>
        </p>
        {subtext && <p className="text-[10px] text-muted-foreground mt-1 truncate">{subtext}</p>}
      </CardContent>
    </Card>
  )
}

// ============ 单日迷你统计 ============

function DayMiniStat({ icon: Icon, label, value, unit }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-md bg-muted p-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
          {value}{unit && <span className="text-[10px] text-muted-foreground ml-0.5" style={{ fontFamily: 'var(--font-sans)' }}>{unit}</span>}
        </p>
      </div>
    </div>
  )
}
