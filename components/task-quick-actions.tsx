'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Pause,
  Timer,
  Flame,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimeRemaining } from '@/lib/format'

interface TaskQuickActionsProps {
  taskId: string
  compact?: boolean
}

export function TaskQuickActions({ taskId, compact = false }: TaskQuickActionsProps) {
  const {
    tasks,
    pomodoroTimerState,
    updatePomodoroTimerState,
    activeTimeEntry,
    startTimeEntry,
    stopTimeEntry,
    setActiveView,
  } = useAppStore()

  const task = tasks.find(t => t.id === taskId)
  if (!task) return null

  const isPomodoroSelected = pomodoroTimerState.selectedTaskId === taskId
  const isPomodoroRunning = pomodoroTimerState.isRunning && isPomodoroSelected
  const isTracking = activeTimeEntry?.taskId === taskId

  const handleStartPomodoro = (e: React.MouseEvent) => {
    e.stopPropagation()
    // 先设置番茄钟状态并关联任务
    updatePomodoroTimerState({
      selectedTaskId: taskId,
      mode: 'work',
      timeLeft: useAppStore.getState().pomodoroSettings.workDuration,
      isRunning: true,
    })
    // 然后跳转到专注页面
    setActiveView('focus')
  }

  const handleTogglePomodoro = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPomodoroRunning) {
      // 暂停时只更新状态，不跳转
      updatePomodoroTimerState({ isRunning: false })
    } else {
      // 继续时恢复运行并跳转到专注页面
      updatePomodoroTimerState({ isRunning: true })
      setActiveView('focus')
    }
  }

  const handleStartTimer = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTracking) {
      stopTimeEntry()
    } else {
      startTimeEntry({
        project: task.project || '',
        description: task.title,
        tags: task.tags,
        taskId: taskId,
      })
    }
  }

  const handleGoToFocus = (e: React.MouseEvent) => {
    e.stopPropagation()
    updatePomodoroTimerState({ selectedTaskId: taskId })
    setActiveView('focus')
  }

  const pomodoroProgress = task.estimatedPomodoros
    ? (task.completedPomodoros / task.estimatedPomodoros) * 100
    : 0

  const isCompleted = task.completedPomodoros >= (task.estimatedPomodoros || Infinity)

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {task.estimatedPomodoros && task.estimatedPomodoros > 0 && (
          <Badge
            variant={isCompleted ? 'default' : 'outline'}
            className={cn(
              'text-[10px] gap-0.5 px-1.5 py-0 h-5',
              isCompleted && 'bg-chart-2 text-white'
            )}
          >
            <Flame className="h-3 w-3" />
            {task.completedPomodoros}/{task.estimatedPomodoros}
          </Badge>
        )}
        {isPomodoroSelected && (
          <Button
            variant={isPomodoroRunning ? 'destructive' : 'default'}
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleTogglePomodoro}
          >
            {isPomodoroRunning ? (
              <>
                <Pause className="h-3 w-3" />
                {formatTimeRemaining(pomodoroTimerState.timeLeft)}
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                继续
              </>
            )}
          </Button>
        )}
        {!isPomodoroSelected && !isTracking && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleStartPomodoro}
          >
            <Timer className="h-3 w-3" />
            专注
          </Button>
        )}
        {isTracking && (
          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 h-5 animate-pulse bg-chart-2/10 text-chart-2 border-chart-2/30">
            <Clock className="h-3 w-3" />
            计时中
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      {task.estimatedPomodoros && task.estimatedPomodoros > 0 && (
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">番茄钟进度</span>
            <span className="text-xs font-medium">
              {task.completedPomodoros}/{task.estimatedPomodoros}
            </span>
          </div>
          <Progress
            value={pomodoroProgress}
            className={cn('h-1.5', isCompleted && '[&>div]:bg-chart-2')}
          />
          {isCompleted && !task.status.includes('done') && (
            <p className="text-[10px] text-chart-2 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              已完成预估番茄钟，可以标记完成了
            </p>
          )}
        </div>
      )}
      
      <div className="flex gap-1">
        {isPomodoroSelected ? (
          <Button
            variant={isPomodoroRunning ? 'destructive' : 'default'}
            size="sm"
            className="gap-1.5"
            onClick={handleTogglePomodoro}
          >
            {isPomodoroRunning ? (
              <>
                <Pause className="h-4 w-4" />
                暂停
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                继续
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleStartPomodoro}
            disabled={pomodoroTimerState.isRunning}
          >
            <Timer className="h-4 w-4" />
            开始专注
          </Button>
        )}
        
        <Button
          variant={isTracking ? 'destructive' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={handleStartTimer}
          disabled={!!activeTimeEntry && !isTracking}
        >
          {isTracking ? (
            <>
              <Pause className="h-4 w-4" />
              停止
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              计时
            </>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoToFocus}
        >
          详情
        </Button>
      </div>
    </div>
  )
}