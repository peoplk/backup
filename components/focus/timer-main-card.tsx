'use client'

import { ComponentType, useMemo, useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Task, PomodoroSettings, TreeState } from '@/lib/types'
import { Play, Pause, RotateCcw, SkipForward, Sparkles } from 'lucide-react'
import { TimerMode, modeConfig } from './timer-config'
import { DynamicTimerRing as DefaultDynamicTimerRing } from './timer-ring'
import { PomodoroQuickTask } from './pomodoro-quick-task'
import { DistractionLog } from './distraction-log'

interface RecommendedTask extends Task {
  recommendationScore: number
  reasons: string[]
}

interface TimerMainCardProps {
  mode: TimerMode
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  progress: number
  isLocked: boolean
  completedSessions: number
  pomodoroSettings: PomodoroSettings
  selectedTaskId: string | null
  tasks: Task[]
  focusNote: string
  setFocusNote: (note: string) => void
  sessionTags: string[]
  setSessionTags: (tags: string[]) => void
  newSessionTag: string
  setNewSessionTag: (tag: string) => void
  recentTags: string[]
  recommendedTasks: RecommendedTask[]
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
  onReset: () => void
  onSkip: () => void
  onToggle: () => void
  DynamicTimerRingComponent?: ComponentType<{
    mode: TimerMode
    timeLeft: number
    totalDuration: number
    isRunning: boolean
    progress: number
  }>
}

