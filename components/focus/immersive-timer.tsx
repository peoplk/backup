'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Play,
  Pause,
  RotateCcw,
  Minimize2,
  SkipForward,
  StretchVertical,
  Footprints,
  Droplets,
  Eye,
  Wind,
  Heart,
  TreeDeciduous,
  Sparkles,
  Target,
  GraduationCap,
  Moon,
  Settings,
  X,
  Volume2,
  VolumeX,
  Music,
  Waves,
  CloudRain,
  Coffee,
  Flame,
  Plane,
  Train,
  Keyboard,
  CloudLightning,
  TrainFront,
  Car,
  Clock3,
  Shell,
  Bell,
  Bird,
  Music4,
  MoonStar,
  AudioWaveform,
  Activity,
  Radio,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/lib/store'
import type { PomodoroSettings } from '@/lib/types'
import {
  AMBIENT_SOUNDS,
  FOCUS_MUSIC,
  syncFocusSound,
} from '@/lib/focus-sound-engine'
import { FOCUS_SOUND_PRESETS, type FocusSoundPreset } from '@/lib/focus-sound-presets'
import { useSoundSleepTimer } from '@/lib/use-sound-sleep-timer'

const SOUND_ICONS: Record<string, React.ElementType> = {
  white: AudioWaveform,
  pink: Activity,
  brown: Radio,
  storm: CloudLightning,
  stream: Droplets,
  subway: TrainFront,
  street: Car,
  clock: Clock3,
  fountain: Shell,
  temple: Bell,
  nightbug: Bird,
  lullaby: Music4,
  nightsea: MoonStar,
  starlight: Sparkles,
  rain: CloudRain,
  forest: TreeDeciduous,
  waves: Waves,
  wind: Wind,
  fire: Flame,
  cafe: Coffee,
  plane: Plane,
  train: Train,
  keyboard: Keyboard,
  heartbeat: Heart,
}

// 噪音风格（白/粉/棕）单独成组，参考 white-noises.com 的彩色噪音概念
const NOISE_STYLES = AMBIENT_SOUNDS.filter(s => s.category === 'noise')
const AMBIENT_ONLY = AMBIENT_SOUNDS.filter(s => s.category !== 'noise')

/** 空混音的稳定引用（渲染层规范化用，避免每次渲染新建对象） */
const EMPTY_SOUND_LEVELS: Record<string, number> = {}

type TimerMode = 'work' | 'short-break' | 'long-break'
type ImmersiveStyleMode = 'neon' | 'chalk' | 'oled'

const STYLE_KEY = 'focusflow-immersive-style'
const STYLE_OPTIONS = [
  { id: 'neon' as const, label: '星环', Icon: Sparkles },
  { id: 'chalk' as const, label: '黑板', Icon: GraduationCap },
  { id: 'oled' as const, label: '暗夜', Icon: Moon },
]

function loadImmersiveStyle(): ImmersiveStyleMode {
  if (typeof window === 'undefined') return 'neon'
  try {
    const v = window.localStorage.getItem(STYLE_KEY)
    if (v === 'chalk' || v === 'oled' || v === 'neon') return v
  } catch {
    // ignore
  }
  return 'neon'
}

// 黑板风格的板书字体（与自习室同一套教室语言）
const CHALK_FONT = { fontFamily: "'Kaiti SC', 'KaiTi', 'STKaiti', 'DFKai-SB', serif" } as const
const MONO_FONT = { fontFamily: 'var(--font-timer), ui-monospace, "Space Grotesk", "Inter", monospace' } as const

