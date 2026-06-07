'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AmbientSound {
  id: string
  name: string
  icon: React.ElementType
  url: string
  category: 'nature' | 'environment' | 'focus'
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', name: '雨声', icon: CloudRain, url: '', category: 'nature' },
  { id: 'forest', name: '森林', icon: TreeDeciduous, url: '', category: 'nature' },
  { id: 'waves', name: '海浪', icon: Waves, url: '', category: 'nature' },
  { id: 'wind', name: '风声', icon: Wind, url: '', category: 'nature' },
  { id: 'fire', name: '篝火', icon: Flame, url: '', category: 'nature' },
  { id: 'cafe', name: '咖啡馆', icon: Coffee, url: '', category: 'environment' },
  { id: 'plane', name: '飞机', icon: Plane, url: '', category: 'environment' },
  { id: 'train', name: '火车', icon: Train, url: '', category: 'environment' },
  { id: 'keyboard', name: '键盘', icon: Keyboard, url: '', category: 'focus' },
  { id: 'heartbeat', name: '心跳', icon: Heart, url: '', category: 'focus' },
]

const FOCUS_MUSIC = [
  { id: 'alpha', name: 'Alpha波', frequency: '10Hz', description: '放松专注' },
  { id: 'beta', name: 'Beta波', frequency: '20Hz', description: '高效工作' },
  { id: 'theta', name: 'Theta波', frequency: '6Hz', description: '深度冥想' },
  { id: 'gamma', name: 'Gamma波', frequency: '40Hz', description: '创意思维' },
]

