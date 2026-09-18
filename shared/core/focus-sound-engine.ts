/**
 * 专注音效引擎（跨端单一来源 · 多轨混音模型，参照 white-noises.com 的混音交互）：
 * - 全局唯一 AudioContext；环境音/彩噪支持多轨并行，每轨独立音量
 * - 双耳节拍单轨，可与环境音叠加
 * - 所有增益变化走 setTargetAtTime 淡入淡出，切换/停止不爆音
 * - UI 层只需调用 syncFocusSound（幂等），由引擎 diff 出需要启停/调音量的轨道
 * - 音色目录为两端并集：桌面原有 13 种循环噪声 + 自 Android 移植的 11 种合成图场景音
 * - 另含番茄钟完成提示音：8 种 Web Audio 合成预设（playPresetSound），与混音轨相互独立
 */

export interface AmbientSound {
  id: string
  name: string
  category: 'nature' | 'environment' | 'focus' | 'noise'
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'white', name: '白噪音', category: 'noise' },
  { id: 'pink', name: '粉噪音', category: 'noise' },
  { id: 'brown', name: '棕噪音', category: 'noise' },
  { id: 'rain', name: '雨声', category: 'nature' },
  { id: 'forest', name: '森林', category: 'nature' },
  { id: 'waves', name: '海浪', category: 'nature' },
  { id: 'wind', name: '风声', category: 'nature' },
  { id: 'fire', name: '篝火', category: 'nature' },
  { id: 'cafe', name: '咖啡馆', category: 'environment' },
  { id: 'plane', name: '飞机', category: 'environment' },
  { id: 'train', name: '火车', category: 'environment' },
  { id: 'keyboard', name: '键盘', category: 'focus' },
  { id: 'heartbeat', name: '心跳', category: 'focus' },
  { id: 'storm', name: '雷雨', category: 'nature' },
  { id: 'stream', name: '溪流', category: 'nature' },
  { id: 'subway', name: '地铁', category: 'environment' },
  { id: 'street', name: '街道', category: 'environment' },
  { id: 'clock', name: '钟表', category: 'environment' },
  { id: 'fountain', name: '喷泉', category: 'environment' },
  { id: 'temple', name: '寺庙风铃', category: 'environment' },
  { id: 'nightbug', name: '夜虫', category: 'environment' },
  { id: 'lullaby', name: '摇篮曲', category: 'environment' },
  { id: 'nightsea', name: '海边夜', category: 'environment' },
  { id: 'starlight', name: '星空', category: 'environment' },
]

export const FOCUS_MUSIC = [
  { id: 'alpha', name: 'Alpha波', frequency: '10Hz', description: '放松专注' },
  { id: 'beta', name: 'Beta波', frequency: '20Hz', description: '高效工作' },
  { id: 'theta', name: 'Theta波', frequency: '6Hz', description: '深度冥想' },
  { id: 'gamma', name: 'Gamma波', frequency: '40Hz', description: '创意思维' },
]

/** 各音源的基础增益系数：白噪音偏刺耳压最低，彩噪稍高，环境音居中 */
const TRACK_GAIN: Record<string, number> = {
  white: 0.09,
  pink: 0.13,
  brown: 0.15,
}

let ctx: AudioContext | null = null
/** 多轨环境音：id → (轨增益 + 内部源停止器，兼容 buffer 型与合成图型音源) */
interface AmbientTrackHandle {
  gain: GainNode
  stop: () => void
}
let ambientTracks = new Map<string, AmbientTrackHandle>()
/** 双耳节拍单轨 */
let binaural: { id: string; oscL: OscillatorNode; oscR: OscillatorNode; gain: GainNode } | null = null

/** Android 端历史音色键 → 共享引擎 id（含概念重合的别名） */
export const SOUND_KEY_ALIASES: Record<string, string> = {
  ocean: 'waves',
  whitenoise: 'white',
  pinknoise: 'pink',
  brownnoise: 'brown',
  fireplace: 'fire',
}

