/**
 * 专注音效内置预设（参照 white-noises.com 的混音方案玩法）：
 * 每个预设是一组「音源 → 音量」映射，一键套用后仍可单独微调每轨。
 */
import type { AmbientSound } from '@/lib/focus-sound-engine'

export interface FocusSoundPreset {
  id: string
  name: string
  levels: Record<string, number>
}

export const FOCUS_SOUND_PRESETS: FocusSoundPreset[] = [
  { id: 'rainy-reading', name: '雨天阅读', levels: { rain: 65, brown: 30 } },
  { id: 'cafe-corner', name: '咖啡馆角落', levels: { cafe: 60, keyboard: 25 } },
  { id: 'forest-walk', name: '森林漫步', levels: { forest: 55, wind: 35 } },
  { id: 'seaside-dusk', name: '海边黄昏', levels: { waves: 60, wind: 30, fire: 20 } },
  { id: 'deep-focus', name: '深夜专注', levels: { brown: 50 } },
]

/** 预设中引用的音源 id 全部合法（防止引擎改名后预设静默失效） */
export function validatePresets(sounds: AmbientSound[]): boolean {
  const ids = new Set(sounds.map(s => s.id))
  return FOCUS_SOUND_PRESETS.every(p => Object.keys(p.levels).every(id => ids.has(id)))
}