export function FocusSound() {
  const { pomodoroTimerState, focusSoundSettings, updateFocusSoundSettings } = useAppStore(useShallow((state) => ({
    pomodoroTimerState: state.pomodoroTimerState,
    focusSoundSettings: state.focusSoundSettings,
    updateFocusSoundSettings: state.updateFocusSoundSettings,
  })))

  const [isOpen, setIsOpen] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)
  const ambientNodesRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null)

  const isPlaying = focusSoundSettings?.isPlaying || false
  const volume = focusSoundSettings?.volume || 50
  const currentSound = focusSoundSettings?.currentSound || null
  const currentMusic = focusSoundSettings?.currentMusic || null

  const stopAllAudio = useCallback(() => {
    oscillatorsRef.current.forEach(osc => {
      try { osc.stop() } catch {}
    })
    oscillatorsRef.current = []

    if (ambientNodesRef.current) {
      try { ambientNodesRef.current.source.stop() } catch {}
      ambientNodesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isPlaying && currentMusic) {
      startBinauralBeat(currentMusic)
    } else if (!isPlaying) {
      stopAllAudio()
    }
  }, [isPlaying, currentMusic])

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume / 100 * 0.3
    }
    if (ambientNodesRef.current) {
      ambientNodesRef.current.gain.gain.value = volume / 100 * 0.15
    }
  }, [volume])

  useEffect(() => {
    if (pomodoroTimerState.isRunning && focusSoundSettings?.autoPlay) {
      updateFocusSoundSettings({ isPlaying: true })
    }
  }, [pomodoroTimerState.isRunning, focusSoundSettings?.autoPlay])

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  const startBinauralBeat = useCallback((musicId: string) => {
    stopAllAudio()

    const ctx = getAudioContext()
    const music = FOCUS_MUSIC.find(m => m.id === musicId)
    if (!music) return

    const frequency = parseInt(music.frequency)
    const baseFreq = 200

    // 使用 ChannelMergerNode 实现真正的立体声双耳节拍
    const merger = ctx.createChannelMerger(2)
    const gainNode = ctx.createGain()

    const oscillatorL = ctx.createOscillator()
    const gainL = ctx.createGain()
    oscillatorL.type = 'sine'
    oscillatorL.frequency.value = baseFreq
    gainL.gain.value = volume / 100 * 0.3
    oscillatorL.connect(gainL)
    gainL.connect(merger, 0, 0) // 左声道

    const oscillatorR = ctx.createOscillator()
    const gainR = ctx.createGain()
    oscillatorR.type = 'sine'
    oscillatorR.frequency.value = baseFreq + frequency
    gainR.gain.value = volume / 100 * 0.3
    oscillatorR.connect(gainR)
    gainR.connect(merger, 0, 1) // 右声道

    merger.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillatorL.start()
    oscillatorR.start()

    oscillatorsRef.current = [oscillatorL, oscillatorR]
    gainNodeRef.current = gainNode
  }, [volume, stopAllAudio, getAudioContext])

  // 使用 Web Audio API 合成环境音效
  const startAmbientSound = useCallback((soundId: string) => {
    stopAllAudio()

    const ctx = getAudioContext()
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    // 根据不同音效类型生成不同的噪音模式
    const soundConfig: Record<string, { filterFreq: number; filterQ: number; modFreq: number }> = {
      rain: { filterFreq: 8000, filterQ: 0.5, modFreq: 3 },
      forest: { filterFreq: 3000, filterQ: 1, modFreq: 0.5 },
      waves: { filterFreq: 1200, filterQ: 0.7, modFreq: 0.15 },
      wind: { filterFreq: 600, filterQ: 0.3, modFreq: 0.1 },
      fire: { filterFreq: 2000, filterQ: 0.8, modFreq: 8 },
      cafe: { filterFreq: 4000, filterQ: 0.4, modFreq: 2 },
      plane: { filterFreq: 300, filterQ: 0.5, modFreq: 0.05 },
      train: { filterFreq: 1500, filterQ: 0.6, modFreq: 1.5 },
      keyboard: { filterFreq: 5000, filterQ: 1, modFreq: 6 },
      heartbeat: { filterFreq: 200, filterQ: 2, modFreq: 1 },
    }

    const config = soundConfig[soundId] || soundConfig.rain

    // 生成带调制的噪音
    for (let i = 0; i < bufferSize; i++) {
      const noise = Math.random() * 2 - 1
      const mod = Math.sin(2 * Math.PI * config.modFreq * i / ctx.sampleRate)
      data[i] = noise * (0.5 + 0.5 * mod)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = config.filterFreq
    filter.Q.value = config.filterQ

    const gainNode = ctx.createGain()
    gainNode.gain.value = volume / 100 * 0.15

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    source.start()

    ambientNodesRef.current = { source, gain: gainNode }
    gainNodeRef.current = gainNode
  }, [volume, stopAllAudio, getAudioContext])

  const handleToggle = () => {
    if (!isPlaying) {
      getAudioContext()
    }
    updateFocusSoundSettings({ isPlaying: !isPlaying })
  }

  const handleSoundSelect = (soundId: string) => {
    startAmbientSound(soundId)
    updateFocusSoundSettings({
      currentSound: soundId,
      currentMusic: null,
      isPlaying: true
    })
  }

  const handleMusicSelect = (musicId: string) => {
    updateFocusSoundSettings({
      currentMusic: musicId,
      currentSound: null,
      isPlaying: true
    })
  }

  const handleVolumeChange = (value: number[]) => {
    updateFocusSoundSettings({ volume: value[0] })
  }

  useEffect(() => {
    return () => {
      stopAllAudio()
    }
  }, [stopAllAudio])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
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
            </div>
            <Button
              variant={isPlaying ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggle}
              className="h-7 text-xs"
            >
              {isPlaying ? '停止' : '播放'}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">音量</span>
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
            <p className="text-xs font-medium text-muted-foreground">双耳节拍</p>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_MUSIC.map((music) => (
                <button
                  key={music.id}
                  onClick={() => handleMusicSelect(music.id)}
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
            <p className="text-xs font-medium text-muted-foreground">环境音效</p>
            <div className="grid grid-cols-5 gap-1.5">
              {AMBIENT_SOUNDS.map((sound) => {
                const Icon = sound.icon
                return (
                  <button
                    key={sound.id}
                    onClick={() => handleSoundSelect(sound.id)}
                    className={cn(
                      'flex flex-col items-center rounded-lg border p-2 transition-all',
                      currentSound === sound.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[9px] mt-1 truncate w-full text-center">{sound.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <input
              type="checkbox"
              id="autoPlay"
              checked={focusSoundSettings?.autoPlay || false}
              onChange={(e) => updateFocusSoundSettings({ autoPlay: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            <label htmlFor="autoPlay" className="text-xs text-muted-foreground">
              开始专注时自动播放
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
