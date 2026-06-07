'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useWeekStats, useStreak } from '@/lib/hooks'
import { useAutoShield, isElectronWithShield } from '@/lib/dnd'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Coffee,
  Brain,
  TreeDeciduous,
  Flame,
  Target,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  SkipForward,
  Music,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ImmersiveTimer } from './immersive-timer'
import { useSmartTaskRecommendation } from '@/lib/smart-recommendation'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DistractionLog } from './distraction-log'
import { notifyPomodoroComplete, notifyBreakComplete } from '@/lib/browser-notifications'
import { PomodoroQuickTask } from './pomodoro-quick-task'
import { useDataLink } from '@/lib/data-link-service'
import { completePomodoroSession } from '@/lib/pomodoro-completion'
import { FocusSound } from '@/components/focus-sound'

type TimerMode = 'work' | 'short-break' | 'long-break'

const modeConfig = {
  work: {
    label: '专注',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1',
    gradient: 'from-chart-1/20 to-chart-1/5',
    gradientFrom: 'oklch(0.57 0.14 250)',
    gradientTo: 'oklch(0.45 0.12 250)',
    glowColor: 'oklch(0.57 0.14 250 / 0.4)',
    icon: Brain,
    // 工作模式的颜色阶段：从蓝色 -> 青色 -> 绿色 -> 黄色 -> 橙色 -> 红色
    colorStages: [
      { progress: 0, from: [100, 70, 250], to: [80, 60, 250] },      // 蓝色
      { progress: 20, from: [70, 180, 250], to: [50, 150, 250] },    // 青色
      { progress: 40, from: [100, 200, 100], to: [80, 180, 80] },    // 绿色
      { progress: 60, from: [250, 200, 50], to: [230, 180, 30] },    // 黄色
      { progress: 80, from: [250, 150, 50], to: [230, 130, 30] },    // 橙色
      { progress: 100, from: [250, 80, 80], to: [230, 60, 60] },     // 红色
    ],
  },
  'short-break': {
    label: '短休息',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2',
    gradient: 'from-chart-2/20 to-chart-2/5',
    gradientFrom: 'oklch(0.65 0.18 145)',
    gradientTo: 'oklch(0.50 0.15 145)',
    glowColor: 'oklch(0.65 0.18 145 / 0.4)',
    icon: Coffee,
    // 短休息：从浅绿 -> 深绿
    colorStages: [
      { progress: 0, from: [150, 250, 150], to: [120, 220, 120] },
      { progress: 100, from: [50, 200, 100], to: [30, 180, 80] },
    ],
  },
  'long-break': {
    label: '长休息',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3',
    gradient: 'from-chart-3/20 to-chart-3/5',
    gradientFrom: 'oklch(0.75 0.15 65)',
    gradientTo: 'oklch(0.60 0.12 65)',
    glowColor: 'oklch(0.75 0.15 65 / 0.4)',
    icon: TreeDeciduous,
    // 长休息：从浅橙 -> 深橙
    colorStages: [
      { progress: 0, from: [255, 200, 150], to: [235, 180, 130] },
      { progress: 100, from: [255, 140, 50], to: [235, 120, 30] },
    ],
  },
}

// 插值函数：根据进度计算当前颜色
function interpolateColor(progress: number, stages: { progress: number; from: number[]; to: number[] }[]) {
  // 找到当前进度所在的阶段
  let lowerStage = stages[0]
  let upperStage = stages[stages.length - 1]

  for (let i = 0; i < stages.length - 1; i++) {
    if (progress >= stages[i].progress && progress <= stages[i + 1].progress) {
      lowerStage = stages[i]
      upperStage = stages[i + 1]
      break
    }
  }

  // 计算在当前阶段内的进度比例
  const stageProgress = (progress - lowerStage.progress) / (upperStage.progress - lowerStage.progress)
  const clampedProgress = Math.max(0, Math.min(1, stageProgress))

  // 插值计算 from 和 to 颜色
  const fromColor = lowerStage.from.map((start, i) => {
    const end = upperStage.from[i]
    return Math.round(start + (end - start) * clampedProgress)
  })

  const toColor = lowerStage.to.map((start, i) => {
    const end = upperStage.to[i]
    return Math.round(start + (end - start) * clampedProgress)
  })

  return {
    from: `rgb(${fromColor[0]}, ${fromColor[1]}, ${fromColor[2]})`,
    to: `rgb(${toColor[0]}, ${toColor[1]}, ${toColor[2]})`,
  }
}

