'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Minimize2, 
  SkipForward,
  Coffee,
  StretchVertical,
  Footprints,
  Droplets,
  Eye,
  Wind,
  TreeDeciduous,
  Sparkles,
  Sun,
  Moon,
  Heart,
} from 'lucide-react'

type TimerMode = 'work' | 'short-break' | 'long-break'

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

// 解析十六进制颜色为 RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

// 插值函数：根据进度计算当前颜色，实现真正的 RGB 渐变插值
function interpolateColor(progress: number, stages: { progress: number; color: string }[]) {
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
  const range = upperStage.progress - lowerStage.progress
  const stageProgress = range === 0 ? 0 : (progress - lowerStage.progress) / range
  const clampedProgress = Math.max(0, Math.min(1, stageProgress))

  // RGB 线性插值
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

interface ImmersiveTimerProps {
  mode: TimerMode
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  completedSessions: number
  treeGrowth: number
  onToggle: () => void
  onReset: () => void
  onSkip: () => void
  onExit: () => void
}

export function ImmersiveTimer({
  mode,
  timeLeft,
  totalDuration,
  isRunning,
  completedSessions,
  treeGrowth,
  onToggle,
  onReset,
  onSkip,
  onExit,
}: ImmersiveTimerProps) {
  const config = modeConfig[mode]
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100
  
  const currentProgress = ((totalDuration - timeLeft) / totalDuration) * 100
  const dynamicColor = interpolateColor(currentProgress, config.colorStages)
  
  const [currentSuggestion, setCurrentSuggestion] = useState(0)
  const [currentQuote, setCurrentQuote] = useState(0)
  const [quoteVisible, setQuoteVisible] = useState(true)
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

  useEffect(() => {
    if (mode !== 'work') {
      const interval = setInterval(() => {
        setCurrentSuggestion(prev => (prev + 1) % breakSuggestions.length)
      }, 8000)
      return () => clearInterval(interval)
    }
  }, [mode])

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteVisible(false)
      setTimeout(() => {
        setCurrentQuote(prev => (prev + 1) % motivationalQuotes.length)
        setQuoteVisible(true)
      }, 500)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const trees = useMemo(() => {
    const result = []
    const totalTrees = Math.min(Math.floor(completedSessions / 4) + 1, 12)
    for (let i = 0; i < totalTrees; i++) {
      result.push({
        size: 24 + Math.random() * 28,
        opacity: 0.4 + Math.random() * 0.5,
        isComplete: i < Math.floor(completedSessions / 4),
      })
    }
    return result
  }, [completedSessions])

  const suggestion = breakSuggestions[currentSuggestion]
  const quote = motivationalQuotes[currentQuote]
  const SuggestionIcon = suggestion.icon

  const radius = 120
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

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
      justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 0%, ${config.bgMid} 0%, ${config.bgFrom} 50%, ${config.bgTo} 100%)`,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${dynamicColor}08 0%, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'background 0.5s ease',
      }} />
      
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `radial-gradient(circle at 50% 50%, ${dynamicColor}03 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        transition: 'background-image 0.5s ease',
      }} />
      
      {isRunning && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${dynamicColor}12 0%, ${dynamicColor}05 40%, transparent 70%)`,
          pointerEvents: 'none',
          animation: 'bgPulse 4s ease-in-out infinite',
          transition: 'background 0.5s ease',
        }} />
      )}
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
      >
        <Minimize2 style={{ width: 20, height: 20 }} />
      </button>

      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 20,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Sparkles style={{ width: 16, height: 16, color: '#fbbf24' }} />
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{completedSessions} 个番茄钟</span>
      </div>

      {mode !== 'work' && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 24px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <SuggestionIcon style={{ width: 22, height: 22, color: suggestion.color }} />
            <span style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)' }}>{suggestion.text}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {breakSuggestions.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentSuggestion ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === currentSuggestion ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ position: 'relative', width: 280, height: 280 }}>
        {isRunning && (
          <div
            id="breath-ring"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 340,
              height: 340,
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
        )}
        
        <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={dynamicColor} stopOpacity="1" />
              <stop offset="100%" stopColor={dynamicColor} stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          <circle cx="140" cy="140" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          
          <circle
            cx="140"
            cy="140"
            r={radius}
            fill="none"
            stroke="url(#pg)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 140 140)"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.5s ease' }}
          />

          {isRunning && (
            <circle
              cx="140" cy="140" r={radius - 30}
              fill="none"
              stroke={dynamicColor}
              strokeWidth="1"
              opacity="0.15"
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
        }}>
          <span style={{
            fontSize: 56,
            fontWeight: 700,
            fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif',
            color: '#ffffff',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}>
            {formatTime(timeLeft)}
          </span>
          <span style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 6,
            letterSpacing: '1px',
          }}>
            {config.label}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 40 }}>
        <button
          onClick={onReset}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent' }}
        >
          <RotateCcw style={{ width: 22, height: 22 }} />
        </button>
        
        <button
          onClick={onToggle}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: 'none',
            background: dynamicColor,
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 32px ${dynamicColor}50`,
            transition: 'transform 0.15s ease, background 0.5s ease, box-shadow 0.5s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {isRunning ? <Pause style={{ width: 28, height: 28 }} /> : <Play style={{ width: 28, height: 28, marginLeft: 3 }} />}
        </button>
        
        <button
          onClick={onSkip}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent' }}
        >
          <SkipForward style={{ width: 22, height: 22 }} />
        </button>
      </div>

      <div style={{
        marginTop: 36,
        textAlign: 'center',
        maxWidth: 400,
        padding: '0 24px',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        opacity: quoteVisible ? 1 : 0,
        transform: quoteVisible ? 'translateY(0)' : 'translateY(-8px)',
      }}>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>"{quote.text}"</p>
        {quote.author && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>— {quote.author}</p>
        )}
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          bottom: 36,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 2,
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
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'rgba(255,255,255,0.35)',
          background: 'rgba(0,0,0,0.25)',
          padding: '3px 12px',
          borderRadius: 16,
          backdropFilter: 'blur(4px)',
        }}>
          <TreeDeciduous style={{ width: 12, height: 12 }} />
          <span>专注森林 · {Math.floor(completedSessions / 4)} 棵树</span>
        </div>
        
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
        }} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: rotate(-90deg 140 140) scale(1); opacity: 0.15; }
          50% { transform: rotate(-90deg 140 140) scale(1.02); opacity: 0.25; }
        }
        @keyframes breathe {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            box-shadow: 0 0 60px ${dynamicColor}15, inset 0 0 60px ${dynamicColor}08;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.08);
            box-shadow: 0 0 100px ${dynamicColor}25, inset 0 0 80px ${dynamicColor}12;
          }
        }
        @keyframes bgPulse {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.7;
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