const modeConfig = {
  work: {
    label: '专注',
    color: '#6366f1',
    bgFrom: '#0a0c14',
    bgMid: '#12162a',
    bgTo: '#0d1020',
    glowColor: '#6366f1',
    // 工作模式的颜色阶段：从蓝色 -> 青色 -> 绿色 -> 黄色 -> 橙色 -> 红色
    colorStages: [
      { progress: 0, color: '#6366f1' },      // 蓝色
      { progress: 20, color: '#06b6d4' },     // 青色
      { progress: 40, color: '#10b981' },     // 绿色
      { progress: 60, color: '#f59e0b' },     // 黄色
      { progress: 80, color: '#f97316' },     // 橙色
      { progress: 100, color: '#ef4444' },    // 红色
    ],
  },
  'short-break': {
    label: '短休息',
    color: '#10b981',
    bgFrom: '#081210',
    bgMid: '#0a1f1a',
    bgTo: '#071510',
    glowColor: '#10b981',
    colorStages: [
      { progress: 0, color: '#6ee7b7' },
      { progress: 100, color: '#059669' },
    ],
  },
  'long-break': {
    label: '长休息',
    color: '#f59e0b',
    bgFrom: '#140c04',
    bgMid: '#1f1508',
    bgTo: '#140a04',
    glowColor: '#f59e0b',
    colorStages: [
      { progress: 0, color: '#fcd34d' },
      { progress: 100, color: '#d97706' },
    ],
  },
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

function interpolateColor(progress: number, stages: { progress: number; color: string }[]) {
  let lowerStage = stages[0]
  let upperStage = stages[stages.length - 1]

  for (let i = 0; i < stages.length - 1; i++) {
    if (progress >= stages[i].progress && progress <= stages[i + 1].progress) {
      lowerStage = stages[i]
      upperStage = stages[i + 1]
      break
    }
  }

  const range = upperStage.progress - lowerStage.progress
  const stageProgress = range === 0 ? 0 : (progress - lowerStage.progress) / range
  const clampedProgress = Math.max(0, Math.min(1, stageProgress))

  const from = hexToRgb(lowerStage.color)
  const to = hexToRgb(upperStage.color)
  const r = Math.round(from[0] + (to[0] - from[0]) * clampedProgress)
  const g = Math.round(from[1] + (to[1] - from[1]) * clampedProgress)
  const b = Math.round(from[2] + (to[2] - from[2]) * clampedProgress)

  return `rgb(${r}, ${g}, ${b})`
}

const breakSuggestions = [
  { icon: StretchVertical, text: '站起来伸展一下身体', color: '#10b981' },
  { icon: Footprints, text: '走动几分钟，活动筋骨', color: '#3b82f6' },
  { icon: Droplets, text: '喝杯水，保持水分', color: '#06b6d4' },
  { icon: Eye, text: '远眺窗外，放松眼睛', color: '#8b5cf6' },
  { icon: Wind, text: '深呼吸几次，放松心情', color: '#14b8a6' },
  { icon: Heart, text: '闭目养神，静心休息', color: '#ec4899' },
]

const motivationalQuotes = [
  { text: '专注是成功的关键', author: '达·芬奇' },
  { text: '每一次专注都是一次进步', author: '' },
  { text: '坚持就是胜利', author: '' },
  { text: '小步前进，终将抵达终点', author: '' },
  { text: '今天的努力是明天的收获', author: '' },
  { text: '专注当下，成就未来', author: '' },
  { text: '时间是最宝贵的资源', author: '' },
  { text: '效率来自专注', author: '' },
  { text: '休息是为了走更远的路', author: '' },
  { text: '保持节奏，持续前进', author: '' },
]

/**
 * 长按放弃按钮：严格模式下的唯一安全出口。
 * 需要按住填满整圈才触发，避免误触或下意识点击导致专注中断。
 */
function HoldToGiveUpButton({
  seconds,
  onComplete,
}: {
  seconds: number
  onComplete: () => void
}) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const lockRef = useRef(false)

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setHolding(false)
    setProgress(0)
  }, [])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  const start = useCallback(() => {
    if (lockRef.current) return
    startRef.current = Date.now()
    setHolding(true)
    const loop = () => {
      const p = Math.min(1, (Date.now() - startRef.current) / (seconds * 1000))
      setProgress(p)
      if (p >= 1) {
        rafRef.current = null
        lockRef.current = true
        setHolding(false)
        setProgress(0)
        onComplete()
        // 触发后短暂上锁，避免连续触发
        window.setTimeout(() => {
          lockRef.current = false
        }, 1500)
        return
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [onComplete, seconds])

  const pct = Math.round(progress * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        aria-label={`长按 ${seconds} 秒放弃本次专注`}
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          background: `conic-gradient(rgba(239,68,68,0.85) ${pct}%, rgba(255,255,255,0.10) ${pct}%)`,
          transition: 'transform 0.15s ease',
          transform: holding ? 'scale(0.94)' : 'scale(1)',
          touchAction: 'none',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: pct > 0 ? '#fca5a5' : 'rgba(255,255,255,0.5)',
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          }}
        >
          {pct > 0 && pct < 100 ? `${Math.ceil(seconds * (1 - progress))}` : '放弃'}
        </span>
      </button>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>
        长按 {seconds} 秒放弃
      </span>
    </div>
  )
}

interface ImmersiveTimerProps {
  mode: TimerMode
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  completedSessions: number
  treeGrowth: number
  taskTitle?: string
  sessionsBeforeLongBreak?: number
  onToggle: () => void
  onReset: () => void
  onSkip: () => void
  onExit: () => void
  /** 全屏严格模式：已请求主进程级窗口锁定（kiosk） */
  strictLocked?: boolean
  /** 严格模式是否可用（Electron 环境才有系统级锁定） */
  strictSupported?: boolean
  /** 放弃本次专注需长按的秒数，0 表示不允许放弃 */
  strictHoldSeconds?: number
  /** 用户尝试绕过锁定的次数 */
  strictViolationCount?: number
  /** 干扰网站/应用屏蔽是否已随锁定生效 */
  strictShieldActive?: boolean
  /** 长按完成后请求放弃（由父级二次确认并执行放弃记录） */
  onRequestGiveUp?: () => void
}