/** 适配器入口：把任意端的历史音色键解析为引擎可播放的实体（环境音或双耳节拍） */
export function resolveFocusSoundKey(key: string): { kind: 'ambient'; id: string } | { kind: 'music'; id: string } | null {
  const aliased = SOUND_KEY_ALIASES[key] ?? key
  if (AMBIENT_SOUNDS.some((s) => s.id === aliased)) return { kind: 'ambient', id: aliased }
  if (FOCUS_MUSIC.some((m) => m.id === aliased)) return { kind: 'music', id: aliased }
  // Android 的 'binaural' 键 → 默认 Alpha 节拍
  if (key === 'binaural') return { kind: 'music', id: 'alpha' }
  return null
}

function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

function trackGainValue(id: string, level: number, volume: number): number {
  return (volume / 100) * (level / 100) * (TRACK_GAIN[id] ?? 0.15)
}

// ============== 循环 buffer 型音源（桌面原有 13 种，实现保持不变） ==============

/** 生成某音源的循环噪音链（含该音特有的滤波与包络调制），未接目的地 */
function buildAmbient(audioCtx: AudioContext, soundId: string): { source: AudioBufferSourceNode; entry: AudioNode } {
  const bufferSize = audioCtx.sampleRate * 2
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)

  // 彩色噪音：白/粉/棕三种独立生成算法
  if (soundId === 'white' || soundId === 'pink' || soundId === 'brown') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, lastOut = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      if (soundId === 'white') {
        data[i] = white * 0.5
      } else if (soundId === 'pink') {
        // Paul Kellet 粉噪音近似（-3dB/倍频程）
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      } else {
        // 棕噪音：积分白噪音（-6dB/倍频程）
        lastOut = (lastOut + 0.02 * white) / 1.02
        data[i] = lastOut * 3.5
      }
    }
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return { source, entry: source }
  }

  // 环境音：根据不同音效类型生成带调制的噪音 + 低通滤波塑形
  const soundConfig: Record<string, { filterFreq: number; filterQ: number; modFreq: number }> = {
    waves: { filterFreq: 1200, filterQ: 0.7, modFreq: 0.15 },
    wind: { filterFreq: 600, filterQ: 0.3, modFreq: 0.1 },
    plane: { filterFreq: 300, filterQ: 0.5, modFreq: 0.05 },
    keyboard: { filterFreq: 5000, filterQ: 1, modFreq: 6 },
    heartbeat: { filterFreq: 200, filterQ: 2, modFreq: 1 },
  }
  const config = soundConfig[soundId] ?? soundConfig.rain

  for (let i = 0; i < bufferSize; i++) {
    const noise = Math.random() * 2 - 1
    const mod = Math.sin(2 * Math.PI * config.modFreq * i / audioCtx.sampleRate)
    data[i] = noise * (0.5 + 0.5 * mod)
  }

  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = config.filterFreq
  filter.Q.value = config.filterQ
  source.connect(filter)
  return { source, entry: filter }
}

// ============== 合成图型音源（自 Android 端移植：带一次性发声与定时器的场景音） ==============

const GRAPH_SOUND_IDS = new Set([
  'rain', 'forest', 'cafe', 'train', 'fire',
  'storm', 'stream', 'subway', 'street', 'clock',
  'fountain', 'temple', 'nightbug', 'lullaby', 'nightsea', 'starlight',
])

/** 生成循环彩色噪声源（白/粉/棕，算法与 buildAmbient 的彩噪分支一致） */
function buildNoiseSource(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, lastOut = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    if (type === 'white') {
      data[i] = white * 0.5
    } else if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    } else {
      lastOut = (lastOut + 0.02 * white) / 1.02
      data[i] = lastOut * 3.5
    }
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

