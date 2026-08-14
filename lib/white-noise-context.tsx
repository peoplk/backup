'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export interface WhiteNoise {
  id: string
  name: string
  type: 'white' | 'pink' | 'brown' | 'rain' | 'ocean' | 'forest' | 'fire' | 'cafe' | 'wind'
  color: string
  description?: string
}

const WHITE_NOISES: WhiteNoise[] = [
  { id: 'white', name: '白噪音', type: 'white', color: 'bg-purple-500/20 text-purple-500', description: '均匀随机噪声' },
  { id: 'pink', name: '粉噪音', type: 'pink', color: 'bg-pink-500/20 text-pink-500', description: '柔和自然' },
  { id: 'brown', name: '棕噪音', type: 'brown', color: 'bg-amber-700/20 text-amber-600', description: '低沉稳重' },
  { id: 'rain', name: '雨声', type: 'rain', color: 'bg-blue-500/20 text-blue-500', description: '模拟雨滴白噪声 + 滤波' },
  { id: 'ocean', name: '海浪', type: 'ocean', color: 'bg-cyan-500/20 text-cyan-500', description: '缓变包络' },
  { id: 'forest', name: '森林', type: 'forest', color: 'bg-green-500/20 text-green-500', description: '鸟鸣 + 风' },
  { id: 'fire', name: '篝火', type: 'fire', color: 'bg-orange-500/20 text-orange-500', description: '噼啪噪声' },
  { id: 'cafe', name: '咖啡厅', type: 'cafe', color: 'bg-amber-500/20 text-amber-500', description: '人声嘈杂' },
  { id: 'wind', name: '风声', type: 'wind', color: 'bg-gray-500/20 text-gray-500', description: '低频滤波' },
]

type NoiseType = WhiteNoise['type']

interface ActiveNoise {
  id: string
  nodes: AudioNode[]
  oscillators: OscillatorNode[]
  sourceNode: AudioNode
  gainNode: GainNode
}

interface WhiteNoiseContextType {
  activeNoises: Set<string>
  volumes: Record<string, number>
  isPlaying: boolean
  toggleNoise: (noiseId: string) => void
  setVolume: (noiseId: string, volume: number) => void
  playAll: () => void
  pauseAll: () => void
  togglePlayPause: () => void
  stopAll: () => void
  noises: WhiteNoise[]
}

const WhiteNoiseContext = createContext<WhiteNoiseContextType | null>(null)

/**
 * 创建噪声缓冲区（白/粉/棕）
 */
function createNoiseBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const bufferSize = sampleRate * 4
  const buffer = ctx.createBuffer(2, bufferSize, sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  switch (type) {
    case 'white': {
      for (let i = 0; i < bufferSize; i++) {
        leftChannel[i] = Math.random() * 2 - 1
        rightChannel[i] = Math.random() * 2 - 1
      }
      break
    }
    case 'pink': {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        leftChannel[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
        rightChannel[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
      break
    }
    case 'brown': {
      let lastOutL = 0, lastOutR = 0
      for (let i = 0; i < bufferSize; i++) {
        const whiteL = Math.random() * 2 - 1
        const whiteR = Math.random() * 2 - 1
        lastOutL = (lastOutL + (0.02 * whiteL)) / 1.02
        lastOutR = (lastOutR + (0.02 * whiteR)) / 1.02
        leftChannel[i] = lastOutL * 3.5
        rightChannel[i] = lastOutR * 3.5
      }
      break
    }
    case 'rain': {
      for (let i = 0; i < bufferSize; i++) {
        const white = (Math.random() * 2 - 1) * 0.5
        leftChannel[i] = white
        rightChannel[i] = Math.random() * 2 - 1
      }
      break
    }
    case 'ocean': {
      for (let i = 0; i < bufferSize; i++) {
        const base = (Math.random() * 2 - 1) * 0.4
        const wave = Math.sin((i / sampleRate) * 2 * Math.PI * 0.15) * 0.3
        leftChannel[i] = base * (1 + wave)
        rightChannel[i] = (Math.random() * 2 - 1) * 0.4 * (1 + wave)
      }
      break
    }
    case 'forest': {
      for (let i = 0; i < bufferSize; i++) {
        const white = (Math.random() * 2 - 1) * 0.2
        const chirp = Math.random() > 0.9985 ? (Math.random() * 2 - 1) * 0.6 : 0
        leftChannel[i] = white + chirp
        rightChannel[i] = (Math.random() * 2 - 1) * 0.2
      }
      break
    }
    case 'fire': {
      for (let i = 0; i < bufferSize; i++) {
        const crackle = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.8 : 0
        const base = (Math.random() * 2 - 1) * 0.15
        leftChannel[i] = base + crackle
        rightChannel[i] = (Math.random() * 2 - 1) * 0.15
      }
      break
    }
    case 'cafe': {
      for (let i = 0; i < bufferSize; i++) {
        const voice = (Math.random() * 2 - 1) * 0.25
        const clink = Math.random() > 0.999 ? (Math.random() * 2 - 1) * 0.4 : 0
        leftChannel[i] = voice + clink
        rightChannel[i] = (Math.random() * 2 - 1) * 0.25
      }
      break
    }
    case 'wind': {
      for (let i = 0; i < bufferSize; i++) {
        const white = (Math.random() * 2 - 1) * 0.4
        const mod = (Math.sin((i / sampleRate) * 2 * Math.PI * 0.3) + 1) * 0.5
        leftChannel[i] = white * mod
        rightChannel[i] = (Math.random() * 2 - 1) * 0.4 * mod
      }
      break
    }
  }

  return buffer
}

function buildNoiseGraph(ctx: AudioContext, type: NoiseType): { source: AudioNode; nodes: AudioNode[] } {
  const nodes: AudioNode[] = []
  const buffer = createNoiseBuffer(ctx, type)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  nodes.push(source)

  let lastNode: AudioNode = source

  // 根据类型加滤波
  if (type === 'rain') {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1200
    bp.Q.value = 0.6
    lastNode.connect(bp)
    nodes.push(bp)
    lastNode = bp
  } else if (type === 'ocean') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 800
    lastNode.connect(lp)
    nodes.push(lp)
    lastNode = lp
  } else if (type === 'forest') {
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 600
    lastNode.connect(hp)
    nodes.push(hp)
    lastNode = hp
  } else if (type === 'fire') {
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 800
    lastNode.connect(hp)
    nodes.push(hp)
    lastNode = hp
  } else if (type === 'cafe') {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 500
    bp.Q.value = 0.4
    lastNode.connect(bp)
    nodes.push(bp)
    lastNode = bp
  } else if (type === 'wind') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    lastNode.connect(lp)
    nodes.push(lp)
    lastNode = lp
  } else if (type === 'brown') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200
    lastNode.connect(lp)
    nodes.push(lp)
    lastNode = lp
  }

  return { source, nodes }
}