export function ImmersiveTimer({
  mode,
  timeLeft,
  totalDuration,
  isRunning,
  completedSessions,
  treeGrowth,
  taskTitle,
  sessionsBeforeLongBreak = 4,
  onToggle,
  onReset,
  onSkip,
  onExit,
  strictLocked = false,
  strictSupported = false,
  strictHoldSeconds = 3,
  strictViolationCount = 0,
  strictShieldActive = false,
  onRequestGiveUp,
}: ImmersiveTimerProps) {
  const config = modeConfig[mode]
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100
  // 严格模式：软锁定（浏览器）也算锁定，只是没有系统级强制力
  const isStrict = strictLocked && mode === 'work'
  const canGiveUp = isStrict && strictHoldSeconds > 0 && typeof onRequestGiveUp === 'function'

  const currentProgress = ((totalDuration - timeLeft) / totalDuration) * 100
  const dynamicColor = interpolateColor(currentProgress, config.colorStages)

  const [styleMode, setStyleModeState] = useState<ImmersiveStyleMode>(loadImmersiveStyle)
  const setImmersiveStyle = (s: ImmersiveStyleMode) => {
    setStyleModeState(s)
    try {
      window.localStorage.setItem(STYLE_KEY, s)
    } catch {
      // ignore
    }
  }

  // 全屏内直接修改时间参数（无需退出）
  const pomodoroSettings = useAppStore((s) => s.pomodoroSettings)
  const updatePomodoroSettings = useAppStore((s) => s.updatePomodoroSettings)
  const updatePomodoroTimerState = useAppStore((s) => s.updatePomodoroTimerState)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 白噪声/专注音效：与专注页弹层共用同一引擎与 store 选择（多轨混音）
  // 注意：选择器只取原始切片（引用稳定），规范化放在渲染层，避免 getSnapshot 返回新对象导致无限重渲染
  const focusSoundState = useAppStore((s) => s.focusSoundSettings)
  const focusSoundSettings = {
    isPlaying: focusSoundState?.isPlaying || false,
    volume: focusSoundState?.volume || 50,
    soundLevels: focusSoundState?.soundLevels ?? EMPTY_SOUND_LEVELS,
    currentMusic: focusSoundState?.currentMusic || null,
    sleepTimerEndsAt: focusSoundState?.sleepTimerEndsAt ?? null,
  }
  const updateFocusSoundSettings = useAppStore((s) => s.updateFocusSoundSettings)
  const [soundOpen, setSoundOpen] = useState(false)
  // 睡眠定时的剩余时间显示（每秒刷新）
  const [now, setNowTick] = useState(Date.now())
  const soundIsPlaying = focusSoundSettings.isPlaying
  const soundVolume = focusSoundSettings.volume
  const soundLevels = focusSoundSettings.soundLevels
  const remainingMin = focusSoundSettings.sleepTimerEndsAt
    ? Math.max(0, Math.ceil((focusSoundSettings.sleepTimerEndsAt - now) / 60000))
    : null

  // 播放状态/混音/音量变化 → 引擎同步（引擎幂等 diff 启停轨道）
  useEffect(() => {
    syncFocusSound({
      soundLevels,
      currentMusic: focusSoundSettings.currentMusic,
      isPlaying: soundIsPlaying,
      volume: soundVolume,
    })
  }, [soundLevels, focusSoundSettings.currentMusic, soundIsPlaying, soundVolume])

  // 睡眠定时到点：暂停播放并清除定时
  useSoundSleepTimer(focusSoundSettings.sleepTimerEndsAt, () => {
    updateFocusSoundSettings({ isPlaying: false, sleepTimerEndsAt: null })
  })

  useEffect(() => {
    if (!focusSoundSettings.sleepTimerEndsAt) return
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [focusSoundSettings.sleepTimerEndsAt])

  /** 点选音源 = 加入/移出混音（多轨并行） */
  const toggleTrack = (soundId: string) => {
    const next = { ...soundLevels }
    if (soundId in next) {
      delete next[soundId]
    } else {
      next[soundId] = 50
    }
    updateFocusSoundSettings({
      soundLevels: next,
      isPlaying: Object.keys(next).length > 0 || !!focusSoundSettings.currentMusic,
    })
  }

  /** 每轨独立音量 */
  const changeTrackLevel = (soundId: string, level: number) => {
    updateFocusSoundSettings({ soundLevels: { ...soundLevels, [soundId]: level } })
  }

  /** 双耳节拍单选，再点一次关闭；与环境音叠加 */
  const selectBinaural = (musicId: string) => {
    if (focusSoundSettings.currentMusic === musicId) {
      updateFocusSoundSettings({
        currentMusic: null,
        isPlaying: Object.keys(soundLevels).length > 0,
      })
    } else {
      updateFocusSoundSettings({ currentMusic: musicId, isPlaying: true })
    }
  }

  const applyPreset = (preset: FocusSoundPreset) => {
    updateFocusSoundSettings({ soundLevels: { ...preset.levels }, isPlaying: true })
  }

  const stopAllSound = () => {
    updateFocusSoundSettings({
      soundLevels: {},
      currentMusic: null,
      isPlaying: false,
      sleepTimerEndsAt: null,
    })
  }

  const setSleepTimer = (minutes: number | null) => {
    updateFocusSoundSettings({
      sleepTimerEndsAt: minutes ? Date.now() + minutes * 60000 : null,
      isPlaying: minutes ? true : soundIsPlaying,
    })
  }

  const changeSoundVolume = (v: number[]) => {
    updateFocusSoundSettings({ volume: v[0] })
  }

  const DURATION_FIELDS = [
    { key: 'workDuration' as const, label: '专注时长', min: 15, max: 60, step: 5, mode: 'work' as const },
    { key: 'shortBreakDuration' as const, label: '短休息', min: 3, max: 15, step: 1, mode: 'short-break' as const },
    { key: 'longBreakDuration' as const, label: '长休息', min: 10, max: 30, step: 5, mode: 'long-break' as const },
  ]

  const applySettingsChange = (patch: Partial<PomodoroSettings>, syncMode?: TimerMode) => {
    updatePomodoroSettings(patch)
    // 暂停/待机时改当前时段的时长：即时生效；运行中则从下一时段生效
    if (!isRunning && syncMode && syncMode === mode) {
      const seconds = 'sessionsBeforeLongBreak' in patch
        ? timeLeft
        : (Object.values(patch)[0] as number)
      if (typeof seconds === 'number' && seconds > 0) {
        updatePomodoroTimerState({ timeLeft: seconds })
      }
    }
  }

  const [currentSuggestion, setCurrentSuggestion] = useState(0)
  const [quoteVisible, setQuoteVisible] = useState(true)
  const [displayQuote, setDisplayQuote] = useState(motivationalQuotes[0])
  const quoteIndexRef = useRef(0)

  // 名人名言实时拉取：主源一言（hitokoto）、备源今日诗词；网络不可用时回退本地语录池
  const fetchLiveQuote = async () => {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 5000)
    try {
      let text = ''
      let author = ''
      try {
        const res = await fetch('https://v1.hitokoto.cn/?max_length=30', { signal: ctrl.signal })
        const data = await res.json()
        text = data.hitokoto || ''
        author = data.from_who || data.from || ''
      } catch {
        const res = await fetch('https://v1.jinrishici.com/all', { signal: ctrl.signal })
        const data = await res.json()
        text = data.content || ''
        author = data.author || data.origin || ''
      }
      if (text) setDisplayQuote({ text, author })
    } catch {
      // 离线/超时：继续使用本地语录池
    } finally {
      window.clearTimeout(timer)
    }
  }

  useEffect(() => {
    void fetchLiveQuote()
    const interval = setInterval(() => {
      setQuoteVisible(false)
      setTimeout(() => {
        quoteIndexRef.current = (quoteIndexRef.current + 1) % motivationalQuotes.length
        setDisplayQuote(motivationalQuotes[quoteIndexRef.current])
        setQuoteVisible(true)
        void fetchLiveQuote()
      }, 500)
    }, 10000)
    return () => clearInterval(interval)
  }, [])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.setProperty('margin', '0', 'important')
    document.body.style.setProperty('padding', '0', 'important')
    document.documentElement.style.setProperty('margin', '0', 'important')
    document.documentElement.style.setProperty('padding', '0', 'important')
    document.documentElement.style.setProperty('overflow', 'hidden', 'important')
    document.body.style.setProperty('overflow', 'hidden', 'important')

    const fitToScreen = () => {
      if (!containerRef.current) return
      const el = containerRef.current
      el.style.setProperty('position', 'fixed', 'important')
      el.style.setProperty('inset', '0', 'important')
      el.style.setProperty('width', '100vw', 'important')
      el.style.setProperty('height', '100vh', 'important')
      el.style.setProperty('margin', '0', 'important')
      el.style.setProperty('padding', '0', 'important')
      el.style.setProperty('border', 'none', 'important')
    }
    fitToScreen()
    window.addEventListener('resize', fitToScreen)

    return () => {
      window.removeEventListener('resize', fitToScreen)
      document.body.style.removeProperty('margin')
      document.body.style.removeProperty('padding')
      document.body.style.removeProperty('overflow')
      document.documentElement.style.removeProperty('margin')
      document.documentElement.style.removeProperty('padding')
      document.documentElement.style.removeProperty('overflow')
    }
  }, [])

  // 严格模式：拦截 Esc 退出（浏览器全屏路径）；Electron 下由主进程 kiosk 兜底
  useEffect(() => {
    if (!isStrict) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onFullscreenChange = () => {
      // 浏览器环境被强制退出全屏时立刻拉回
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        void document.documentElement.requestFullscreen().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [isStrict])

  useEffect(() => {
    if (mode !== 'work') {
      const interval = setInterval(() => {
        setCurrentSuggestion(prev => (prev + 1) % breakSuggestions.length)
      }, 8000)
      return () => clearInterval(interval)
    }
  }, [mode])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 树的尺寸/透明度只随 completedSessions 稳定增长时生成一次，
  // 避免依赖变化时全部重随机导致视觉抖动
  const trees = useMemo(() => {
    const breakEvery = sessionsBeforeLongBreak || 4
    const result = []
    const totalTrees = Math.min(Math.floor(completedSessions / breakEvery) + 1, 12)
    const rng = () => {
      let seed = 0x2f6e2b1 + completedSessions * 0x9e3779b9
      return () => {
        seed = (seed + 0x9e3779b9) & 0xffffffff
        const t = (seed ^ (seed >>> 15)) >>> 0
        return t / 0xffffffff
      }
    }
    const next = rng()
    for (let i = 0; i < totalTrees; i++) {
      result.push({
        size: 24 + next() * 28,
        opacity: 0.4 + next() * 0.5,
        isComplete: i < Math.floor(completedSessions / breakEvery),
      })
    }
    return result
  }, [completedSessions, sessionsBeforeLongBreak])

  const suggestion = breakSuggestions[currentSuggestion]
  const SuggestionIcon = suggestion.icon

  const radius = 132
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  const sessionIndex = (sessionsBeforeLongBreak || 4) > 0 ? completedSessions % (sessionsBeforeLongBreak || 4) : 0

  // 三套风格的皮肤参数：neon 沿用动态色环；chalk 黑板粉笔；oled 纯黑极简
  const skin = useMemo(() => {
    if (styleMode === 'chalk') {
      return {
        bg: 'radial-gradient(ellipse at 50% 38%, #33584c 0%, #27453c 55%, #1d3830 100%)',
        timeColor: '#ffffff',
        timeShadow: '0 0 3px rgba(255,255,255,0.4)',
        labelColor: 'rgba(255,255,255,0.65)',
        secondary: 'rgba(255,255,255,0.7)',
        badgeBg: 'rgba(255,255,255,0.08)',
        badgeBorder: '1px solid rgba(255,255,255,0.22)',
        badgeColor: 'rgba(255,255,255,0.88)',
        dotActive: 'rgba(255,255,255,0.85)',
        dotInactive: 'rgba(255,255,255,0.25)',
        ghostBorder: '1px solid rgba(255,255,255,0.35)',
        ghostBg: 'transparent',
        ghostColor: 'rgba(255,255,255,0.75)',
        playBg: 'rgba(255,255,255,0.12)',
        playColor: '#ffffff',
        playBorder: '2px solid rgba(255,255,255,0.45)',
        playGlow: 'none',
      }
    }
    if (styleMode === 'oled') {
      return {
        bg: '#000000',
        timeColor: '#ffffff',
        timeShadow: 'none',
        labelColor: 'rgba(255,255,255,0.35)',
        secondary: 'rgba(255,255,255,0.45)',
        badgeBg: 'rgba(255,255,255,0.05)',
        badgeBorder: '1px solid rgba(255,255,255,0.1)',
        badgeColor: 'rgba(255,255,255,0.75)',
        dotActive: 'rgba(255,255,255,0.7)',
        dotInactive: 'rgba(255,255,255,0.12)',
        ghostBorder: '1px solid rgba(255,255,255,0.14)',
        ghostBg: 'transparent',
        ghostColor: 'rgba(255,255,255,0.5)',
        playBg: '#ffffff',
        playColor: '#000000',
        playBorder: 'none',
        playGlow: '0 0 40px rgba(255,255,255,0.15)',
      }
    }
    return {
      bg: `radial-gradient(ellipse at 50% 0%, ${config.bgMid} 0%, ${config.bgFrom} 50%, ${config.bgTo} 100%)`,
      timeColor: '#ffffff',
      timeShadow: 'none',
      labelColor: dynamicColor,
      secondary: dynamicColor,
      badgeBg: 'rgba(255,255,255,0.06)',
      badgeBorder: '1px solid rgba(255,255,255,0.09)',
      badgeColor: 'rgba(255,255,255,0.85)',
      dotActive: dynamicColor,
      dotInactive: 'rgba(255,255,255,0.16)',
      ghostBorder: '1px solid rgba(255,255,255,0.1)',
      ghostBg: 'rgba(255,255,255,0.05)',
      ghostColor: 'rgba(255,255,255,0.45)',
      playBg: dynamicColor,
      playColor: 'white',
      playBorder: 'none',
      playGlow: `0 0 60px ${dynamicColor}55, 0 12px 40px rgba(0,0,0,0.35)`,
    }
  }, [styleMode, dynamicColor, config])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div ref={containerRef} className="immersive-fullscreen" style={{
      position: 'fixed',
      inset: 0,
      margin: 0,
      padding: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      boxSizing: 'border-box',
      background: skin.bg,
    }}>
      {/* 风格专属背景层 */}
      {styleMode === 'neon' && (
        <>
          {/* 顶部环境光晕 */}
          <div style={{
            position: 'absolute',
            top: '-30%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '110%',
            height: '60%',
            background: `radial-gradient(ellipse at 50% 50%, ${dynamicColor}1f 0%, transparent 65%)`,
            pointerEvents: 'none',
            transition: 'background 0.5s ease',
          }} />
          {/* 点阵背景 */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle at 50% 50%, ${dynamicColor}05 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
            pointerEvents: 'none',
            transition: 'background-image 0.5s ease',
          }} />
        </>
      )}
      {styleMode === 'chalk' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 140px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }} />
      )}
      {styleMode === 'oled' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 2,
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: 'rgba(255,255,255,0.85)',
          transition: 'width 0.3s ease-out',
          pointerEvents: 'none',
        }} />
      )}

      {/* 顶部栏：会话徽章 + 风格切换 + 退出 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '28px 32px',
        zIndex: 2,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 18px',
          borderRadius: 999,
          background: skin.badgeBg,
          border: skin.badgeBorder,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: styleMode === 'neon' ? dynamicColor : 'rgba(255,255,255,0.8)',
            boxShadow: styleMode === 'neon' ? `0 0 12px ${dynamicColor}` : 'none',
            transition: 'background 0.5s ease',
          }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: skin.badgeColor, ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
            {config.label}
          </span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
             第 {sessionIndex + 1} 个 · 共 {sessionsBeforeLongBreak} 个
          </span>
        </div>

        {/* 风格切换器 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 5,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}>
          {STYLE_OPTIONS.map((s) => {
            const active = styleMode === s.id
            return (
              <button
                key={s.id}
                title={`${s.label}风格`}
                aria-label={`${s.label}风格`}
                onClick={() => setImmersiveStyle(s.id)}
                style={{
                  width: 34,
                  height: 28,
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                <s.Icon style={{ width: 15, height: 15 }} />
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setSoundOpen(true)}
            aria-label="白噪声设置"
            title="白噪声设置"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: soundIsPlaying ? '1px solid rgba(255,255,255,0.35)' : skin.badgeBorder,
              background: soundIsPlaying ? 'rgba(255,255,255,0.16)' : skin.badgeBg,
              color: soundIsPlaying ? '#ffffff' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = soundIsPlaying ? 'rgba(255,255,255,0.16)' : skin.badgeBg; e.currentTarget.style.color = soundIsPlaying ? '#ffffff' : 'rgba(255,255,255,0.55)' }}
          >
            {soundIsPlaying ? <Volume2 style={{ width: 20, height: 20 }} /> : <VolumeX style={{ width: 20, height: 20 }} />}
          </button>
          {!isStrict && (
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="时间设置"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: skin.badgeBorder,
                background: skin.badgeBg,
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = skin.badgeBg; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
            >
              <Settings style={{ width: 20, height: 20 }} />
            </button>
          )}
          {isStrict ? (
            <div
              title={
                strictSupported
                  ? '严格模式已锁定窗口：Esc、关闭窗口、切换应用均会被拦截'
                  : '严格模式（当前环境不支持系统级锁定，仅锁定界面操作）'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 44,
                padding: '0 16px',
                borderRadius: 999,
                border: '1px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.12)',
                color: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            >
              <Lock style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>严格模式</span>
              {strictShieldActive && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <ShieldCheck style={{ width: 14, height: 14 }} />
                  已屏蔽
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={onExit}
              aria-label="退出全屏"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: skin.badgeBorder,
                background: skin.badgeBg,
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = skin.badgeBg; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
            >
              <Minimize2 style={{ width: 20, height: 20 }} />
            </button>
          )}
        </div>
      </div>

      {/* 时间参数面板 */}
      {settingsOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            style={{
              width: 'min(92vw, 440px)',
              maxHeight: '82vh',
              overflowY: 'auto',
              borderRadius: 20,
              background: styleMode === 'oled' ? '#0a0a0a' : styleMode === 'chalk' ? 'rgba(255,255,255,0.07)' : 'rgba(13,16,28,0.94)',
              border: skin.badgeBorder,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              padding: '24px 26px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: skin.badgeColor, ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
                时间参数
              </span>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="关闭时间设置"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {DURATION_FIELDS.map((f) => (
                <div key={f.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
                      {f.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: skin.secondary, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                      {pomodoroSettings[f.key] / 60} 分钟
                    </span>
                  </div>
                  <Slider
                    value={[pomodoroSettings[f.key] / 60]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onValueChange={([v]) => applySettingsChange({ [f.key]: v * 60 }, f.mode)}
                  />
                </div>
              ))}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
                    长休息间隔
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: skin.secondary, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                    每 {pomodoroSettings.sessionsBeforeLongBreak} 个番茄
                  </span>
                </div>
                <Slider
                  value={[pomodoroSettings.sessionsBeforeLongBreak]}
                  min={2}
                  max={6}
                  step={1}
                  onValueChange={([v]) => applySettingsChange({ sessionsBeforeLongBreak: v })}
                />
              </div>
            </div>

            <p style={{ marginTop: 18, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)', ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
              {isRunning
                ? '运行中的时段不受影响，新时长从下一时段生效'
                : '当前时段的剩余时间已按新时长即时更新'}
            </p>

            <button
              onClick={() => setSettingsOpen(false)}
              style={{
                marginTop: 18,
                width: '100%',
                height: 42,
                borderRadius: 12,
                border: skin.ghostBorder,
                background: skin.playBg,
                color: skin.playColor,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* 白噪声/专注音效面板 */}
      {soundOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setSoundOpen(false)}
        >
          <div
            style={{
              width: 'min(92vw, 460px)',
              maxHeight: '82vh',
              overflowY: 'auto',
              borderRadius: 20,
              background: styleMode === 'oled' ? '#0a0a0a' : styleMode === 'chalk' ? 'rgba(255,255,255,0.07)' : 'rgba(13,16,28,0.94)',
              border: skin.badgeBorder,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              padding: '24px 26px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: skin.badgeColor, display: 'flex', alignItems: 'center', gap: 8, ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
                <Music style={{ width: 16, height: 16 }} />
                白噪声与专注音效
              </span>
              <button
                onClick={() => setSoundOpen(false)}
                aria-label="关闭声音面板"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* 总音量 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>总音量</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: skin.secondary, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                  {soundVolume}%
                </span>
              </div>
              <Slider
                value={[soundVolume]}
                min={0}
                max={100}
                step={1}
                onValueChange={changeSoundVolume}
              />
            </div>

            {/* 预设组合 */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>预设组合</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FOCUS_SOUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      fontSize: 11,
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.65)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 白噪音风格：点选加入混音，再点移出 */}
            <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>白噪音风格</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {NOISE_STYLES.map((sound) => {
                const Icon = SOUND_ICONS[sound.id] ?? Music
                const active = sound.id in soundLevels
                const desc = sound.id === 'white' ? '均匀遮蔽人声' : sound.id === 'pink' ? '柔和近似雨声' : '低沉近似瀑布'
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleTrack(sound.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 3,
                      padding: '12px 6px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      border: active ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.12)',
                      background: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Icon style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{sound.name}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
                  </button>
                )
              })}
            </div>

            {/* 环境音效（可多选叠加） */}
            <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>环境音效（可多选叠加）</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {AMBIENT_ONLY.map((sound) => {
                const Icon = SOUND_ICONS[sound.id] ?? Music
                const active = sound.id in soundLevels
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleTrack(sound.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '10px 4px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Icon style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{sound.name}</span>
                  </button>
                )
              })}
            </div>

            {/* 已启用音源：每轨独立音量 */}
            {Object.keys(soundLevels).length > 0 && (
              <div style={{ marginTop: 18 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                  已启用音源（{Object.keys(soundLevels).length} 轨）
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(soundLevels).map(([id, level]) => {
                    const sound = AMBIENT_SOUNDS.find(s => s.id === id)
                    if (!sound) return null
                    const Icon = SOUND_ICONS[id] ?? Music
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', width: 44, flexShrink: 0 }}>{sound.name}</span>
                        <div style={{ flex: 1 }}>
                          <Slider
                            value={[level]}
                            min={5}
                            max={100}
                            step={1}
                            onValueChange={(v) => changeTrackLevel(id, v[0])}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: skin.secondary, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', width: 34, textAlign: 'right', flexShrink: 0 }}>
                          {level}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 双耳节拍 */}
            <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', margin: '18px 0 10px' }}>双耳节拍</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {FOCUS_MUSIC.map((music) => {
                const active = focusSoundSettings.currentMusic === music.id
                return (
                  <button
                    key={music.id}
                    onClick={() => selectBinaural(music.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      padding: '10px 6px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{music.name}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{music.frequency} · {music.description}</span>
                  </button>
                )
              })}
            </div>

            {/* 定时停止 */}
            <div style={{ marginTop: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                定时停止{remainingMin !== null && <span style={{ color: skin.secondary }}> · 剩 {remainingMin} 分钟</span>}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[null, 15, 30, 60].map((minutes) => {
                  const active = minutes === null
                    ? focusSoundSettings.sleepTimerEndsAt === null
                    : remainingMin !== null && Math.abs(remainingMin - minutes) < 1
                  return (
                    <button
                      key={String(minutes)}
                      onClick={() => setSleepTimer(minutes)}
                      style={{
                        padding: '7px 0',
                        borderRadius: 10,
                        fontSize: 11,
                        cursor: 'pointer',
                        border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {minutes === null ? '关闭' : `${minutes} 分钟`}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 停止：清空混音并暂停 */}
            <button
              onClick={stopAllSound}
              disabled={!soundIsPlaying}
              style={{
                marginTop: 18,
                width: '100%',
                height: 42,
                borderRadius: 12,
                border: skin.ghostBorder,
                background: soundIsPlaying ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: soundIsPlaying ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                fontSize: 14,
                fontWeight: 500,
                cursor: soundIsPlaying ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              {soundIsPlaying ? '清空并停止' : '未在播放'}
            </button>

            <p style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)' }}>
              多种音源可同时叠加，每轨独立调节音量；专注页与全屏保持同步，开启"开始专注时自动播放"后入座即有声音。
            </p>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        zIndex: 1,
      }}>
        {/* 当前任务 */}
        {taskTitle && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderRadius: 999,
            background: skin.badgeBg,
            border: skin.badgeBorder,
            marginBottom: 44,
            maxWidth: '46vw',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}>
            <Target style={{ width: 16, height: 16, color: skin.labelColor, flexShrink: 0, transition: 'color 0.5s ease' }} />
            <span style={{
              fontSize: 16,
              fontWeight: 500,
              color: skin.badgeColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {taskTitle}
            </span>
          </div>
        )}

        {/* 计时主体：三种风格 */}
        {styleMode === 'neon' && (
          <div style={{ position: 'relative', width: 300, height: 300 }}>
            {isRunning && (
              <div
                id="breath-ring"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 380,
                  height: 380,
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            )}

            <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', top: 0, left: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={dynamicColor} stopOpacity="1" />
                  <stop offset="100%" stopColor={dynamicColor} stopOpacity="0.4" />
                </linearGradient>
              </defs>

              <circle cx="150" cy="150" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />

              <circle
                cx="150" cy="150" r={radius} fill="none"
                stroke="url(#pg)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 150 150)"
                style={{ transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.5s ease' }}
              />

              {isRunning && (
                <circle
                  cx="150" cy="150" r={radius - 24} fill="none"
                  stroke={dynamicColor}
                  strokeWidth="1"
                  opacity="0.18"
                  style={{ animation: 'pulse 2s ease-in-out infinite' }}
                />
              )}
            </svg>

            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}>
              <span style={{
                fontSize: 64,
                fontWeight: 700,
                fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif',
                color: '#ffffff',
                letterSpacing: '-2px',
                lineHeight: 1,
              }}>
                {formatTime(timeLeft)}
              </span>
              <span style={{
                fontSize: 14,
                letterSpacing: '4px',
                color: dynamicColor,
                fontWeight: 500,
                textTransform: 'uppercase',
                transition: 'color 0.5s ease',
              }}>
                {config.label}
              </span>
            </div>
          </div>
        )}

        {styleMode === 'chalk' && (
          <div style={{ width: 'min(62vw, 560px)', textAlign: 'center' }}>
            <p style={{
              ...MONO_FONT,
              fontSize: 'clamp(88px, 13vw, 150px)',
              fontWeight: 700,
              lineHeight: 1,
              color: skin.timeColor,
              textShadow: skin.timeShadow,
              letterSpacing: '-2px',
            }}>
              {formatTime(timeLeft)}
            </p>
            <p style={{ marginTop: 12, fontSize: 20, letterSpacing: '10px', color: skin.labelColor, ...CHALK_FONT }}>
              {config.label}
            </p>
            {/* 粉笔进度线 */}
            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.14)', marginTop: 30 }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${Math.min(100, Math.max(0, progress))}%`,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.85)',
                boxShadow: '0 0 6px rgba(255,255,255,0.4)',
                transition: 'width 0.3s ease-out',
              }} />
            </div>
          </div>
        )}

        {styleMode === 'oled' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{
              ...MONO_FONT,
              fontSize: 'clamp(96px, 15vw, 170px)',
              fontWeight: 200,
              lineHeight: 1,
              color: '#ffffff',
              letterSpacing: '-4px',
            }}>
              {formatTime(timeLeft)}
            </p>
            <p style={{ marginTop: 16, fontSize: 12, letterSpacing: '12px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
              {config.label}
            </p>
          </div>
        )}

        {/* 会话进度点 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 44 }}>
          {Array.from({ length: sessionsBeforeLongBreak }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === sessionIndex ? 22 : 7,
                height: 7,
                borderRadius: 4,
                background: i <= sessionIndex ? skin.dotActive : skin.dotInactive,
                boxShadow: i <= sessionIndex && styleMode === 'neon' ? `0 0 10px ${dynamicColor}66` : 'none',
                transition: 'all 0.4s ease',
              }}
            />
          ))}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 6, ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>
            完成 {sessionsBeforeLongBreak} 个后长休息
          </span>
        </div>

        {/* 控制按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 56 }}>
          <button
            onClick={onReset}
            aria-label="重置"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: skin.ghostBorder,
              background: skin.ghostBg,
              color: skin.ghostColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = skin.ghostColor; e.currentTarget.style.background = skin.ghostBg }}
          >
            <RotateCcw style={{ width: 22, height: 22 }} />
          </button>

          <button
            onClick={onToggle}
            aria-label={isRunning ? '暂停' : '开始'}
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              border: skin.playBorder,
              background: skin.playBg,
              color: skin.playColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: skin.playGlow,
              transition: 'transform 0.15s ease, background 0.5s ease, box-shadow 0.5s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isRunning ? <Pause style={{ width: 32, height: 32 }} /> : <Play style={{ width: 32, height: 32, marginLeft: 4 }} />}
          </button>

          <button
            onClick={onSkip}
            aria-label="跳过"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: skin.ghostBorder,
              background: skin.ghostBg,
              color: skin.ghostColor,
              cursor: 'pointer',
              display: isStrict ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = skin.ghostColor; e.currentTarget.style.background = skin.ghostBg }}
          >
            <SkipForward style={{ width: 22, height: 22 }} />
          </button>
        </div>

        {/* 严格模式：唯一出口是长按放弃；同时反馈被拦截的离开尝试 */}
        {isStrict && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 30 }}>
            {canGiveUp && onRequestGiveUp ? (
              <HoldToGiveUpButton seconds={strictHoldSeconds} onComplete={onRequestGiveUp} />
            ) : (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                严格模式：必须完成本轮才能退出
              </span>
            )}
            {strictViolationCount > 0 && (
              <div key={strictViolationCount} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(252,165,165,0.85)' }}>
                <AlertTriangle style={{ width: 13, height: 13 }} />
                <span>检测到 {strictViolationCount} 次离开尝试，已自动回到专注</span>
              </div>
            )}
          </div>
        )}

        {/* 提示 / 引语 */}
        <div style={{
          marginTop: 40,
          textAlign: 'center',
          maxWidth: 460,
          padding: '0 24px',
          minHeight: 26,
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          opacity: quoteVisible ? 1 : 0,
          transform: quoteVisible ? 'translateY(0)' : 'translateY(-6px)',
        }}>
          {mode !== 'work' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <SuggestionIcon style={{ width: 18, height: 18, color: suggestion.color }} />
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>{suggestion.text}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontStyle: styleMode === 'chalk' ? 'normal' : 'italic', ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>"{displayQuote.text}"</p>
              {displayQuote.author && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginTop: 6, ...(styleMode === 'chalk' ? CHALK_FONT : {}) }}>— {displayQuote.author}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* 底部：neon 森林 / chalk 粉笔计数 */}
      {styleMode === 'neon' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 140,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          <div style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 3,
            paddingLeft: 40,
            paddingRight: 40,
          }}>
            {trees.map((tree, i) => (
              <TreeDeciduous
                key={i}
                style={{
                  width: tree.size,
                  height: tree.size,
                  opacity: tree.opacity,
                  color: tree.isComplete ? '#22c55e' : '#16a34a',
                  transform: `translateY(${tree.isComplete ? 0 : 10}px)`,
                }}
              />
            ))}
          </div>

          <div style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.25)',
            padding: '4px 14px',
            borderRadius: 16,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}>
            <Sparkles style={{ width: 11, height: 11 }} />
            <span>专注森林 · {Math.floor(completedSessions / (sessionsBeforeLongBreak || 4))} 棵树</span>
          </div>

          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 90,
            background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)',
          }} />
        </div>
      )}

      {styleMode === 'chalk' && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          paddingBottom: 26,
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          {/* 粉笔 tally：每完成一个番茄一道竖线，满 5 道一道斜杠 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5, maxWidth: '70vw' }}>
            {Array.from({ length: Math.min(completedSessions, 20) }).map((_, i) => {
              const within = i % 5
              const closing = within === 4
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.8)',
                    width: 3,
                    height: closing ? 22 : 16,
                    transform: closing ? 'rotate(24deg)' : `rotate(${((i % 3) - 1) * 4}deg)`,
                    marginRight: closing ? 10 : 0,
                  }}
                />
              )
            })}
            {completedSessions === 0 && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', ...CHALK_FONT }}>今天的粉笔计数还没开始</span>
            )}
          </div>
          {completedSessions > 0 && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', ...CHALK_FONT }}>
              今日已完成 {completedSessions} 个番茄
            </span>
          )}
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.4em', color: 'rgba(255,255,255,0.3)', ...CHALK_FONT }}>
            静 能 生 慧 · 专 注 致 远
          </p>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: rotate(-90deg 150 150) scale(1); opacity: 0.18; }
          50% { transform: rotate(-90deg 150 150) scale(1.02); opacity: 0.3; }
        }
        @keyframes breathe {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            box-shadow: 0 0 60px ${dynamicColor}14, inset 0 0 60px ${dynamicColor}08;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.08);
            box-shadow: 0 0 100px ${dynamicColor}22, inset 0 0 80px ${dynamicColor}10;
          }
        }
        #breath-ring {
          animation: breathe 4s ease-in-out infinite;
        }
      `}</style>
    </div>,
    document.body
  )
}