/** 周期性短促发声（鸟鸣/雷声/钟表等）的 helper */
function scheduleRepeats(
  ctx: AudioContext,
  intervalMs: number,
  fire: (ctx: AudioContext) => void,
  chance = 1
): () => void {
  const timer = window.setInterval(() => {
    if (Math.random() > chance) return
    fire(ctx)
  }, intervalMs)
  return () => {
    window.clearInterval(timer)
  }
}

function noiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  make: (ctx: AudioContext) => AudioBufferSourceNode,
  opts: { filter?: { type: BiquadFilterType; freq: number; q?: number }; peak: number; attack: number; decay: number }
): void {
  const src = make(ctx)
  let last: AudioNode = src
  if (opts.filter) {
    const f = ctx.createBiquadFilter()
    f.type = opts.filter.type
    f.frequency.value = opts.filter.freq
    if (opts.filter.q !== undefined) f.Q.value = opts.filter.q
    last.connect(f)
    last = f
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, ctx.currentTime)
  g.gain.linearRampToValueAtTime(opts.peak, ctx.currentTime + opts.attack)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + opts.decay)
  last.connect(g)
  g.connect(dest)
  src.start()
  src.stop(ctx.currentTime + opts.decay + 0.05)
}

function toneBurst(
  ctx: AudioContext,
  dest: AudioNode,
  opts: { type: OscillatorType; freq: number; freqEnd?: number; peak: number; attack: number; decay: number; lowpass?: number }
): void {
  const osc = ctx.createOscillator()
  osc.type = opts.type
  osc.frequency.setValueAtTime(opts.freq, ctx.currentTime)
  if (opts.freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(opts.freqEnd, ctx.currentTime + opts.decay)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, ctx.currentTime)
  g.gain.linearRampToValueAtTime(opts.peak, ctx.currentTime + opts.attack)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + opts.decay)
  let last: AudioNode = osc
  if (opts.lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = opts.lowpass
    osc.connect(f)
    last = f
  }
  last.connect(g)
  g.connect(dest)
  osc.start()
  osc.stop(ctx.currentTime + opts.decay + 0.05)
}

/** 循环噪音底 + 滤波链（可选 LFO 调制音量），返回停止器 */
function noiseBed(
  ctx: AudioContext,
  dest: AudioNode,
  type: 'white' | 'pink' | 'brown',
  chain: Array<{ type: BiquadFilterType; freq: number; q?: number }>,
  baseGain: number,
  lfo?: { freq: number; depth: number }
): { stop: () => void } {
  const noise = buildNoiseSource(ctx, type)
  let last: AudioNode = noise
  for (const f of chain) {
    const filter = ctx.createBiquadFilter()
    filter.type = f.type
    filter.frequency.value = f.freq
    if (f.q !== undefined) filter.Q.value = f.q
    last.connect(filter)
    last = filter
  }
  const gain = ctx.createGain()
  gain.gain.value = lfo ? 0 : baseGain
  last.connect(gain)
  gain.connect(dest)
  noise.start()
  const stops: Array<() => void> = [() => { try { noise.stop() } catch { /* stopped */ } }]
  if (lfo) {
    const osc = ctx.createOscillator()
    osc.frequency.value = lfo.freq
    const oscGain = ctx.createGain()
    oscGain.gain.value = lfo.depth
    osc.connect(oscGain)
    oscGain.connect(gain.gain)
    osc.start()
    stops.push(() => { try { osc.stop() } catch { /* stopped */ } })
  }
  return {
    stop: () => stops.forEach((fn) => fn()),
  }
}

