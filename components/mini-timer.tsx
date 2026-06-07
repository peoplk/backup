'use client'

import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Play,
  Pause,
  Coffee,
  TreeDeciduous,
  Brain,
  RotateCcw,
  SkipForward,
  Target,
  Flame,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { usePomodoroControls } from '@/lib/hooks/usePomodoroControls'

const modeConfig = {
  work: {
    label: '专注',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1',
    icon: Brain,
  },
  'short-break': {
    label: '短休息',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2',
    icon: Coffee,
  },
  'long-break': {
    label: '长休息',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3',
    icon: TreeDeciduous,
  },
}

export function MiniTimer() {
  const {
    mode,
    timeLeft,
    isRunning,
    completedSessions,
    selectedTask,
    progress,
    todaySessions,
    handleReset,
    handleSkip,
    handleToggle,
    formatTime,
  } = usePomodoroControls()

  const pomodoroSettings = useAppStore(useShallow((state) => state.pomodoroSettings))
  const checkAndResetDailyPomodoro = useAppStore((state) => state.checkAndResetDailyPomodoro)

  const [isOpen, setIsOpen] = useState(false)
  const config = modeConfig[mode]
  const ModeIcon = config.icon

  // 应用启动时检查是否需要重置每日番茄钟计数
  useEffect(() => {
    checkAndResetDailyPomodoro()
  }, [checkAndResetDailyPomodoro])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full px-4 py-3 shadow-lg transition-all duration-300 hover:scale-105',
            isRunning ? 'bg-gradient-to-r from-chart-1 to-chart-1/80 text-white' : 'bg-card border border-border'
          )}
        >
          <div className="relative">
            <div
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                isRunning ? 'bg-white/20' : 'bg-muted'
              )}
            >
              <ModeIcon className="h-5 w-5" />
            </div>
            {isRunning && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-chart-2 animate-pulse" />
            )}
          </div>
          <div className="flex flex-col items-start min-w-[60px]">
            <span className={cn(
              'text-lg font-bold tabular-nums',
              isRunning ? 'text-white' : 'text-foreground'
            )}
            style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}
            >
              {formatTime(timeLeft)}
            </span>
            <span className={cn(
              'text-[10px]',
              isRunning ? 'text-white/70' : 'text-muted-foreground'
            )}>
              {config.label}
            </span>
          </div>
          <Progress
            value={progress}
            className={cn(
              'h-1 w-16',
              isRunning && '[&>div]:bg-white/50'
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end" side="top">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('rounded-lg p-2', config.bgColor, 'bg-opacity-20')}>
                <ModeIcon className={cn('h-5 w-5', config.color)} />
              </div>
              <div>
                <p className="font-semibold">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedTask ? selectedTask.title : '无关联任务'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn('text-2xl font-bold tabular-nums', config.color)}
                 style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>
                {formatTime(timeLeft)}
              </p>
              <p className="text-xs text-muted-foreground">
                今日 {todaySessions} 个番茄钟
              </p>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              className={cn(
                'h-14 w-14 rounded-full',
                config.bgColor,
                'text-white'
              )}
              onClick={handleToggle}
            >
              {isRunning ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={handleSkip}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center rounded-lg bg-muted/50 p-2">
              <div className="flex items-center justify-center gap-1 text-chart-1">
                <Target className="h-3.5 w-3.5" />
                <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{todaySessions}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">今日番茄钟</p>
            </div>
            <div className="text-center rounded-lg bg-muted/50 p-2">
              <div className="flex items-center justify-center gap-1 text-chart-3">
                <Flame className="h-3.5 w-3.5" />
                <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{completedSessions}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">本轮进度</p>
            </div>
            <div className="text-center rounded-lg bg-muted/50 p-2">
              <div className="flex items-center justify-center gap-1 text-chart-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{pomodoroSettings.sessionsBeforeLongBreak}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">长休息间隔</p>
            </div>
          </div>

          {selectedTask && (
            <div className="rounded-lg border bg-muted/30 p-2">
              <p className="text-xs text-muted-foreground mb-1">关联任务</p>
              <p className="text-sm font-medium truncate">{selectedTask.title}</p>
              {selectedTask.estimatedPomodoros && (
                <div className="flex items-center gap-2 mt-1">
                  <Progress
                    value={(selectedTask.completedPomodoros / selectedTask.estimatedPomodoros) * 100}
                    className="h-1 flex-1"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedTask.completedPomodoros}/{selectedTask.estimatedPomodoros}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
