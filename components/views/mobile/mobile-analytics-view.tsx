'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { MobileStatCard } from '@/components/mobile/mobile-stat-card'
import { Timer, CheckCircle2, Flame, Activity, Clock, Calendar, Target, Award, Zap, TrendingUp, Brain, Trophy, BarChart3, PieChart, LineChart } from 'lucide-react'

type TimeRange = 'week' | 'month' | 'year'
type ChartType = 'bar' | 'line' | 'pie'
const RANGE_LABELS: Record<TimeRange, string> = { week: '周', month: '月', year: '年' }
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEK_DAYS_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function getRangeStart(range: TimeRange): Date {
  const d = new Date()
  if (range === 'week') { d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)) }
  else if (range === 'month') { d.setDate(d.getDate() - 30) }
  else { d.setDate(d.getDate() - 365) }
  d.setHours(0, 0, 0, 0)
  return d
}

function calcStreak(allWorkSessions: { completedAt: Date | string }[]): number {
  const dates = [...new Set(allWorkSessions.map(s => new Date(s.completedAt).toDateString()))]
  let streak = 0
  const checkDate = new Date()
  for (let i = 0; i < 365; i++) {
    const ds = checkDate.toDateString()
    if (dates.includes(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1) }
    else if (i === 0) { checkDate.setDate(checkDate.getDate() - 1); if (dates.includes(checkDate.toDateString())) { streak++; checkDate.setDate(checkDate.getDate() - 1) } else break }
    else break
  }
  return streak
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

export function MobileAnalyticsView() {
  const { pomodoroSessions, tasks, habits, habitCheckIns, projects, achievements, userLevel } = useAppStore(
    useShallow(s => ({
      pomodoroSessions: s.pomodoroSessions, tasks: s.tasks, habits: s.habits,
      habitCheckIns: s.habitCheckIns, projects: s.projects, achievements: s.achievements, userLevel: s.userLevel,
    }))
  )

  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const rangeStart = useMemo(() => getRangeStart(timeRange), [timeRange])

  const summaryStats = useMemo(() => {
    const workInRange = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart)
    const totalFocusSeconds = workInRange.reduce((a, s) => a + s.duration, 0)
    const completedTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt) >= rangeStart && t.status === 'done').length
    const streak = calcStreak(pomodoroSessions.filter(s => s.type === 'work'))
    const focusScore = Math.min(100, (totalFocusSeconds / 60 / 480) * 100)
    const taskScore = Math.min(100, (completedTasks / 35) * 100)
    const streakScore = Math.min(100, (streak / 7) * 100)
    const activeHabits = habits.filter(h => !h.archived).length
    const habitCheckInsCount = habitCheckIns.filter(c => new Date(c.date) >= rangeStart && c.completed).length
    const daysInRange = Math.max(1, Math.ceil((Date.now() - rangeStart.getTime()) / 86400000))
    const habitScore = activeHabits > 0 ? Math.min(100, (habitCheckInsCount / (activeHabits * daysInRange)) * 100) : 0
    return { totalFocusHours: (totalFocusSeconds / 3600).toFixed(1), completedTasks, streak, efficiencyScore: Math.round((focusScore + taskScore + streakScore + habitScore) / 4) }
  }, [pomodoroSessions, tasks, habits, habitCheckIns, rangeStart])

  const focusTrendData = useMemo(() => {
    const workInRange = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart)
    const result: { label: string; minutes: number; isToday?: boolean }[] = []

    if (timeRange === 'year') {
      const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
      const yr = new Date().getFullYear()
      months.forEach((label, mi) => {
        const mins = Math.round(workInRange.filter(s => new Date(s.completedAt).getMonth() === mi).reduce((a, s) => a + s.duration, 0) / 60)
        result.push({ label, minutes: mins })
      })
    } else {
      const days = timeRange === 'week' ? 7 : 30
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
        const dStr = d.toDateString()
        const mins = Math.round(workInRange.filter(s => new Date(s.completedAt).toDateString() === dStr).reduce((a, s) => a + s.duration, 0) / 60)
        const label = timeRange === 'week' ? WEEK_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1] : `${d.getMonth() + 1}/${d.getDate()}`
        result.push({ label, minutes: mins, isToday: i === 0 })
      }
    }
    return result
  }, [pomodoroSessions, timeRange, rangeStart])

  const focusPieData = useMemo(() => {
    const workInRange = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart)
    const byDayType: Record<string, number> = { '工作日': 0, '周末': 0 }
    const byPeriod: Record<string, number> = { '早晨(6-12)': 0, '下午(12-18)': 0, '晚上(18-24)': 0, '深夜(0-6)': 0 }
    const byTask: Record<string, number> = {}

    workInRange.forEach(s => {
      const d = new Date(s.completedAt)
      const day = d.getDay()
      const mins = s.duration / 60
      byDayType[day === 0 || day === 6 ? '周末' : '工作日'] += mins
      const h = d.getHours()
      if (h >= 6 && h < 12) byPeriod['早晨(6-12)'] += mins
      else if (h >= 12 && h < 18) byPeriod['下午(12-18)'] += mins
      else if (h >= 18 && h < 24) byPeriod['晚上(18-24)'] += mins
      else byPeriod['深夜(0-6)'] += mins
      if (s.taskId) {
        const task = tasks.find(t => t.id === s.taskId)
        const name = task?.title || '其他任务'
        byTask[name] = (byTask[name] || 0) + mins
      } else {
        byTask['无关联任务'] = (byTask['无关联任务'] || 0) + mins
      }
    })

    const toPieItems = (obj: Record<string, number>) =>
      Object.entries(obj).filter(([, v]) => v > 0).map(([name, mins], i) => ({
        name, minutes: Math.round(mins), color: PIE_COLORS[i % PIE_COLORS.length],
        percent: 0,
      }))

    const dayItems = toPieItems(byDayType)
    const periodItems = toPieItems(byPeriod)
    const taskItems = toPieItems(byTask)

    const calcPercent = (items: typeof dayItems) => {
      const total = items.reduce((a, b) => a + b.minutes, 0)
      return items.map(it => ({ ...it, percent: total > 0 ? Math.round((it.minutes / total) * 100) : 0 }))
    }

    return {
      byDayType: calcPercent(dayItems),
      byPeriod: calcPercent(periodItems),
      byTask: calcPercent(taskItems.slice(0, 6)),
    }
  }, [pomodoroSessions, tasks, rangeStart])

  const hourlyDistribution = useMemo(() => {
    const hc: Record<number, number> = {}
    for (let i = 0; i < 24; i++) hc[i] = 0
    pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart).forEach(s => { hc[new Date(s.completedAt).getHours()] += s.duration / 60 })
    return Object.entries(hc).map(([h, m]) => ({ hour: parseInt(h), label: h.padStart(2, '0'), minutes: Math.round(m) }))
  }, [pomodoroSessions, rangeStart])

  const projectBreakdown = useMemo(() => {
    if (!projects.length) return []
    const total = projects.reduce((a, p) => a + p.totalTime, 0)
    return projects.map(p => ({ id: p.id, name: p.name, color: p.color, totalTime: p.totalTime, percent: total > 0 ? Math.round((p.totalTime / total) * 100) : 0, hours: (p.totalTime / 3600).toFixed(1) })).sort((a, b) => b.totalTime - a.totalTime)
  }, [projects])

  const insights = useMemo(() => {
    const workInRange = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= rangeStart)
    const hc: Record<number, number> = {}; for (let i = 0; i < 24; i++) hc[i] = 0
    workInRange.forEach(s => { hc[new Date(s.completedAt).getHours()] += s.duration })
    const bestHour = Object.entries(hc).sort((a, b) => b[1] - a[1])[0]
    const dc: Record<string, number> = {}; WEEK_DAYS_FULL.forEach(d => dc[d] = 0)
    workInRange.forEach(s => { dc[WEEK_DAYS_FULL[new Date(s.completedAt).getDay()]] += s.duration })
    const activeHabits = habits.filter(h => !h.archived).length
    const habitCount = habitCheckIns.filter(c => new Date(c.date) >= rangeStart && c.completed).length
    const daysInRange = Math.max(1, Math.ceil((Date.now() - rangeStart.getTime()) / 86400000))
    return {
      bestHour: bestHour ? `${parseInt(bestHour[0]).toString().padStart(2, '0')}:00` : '-',
      bestDay: Object.entries(dc).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
      habitRate: activeHabits > 0 ? Math.min(100, Math.round((habitCount / (activeHabits * daysInRange)) * 100)) : 0,
    }
  }, [pomodoroSessions, habits, habitCheckIns, rangeStart])

  const achievementBadges = useMemo(() => {
    const ws = pomodoroSessions.filter(s => s.type === 'work')
    const earlyBirdDays = new Set(ws.filter(s => new Date(s.completedAt).getHours() < 7).map(s => new Date(s.completedAt).toDateString())).size
    const todayPomodoros = ws.filter(s => new Date(s.completedAt).toDateString() === new Date().toDateString()).length
    const streak = calcStreak(ws)
    const completedTasks = tasks.filter(t => t.status === 'done').length
    const efficiency = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
    const totalFocusMinutes = ws.reduce((a, s) => a + s.duration, 0) / 60
    const badges = [
      { name: '早起鸟', desc: '5天7点前专注', icon: Zap, earned: earlyBirdDays >= 5, progress: Math.min((earlyBirdDays / 5) * 100, 100), color: '#F5A623' },
      { name: '专注大师', desc: '单日8个番茄钟', icon: Timer, earned: todayPomodoros >= 8, progress: Math.min((todayPomodoros / 8) * 100, 100), color: '#4A90E2' },
      { name: '周冠军', desc: '连续7天专注', icon: Award, earned: streak >= 7, progress: Math.min((streak / 7) * 100, 100), color: '#7ED321' },
      { name: '效率之星', desc: '效率达95%', icon: TrendingUp, earned: efficiency >= 95, progress: Math.min((efficiency / 95) * 100, 100), color: '#9B59B6' },
      { name: '百钟达人', desc: '累计100个番茄钟', icon: Trophy, earned: ws.length >= 100, progress: Math.min((ws.length / 100) * 100, 100), color: '#E91E63' },
      { name: '千分专注', desc: '累计1000分钟专注', icon: Flame, earned: totalFocusMinutes >= 1000, progress: Math.min((totalFocusMinutes / 1000) * 100, 100), color: '#FF5722' },
    ]
    achievements?.forEach(a => { if (!badges.find(b => b.name === a.name)) badges.push({ name: a.name, desc: a.description, icon: Award, earned: a.earned, progress: a.progress * 100, color: '#00CED1' }) })
    return badges
  }, [pomodoroSessions, tasks, achievements])

  const maxTrend = Math.max(1, ...focusTrendData.map(d => d.minutes))
  const maxHourly = Math.max(1, ...hourlyDistribution.map(d => d.minutes))

  const renderBarChart = () => (
    <div className="flex items-end gap-1.5 h-32">
      {focusTrendData.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[9px] text-muted-foreground tabular-nums">{d.minutes > 0 ? d.minutes : ''}</span>
          <div className="w-full relative" style={{ height: '80px' }}>
            <div className={cn('absolute bottom-0 w-full rounded-lg transition-all duration-500', d.isToday ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-primary/30')} style={{ height: `${Math.max((d.minutes / maxTrend) * 100, 3)}%` }} />
          </div>
          <span className={cn('text-[9px] truncate w-full text-center', d.isToday ? 'text-primary font-semibold' : 'text-muted-foreground')}>{d.label}</span>
        </div>
      ))}
    </div>
  )

  const renderLineChart = () => {
    const chartH = 120
    const chartW = 300
    const padL = 30
    const padR = 10
    const padT = 10
    const padB = 20
    const plotW = chartW - padL - padR
    const plotH = chartH - padT - padB
    const data = focusTrendData
    const maxVal = Math.max(1, ...data.map(d => d.minutes))
    const points = data.map((d, i) => {
      const x = padL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2)
      const y = padT + plotH - (d.minutes / maxVal) * plotH
      return { x, y, ...d }
    })
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${padT + plotH} Z`

    return (
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-36">
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padT + plotH - ratio * plotH
          const val = Math.round(ratio * maxVal)
          return (
            <g key={ratio}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeDasharray="3 3" />
              <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={7}>{val}</text>
            </g>
          )
        })}
        <path d={areaPath} fill="url(#lineAreaGrad)" />
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.isToday ? 4 : 2.5} fill={p.isToday ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.6)'} stroke="hsl(var(--background))" strokeWidth={1.5} />
            {p.minutes > 0 && (
              <text x={p.x} y={p.y - 7} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>{p.minutes}</text>
            )}
          </g>
        ))}
        {points.filter((_, i) => {
          if (data.length <= 7) return true
          if (data.length <= 15) return i % 2 === 0
          return i % Math.ceil(data.length / 7) === 0
        }).map((p, i) => (
          <text key={i} x={p.x} y={chartH - 2} textAnchor="middle" className={cn('fill-muted-foreground', p.isToday && 'fill-primary font-bold')} fontSize={7}>{p.label}</text>
        ))}
      </svg>
    )
  }

  const renderPieChart = () => {
    const pieCategories = [
      { key: 'byDayType' as const, title: '工作日 vs 周末' },
      { key: 'byPeriod' as const, title: '时段分布' },
      { key: 'byTask' as const, title: '任务分布' },
    ]
    return (
      <div className="space-y-5">
        {pieCategories.map(cat => {
          const items = focusPieData[cat.key]
          if (items.length === 0) return null
          const total = items.reduce((a, b) => a + b.minutes, 0)
          const cx = 60, cy = 60, r = 50
          let cumulativePercent = 0
          const arcs = items.map(item => {
            const startAngle = cumulativePercent * 3.6
            const sweepAngle = item.percent * 3.6
            cumulativePercent += item.percent
            const startRad = (startAngle - 90) * Math.PI / 180
            const endRad = (startAngle + sweepAngle - 90) * Math.PI / 180
            const x1 = cx + r * Math.cos(startRad)
            const y1 = cy + r * Math.sin(startRad)
            const x2 = cx + r * Math.cos(endRad)
            const y2 = cy + r * Math.sin(endRad)
            const largeArc = sweepAngle > 180 ? 1 : 0
            const d = items.length === 1
              ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
              : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
            return { ...item, d }
          })
          return (
            <div key={cat.key}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{cat.title}</p>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
                  {arcs.map((arc, i) => (
                    <path key={i} d={arc.d} fill={arc.color} stroke="hsl(var(--background))" strokeWidth={1.5} />
                  ))}
                  <circle cx={cx} cy={cy} r={28} fill="hsl(var(--background))" />
                  <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground" fontSize={12} fontWeight={700}>{total}</text>
                  <text x={cx} y={cy + 8} textAnchor="middle" className="fill-muted-foreground" fontSize={7}>分钟</text>
                </svg>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs truncate flex-1">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {focusPieData.byDayType.length === 0 && focusPieData.byPeriod.length === 0 && focusPieData.byTask.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/60">
        {(['week', 'month', 'year'] as TimeRange[]).map(r => (
          <button key={r} className={cn('flex-1 py-2 text-sm font-semibold rounded-xl transition-all active:scale-95', timeRange === r ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'text-muted-foreground hover:text-foreground')} onClick={() => setTimeRange(r)}>
            本{RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MobileStatCard icon={Timer} iconBg="bg-blue-500/15" iconColor="text-blue-500" label="专注时长" value={summaryStats.totalFocusHours} suffix="h" />
        <MobileStatCard icon={CheckCircle2} iconBg="bg-emerald-500/15" iconColor="text-emerald-500" label="完成任务" value={summaryStats.completedTasks} suffix="个" />
        <MobileStatCard icon={Flame} iconBg="bg-amber-500/15" iconColor="text-amber-500" label="连续专注" value={summaryStats.streak} suffix="天" />
        <MobileStatCard icon={Activity} iconBg="bg-violet-500/15" iconColor="text-violet-500" label="效率评分" value={summaryStats.efficiencyScore} suffix="%" progress={summaryStats.efficiencyScore} />
      </div>

      <div className="rounded-2xl glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">专注趋势</h3>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50">
            {([
              { type: 'bar' as ChartType, icon: BarChart3, label: '柱状图' },
              { type: 'line' as ChartType, icon: LineChart, label: '折线图' },
              { type: 'pie' as ChartType, icon: PieChart, label: '饼状图' },
            ]).map(opt => (
              <button
                key={opt.type}
                className={cn(
                  'h-7 w-7 rounded-md flex items-center justify-center transition-all active:scale-90',
                  chartType === opt.type ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setChartType(opt.type)}
                title={opt.label}
              >
                <opt.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        {chartType === 'bar' && renderBarChart()}
        {chartType === 'line' && renderLineChart()}
        {chartType === 'pie' && renderPieChart()}
      </div>

      <div className="rounded-2xl glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">时段分布</h3>
        <div className="flex items-end gap-px h-20">
          {hourlyDistribution.map(d => (
            <div key={d.hour} className="flex-1 flex flex-col items-center min-w-0">
              <div className="w-full relative" style={{ height: '56px' }}>
                <div className="absolute bottom-0 w-full rounded-t-sm bg-blue-500/40 transition-all duration-300" style={{ height: `${Math.max((d.minutes / maxHourly) * 100, 2)}%` }} />
              </div>
              {d.hour % 3 === 0 && <span className="text-[8px] text-muted-foreground mt-0.5">{d.label}</span>}
            </div>
          ))}
        </div>
      </div>

      {projectBreakdown.length > 0 && (
        <div className="rounded-2xl glass-card p-4">
          <h3 className="text-sm font-semibold mb-3">项目时间分布</h3>
          <div className="space-y-3">
            {projectBreakdown.map(p => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{p.hours}h</span>
                    <span className="text-[10px] font-medium tabular-nums">{p.percent}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p.percent}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl glass-card p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Brain className="h-4 w-4 text-violet-500" />智能洞察</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-blue-500/5 border border-blue-500/10 p-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-blue-500" /></div>
            <div className="flex-1 min-w-0"><p className="text-[10px] text-muted-foreground">最佳专注时段</p><p className="text-sm font-semibold">{insights.bestHour}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Calendar className="h-4 w-4 text-emerald-500" /></div>
            <div className="flex-1 min-w-0"><p className="text-[10px] text-muted-foreground">最佳工作日</p><p className="text-sm font-semibold">{insights.bestDay}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><Target className="h-4 w-4 text-amber-500" /></div>
            <div className="flex-1 min-w-0"><p className="text-[10px] text-muted-foreground">习惯完成率</p><p className="text-sm font-semibold">{insights.habitRate}%</p></div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl glass-card p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-amber-500" />成就徽章</h3>
        <div className="grid grid-cols-3 gap-2">
          {achievementBadges.map((badge, i) => {
            const Icon = badge.icon
            return (
              <div key={i} className={cn('rounded-xl border p-3 text-center transition-all', badge.earned ? 'border-amber-500/20 bg-amber-500/5' : 'opacity-40 grayscale')}>
                <div className="h-10 w-10 rounded-full mx-auto flex items-center justify-center mb-1.5" style={{ backgroundColor: badge.earned ? `${badge.color}20` : 'rgba(0,0,0,0.05)' }}>
                  <Icon className="h-5 w-5" style={{ color: badge.earned ? badge.color : 'currentColor' }} />
                </div>
                <p className="text-[11px] font-medium truncate">{badge.name}</p>
                <p className="text-[9px] text-muted-foreground truncate">{badge.desc}</p>
                {!badge.earned && <div className="mt-1.5 h-1 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${badge.progress}%`, backgroundColor: badge.color }} /></div>}
                {badge.earned && <span className="text-[9px] text-amber-500 font-medium">已达成</span>}
              </div>
            )
          })}
        </div>
      </div>

      {userLevel && (
        <div className="rounded-2xl glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shadow-sm shadow-amber-500/25">{userLevel.level}</div>
              <div><p className="text-sm font-semibold">{userLevel.title}</p><p className="text-[10px] text-muted-foreground">{userLevel.totalPoints} 总积分</p></div>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{userLevel.currentLevelPoints}/{userLevel.nextLevelPoints}</span>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{ width: `${userLevel.nextLevelPoints > 0 ? Math.min(100, (userLevel.currentLevelPoints / userLevel.nextLevelPoints) * 100) : 0}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