export function TimerMainCard({
  mode,
  timeLeft,
  totalDuration,
  isRunning,
  progress,
  isLocked,
  completedSessions,
  pomodoroSettings,
  selectedTaskId,
  tasks,
  focusNote,
  setFocusNote,
  sessionTags,
  setSessionTags,
  newSessionTag,
  setNewSessionTag,
  recentTags,
  recommendedTasks,
  updatePomodoroTimerState,
  onReset,
  onSkip,
  onToggle,
  DynamicTimerRingComponent = DefaultDynamicTimerRing,
}: TimerMainCardProps) {
  const config = modeConfig[mode]
  const activeTasks = tasks.filter((t) => t.status !== 'done')
  const selectedTask = tasks.find((t) => t.id === selectedTaskId)

  // 全局标签库，用于自动补全匹配
  const tags = useAppStore((s) => s.tags)

  // 自动补全：输入时从全局 tags 中匹配 name 包含输入文字的标签
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const autocompleteSuggestions = useMemo(() => {
    if (!newSessionTag.trim()) return []
    const input = newSessionTag.trim().toLowerCase()
    return tags
      .filter((t) =>
        t.name.toLowerCase().includes(input) &&
        !sessionTags.includes(t.name)
      )
      .sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
        return a.name.localeCompare(b.name)
      })
      .slice(0, 5)
      .map((t) => t.name)
  }, [newSessionTag, tags, sessionTags])

  // 点击外部关闭自动补全
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addSessionTag = (rawName: string) => {
    const name = rawName.trim()
    if (!name) return
    if (sessionTags.includes(name)) {
      setNewSessionTag('')
      setShowAutocomplete(false)
      return
    }
    setSessionTags([...sessionTags, name])
    setNewSessionTag('')
    setShowAutocomplete(false)
  }

  const handleModeChange = (newMode: TimerMode) => {
    if (isRunning) {
      return
    }
    updatePomodoroTimerState({
      mode: newMode,
      timeLeft: newMode === 'work'
        ? pomodoroSettings.workDuration
        : newMode === 'short-break'
        ? pomodoroSettings.shortBreakDuration
        : pomodoroSettings.longBreakDuration,
    })
  }

  return (
    <Card className="lg:col-span-2 overflow-hidden">
      <div className={cn('bg-gradient-to-br p-8', config.gradient)}>
        <div className="mb-8 flex justify-center gap-2">
          {(Object.keys(modeConfig) as TimerMode[]).map((m) => {
            const Icon = modeConfig[m].icon
            const isActive = mode === m
            const isDisabled = (isRunning && !isActive) || isLocked
            return (
              <Button
                key={m}
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'gap-2 transition-all duration-200',
                  isActive && modeConfig[m].bgColor,
                  isActive && 'text-white shadow-lg',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => handleModeChange(m)}
                disabled={isDisabled}
              >
                <Icon className="h-4 w-4" />
                {modeConfig[m].label}
              </Button>
            )
          })}
        </div>

        {isLocked && (
          <p className="text-center text-xs text-destructive font-medium mb-4">
            严格模式已开启：当前专注阶段结束前无法暂停、重置或跳过
          </p>
        )}

        {!isLocked && isRunning && (
          <p className="text-center text-xs text-muted-foreground mb-4">
            计时器运行中，模式切换已禁用
          </p>
        )}

        <DynamicTimerRingComponent
          mode={mode}
          timeLeft={timeLeft}
          totalDuration={totalDuration}
          isRunning={isRunning}
          progress={progress}
        />

        <div className="mt-8 flex justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onReset}
            disabled={isLocked}
            aria-label="重置"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            className={cn(
              'h-14 w-14 rounded-full text-white flex items-center justify-center',
              config.bgColor
            )}
            onClick={onToggle}
            disabled={isLocked}
          >
            {isRunning ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onSkip}
            disabled={isLocked}
            title={isRunning ? "暂停后跳过当前阶段" : "跳过当前阶段"}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <div className="w-[280px] space-y-3">
            <Select
              value={selectedTaskId || 'none'}
              onValueChange={(v) => updatePomodoroTimerState({ selectedTaskId: v === 'none' ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择要专注的任务..." />
              </SelectTrigger>
              <SelectContent className="w-[280px]" position="popper" align="center" sideOffset={4}>
                <SelectItem value="none">无任务</SelectItem>
                {activeTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{task.title}</span>
                      {task.estimatedPomodoros && (
                        <Badge variant="outline" className="text-2xs px-1 ml-auto shrink-0">
                          {task.completedPomodoros}/{task.estimatedPomodoros}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTask && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate">{selectedTask.title}</span>
                  {selectedTask.priority === 'urgent' && (
                    <Badge className="bg-red-500 text-2xs">紧急</Badge>
                  )}
                  {selectedTask.priority === 'high' && (
                    <Badge className="bg-orange-500 text-2xs">高优</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={selectedTask.estimatedPomodoros
                      ? (selectedTask.completedPomodoros / selectedTask.estimatedPomodoros) * 100
                      : 0
                    }
                    className="h-1.5 flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {selectedTask.completedPomodoros}/{selectedTask.estimatedPomodoros || '?'}
                  </span>
                </div>
                {selectedTask.project && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    项目: {selectedTask.project}
                  </p>
                )}
              </div>
            )}

            <PomodoroQuickTask />
          </div>
          {mode === 'work' && (
            <div className="mt-3 w-[280px]">
              <Textarea
                placeholder="记录本次专注的笔记..."
                value={focusNote}
                onChange={(e) => setFocusNote(e.target.value)}
                className="resize-none text-sm bg-muted/30 border-border/30 min-h-0"
                rows={2}
              />
            </div>
          )}
          <div className="mt-2 w-[280px]">
            {sessionTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {sessionTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-2xs">
                    {tag}
                    <button
                      onClick={() => setSessionTags(sessionTags.filter((t) => t !== tag))}
                      className="ml-0.5"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative" ref={autocompleteRef}>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="+ 添加标签..."
                  value={newSessionTag}
                  onChange={(e) => {
                    setNewSessionTag(e.target.value)
                    setShowAutocomplete(true)
                  }}
                  onFocus={() => {
                    if (newSessionTag.trim()) setShowAutocomplete(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSessionTag.trim()) {
                      e.preventDefault()
                      addSessionTag(newSessionTag)
                    }
                    if (e.key === 'Escape') {
                      setShowAutocomplete(false)
                    }
                  }}
                  className="flex-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    if (newSessionTag.trim() && !sessionTags.includes(newSessionTag.trim())) {
                      setSessionTags([...sessionTags, newSessionTag.trim()])
                    }
                    setNewSessionTag('')
                    setShowAutocomplete(false)
                  }}
                >
                  +添加
                </Button>
              </div>
              {/* 自动补全下拉列表 */}
              {showAutocomplete && autocompleteSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border/50 bg-popover shadow-md py-1">
                  {autocompleteSuggestions.map((name) => (
                    <button
                      key={name}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors truncate"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addSessionTag(name)
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {recentTags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-2xs text-muted-foreground/60 mr-0.5">最近</span>
                {recentTags.map((name) => {
                  const selected = sessionTags.includes(name)
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        if (selected) {
                          setSessionTags(sessionTags.filter((t) => t !== name))
                        } else {
                          setSessionTags([...sessionTags, name])
                        }
                      }}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-2xs border transition-all',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/40 hover:bg-primary/5'
                      )}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {isRunning && mode === 'work' && (
            <div className="mt-3">
              <DistractionLog
                taskId={selectedTaskId || undefined}
                compact
                isTimerRunning
              />
            </div>
          )}
        </div>

        {!selectedTaskId && recommendedTasks.length > 0 && (
          <div className="mt-6 mx-auto w-[320px]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-chart-3" />
              <span className="text-sm font-medium text-chart-3">智能推荐</span>
            </div>
            <div className="space-y-2">
              {recommendedTasks.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  onClick={() => updatePomodoroTimerState({ selectedTaskId: task.id })}
                  className="w-full text-left rounded-lg border border-border/50 p-3 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {task.reasons.slice(0, 2).map((reason, i) => (
                          <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {task.recommendationScore}分
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
