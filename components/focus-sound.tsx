'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Volume2,
  VolumeX,
  Music,
  Waves,
  Wind,
  CloudRain,
  TreeDeciduous,
  Coffee,
  Flame,
  Plane,
  Train,
  Keyboard,
  CloudLightning,
  Droplets,
  TrainFront,
  Car,
  Clock3,
  Shell,
  Bell,
  Bird,
  Music4,
  MoonStar,
  Sparkles,
  Heart,
  AudioWaveform,
  Activity,
  Radio,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

const AMBIENT_ONLY = AMBIENT_SOUNDS.filter(s => s.category !== 'noise')
const NOISE_STYLES = AMBIENT_SOUNDS.filter(s => s.category === 'noise')
const SLEEP_TIMER_OPTIONS = [15, 30, 60]

/** 空混音的稳定引用（渲染层规范化用，避免每次渲染新建对象） */
const EMPTY_SOUND_LEVELS: Record<string, number> = {}

export function FocusSound() {
  const { pomodoroTimerState, focusSoundSettings, updateFocusSoundSettings } = useAppStore(useShallow((state) => ({
    pomodoroTimerState: state.pomodoroTimerState,
    focusSoundSettings: state.focusSoundSettings,
    updateFocusSoundSettings: state.updateFocusSoundSettings,
  })))

  const [isOpen, setIsOpen] = useState(false)
  // 睡眠定时的剩余时间显示（每秒刷新）
  const [now, setNow] = useState(Date.now())

  const isPlaying = focusSoundSettings?.isPlaying || false
  const volume = focusSoundSettings?.volume || 50
  const soundLevels = focusSoundSettings?.soundLevels ?? EMPTY_SOUND_LEVELS
  const currentMusic = focusSoundSettings?.currentMusic || null
  const sleepTimerEndsAt = focusSoundSettings?.sleepTimerEndsAt ?? null

  // 播放状态/混音/音量变化 → 引擎同步（引擎幂等 diff 启停轨道，与全屏面板共用）
  useEffect(() => {
    syncFocusSound({ soundLevels, currentMusic, isPlaying, volume })
  }, [soundLevels, currentMusic, isPlaying, volume])

  // 睡眠定时到点：暂停播放并清除定时
  useSoundSleepTimer(sleepTimerEndsAt, () => {
    updateFocusSoundSettings({ isPlaying: false, sleepTimerEndsAt: null })
  })

  useEffect(() => {
    if (!sleepTimerEndsAt) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [sleepTimerEndsAt])

  useEffect(() => {
    if (pomodoroTimerState.isRunning && focusSoundSettings?.autoPlay) {
      updateFocusSoundSettings({ isPlaying: true })
    }
  }, [pomodoroTimerState.isRunning, focusSoundSettings?.autoPlay])

  const handleToggle = () => {
    if (!isPlaying) {
      if (Object.keys(soundLevels).length === 0 && !currentMusic) {
        // 未选择过音源时默认播放雨声
        updateFocusSoundSettings({ soundLevels: { rain: 50 }, isPlaying: true })
        return
      }
      updateFocusSoundSettings({ isPlaying: true })
    } else {
      updateFocusSoundSettings({ isPlaying: false })
    }
  }

  /** 点选音源 = 加入/移出混音（多轨并行，参照 white-noises.com） */
  const toggleTrack = (soundId: string) => {
    const next = { ...soundLevels }
    if (soundId in next) {
      delete next[soundId]
    } else {
      next[soundId] = 50
    }
    updateFocusSoundSettings({
      soundLevels: next,
      isPlaying: Object.keys(next).length > 0 || !!currentMusic,
    })
  }

  /** 双耳节拍单选，再点一次关闭；与环境音叠加 */
  const selectMusic = (musicId: string) => {
    if (currentMusic === musicId) {
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

  const stopAll = () => {
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
      isPlaying: minutes ? true : isPlaying,
    })
  }

  const handleVolumeChange = (value: number[]) => {
    updateFocusSoundSettings({ volume: value[0] })
  }

  const remainingMin = sleepTimerEndsAt
    ? Math.max(0, Math.ceil((sleepTimerEndsAt - now) / 60000))
    : null

  const renderChip = (sound: { id: string; name: string }, gridCls: string) => {
    const Icon = SOUND_ICONS[sound.id] ?? Music
    const active = sound.id in soundLevels
    return (
      <button
        key={sound.id}
        onClick={() => toggleTrack(sound.id)}
        className={cn(
          'flex flex-col items-center rounded-lg border p-2 transition-all',
          gridCls,
          active
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="text-[9px] mt-1 truncate w-full text-center">{sound.name}</span>
      </button>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="声音设置"
          className={cn(
            'relative',
            isPlaying && 'text-primary bg-primary/10'
          )}
        >
          {isPlaying ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          {isPlaying && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">专注音乐</span>
              {Object.keys(soundLevels).length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  混音 {Object.keys(soundLevels).length} 轨
                </span>
              )}
            </div>
            <Button
              variant={isPlaying ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggle}
              className="h-7 text-xs"
            >
              {isPlaying ? '暂停' : '播放'}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">总音量</span>
              <span className="text-xs text-muted-foreground tabular-nums">{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">预设组合</p>
            <div className="flex flex-wrap gap-1.5">
              {FOCUS_SOUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-border/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted/30 hover:text-foreground"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">白噪音风格</p>
            <div className="grid grid-cols-3 gap-1.5">
              {NOISE_STYLES.map((sound) => renderChip(sound, ''))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">环境音效（可多选叠加）</p>
            <div className="grid grid-cols-5 gap-1.5">
              {AMBIENT_ONLY.map((sound) => renderChip(sound, ''))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">双耳节拍</p>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_MUSIC.map((music) => (
                <button
                  key={music.id}
                  onClick={() => selectMusic(music.id)}
                  className={cn(
                    'flex flex-col items-center rounded-lg border p-3 transition-all',
                    currentMusic === music.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                  )}
                >
                  <span className="text-xs font-medium">{music.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{music.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" />
                定时停止
                {remainingMin !== null && (
                  <span className="text-primary tabular-nums">剩 {remainingMin} 分钟</span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setSleepTimer(null)}
                className={cn(
                  'rounded-lg border py-1.5 text-[11px] transition-all',
                  sleepTimerEndsAt === null
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/50 text-muted-foreground hover:bg-muted/30'
                )}
              >
                关闭
              </button>
              {SLEEP_TIMER_OPTIONS.map((min) => (
                <button
                  key={min}
                  onClick={() => setSleepTimer(min)}
                  className={cn(
                    'rounded-lg border py-1.5 text-[11px] transition-all',
                    sleepTimerEndsAt !== null && Math.abs((remainingMin ?? -1) - min) < 1
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/50 text-muted-foreground hover:bg-muted/30'
                  )}
                >
                  {min} 分钟
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={stopAll}
              className="h-7 text-xs"
              disabled={!isPlaying && Object.keys(soundLevels).length === 0 && !currentMusic}
            >
              清空并停止
            </Button>
            <input
              type="checkbox"
              id="autoPlay"
              checked={focusSoundSettings?.autoPlay || false}
              onChange={(e) => updateFocusSoundSettings({ autoPlay: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            <label htmlFor="autoPlay" className="text-xs text-muted-foreground cursor-pointer">
              开始专注时自动播放
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
