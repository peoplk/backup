'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Timer,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskEfficiencyCardProps {
  taskId: string
  className?: string
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function TaskEfficiencyCard({ taskId, className }: TaskEfficiencyCardProps) {
  const { task, timeEntries } = useAppStore((s) => {
    const t = s.tasks.find((x) => x.id === taskId)
    const entries = t ? s.timeEntries.filter((e) => e.taskId === taskId) : []
    return { task: t, timeEntries: entries }
  })

  const stats = useMemo(() => {
    if (!task) return null
    const completed = task.completedPomodoros || 0
    const estimated = task.estimatedPomodoros || 0
    const timeSpent = task.timeSpent || 0
    const actualMinutes = timeSpent / 60
    const estimatedMinutes = estimated * 25
    const efficiency = estimatedMinutes > 0 ? (estimatedMinutes / Math.max(1, actualMinutes)) * 100 : 0
    const overdue = estimated > 0 && completed > estimated
    const avgSession = completed > 0 ? actualMinutes / completed : 0

    let rating: 'over' | 'efficient' | 'normal' | 'slow' = 'normal'
    if (estimated > 0) {
      if (actualMinutes > estimatedMinutes * 1.2) rating = 'slow'
      else if (actualMinutes < estimatedMinutes * 0.8) rating = 'efficient'
      else if (actualMinutes > estimatedMinutes) rating = 'over'
    }

    return {
      completed,
      estimated,
      timeSpent,
      actualMinutes,
      estimatedMinutes,
      efficiency,
      overdue,
      avgSession,
      rating,
      timeEntries: timeEntries.length,
    }
  }, [task, timeEntries])

  if (!task || !stats) return null

  const completionPct = stats.estimated > 0
    ? Math.min(100, Math.round((stats.completed / stats.estimated) * 100))
    : 0

  return (
    <Card className={cn('border-border/40', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4" />
          任务效率分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 番茄数进度 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3 w-3" />
              番茄进度
            </span>
            <span className="font-medium tabular-nums">
              {stats.completed} / {stats.estimated || '—'}
            </span>
          </div>
          <Progress value={completionPct} className="h-1.5" />
          {stats.overdue && (
            <div className="flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-3 w-3" />
              已超出预估 {stats.completed - stats.estimated} 个番茄
            </div>
          )}
        </div>

        {/* 时间投入 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <div className="flex items-center gap-1 text-2xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              实际投入
            </div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">
              {formatDuration(stats.timeSpent)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <div className="flex items-center gap-1 text-2xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              预估时长
            </div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">
              {stats.estimated > 0 ? formatDuration(stats.estimated * 25 * 60) : '—'}
            </div>
          </div>
        </div>

        {/* 效率评级 */}
        {stats.estimated > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 p-2.5">
            <div className="flex items-center gap-2">
              {stats.rating === 'efficient' ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-2xs">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  比预估快
                </Badge>
              ) : stats.rating === 'over' || stats.rating === 'slow' ? (
                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-2xs">
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                  {stats.rating === 'slow' ? '超出较多' : '略超预估'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-2xs">
                  接近预估
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              平均 {stats.avgSession.toFixed(1)} m / 番茄
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
