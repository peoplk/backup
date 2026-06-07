'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type HeatmapDay =
  | { kind: 'data'; date: Date; count: number; totalMinutes: number; level: number }
  | { kind: 'empty'; date: null }

type HeatmapWeek = HeatmapDay[]

export function FocusHeatmap() {
  const { pomodoroSessions, timeEntries } = useAppStore(
    useShallow((state) => ({
      pomodoroSessions: state.pomodoroSessions,
      timeEntries: state.timeEntries,
    }))
  )

  const toDate = (date: Date | string): Date => {
    return date instanceof Date ? date : new Date(date)
  }

  const heatmapData = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 365)

    const dataMap = new Map<string, { count: number; totalMinutes: number }>()

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dataMap.set(dateStr, { count: 0, totalMinutes: 0 })
    }

    pomodoroSessions.forEach(session => {
      const dateStr = toDate(session.completedAt).toISOString().split('T')[0]
      if (dataMap.has(dateStr) && session.type === 'work') {
        const current = dataMap.get(dateStr)!
        current.count++
        current.totalMinutes += Math.round(session.duration / 60)
        dataMap.set(dateStr, current)
      }
    })

    timeEntries.forEach(entry => {
      const dateStr = toDate(entry.startTime).toISOString().split('T')[0]
      if (dataMap.has(dateStr)) {
        const current = dataMap.get(dateStr)!
        current.totalMinutes += Math.round(entry.duration / 60)
        dataMap.set(dateStr, current)
      }
    })

    const allValues = Array.from(dataMap.values()).map(d => d.totalMinutes)
    const maxVal = Math.max(...allValues, 1)

    const result: HeatmapData[] = []

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const data = dataMap.get(dateStr) || { count: 0, totalMinutes: 0 }

      let level = 0
      if (data.totalMinutes > 0) {
        const ratio = data.totalMinutes / maxVal
        if (ratio >= 0.75) level = 4
        else if (ratio >= 0.5) level = 3
        else if (ratio >= 0.25) level = 2
        else level = 1
      }

      result.push({
        date: new Date(d),
        count: data.count,
        totalMinutes: data.totalMinutes,
        level
      })
    }

    return result
  }, [pomodoroSessions, timeEntries])

  const weeks = useMemo<HeatmapWeek[]>(() => {
    const weeksArray: HeatmapWeek[] = []
    let currentWeek: HeatmapWeek = []

    heatmapData.forEach((day, index) => {
      const dayOfWeek = day.date.getDay()

      if (index === 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push({ kind: 'empty', date: null })
        }
      }

      currentWeek.push({ kind: 'data', date: day.date, count: day.count, totalMinutes: day.totalMinutes, level: day.level })

      if (dayOfWeek === 6 || index === heatmapData.length - 1) {
        while (currentWeek.length < 7) {
          currentWeek.push({ kind: 'empty', date: null })
        }
        weeksArray.push(currentWeek)
        currentWeek = []
      }
    })

    return weeksArray
  }, [heatmapData])

  const stats = useMemo(() => {
    const totalDays = heatmapData.filter(d => d.totalMinutes > 0).length
    const totalMinutes = heatmapData.reduce((acc, d) => acc + d.totalMinutes, 0)
    const avgMinutes = totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
    const currentStreak = calculateCurrentStreak(heatmapData)
    const longestStreak = calculateLongestStreak(heatmapData)

    return {
      totalDays,
      totalHours: Math.round(totalMinutes / 60),
      avgMinutes,
      currentStreak,
      longestStreak
    }
  }, [heatmapData])

  const levelColors = [
    'bg-muted/30',
    'bg-chart-1/20',
    'bg-chart-1/40',
    'bg-chart-1/60',
    'bg-chart-1/80',
  ]

  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = []
    weeks.forEach((week, index) => {
      const firstDay = week.find(d => d.kind === 'data')
      if (firstDay && firstDay.kind === 'data') {
        const month = firstDay.date.getMonth()
        const prevWeek = weeks[index - 1]
        const prevFirstDay = prevWeek?.find(d => d.kind === 'data')
        const prevMonth = prevFirstDay && prevFirstDay.kind === 'data' ? prevFirstDay.date.getMonth() : -1
        if (index === 0 || prevMonth !== month) {
          labels.push({ weekIndex: index, label: `${month + 1}月` })
        }
      }
    })
    return labels
  }, [weeks])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            🎯 专注热力图
          </CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>连续 <strong className="text-chart-1">{stats.currentStreak}</strong> 天</span>
            <span>最长 <strong className="text-chart-2">{stats.longestStreak}</strong> 天</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="overflow-x-auto pb-2">
            <div className="inline-flex gap-[3px] min-w-max">
              <div className="flex flex-col gap-[3px] mr-2 text-xs text-muted-foreground pt-4">
                {['一', '三', '五'].map((day, i) => (
                  <div key={i} style={{ height: 12 + i * 14 }} className="leading-[14px]">
                    {day}
                  </div>
                ))}
              </div>

              <div className="flex gap-[3px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[3px]">
                    {monthLabels.find(l => l.weekIndex === weekIndex) && (
                      <div className="col-span-7 text-xs text-muted-foreground mb-1 h-3">
                        {monthLabels.find(l => l.weekIndex === weekIndex)?.label}
                      </div>
                    )}
                    {week.map((day, dayIndex) => {
                      if (day.kind === 'empty') {
                        return <div key={dayIndex} className="w-3 h-3 rounded-sm" />
                      }

                      const isToday = day.date.toDateString() === new Date().toDateString()

                      return (
                        <Tooltip key={dayIndex}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'w-3 h-3 rounded-sm transition-all hover:ring-1 ring-ring cursor-pointer',
                                levelColors[day.level],
                                isToday && 'ring-1 ring-primary ring-offset-1'
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">
                              {day.date.toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p>{day.count} 个番茄钟 · {day.totalMinutes} 分钟专注</p>
                            {day.level >= 4 && <p className="text-chart-1 mt-1">🔥 高效日！</p>}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>少</span>
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  className={cn('w-3 h-3 rounded-sm', levelColors[level])}
                />
              ))}
              <span>多</span>
            </div>
            <div className="flex gap-4">
              <span>共 <strong className="text-foreground">{stats.totalDays}</strong> 天活跃</span>
              <span><strong className="text-foreground">{stats.totalHours}</strong> 小时</span>
              <span>日均 <strong className="text-foreground">{stats.avgMinutes}</strong> 分钟</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

interface HeatmapData {
  date: Date
  count: number
  totalMinutes: number
  level: number
}

function calculateCurrentStreak(data: HeatmapData[]): number {
  if (data.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let cursor = new Date(today)

  for (let attempt = 0; attempt < data.length; attempt++) {
    const cursorStr = cursor.toDateString()
    const day = data.find((d) => d.date.toDateString() === cursorStr)

    if (day && day.totalMinutes > 0) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else if (attempt === 0) {
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

function calculateLongestStreak(data: HeatmapData[]): number {
  let maxStreak = 0
  let currentStreak = 0

  data.forEach(day => {
    if (day.totalMinutes > 0) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  })

  return maxStreak
}
