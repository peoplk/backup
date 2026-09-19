'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { PomodoroSettings, Task, TreeState } from '@/lib/types'
import { Brain, CheckCircle2, Play, Sparkles } from 'lucide-react'

interface TimerSummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'work' | 'short-break' | 'long-break'
  lastSessionDuration: number
  completedSessions: number
  completedSessionsCount: number
  streak: number
  selectedTaskId: string | null
  tasks: Task[]
  pomodoroSettings: PomodoroSettings
  updateTask: (id: string, updates: Partial<Task>) => void
  updatePomodoroTimerState: (updates: Partial<{
    mode: 'work' | 'short-break' | 'long-break'
    timeLeft: number
    isRunning: boolean
    completedSessions: number
    selectedTaskId: string | null
    treeGrowth: number
    treeState: TreeState
    lastSessionDate: string
  }>) => void
}

export function TimerSummaryDialog({
  open,
  onOpenChange,
  mode,
  lastSessionDuration,
  completedSessions,
  completedSessionsCount,
  streak,
  selectedTaskId,
  tasks,
  pomodoroSettings,
  updateTask,
  updatePomodoroTimerState,
}: TimerSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-chart-1" />
            专注完成！
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-center py-4">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-chart-1/20 to-chart-1/5 flex items-center justify-center">
                <Brain className="h-10 w-10 text-chart-1" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-chart-2 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center rounded-xl bg-muted/50 p-3">
              <p className="text-2xl font-bold">{Math.round(lastSessionDuration / 60)}</p>
              <p className="text-xs text-muted-foreground">分钟</p>
            </div>
            <div className="text-center rounded-xl bg-muted/50 p-3">
              <p className="text-2xl font-bold">{completedSessions}</p>
              <p className="text-xs text-muted-foreground">今日番茄钟</p>
            </div>
            <div className="text-center rounded-xl bg-muted/50 p-3">
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-xs text-muted-foreground">连续天数</p>
            </div>
          </div>
          {selectedTaskId && (() => {
            const task = tasks.find(t => t.id === selectedTaskId)
            if (!task) return null
            const isTaskComplete = task.estimatedPomodoros && task.completedPomodoros >= task.estimatedPomodoros
            return (
              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">关联任务</p>
                  {isTaskComplete && task.status !== 'done' && (
                    <Badge className="bg-chart-2 text-2xs">可完成</Badge>
                  )}
                </div>
                <p className="font-medium text-sm">{task.title}</p>
                {task.estimatedPomodoros && (
                  <div className="flex items-center gap-2 mt-2">
                    <Progress
                      value={(task.completedPomodoros / task.estimatedPomodoros) * 100}
                      className="h-1.5 flex-1"
                    />
                    <span className="text-xs text-muted-foreground">
                      {task.completedPomodoros}/{task.estimatedPomodoros}
                    </span>
                  </div>
                )}
                {isTaskComplete && task.status !== 'done' && (
                  <Button
                    size="sm"
                    className="w-full mt-3 gap-1.5"
                    onClick={() => {
                      updateTask(selectedTaskId, { status: 'done', completedAt: new Date() })
                      updatePomodoroTimerState({ selectedTaskId: null })
                      onOpenChange(false)
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    标记任务完成
                  </Button>
                )}
              </div>
            )
          })()}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => {
                // "继续专注"：跳过休息直接切回工作模式并启动
                updatePomodoroTimerState({
                  mode: 'work',
                  timeLeft: pomodoroSettings.workDuration,
                  isRunning: true,
                })
                onOpenChange(false)
              }}
            >
              <Play className="h-4 w-4" />
              继续专注
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                // "休息一下"：关闭弹窗并启动休息计时器
                // 进度环的进度由 timeLeft/initialTime 计算，启动后 isRunning=true 才会递减
                const currentMode = mode
                const isCurrentlyBreak = currentMode === 'short-break' || currentMode === 'long-break'
                if (isCurrentlyBreak) {
                  // 模式已切换到休息，直接启动
                  updatePomodoroTimerState({ isRunning: true })
                } else {
                  // 兜底：万一 mode 还在 work，手动切到下一个休息模式并启动
                  const nextBreak = (completedSessionsCount + 1) % (pomodoroSettings.sessionsBeforeLongBreak || 4) === 0
                  updatePomodoroTimerState({
                    mode: nextBreak ? 'long-break' : 'short-break',
                    timeLeft: nextBreak
                      ? pomodoroSettings.longBreakDuration
                      : pomodoroSettings.shortBreakDuration,
                    isRunning: true,
                  })
                }
                onOpenChange(false)
              }}
            >
              休息一下
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
