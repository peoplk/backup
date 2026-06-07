'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Target, Flame, Clock, Sparkles, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyGoalRingProps {
  className?: string
  /** 紧凑模式：仅一个圆环 + 当前/目标 */
  compact?: boolean
}

const SIZE = 156
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

export function DailyGoalRing({ className, compact = false }: DailyGoalRingProps) {
  const { focusGoals, pomodoroSessions } = useAppStore(
    useShallow((s) => ({ focusGoals: s.focusGoals, pomodoroSessions: s.pomodoroSessions }))
  )

  const todayStats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()

    const workToday = pomodoroSessions.filter((s) => {
      if (s.type !== 'work') return false
      return new Date(s.completedAt).getTime() >= todayMs
    })
    const count = workToday.length
    const minutes = Math.round(workToday.reduce((acc, s) => acc + s.duration / 60, 0))
    return { count, minutes }
  }, [pomodoroSessions])

  const pomodoroTarget = Math.max(1, focusGoals.dailyPomodoros)
  const minuteTarget = Math.max(1, focusGoals.dailyMinutes)

  const pomodoroRatio = Math.min(1, todayStats.count / pomodoroTarget)
  const minuteRatio = Math.min(1, todayStats.minutes / minuteTarget)
  // 综合进度 = 番茄数权重 0.6 + 分钟权重 0.4
  const overallRatio = pomodoroRatio * 0.6 + minuteRatio * 0.4
  const overallPercent = Math.round(overallRatio * 100)

  const pomodoroOffset = CIRC * (1 - pomodoroRatio)
  const minuteOffset = CIRC * (1 - minuteRatio)

  const isComplete = overallRatio >= 1
  const pomodoroComplete = todayStats.count >= pomodoroTarget
  const minuteComplete = todayStats.minutes >= minuteTarget

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="relative" style={{ width: 60, height: 60 }}>
          <svg width={60} height={60} className="-rotate-90">
            <circle cx={30} cy={30} r={26} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted" />
            <circle
              cx={30}
              cy={30}
              r={26}
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - overallRatio)}
              className={cn(
                'transition-all duration-500',
                isComplete ? 'text-amber-500' : 'text-primary'
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold tabular-nums">{overallPercent}%</span>
          </div>
        </div>
        <div className="text-xs leading-tight">
          <div className="font-medium">今日目标</div>
          <div className="text-muted-foreground tabular-nums">
            {todayStats.count}/{pomodoroTarget} 番茄
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {/* 背景环 */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-muted/30"
          />
          {/* 外环：番茄数（蓝色） */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={pomodoroOffset}
            className={cn(
              'transition-all duration-700',
              pomodoroComplete ? 'text-emerald-500' : 'text-primary'
            )}
          />
          {/* 内环：分钟（琥珀色 80% 半径） */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS * 0.72}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE * 0.6}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * RADIUS * 0.72}
            strokeDashoffset={minuteOffset * 0.72}
            className={cn(
              'transition-all duration-700',
              minuteComplete ? 'text-emerald-500' : 'text-amber-500'
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isComplete ? (
            <>
              <Trophy className="h-5 w-5 text-amber-500 mb-0.5" />
              <span className="text-lg font-bold tabular-nums">{overallPercent}%</span>
              <span className="text-[10px] text-muted-foreground">已达成</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold tabular-nums">{overallPercent}%</span>
              <span className="text-[10px] text-muted-foreground">今日目标</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-center text-xs">
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>番茄</span>
          </div>
          <div className="font-semibold tabular-nums">
            {todayStats.count}
            <span className="text-muted-foreground"> / {pomodoroTarget}</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>分钟</span>
          </div>
          <div className="font-semibold tabular-nums">
            {todayStats.minutes}
            <span className="text-muted-foreground"> / {minuteTarget}</span>
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="mt-3 flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Sparkles className="h-3 w-3" />
          今日目标已达成，干得漂亮
        </div>
      )}
    </div>
  )
}
