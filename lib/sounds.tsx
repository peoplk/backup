'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

type SoundType = 'work-complete' | 'break-complete' | 'notification' | 'achievement'

// 使用 Web Audio API 合成不同音效，每种类型有独特的音色
function getAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return null
  }
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3, delay: number = 0) {
  const ctx = getAudioContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay)

  gainNode.gain.setValueAtTime(0, ctx.currentTime + delay)
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.start(ctx.currentTime + delay)
  oscillator.stop(ctx.currentTime + delay + duration)
}

const SOUND_SYNTHESIS: Record<SoundType, () => void> = {
  // 专注完成：上升的双音阶（C5-E5），清脆明亮
  'work-complete': () => {
    playTone(523.25, 0.3, 'sine', 0.25, 0)
    playTone(659.25, 0.4, 'sine', 0.25, 0.15)
  },
  // 休息结束：下降的柔和音（E5-C5），温和提醒
  'break-complete': () => {
    playTone(659.25, 0.3, 'sine', 0.2, 0)
    playTone(523.25, 0.4, 'sine', 0.2, 0.15)
  },
  // 通知：短促的 ping 音（G5），简洁明快
  'notification': () => {
    playTone(783.99, 0.15, 'sine', 0.2, 0)
    playTone(783.99, 0.15, 'sine', 0.15, 0.2)
  },
  // 成就解锁：上升琶音（C5-E5-G5-C6），胜利感
  'achievement': () => {
    playTone(523.25, 0.2, 'triangle', 0.25, 0)
    playTone(659.25, 0.2, 'triangle', 0.25, 0.12)
    playTone(783.99, 0.2, 'triangle', 0.25, 0.24)
    playTone(1046.50, 0.5, 'triangle', 0.3, 0.36)
  },
}

export function useSound() {
  const { pomodoroSettings } = useAppStore()

  const play = useCallback((type: SoundType) => {
    try {
      SOUND_SYNTHESIS[type]()
    } catch {
    }
  }, [])

  const playWorkComplete = useCallback(() => play('work-complete'), [play])
  const playBreakComplete = useCallback(() => play('break-complete'), [play])
  const playNotification = useCallback(() => play('notification'), [play])
  const playAchievement = useCallback(() => play('achievement'), [play])

  return {
    play,
    playWorkComplete,
    playBreakComplete,
    playNotification,
    playAchievement,
  }
}

export function SoundSettings() {
  const [enabled, setEnabled] = useState(true)
  const { playNotification } = useSound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">声音提醒</p>
        <p className="text-sm text-muted-foreground">完成任务时播放提示音</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => playNotification()}
        >
          测试
        </Button>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
    </div>
  )
}
