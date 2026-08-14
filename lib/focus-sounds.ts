/**
 * 专注完成音效预设
 * 使用 Web Audio API 合成，无需音频文件
 */

export type SoundPresetId =
  | 'classic'
  | 'bell'
  | 'chime'
  | 'piano'
  | 'nature'
  | 'digital'
  | 'soft'
  | 'triumph'

export interface SoundPreset {
  id: SoundPresetId
  name: string
  description: string
  icon: string
}

export const SOUND_PRESETS: SoundPreset[] = [
  { id: 'classic', name: '经典提示', description: '三连音 880/1100Hz', icon: '🔔' },
  { id: 'bell', name: '钟声', description: '悠长钟鸣', icon: '🛎️' },
  { id: 'chime', name: '风铃', description: '清脆风铃', icon: '🎐' },
  { id: 'piano', name: '钢琴', description: 'C-E-G 和弦', icon: '🎹' },
  { id: 'nature', name: '自然', description: '鸟鸣啁啾', icon: '🌿' },
  { id: 'digital', name: '数字', description: '电子合成', icon: '⚡' },
  { id: 'soft', name: '柔和', description: '低频正弦', icon: '🌙' },
  { id: 'triumph', name: '胜利', description: '上行音阶', icon: '🏆' },
]

interface ToneOptions {
  frequency: number
  duration: number
  type?: OscillatorType
  startTime?: number
  volume?: number
}

function playTone(ctx: AudioContext, options: ToneOptions) {
  const { frequency, duration, type = 'sine', startTime = 0, volume = 0.3 } = options
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.frequency.value = frequency
  oscillator.type = type

  const t = ctx.currentTime + startTime / 1000
  gainNode.gain.setValueAtTime(volume, t)
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration / 1000)

  oscillator.start(t)
  oscillator.stop(t + duration / 1000)
}

/**
 * 播放指定预设的完成音效
 */
export function playPresetSound(ctx: AudioContext, preset: SoundPresetId) {
  switch (preset) {
    case 'classic':
      playTone(ctx, { frequency: 880, duration: 150 })
      playTone(ctx, { frequency: 1100, duration: 150, startTime: 150 })
      playTone(ctx, { frequency: 880, duration: 200, startTime: 300 })
      break

    case 'bell':
      playTone(ctx, { frequency: 523, duration: 800, type: 'triangle', volume: 0.25 })
      playTone(ctx, { frequency: 659, duration: 800, type: 'triangle', startTime: 50, volume: 0.2 })
      playTone(ctx, { frequency: 784, duration: 1000, type: 'triangle', startTime: 100, volume: 0.15 })
      break

    case 'chime':
      playTone(ctx, { frequency: 1318, duration: 300, type: 'sine', volume: 0.2 })
      playTone(ctx, { frequency: 1760, duration: 300, type: 'sine', startTime: 100, volume: 0.15 })
      playTone(ctx, { frequency: 2093, duration: 400, type: 'sine', startTime: 200, volume: 0.1 })
      break

    case 'piano':
      playTone(ctx, { frequency: 523, duration: 500, type: 'triangle', volume: 0.25 })
      playTone(ctx, { frequency: 659, duration: 500, type: 'triangle', startTime: 50, volume: 0.25 })
      playTone(ctx, { frequency: 784, duration: 700, type: 'triangle', startTime: 100, volume: 0.25 })
      break

    case 'nature':
      playTone(ctx, { frequency: 2200, duration: 80, type: 'sine', volume: 0.15 })
      playTone(ctx, { frequency: 2600, duration: 60, type: 'sine', startTime: 120, volume: 0.12 })
      playTone(ctx, { frequency: 2000, duration: 100, type: 'sine', startTime: 250, volume: 0.15 })
      playTone(ctx, { frequency: 2400, duration: 70, type: 'sine', startTime: 400, volume: 0.12 })
      break

    case 'digital':
      playTone(ctx, { frequency: 1000, duration: 100, type: 'square', volume: 0.15 })
      playTone(ctx, { frequency: 1200, duration: 100, type: 'square', startTime: 100, volume: 0.15 })
      playTone(ctx, { frequency: 1600, duration: 150, type: 'square', startTime: 200, volume: 0.15 })
      break

    case 'soft':
      playTone(ctx, { frequency: 440, duration: 600, type: 'sine', volume: 0.2 })
      playTone(ctx, { frequency: 554, duration: 600, type: 'sine', startTime: 200, volume: 0.15 })
      break

    case 'triumph':
      playTone(ctx, { frequency: 523, duration: 120, type: 'triangle', volume: 0.2 })
      playTone(ctx, { frequency: 659, duration: 120, type: 'triangle', startTime: 120, volume: 0.2 })
      playTone(ctx, { frequency: 784, duration: 120, type: 'triangle', startTime: 240, volume: 0.2 })
      playTone(ctx, { frequency: 1047, duration: 400, type: 'triangle', startTime: 360, volume: 0.25 })
      break

    default:
      playTone(ctx, { frequency: 880, duration: 150 })
      playTone(ctx, { frequency: 1100, duration: 150, startTime: 150 })
  }
}