/** buildGraphAmbient：把 id 对应的合成图接入 dest（轨增益），返回停止器 */
function buildGraphAmbient(ctx: AudioContext, id: string, dest: GainNode): () => void {
  switch (id) {
    // ---- 反向移植自 Android：比桌面原版多一层"事件式"细节（雨滴/鸟鸣/杯碟/铁轨/噼啪） ----
    case 'rain': {
      // 白噪雨底（高/低通塑形）+ 短促雨滴脉冲
      const bed = noiseBed(ctx, dest, 'white', [
        { type: 'highpass', freq: 200 },
        { type: 'lowpass', freq: 3000, q: 0.5 },
      ], 0.6)
      const drops = scheduleRepeats(ctx, 100, (c) => {
        noiseBurst(c, dest, (cc) => buildNoiseSource(cc, 'white'), {
          filter: { type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 8 },
          peak: 0.15, attack: 0.005, decay: 0.05,
        })
      })
      return () => { drops(); bed.stop() }
    }
    case 'forest': {
      // 风声底 + 随机鸟鸣（高频正弦滑音）
      const bed = noiseBed(ctx, dest, 'pink', [{ type: 'lowpass', freq: 1500 }], 0.25)
      const birds = scheduleRepeats(ctx, 1500, (c) => {
        const f1 = 1500 + Math.random() * 1500
        toneBurst(c, dest, { type: 'sine', freq: f1, freqEnd: f1 + 500 + Math.random() * 1000, peak: 0.06, attack: 0.02, decay: 0.2 })
      }, 0.5)
      return () => { birds(); bed.stop() }
    }
    case 'cafe': {
      // 人声嘈杂底 + 偶尔杯碟声
      const bed = noiseBed(ctx, dest, 'brown', [{ type: 'bandpass', freq: 400, q: 0.7 }], 0.4)
      const cups = scheduleRepeats(ctx, 2000, (c) => {
        toneBurst(c, dest, { type: 'triangle', freq: 2500 + Math.random() * 800, peak: 0.04, attack: 0.005, decay: 0.1 })
      }, 0.3)
      return () => { cups(); bed.stop() }
    }
    case 'train': {
      // 行进噪声底 + 规律铁轨节奏
      const bed = noiseBed(ctx, dest, 'pink', [{ type: 'lowpass', freq: 1200 }], 0.5)
      const rails = scheduleRepeats(ctx, 600, (c) => {
        toneBurst(c, dest, { type: 'square', freq: 80, peak: 0.08, attack: 0.01, decay: 0.08, lowpass: 300 })
      })
      return () => { rails(); bed.stop() }
    }
    case 'fire': {
      // 低沉火焰底 + 噼啪爆裂
      const bed = noiseBed(ctx, dest, 'brown', [{ type: 'lowpass', freq: 600 }], 0.25)
      const crackles = scheduleRepeats(ctx, 600, (c) => {
        noiseBurst(c, dest, (cc) => buildNoiseSource(cc, 'white'), {
          filter: { type: 'highpass', freq: 1500 },
          peak: 0.2, attack: 0.005, decay: 0.08,
        })
      }, 0.4)
      return () => { crackles(); bed.stop() }
    }
    case 'storm': {
      // 持续雨声底 + 随机雷声
      const bed = noiseBed(ctx, dest, 'brown', [{ type: 'lowpass', freq: 1500 }], 0.7)
      const thunder = scheduleRepeats(ctx, 4000, (c) => {
        noiseBurst(c, dest, (cc) => buildNoiseSource(cc, 'brown'), { filter: { type: 'lowpass', freq: 400 }, peak: 0.4, attack: 0.05, decay: 1.8 })
      }, 0.4)
      return () => { thunder(); bed.stop() }
    }
    case 'stream': {
      const bed = noiseBed(ctx, dest, 'white', [{ type: 'bandpass', freq: 2000, q: 1 }], 0.4)
      const bed2 = noiseBed(ctx, dest, 'white', [{ type: 'highpass', freq: 4000 }], 0.15)
      return () => { bed.stop(); bed2.stop() }
    }
    case 'subway':
      return noiseBed(ctx, dest, 'brown', [{ type: 'lowpass', freq: 500 }], 0.6).stop
    case 'street':
      return noiseBed(ctx, dest, 'white', [{ type: 'bandpass', freq: 1500, q: 0.5 }], 0.2).stop
    case 'clock':
      return scheduleRepeats(ctx, 2000, (c) => {
        toneBurst(c, dest, { type: 'sine', freq: 1000, peak: 0.15, attack: 0.005, decay: 0.4 })
      })
    case 'fountain':
      return noiseBed(ctx, dest, 'white', [{ type: 'highpass', freq: 3000 }], 0.25).stop
    case 'temple': {
      // 风铃：五音列错落循环
      const freqs = [523, 659, 784, 880, 1047]
      const timeouts: number[] = []
      const chime = (freq: number, vol: number, delayMs: number) => {
        timeouts.push(window.setTimeout(() => {
          toneBurst(ctx, dest, { type: 'sine', freq, peak: vol, attack: 0.01, decay: 2.5 })
        }, delayMs))
      }
      const loop = window.setInterval(() => {
        freqs.forEach((f, i) => chime(f, 0.05, i * 2000))
      }, 12000)
      freqs.forEach((f, i) => chime(f, 0.08, i * 4000))
      return () => {
        window.clearInterval(loop)
        timeouts.forEach((t) => window.clearTimeout(t))
      }
    }
    case 'nightbug':
      return scheduleRepeats(ctx, 400, (c) => {
        const freq = 4000 + Math.random() * 2000
        toneBurst(c, dest, { type: 'sine', freq, freqEnd: freq * 0.8, peak: 0.04, attack: 0.02, decay: 0.05 })
      }, 0.6)
    case 'lullaby': {
      const notes = [523, 587, 659, 698, 784, 698, 659, 587]
      let step = 0
      const timer = window.setInterval(() => {
        toneBurst(ctx, dest, { type: 'sine', freq: notes[step % notes.length], peak: 0.1, attack: 0.05, decay: 0.4 })
        step++
      }, 500)
      return () => window.clearInterval(timer)
    }
    case 'nightsea':
      return noiseBed(ctx, dest, 'white', [{ type: 'lowpass', freq: 500 }], 0, { freq: 0.1, depth: 0.3 }).stop
    case 'starlight': {
      const bed = noiseBed(ctx, dest, 'pink', [{ type: 'lowpass', freq: 800 }], 0.4)
      const sparkle = scheduleRepeats(ctx, 3500, (c) => {
        toneBurst(c, dest, { type: 'sine', freq: 2000 + Math.random() * 1000, peak: 0.05, attack: 0.02, decay: 0.6 })
      }, 0.3)
      return () => { sparkle(); bed.stop() }
    }
    default:
      return () => undefined
  }
}