function OrbitRing({ mode, color }: { mode: TimerMode; color?: string }) {
  const config = modeConfig[mode]
  const ringColor = color || config.gradientFrom
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 rounded-full border border-dashed transition-colors duration-500"
        style={{ borderColor: `${ringColor}30` }}
      />
    </div>
  )
}

function OrbitingDots({ mode, isRunning, color }: { mode: TimerMode; isRunning: boolean; color?: string }) {
  const config = modeConfig[mode]
  const dotColor = color || config.gradientFrom

  const dots = [
    { offset: 0, size: 5, opacity: 0.9 },
    { offset: 90, size: 4, opacity: 0.6 },
    { offset: 180, size: 3, opacity: 0.4 },
    { offset: 270, size: 4, opacity: 0.5 },
  ]

  return (
    <div
      className="absolute inset-0 pointer-events-none rounded-full overflow-hidden"
      style={{
        animation: isRunning ? 'orbitSpin 12s linear infinite' : 'none',
      }}
    >
      {dots.map((dot, i) => {
        const angle = ((dot.offset) * Math.PI) / 180
        const radius = 47
        const cx = 50 + Math.cos(angle - Math.PI / 2) * radius
        const cy = 50 + Math.sin(angle - Math.PI / 2) * radius

        return (
          <div
            key={i}
            className="absolute rounded-full transition-opacity duration-500"
            style={{
              width: dot.size,
              height: dot.size,
              left: `${cx}%`,
              top: `${cy}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: dotColor,
              boxShadow: `0 0 ${dot.size * 2}px ${dotColor}`,
              opacity: isRunning ? dot.opacity : dot.opacity * 0.3,
            }}
          />
        )
      })}
    </div>
  )
}

function GlowEffect({ mode, isRunning, colorFrom }: { mode: TimerMode; isRunning: boolean; colorFrom: string }) {
  return (
    <div
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        animation: isRunning ? 'glowBreath 4s ease-in-out infinite' : 'none',
        background: `radial-gradient(circle, ${colorFrom}26 0%, transparent 60%)`,
      }}
    />
  )
}

// 动态计时器环形组件
interface DynamicTimerRingProps {
  mode: TimerMode
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  progress: number
}

function DynamicTimerRing({ mode, timeLeft, totalDuration, isRunning, progress }: DynamicTimerRingProps) {
  const config = modeConfig[mode]
  const ModeIcon = config.icon
  
  // 计算当前进度百分比 (0-100)
  const currentProgress = useMemo(() => ((totalDuration - timeLeft) / totalDuration) * 100, [totalDuration, timeLeft])
  
  const dynamicColors = useMemo(() => interpolateColor(currentProgress, config.colorStages), [currentProgress, config.colorStages])
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative mx-auto w-72 h-72">
      <GlowEffect mode={mode} isRunning={isRunning} colorFrom={dynamicColors.from} />
      
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${dynamicColors.from}15 0%, ${dynamicColors.to}08 100%)`,
        }}
      />
      
      <OrbitRing mode={mode} color={dynamicColors.from} />
      
      <svg
        className="absolute inset-0 -rotate-90 rounded-full z-10"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id={`progressGradient-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={dynamicColors.from} />
            <stop offset="100%" stopColor={dynamicColors.to} />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted/20"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`url(#progressGradient-${mode})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${progress * 2.83} 283`}
          style={{ 
            filter: `drop-shadow(0 0 8px ${dynamicColors.from})`,
            transition: 'stroke 0.5s ease'
          }}
        />
      </svg>
      
      <OrbitingDots mode={mode} isRunning={isRunning} color={dynamicColors.from} />

      <div className="absolute inset-6 rounded-full bg-card/90 backdrop-blur-sm flex flex-col items-center justify-center z-20">
        <ModeIcon 
          className="h-8 w-8 mb-2 transition-colors duration-500" 
          style={{ color: dynamicColors.from }}
        />
        <span
          className="font-bold tracking-tight transition-colors duration-500"
          style={{
            fontSize: 48,
            lineHeight: 1,
            letterSpacing: '-1px',
            fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif',
            color: dynamicColors.from,
          }}
        >
          {formatTime(timeLeft)}
        </span>
        <span className="mt-1 text-sm text-muted-foreground">
          {config.label}
        </span>
      </div>
    </div>
  )
}

export function PomodoroTimer() {
  const {
    tasks,
    pomodoroSettings,
    updatePomodoroSettings,
    addPomodoroSession,
    pomodoroSessions,
    updateTask,
    pomodoroTimerState,
    updatePomodoroTimerState,
    addTimeEntry,
    addTimeBlock,
    isFullscreen,
    setIsFullscreen,
    checkAndResetDailyPomodoro,
    pomodoroStrictMode,
    addDistraction,
    focusPresets,
    applyFocusPreset,
    addFocusPreset,
    updateFocusPreset,
    deleteFocusPreset,
  } = useAppStore(useShallow((state) => ({
    tasks: state.tasks,
    pomodoroSettings: state.pomodoroSettings,
    updatePomodoroSettings: state.updatePomodoroSettings,
    addPomodoroSession: state.addPomodoroSession,
    pomodoroSessions: state.pomodoroSessions,
    updateTask: state.updateTask,
    pomodoroTimerState: state.pomodoroTimerState,
    updatePomodoroTimerState: state.updatePomodoroTimerState,
    addTimeEntry: state.addTimeEntry,
    addTimeBlock: state.addTimeBlock,
    isFullscreen: state.isFullscreen,
    setIsFullscreen: state.setIsFullscreen,
    checkAndResetDailyPomodoro: state.checkAndResetDailyPomodoro,
    pomodoroStrictMode: state.pomodoroStrictMode,
    addDistraction: state.addDistraction,
    focusPresets: state.focusPresets,
    applyFocusPreset: state.applyFocusPreset,
    addFocusPreset: state.addFocusPreset,
    updateFocusPreset: state.updateFocusPreset,
    deleteFocusPreset: state.deleteFocusPreset,
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

  // 自动屏蔽网站/应用：仅在专注时启用
  useAutoShield(isRunning, mode === 'work')
  const [autoStartBreak, setAutoStartBreak] = useState(true)
  const [autoStartWork, setAutoStartWork] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [focusNote, setFocusNote] = useState('')
  const [sessionTags, setSessionTags] = useState<string[]>([])
  const [newSessionTag, setNewSessionTag] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [lastSessionDuration, setLastSessionDuration] = useState(0)
  const [lastSessionMode, setLastSessionMode] = useState<TimerMode>('work')

  const containerRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerStartRef = useRef<{ startedAt: number; timeLeftAtStart: number } | null>(null)

  const activeTasks = tasks.filter((t) => t.status !== 'done')
  const selectedTask = tasks.find((t) => t.id === selectedTaskId)

  const totalDuration =
    mode === 'work'
      ? pomodoroSettings.workDuration
      : mode === 'short-break'
      ? pomodoroSettings.shortBreakDuration
      : pomodoroSettings.longBreakDuration

  const progress = ((totalDuration - timeLeft) / totalDuration) * 100

  const todaySessions = useMemo(() => {
    const todayStr = new Date().toDateString()
    return pomodoroSessions.filter(
      (s) =>
        new Date(s.completedAt).toDateString() === todayStr &&
        s.type === 'work'
    ).length
  }, [pomodoroSessions])

  const playSound = useCallback((frequency: number = 800, duration: number = 200) => {
    if (!soundEnabled) return
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
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
    } catch (e) {
    }
  }, [soundEnabled])

  const playNotificationSound = useCallback(() => {
    playSound(880, 150)
    setTimeout(() => playSound(1100, 150), 150)
    setTimeout(() => playSound(880, 200), 300)
  }, [playSound])

  const handleComplete = useCallback(() => {
    const result = completePomodoroSession({
      mode,
      duration: totalDuration,
      selectedTaskId,
      focusNote,
      sessionTags,
    })
    setFocusNote('')
    setSessionTags([])

    if (result.sessionId) {
      dataLink.handlePomodoroCompletion(
        result.sessionId,
        totalDuration,
        mode,
        selectedTaskId || undefined
      )
    }

    if (result.taskEstimatedReached && selectedTaskId) {
      const task = tasks.find((t) => t.id === selectedTaskId)
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
            updateTask(selectedTaskId, { status: 'done', completedAt: new Date() })
            dataLink.handleTaskCompletion(selectedTaskId)
          }
        }, 500)
      }
    }

    playNotificationSound()

    if (mode === 'work') {
      notifyPomodoroComplete(
        Math.round(totalDuration / 60),
        selectedTaskId ? tasks.find((t) => t.id === selectedTaskId)?.title : undefined
      )

      setLastSessionDuration(totalDuration)
      setLastSessionMode(mode)
      setShowSummary(true)

      const newCompletedSessions = completedSessions + 1
      const newTreeGrowth = Math.min(treeGrowth + 25, 100)

      const nextBreak = newCompletedSessions % pomodoroSettings.sessionsBeforeLongBreak === 0
      const nextMode = nextBreak ? 'long-break' : 'short-break'
      const nextDuration = nextBreak
        ? pomodoroSettings.longBreakDuration
        : pomodoroSettings.shortBreakDuration

      updatePomodoroTimerState({
        completedSessions: newCompletedSessions,
        treeGrowth: newTreeGrowth,
        mode: nextMode,
        timeLeft: nextDuration,
        isRunning: autoStartBreak,
      })
    } else {
      notifyBreakComplete('work')

      updatePomodoroTimerState({
        mode: 'work',
        timeLeft: pomodoroSettings.workDuration,
        isRunning: autoStartWork,
      })
    }
  }, [
    addPomodoroSession,
    addTimeBlock,
    selectedTaskId,
    mode,
    totalDuration,
    completedSessions,
    treeGrowth,
    pomodoroSettings,
    tasks,
    updateTask,
    playNotificationSound,
    autoStartBreak,
    autoStartWork,
    updatePomodoroTimerState,
    dataLink,
    showConfirm,
    focusNote,
    sessionTags,
  ])

  useEffect(() => {
    checkAndResetDailyPomodoro()
  }, [checkAndResetDailyPomodoro])

  // 基于时间戳的精确计时器，避免浏览器后台标签页节流导致计时偏移
  useEffect(() => {
    if (!isRunning) {
      timerStartRef.current = null
      return
    }

    // 记录计时开始的时间戳和当时的剩余时间
    if (!timerStartRef.current) {
      timerStartRef.current = {
        startedAt: Date.now(),
        timeLeftAtStart: timeLeft,
      }
    }

    const interval = setInterval(() => {
      if (!timerStartRef.current) return
      const elapsed = Math.floor((Date.now() - timerStartRef.current.startedAt) / 1000)
      const newTimeLeft = Math.max(0, timerStartRef.current.timeLeftAtStart - elapsed)

      if (newTimeLeft <= 0) {
        timerStartRef.current = null
        updatePomodoroTimerState({ timeLeft: 0 })
      } else {
        updatePomodoroTimerState({ timeLeft: newTimeLeft })
      }
    }, 250) // 更频繁的检查确保精度

    return () => clearInterval(interval)
  }, [isRunning, updatePomodoroTimerState])

  // 当 timeLeft 变为 0 且计时器正在运行时触发完成
  useEffect(() => {
    if (isRunning && timeLeft === 0) {
      handleComplete()
    }
  }, [isRunning, timeLeft, handleComplete])

  useEffect(() => {
    const handleElectronFullscreenChange = (isFullScreen: boolean) => {
      if (!isFullScreen && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    
    if (typeof window !== 'undefined' && window.electronAPI?.onFullScreenChange) {
      window.electronAPI.onFullScreenChange(handleElectronFullscreenChange)
    }
    
    const handleBrowserFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleBrowserFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleBrowserFullscreenChange)
    }
  }, [isFullscreen])

  useEffect(() => {
    document.title = isRunning
      ? `${formatTime(timeLeft)} - ${modeConfig[mode].label} | FocusFlow`
      : 'FocusFlow'
    return () => {
      document.title = 'FocusFlow'
    }
  }, [isRunning, timeLeft, mode])

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

  const handleReset = () => {
    timerStartRef.current = null
    updatePomodoroTimerState({
      isRunning: false,
      timeLeft: totalDuration,
      treeGrowth: 0,
    })
  }

  const handleSkip = () => {
    timerStartRef.current = null
    if (mode === 'work') {
      const nextBreak = (completedSessions + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0
      updatePomodoroTimerState({
        isRunning: false,
        mode: nextBreak ? 'long-break' : 'short-break',
        timeLeft: nextBreak ? pomodoroSettings.longBreakDuration : pomodoroSettings.shortBreakDuration,
      })
    } else {
      updatePomodoroTimerState({
        isRunning: false,
        mode: 'work',
        timeLeft: pomodoroSettings.workDuration,
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const config = modeConfig[mode]
  const ModeIcon = config.icon

  if (isFullscreen) {
    return (
      <ImmersiveTimer
        mode={mode}
        timeLeft={timeLeft}
        totalDuration={totalDuration}
        isRunning={isRunning}
        completedSessions={completedSessions}
        treeGrowth={treeGrowth}
        onToggle={() => updatePomodoroTimerState({ isRunning: !isRunning })}
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
          onClick={() => setSoundEnabled(!soundEnabled)}
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
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              设置
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>番茄钟设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  专注时长: {pomodoroSettings.workDuration / 60} 分钟
                </label>
                <Slider
                  value={[pomodoroSettings.workDuration / 60]}
                  min={15}
                  max={60}
                  step={5}
                  onValueChange={([value]) =>
                    updatePomodoroSettings({ workDuration: value * 60 })
                  }
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  短休息时长: {pomodoroSettings.shortBreakDuration / 60} 分钟
                </label>
                <Slider
                  value={[pomodoroSettings.shortBreakDuration / 60]}
                  min={3}
                  max={15}
                  step={1}
                  onValueChange={([value]) =>
                    updatePomodoroSettings({ shortBreakDuration: value * 60 })
                  }
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  长休息时长: {pomodoroSettings.longBreakDuration / 60} 分钟
                </label>
                <Slider
                  value={[pomodoroSettings.longBreakDuration / 60]}
                  min={10}
                  max={30}
                  step={5}
                  onValueChange={([value]) =>
                    updatePomodoroSettings({ longBreakDuration: value * 60 })
                  }
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  长休息间隔: 每 {pomodoroSettings.sessionsBeforeLongBreak} 个番茄钟
                </label>
                <Slider
                  value={[pomodoroSettings.sessionsBeforeLongBreak]}
                  min={2}
                  max={6}
                  step={1}
                  onValueChange={([value]) =>
                    updatePomodoroSettings({ sessionsBeforeLongBreak: value })
                  }
                />
              </div>
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">自动化选项</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">自动开始休息</p>
                    <p className="text-xs text-muted-foreground">专注结束后自动开始休息</p>
                  </div>
                  <Switch
                    checked={autoStartBreak}
                    onCheckedChange={setAutoStartBreak}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">自动开始专注</p>
                    <p className="text-xs text-muted-foreground">休息结束后自动开始专注</p>
                  </div>
                  <Switch
                    checked={autoStartWork}
                    onCheckedChange={setAutoStartWork}
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!isFullscreen && focusPresets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground shrink-0">模式预设：</span>
          {focusPresets.map((preset) => {
            const isActive = pomodoroSettings.workDuration === preset.workDuration &&
              pomodoroSettings.shortBreakDuration === preset.shortBreakDuration
            const isDefault = preset.id.startsWith('preset-')
            
            return (
              <Popover key={preset.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => {
                      if (!isRunning) {
                        applyFocusPreset(preset.id)
                        setAutoStartBreak(preset.autoStartBreak)
                        setAutoStartWork(preset.autoStartWork)
                        setSoundEnabled(preset.soundEnabled)
                      }
                    }}
                    disabled={isRunning}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 group',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/50',
                      isRunning && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                    <span className="text-muted-foreground">{preset.workDuration / 60}+{preset.shortBreakDuration / 60}</span>
                    {!isDefault && (
                      <MoreHorizontal className="h-3 w-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </PopoverTrigger>
                {!isDefault && (
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          if (!isRunning) {
                            updateFocusPreset(preset.id, {
                              name: preset.name,
                              icon: preset.icon,
                              workDuration: pomodoroSettings.workDuration,
                              shortBreakDuration: pomodoroSettings.shortBreakDuration,
                              longBreakDuration: pomodoroSettings.longBreakDuration,
                              sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
                              autoStartBreak,
                              autoStartWork,
                              soundEnabled,
                              color: preset.color,
                            })
                          }
                        }}
                        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        更新为当前设置
                      </button>
                      <button
                        onClick={() => {
                          deleteFocusPreset(preset.id)
                        }}
                        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除预设
                      </button>
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            )
          })}
          <button
            onClick={() => {
              if (!isRunning) {
                addFocusPreset({
                  name: '自定义模式',
                  icon: '⚙️',
                  workDuration: pomodoroSettings.workDuration,
                  shortBreakDuration: pomodoroSettings.shortBreakDuration,
                  longBreakDuration: pomodoroSettings.longBreakDuration,
                  sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
                  autoStartBreak,
                  autoStartWork,
                  soundEnabled,
                  color: '#607D8B',
                })
              }
            }}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1 rounded-lg border border-dashed border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-all shrink-0 hover:border-primary/30 hover:text-primary',
              isRunning && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Plus className="h-3 w-3" />
            保存当前
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={cn('lg:col-span-2 overflow-hidden', isFullscreen && 'lg:col-span-3')}>
          <div className={cn('bg-gradient-to-br p-8', config.gradient)}>
            <div className="mb-8 flex justify-center gap-2">
              {(Object.keys(modeConfig) as TimerMode[]).map((m) => {
                const Icon = modeConfig[m].icon
                const isActive = mode === m
                const isDisabled = isRunning && !isActive
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
            
            {isRunning && (
              <p className="text-center text-xs text-muted-foreground mb-4">
                计时器运行中，模式切换已禁用
              </p>
            )}

            <DynamicTimerRing
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
                onClick={handleReset}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                className={cn(
                  'h-14 w-14 rounded-full text-white flex items-center justify-center',
                  config.bgColor
                )}
                onClick={() => updatePomodoroTimerState({ isRunning: !isRunning })}
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
                onClick={handleSkip}
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
                            <Badge variant="outline" className="text-[10px] px-1 ml-auto shrink-0">
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
                        <Badge className="bg-red-500 text-[10px]">紧急</Badge>
                      )}
                      {selectedTask.priority === 'high' && (
                        <Badge className="bg-orange-500 text-[10px]">高优</Badge>
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
                      <Badge key={tag} variant="secondary" className="gap-1 text-[11px]">
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
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="+ 添加标签..."
                    value={newSessionTag}
                    onChange={(e) => setNewSessionTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSessionTag.trim()) {
                        e.preventDefault()
                        if (!sessionTags.includes(newSessionTag.trim())) {
                          setSessionTags([...sessionTags, newSessionTag.trim()])
                        }
                        setNewSessionTag('')
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
                    }}
                  >
                    +添加
                  </Button>
                </div>
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

        {!isFullscreen && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-chart-3" />
                  今日进度
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{todaySessions}</span>
                  <span className="text-muted-foreground">/ 8 番茄钟</span>
                </div>
                <Progress value={(todaySessions / 8) * 100} className="mt-3 h-2" />
                <div className="mt-4 flex justify-center gap-1">
                  {Array.from({ length: pomodoroSettings.sessionsBeforeLongBreak }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-3 w-3 rounded-full transition-all',
                        i < completedSessions % pomodoroSettings.sessionsBeforeLongBreak
                          ? 'bg-chart-1'
                          : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  完成 {pomodoroSettings.sessionsBeforeLongBreak} 个获得长休息
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TreeDeciduous className="h-5 w-5 text-chart-2" />
                  专注成就
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-32 w-32">
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-1000"
                    style={{
                      height: `${Math.max(treeGrowth, 10)}%`,
                      width: `${30 + treeGrowth * 0.5}%`,
                    }}
                  >
                    <TreeDeciduous
                      className={cn(
                        'h-full w-full transition-colors duration-500',
                        treeGrowth >= 100
                          ? 'text-chart-2'
                          : treeGrowth >= 50
                          ? 'text-chart-2/70'
                          : 'text-chart-2/40'
                      )}
                    />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium">
                    {treeGrowth >= 100
                      ? '你的树已长成!'
                      : treeGrowth >= 50
                      ? '继续加油!'
                      : '开始专注来培育你的树'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    成长度: {treeGrowth}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">本周统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-chart-1" />
                    <span className="text-sm">完成番茄钟</span>
                  </div>
                  <span className="font-medium">{weekStats.weekPomodoros}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-chart-2" />
                    <span className="text-sm">专注时长</span>
                  </div>
                  <span className="font-medium">{weekStats.weekHours.toFixed(1)}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-chart-3" />
                    <span className="text-sm">完成任务</span>
                  </div>
                  <span className="font-medium">{weekStats.weekTasks}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-destructive" />
                    <span className="text-sm">连续天数</span>
                  </div>
                  <span className="font-medium">{streak} 天</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  今日记录
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pomodoroSessions
                    .filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString())
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .map((session) => {
                      const sessionTask = session.taskId ? tasks.find((t) => t.id === session.taskId) : null
                      const sessionTime = new Date(session.completedAt)
                      return (
                        <div key={session.id} className="rounded-lg bg-muted/30 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {sessionTime.getHours().toString().padStart(2, '0')}:{sessionTime.getMinutes().toString().padStart(2, '0')}
                              </span>
                              <span className={cn(
                                'shrink-0 text-xs px-1.5 py-0.5 rounded',
                                session.type === 'work' ? 'bg-chart-1/20 text-chart-1' : 'bg-chart-2/20 text-chart-2'
                              )}>
                                {session.type === 'work' ? '专注' : '休息'}
                              </span>
                            </div>
                            <span className="font-medium">{Math.round(session.duration / 60)} 分钟</span>
                          </div>
                          {session.note && (
                            <p className="mt-1 text-muted-foreground line-clamp-2">{session.note}</p>
                          )}
                          {sessionTask && (
                            <p className="mt-0.5 text-primary/70">📌 {sessionTask.title}</p>
                          )}
                        </div>
                      )
                    })}
                  {pomodoroSessions.filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString()).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">暂无记录</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {todaySessions >= 8 && (
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

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="sm:max-w-md">
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
                      <Badge className="bg-chart-2 text-[10px]">可完成</Badge>
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
                        setShowSummary(false)
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
                  setShowSummary(false)
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
                  const currentMode = pomodoroTimerState.mode
                  const isCurrentlyBreak = currentMode === 'short-break' || currentMode === 'long-break'
                  if (isCurrentlyBreak) {
                    // 模式已切换到休息，直接启动
                    updatePomodoroTimerState({ isRunning: true })
                  } else {
                    // 兜底：万一 mode 还在 work，手动切到下一个休息模式并启动
                    const nextBreak = (completedSessions + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0
                    updatePomodoroTimerState({
                      mode: nextBreak ? 'long-break' : 'short-break',
                      timeLeft: nextBreak
                        ? pomodoroSettings.longBreakDuration
                        : pomodoroSettings.shortBreakDuration,
                      isRunning: true,
                    })
                  }
                  setShowSummary(false)
                }}
              >
                休息一下
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