export function WhiteNoiseProvider({ children }: { children: React.ReactNode }) {
  const [activeNoises, setActiveNoises] = useState<Set<string>>(new Set())
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [isPlaying, setIsPlaying] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const activeRef = useRef<Map<string, ActiveNoise>>(new Map())

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const Ctor = (window.AudioContext || window.webkitAudioContext) as typeof AudioContext
      if (!Ctor) return null
      audioCtxRef.current = new Ctor()
      const master = audioCtxRef.current.createGain()
      master.gain.value = 0
      master.connect(audioCtxRef.current.destination)
      masterGainRef.current = master
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    return audioCtxRef.current
  }, [])

  useEffect(() => {
    return () => {
      activeRef.current.forEach((item) => {
        try {
          item.sourceNode.disconnect()
        } catch { /* already disconnected */ }
      })
      activeRef.current.clear()
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [])

  const toggleNoise = useCallback((noiseId: string) => {
    const noise = WHITE_NOISES.find(n => n.id === noiseId)
    if (!noise) return

    setActiveNoises((prev) => {
      const next = new Set(prev)
      if (next.has(noiseId)) {
        next.delete(noiseId)
        const item = activeRef.current.get(noiseId)
        if (item) {
          try {
            item.gainNode.gain.cancelScheduledValues(audioCtxRef.current?.currentTime || 0)
            item.gainNode.gain.linearRampToValueAtTime(0, (audioCtxRef.current?.currentTime || 0) + 0.2)
            setTimeout(() => {
              try { item.sourceNode.disconnect() } catch { /* already disconnected */ }
            }, 250)
          } catch { /* audio param may be invalid */ }
          activeRef.current.delete(noiseId)
        }
      } else {
        next.add(noiseId)
        const ctx = ensureContext()
        if (!ctx || !masterGainRef.current) return next
        const { source, nodes } = buildNoiseGraph(ctx, noise.type)
        const gain = ctx.createGain()
        gain.gain.value = 0
        source.connect(gain)
        gain.connect(masterGainRef.current)
        try {
          (source as AudioBufferSourceNode).start(0)
        } catch { /* already started */ }
        // 渐入
        gain.gain.linearRampToValueAtTime(volumes[noiseId] ?? 0.3, ctx.currentTime + 0.3)
        activeRef.current.set(noiseId, {
          id: noiseId,
          nodes,
          oscillators: [],
          sourceNode: source,
          gainNode: gain,
        })
      }
      return next
    })
  }, [ensureContext, volumes])

  const setVolume = useCallback((noiseId: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [noiseId]: volume }))
    const item = activeRef.current.get(noiseId)
    const ctx = audioCtxRef.current
    if (item && ctx) {
      try {
        item.gainNode.gain.cancelScheduledValues(ctx.currentTime)
        item.gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1)
      } catch { /* audio param may be invalid */ }
    }
  }, [])

  const playAll = useCallback(() => {
    const ctx = ensureContext()
    if (!ctx || !masterGainRef.current) return
    masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
    masterGainRef.current.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.3)
    setIsPlaying(true)
  }, [ensureContext])

  const pauseAll = useCallback(() => {
    const ctx = audioCtxRef.current
    if (ctx && masterGainRef.current) {
      masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
      masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
    }
    setIsPlaying(false)
  }, [])

  const togglePlayPause = useCallback(() => {
    if (isPlaying) pauseAll()
    else playAll()
  }, [isPlaying, playAll, pauseAll])

  const stopAll = useCallback(() => {
    activeRef.current.forEach((item) => {
      try { item.sourceNode.disconnect() } catch { /* already disconnected */ }
    })
    activeRef.current.clear()
    setActiveNoises(new Set())
    setIsPlaying(false)
  }, [])

  return (
    <WhiteNoiseContext.Provider
      value={{
        activeNoises,
        volumes,
        isPlaying,
        toggleNoise,
        setVolume,
        playAll,
        pauseAll,
        togglePlayPause,
        stopAll,
        noises: WHITE_NOISES,
      }}
    >
      {children}
    </WhiteNoiseContext.Provider>
  )
}

export function useWhiteNoiseContext() {
  const context = useContext(WhiteNoiseContext)
  if (!context) {
    throw new Error('useWhiteNoiseContext must be used within a WhiteNoiseProvider')
  }
  return context
}