function startTrack(id: string, level: number, volume: number): void {
  const audioCtx = getAudioContext()
  const gain = audioCtx.createGain()
  gain.gain.value = 0
  gain.connect(audioCtx.destination)

  let stop: () => void
  if (GRAPH_SOUND_IDS.has(id)) {
    // 合成图型音源（雷雨/寺庙风铃等带一次性发声与定时器）
    stop = buildGraphAmbient(audioCtx, id, gain)
  } else {
    // 循环 buffer 型音源（桌面原有 13 种，实现保持不变）
    const { source, entry } = buildAmbient(audioCtx, id)
    entry.connect(gain)
    source.start()
    stop = () => { try { source.stop() } catch { /* already stopped */ } }
  }

  ambientTracks.set(id, { gain, stop })
  // 淡入
  gain.gain.setTargetAtTime(trackGainValue(id, level, volume), audioCtx.currentTime, 0.15)
}

function stopTrack(id: string): void {
  const track = ambientTracks.get(id)
  if (!track) return
  ambientTracks.delete(id)
  try {
    const audioCtx = getAudioContext()
    track.gain.gain.cancelScheduledValues(audioCtx.currentTime)
    // 淡出后延迟释放内部源与定时器
    track.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08)
  } catch { /* already stopped */ }
  window.setTimeout(() => {
    try { track.stop() } catch { /* already stopped */ }
  }, 500)
}

