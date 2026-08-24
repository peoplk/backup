'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useWeekStats, useStreak } from '@/lib/hooks'
import { useAutoShield } from '@/lib/dnd'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  CheckCircle2,
} from 'lucide-react'
import { ImmersiveTimer } from './immersive-timer'
import { useSmartTaskRecommendation } from '@/lib/smart-recommendation'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useDataLink } from '@/lib/data-link-service'
import { abandonPomodoroSession } from '@/lib/pomodoro-completion'
import { subscribePomodoroCompletion, setPomodoroSessionNoteProvider } from '@/lib/pomodoro-engine'
import { FocusSound } from '@/components/focus-sound'
import { TimerMode, modeConfig } from './timer-config'
import { DynamicTimerRing } from './timer-ring'
import { TimerPresets } from './timer-presets'
import { TimerSettingsDialog } from './timer-settings-dialog'
import { TimerSummaryDialog } from './timer-summary-dialog'
import { TimerSidebar } from './timer-sidebar'
import { TimerMainCard } from './timer-main-card'

export function PomodoroTimer() {
  const {
    tasks,
    pomodoroSettings,
    updatePomodoroSettings,
    pomodoroSessions,
    updateTask,
    pomodoroTimerState,
    updatePomodoroTimerState,
    isFullscreen,
    setIsFullscreen,
    pomodoroStrictMode,
    focusPresets,
    applyFocusPreset,
    addFocusPreset,
    updateFocusPreset,
    deleteFocusPreset,
    focusGoals,
    abandonedPomodoroSessions,
    tags,
    incrementTagUsage,
  } = useAppStore(useShallow((state) => ({
    tasks: state.tasks,
    pomodoroSettings: state.pomodoroSettings,
    updatePomodoroSettings: state.updatePomodoroSettings,
    pomodoroSessions: state.pomodoroSessions,
    updateTask: state.updateTask,
    pomodoroTimerState: state.pomodoroTimerState,
    updatePomodoroTimerState: state.updatePomodoroTimerState,
    isFullscreen: state.isFullscreen,
    setIsFullscreen: state.setIsFullscreen,
    pomodoroStrictMode: state.pomodoroStrictMode,
    focusPresets: state.focusPresets,
    applyFocusPreset: state.applyFocusPreset,
    addFocusPreset: state.addFocusPreset,
    updateFocusPreset: state.updateFocusPreset,
    deleteFocusPreset: state.deleteFocusPreset,
    focusGoals: state.focusGoals,
    abandonedPomodoroSessions: state.abandonedPomodoroSessions,
    tags: state.tags,
    incrementTagUsage: state.incrementTagUsage,
  })))

  const weekStats = useWeekStats()
  const streak = useStreak()
  const recommendedTasks = useSmartTaskRecommendation(3)
  const { confirm: showConfirm, DialogComponent: ConfirmDialog } = useConfirm()
  const dataLink = useDataLink()

  const mode = pomodoroTimerState.mode
  const timeLeft = pomodoroTimerState.timeLeft
  const isRunning = pomodoroTimerState.isRunning
  const completedSessions = pomodoroTimerState.completedSessions
  const selectedTaskId = pomodoroTimerState.selectedTaskId
  const treeGrowth = pomodoroTimerState.treeGrowth
  const treeState = pomodoroTimerState.treeState

  // 自动屏蔽网站/应用：仅在专注时启用
  useAutoShield(isRunning, mode === 'work')
  const autoStartBreak = pomodoroSettings.autoStartBreak ?? true
  const autoStartWork = pomodoroSettings.autoStartWork ?? false
  const soundEnabled = pomodoroSettings.soundEnabled ?? true
  const [showSettings, setShowSettings] = useState(false)
  const [focusNote, setFocusNote] = useState('')
  const [sessionTags, setSessionTags] = useState<string[]>([])
  const [newSessionTag, setNewSessionTag] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [lastSessionDuration, setLastSessionDuration] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const totalDuration =
    mode === 'work'
      ? pomodoroSettings.workDuration
      : mode === 'short-break'
      ? pomodoroSettings.shortBreakDuration
      : pomodoroSettings.longBreakDuration

  const progress = ((totalDuration - timeLeft) / totalDuration) * 100

  const isLocked =
    pomodoroStrictMode.enabled &&
    pomodoroStrictMode.lockUntilSessionEnd &&
    mode === 'work' &&
    (isRunning || timeLeft < totalDuration)

  const todaySessions = useMemo(() => {
    const todayStr = new Date().toDateString()
    return pomodoroSessions.filter(
      (s) =>
        new Date(s.completedAt).toDateString() === todayStr &&
        s.type === 'work'
    ).length
  }, [pomodoroSessions])

  const todayAbandoned = useMemo(() => {
    const todayStr = new Date().toDateString()
    return abandonedPomodoroSessions.filter(
      (s) =>
        new Date(s.completedAt).toDateString() === todayStr &&
        s.type === 'work'
    ).length
  }, [abandonedPomodoroSessions])

  // 最近标签：按 usageCount 降序取前 10 个名称
  const recentTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
        return a.name.localeCompare(b.name)
      })
      .slice(0, 10)
      .map((t) => t.name)
  }, [tags])

  const playSound = useCallback((frequency: number = 800, duration: number = 200) => {
    if (!soundEnabled) return

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext!)()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration / 1000)
    } catch {
    }
  }, [soundEnabled])

  // 会话备注/标签提供给全局引擎（完成或放弃会话时带上）
  useEffect(() => {
    setPomodoroSessionNoteProvider(() => ({ focusNote, sessionTags }))
    return () => setPomodoroSessionNoteProvider(null)
  }, [focusNote, sessionTags])

  // 会话完成（含自动完成与外部控制触发）后展示总结弹窗与任务预估达成确认
  useEffect(() => {
    return subscribePomodoroCompletion((info) => {
      if (info.mode === 'work') {
        setLastSessionDuration(info.totalDuration)
        setShowSummary(true)
      }

      if (info.taskEstimatedReached && info.selectedTaskId) {
        const taskId = info.selectedTaskId
        const task = tasks.find((t) => t.id === taskId)
        if (task) {
          setTimeout(async () => {
            const confirmed = await showConfirm({
              title: '🎉 恭喜完成！',
              description: `你已完成任务「${task.title}」的预估番茄钟数（${task.estimatedPomodoros}个）。是否标记任务为完成？`,
              confirmText: '标记完成',
              cancelText: '稍后再说',
              variant: 'success',
            })

            if (confirmed) {
              updateTask(taskId, { status: 'done', completedAt: new Date() })
              dataLink.handleTaskCompletion(taskId)
            }
          }, 500)
        }
      }
    })
  }, [tasks, updateTask, dataLink, showConfirm])

  useEffect(() => {
    const handleElectronFullscreenChange = (isFullScreen: boolean) => {
      if (!isFullScreen && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    const off = typeof window !== 'undefined' && window.electronAPI?.onFullScreenChange
      ? window.electronAPI.onFullScreenChange(handleElectronFullscreenChange)
      : undefined

    const handleBrowserFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleBrowserFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleBrowserFullscreenChange)
      if (typeof off === 'function') off()
    }
  }, [isFullscreen])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    document.title = isRunning
      ? `${formatTime(timeLeft)} - ${modeConfig[mode].label} | FocusFlow`
      : 'FocusFlow'
    return () => {
      document.title = 'FocusFlow'
    }
  }, [isRunning, timeLeft, mode])

  const abandonCurrentSession = () => {
    if (mode !== 'work') return
    const elapsed = totalDuration - timeLeft
    if (elapsed <= 0) return

    abandonPomodoroSession({
      duration: elapsed,
      selectedTaskId,
      focusNote,
      sessionTags,
    })

    // 中断后当前树木枯萎，成长度归零（下一颗新树会重新种植）
    updatePomodoroTimerState({ treeGrowth: 0, treeState: 'withered' })
  }

  const handleReset = () => {
    if (isLocked) return
    if (mode === 'work' && timeLeft < totalDuration) {
      abandonCurrentSession()
    }
    updatePomodoroTimerState({
      isRunning: false,
      timeLeft: totalDuration,
      treeGrowth: 0,
      treeState: treeState === 'withered' ? 'withered' : 'seed',
    })
  }

  const handleSkip = () => {
    if (isLocked) return
    if (mode === 'work') {
      if (timeLeft < totalDuration) {
        abandonCurrentSession()
      }
      const nextBreak = (completedSessions + 1) % (pomodoroSettings.sessionsBeforeLongBreak || 4) === 0
      updatePomodoroTimerState({
        isRunning: false,
        mode: nextBreak ? 'long-break' : 'short-break',
        timeLeft: nextBreak ? pomodoroSettings.longBreakDuration : pomodoroSettings.shortBreakDuration,
        treeState: treeState === 'withered' ? 'withered' : 'seed',
      })
    } else {
      updatePomodoroTimerState({
        isRunning: false,
        mode: 'work',
        timeLeft: pomodoroSettings.workDuration,
        treeState: treeState === 'withered' ? 'withered' : 'seed',
      })
    }
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true)
      if (typeof window !== 'undefined' && window.electronAPI?.setFullScreen) {
        window.electronAPI.setFullScreen(true)
      } else {
        document.documentElement.requestFullscreen().catch(() => {
          setIsFullscreen(false)
        })
      }
    } else {
      setIsFullscreen(false)
      if (typeof window !== 'undefined' && window.electronAPI?.setFullScreen) {
        window.electronAPI.setFullScreen(false)
      } else if (document.fullscreenElement) {
        document.exitFullscreen()
      }
    }
  }

  const handleToggle = useCallback(() => {
    // 严格模式锁定期间允许暂停/继续，但禁止通过切换模式逃避会话
    // 暂停不视为逃避：锁定状态下无法重置/跳过，会话必须走完
    // 严格模式：检查每日上限
    if (
      !isRunning &&
      mode === 'work' &&
      pomodoroStrictMode.enabled &&
      pomodoroStrictMode.maxSessionsPerDay > 0 &&
      todaySessions >= pomodoroStrictMode.maxSessionsPerDay
    ) {
      showConfirm({
        title: '已达每日上限',
        description: `今日已完成 ${todaySessions} 个番茄钟，达到严格模式设定的上限（${pomodoroStrictMode.maxSessionsPerDay} 个）。建议适当休息，明日再战！`,
        confirmText: '我知道了',
        cancelText: '',
        variant: 'warning',
      })
      return
    }
    updatePomodoroTimerState({ isRunning: !isRunning })
  }, [isLocked, isRunning, mode, pomodoroStrictMode, todaySessions, updatePomodoroTimerState, showConfirm])

  // 外部控制（小组件/托盘/漂浮钟）触发的严格模式每日上限拦截提示
  useEffect(() => {
    const handleStrictBlocked = (e: Event) => {
      const detail = (e as CustomEvent<{ todaySessions: number; max: number }>).detail
      showConfirm({
        title: '已达每日上限',
        description: `今日已完成 ${detail.todaySessions} 个番茄钟，达到严格模式设定的上限（${detail.max} 个）。建议适当休息，明日再战！`,
        confirmText: '我知道了',
        cancelText: '',
        variant: 'warning',
      })
    }
    window.addEventListener('focusflow:strict-limit-blocked', handleStrictBlocked)
    return () => window.removeEventListener('focusflow:strict-limit-blocked', handleStrictBlocked)
  }, [showConfirm])

  if (isFullscreen) {
    return (
      <ImmersiveTimer
        mode={mode}
        timeLeft={timeLeft}
        totalDuration={totalDuration}
        isRunning={isRunning}
        completedSessions={completedSessions}
        treeGrowth={treeGrowth}
        taskTitle={tasks.find((t) => t.id === selectedTaskId)?.title}
        sessionsBeforeLongBreak={pomodoroSettings.sessionsBeforeLongBreak ?? 4}
        onToggle={handleToggle}
        onReset={handleReset}
        onSkip={handleSkip}
        onExit={() => {
          if (typeof window !== 'undefined' && window.electronAPI?.setFullScreen) {
            window.electronAPI.setFullScreen(false)
          } else if (document.fullscreenElement) {
            document.exitFullscreen()
          }
          setIsFullscreen(false)
        }}
      />
    )
  }

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <FocusSound />
        <Button
          variant="outline"
          size="icon"
          aria-label={soundEnabled ? '关闭声音' : '开启声音'}
          onClick={() => updatePomodoroSettings({ soundEnabled: !soundEnabled })}
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        <TimerSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          pomodoroSettings={pomodoroSettings}
          updatePomodoroSettings={updatePomodoroSettings}
          autoStartBreak={autoStartBreak}
          autoStartWork={autoStartWork}
        />
      </div>

      <TimerPresets
        focusPresets={focusPresets}
        pomodoroSettings={pomodoroSettings}
        isRunning={isRunning}
        autoStartBreak={autoStartBreak}
        autoStartWork={autoStartWork}
        soundEnabled={soundEnabled}
        applyFocusPreset={applyFocusPreset}
        updateFocusPreset={updateFocusPreset}
        deleteFocusPreset={deleteFocusPreset}
        addFocusPreset={addFocusPreset}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <TimerMainCard
          mode={mode}
          timeLeft={timeLeft}
          totalDuration={totalDuration}
          isRunning={isRunning}
          progress={progress}
          isLocked={isLocked}
          completedSessions={completedSessions}
          pomodoroSettings={pomodoroSettings}
          selectedTaskId={selectedTaskId}
          tasks={tasks}
          focusNote={focusNote}
          setFocusNote={setFocusNote}
          sessionTags={sessionTags}
          setSessionTags={setSessionTags}
          newSessionTag={newSessionTag}
          setNewSessionTag={setNewSessionTag}
          recentTags={recentTags}
          recommendedTasks={recommendedTasks}
          updatePomodoroTimerState={updatePomodoroTimerState}
          onReset={handleReset}
          onSkip={handleSkip}
          onToggle={handleToggle}
          DynamicTimerRingComponent={DynamicTimerRing}
        />

        <TimerSidebar
          todaySessions={todaySessions}
          focusGoals={focusGoals}
          completedSessions={completedSessions}
          pomodoroSettings={pomodoroSettings}
          treeGrowth={treeGrowth}
          treeState={treeState}
          todayAbandoned={todayAbandoned}
          weekStats={weekStats}
          streak={streak}
          pomodoroSessions={pomodoroSessions}
          tasks={tasks}
        />
      </div>

      {todaySessions >= (focusGoals.dailyPomodoros || 8) && (
        <Card className="border-chart-2 bg-chart-2/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-chart-2/20 p-3">
              <CheckCircle2 className="h-6 w-6 text-chart-2" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-chart-2">恭喜达成今日目标!</p>
              <p className="text-sm text-muted-foreground">
                你已完成 {todaySessions} 个番茄钟，休息一下吧
              </p>
            </div>
            <Badge className="bg-chart-2">+ 100 经验</Badge>
          </CardContent>
        </Card>
      )}

      {ConfirmDialog}

      <TimerSummaryDialog
        open={showSummary}
        onOpenChange={setShowSummary}
        mode={mode}
        lastSessionDuration={lastSessionDuration}
        completedSessions={completedSessions}
        completedSessionsCount={completedSessions}
        streak={streak}
        selectedTaskId={selectedTaskId}
        tasks={tasks}
        pomodoroSettings={pomodoroSettings}
        updateTask={updateTask}
        updatePomodoroTimerState={updatePomodoroTimerState}
      />
    </div>
  )
}