function startBinauralTrack(musicId: string, volume: number): void {
  const audioCtx = getAudioContext()
  const music = FOCUS_MUSIC.find(m => m.id === musicId)
  if (!music) return

  const frequency = parseInt(music.frequency)
  const baseFreq = 200

  // 使用 ChannelMergerNode 实现真正的立体声双耳节拍
  const merger = audioCtx.createChannelMerger(2)
  const gainNode = audioCtx.createGain()
  gainNode.gain.value = 0

  const oscillatorL = audioCtx.createOscillator()
  oscillatorL.type = 'sine'
  oscillatorL.frequency.value = baseFreq
  oscillatorL.connect(merger, 0, 0) // 左声道

  const oscillatorR = audioCtx.createOscillator()
  oscillatorR.type = 'sine'
  oscillatorR.frequency.value = baseFreq + frequency
  oscillatorR.connect(merger, 0, 1) // 右声道

  merger.connect(gainNode)
  gainNode.connect(audioCtx.destination)

  oscillatorL.start()
  oscillatorR.start()

  binaural = { id: musicId, oscL: oscillatorL, oscR: oscillatorR, gain: gainNode }
  gainNode.gain.setTargetAtTime((volume / 100) * 0.3, audioCtx.currentTime, 0.15)
}

function stopBinauralTrack(): void {
  if (!binaural) return
  const current = binaural
  binaural = null
  try {
    const audioCtx = getAudioContext()
    current.gain.gain.cancelScheduledValues(audioCtx.currentTime)
    current.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08)
    current.oscL.stop(audioCtx.currentTime + 0.5)
    current.oscR.stop(audioCtx.currentTime + 0.5)
  } catch { /* already stopped */ }
}

export interface FocusSoundSyncState {
  /** 各环境音轨的独立音量（0-100），键存在即在混音中 */
  soundLevels: Record<string, number>
  /** 双耳节拍（单选，null 关闭），可与环境音叠加 */
  currentMusic: string | null
  /** 总开关：暂停保留混音配置，恢复即续播 */
  isPlaying: boolean
  /** 总音量（0-100） */
  volume: number
}

/** 唯一的同步入口（幂等）：按期望状态 diff 启停轨道、更新每轨增益 */
export function syncFocusSound(next: FocusSoundSyncState): void {
  const soundLevels = next.soundLevels ?? {}
  const { currentMusic = null, isPlaying = false, volume = 50 } = next

  // 环境音轨 diff
  for (const id of [...ambientTracks.keys()]) {
    if (!isPlaying || !(id in soundLevels)) {
      stopTrack(id)
    }
  }
  if (isPlaying) {
    for (const [id, level] of Object.entries(soundLevels)) {
      const track = ambientTracks.get(id)
      if (track) {
        track.gain.gain.setTargetAtTime(trackGainValue(id, level, volume), getAudioContext().currentTime, 0.08)
      } else if (level > 0) {
        startTrack(id, level, volume)
      }
    }
  }

  // 双耳节拍 diff
  if (isPlaying && currentMusic) {
    if (!binaural || binaural.id !== currentMusic) {
      stopBinauralTrack()
      startBinauralTrack(currentMusic, volume)
    } else {
      binaural.gain.gain.setTargetAtTime((volume / 100) * 0.3, getAudioContext().currentTime, 0.08)
    }
  } else if (binaural) {
    stopBinauralTrack()
  }
}

/** 立即淡出停止全部发声节点（外部强制停止入口） */
export function stopAllFocusSound(): void {
  for (const id of [...ambientTracks.keys()]) {
    stopTrack(id)
  }
  stopBinauralTrack()
}

// ============== 完成提示音（番茄钟/休息结束的一次性提示音，Web Audio 合成，无音频文件） ==============

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

/** 播放指定预设的完成音效（独立 AudioContext 直连扬声器，不经混音轨） */
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
