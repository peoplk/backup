'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
    const breakEvery = sessionsBeforeLongBreak || 4
    const result = []
    const totalTrees = Math.min(Math.floor(completedSessions / breakEvery) + 1, 12)
    for (let i = 0; i < totalTrees; i++) {
      result.push({
        size: 24 + Math.random() * 28,
        opacity: 0.4 + Math.random() * 0.5,
        isComplete: i < Math.floor(completedSessions / breakEvery),
      })
    }
    return result
  }, [completedSessions, sessionsBeforeLongBreak])

  const suggestion = breakSuggestions[currentSuggestion]
  const quote = motivationalQuotes[currentQuote]
  const SuggestionIcon = suggestion.icon

  const radius = 132
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  const sessionIndex = (sessionsBeforeLongBreak || 4) > 0 ? completedSessions % (sessionsBeforeLongBreak || 4) : 0

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
      background: `radial-gradient(ellipse at 50% 0%, ${config.bgMid} 0%, ${config.bgFrom} 50%, ${config.bgTo} 100%)`,
    }}>
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

      {/* 顶部栏：会话徽章 + 退出 */}
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
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dynamicColor,
            boxShadow: `0 0 12px ${dynamicColor}`,
            transition: 'background 0.5s ease',
          }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
            {config.label}
          </span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
             第 {sessionIndex + 1} 个 · 共 {sessionsBeforeLongBreak} 个
          </span>
        </div>

        <button
          onClick={onExit}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.06)',
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
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
        >
          <Minimize2 style={{ width: 20, height: 20 }} />
        </button>
      </div>

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
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: 44,
            maxWidth: '46vw',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}>
            <Target style={{ width: 16, height: 16, color: dynamicColor, flexShrink: 0, transition: 'color 0.5s ease' }} />
            <span style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {taskTitle}
            </span>
          </div>
        )}

        {/* 计时环 */}
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
              cx="150"
              cy="150"
              r={radius}
              fill="none"
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
                cx="150"
                cy="150"
                r={radius - 24}
                fill="none"
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

        {/* 会话进度点 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 44 }}>
          {Array.from({ length: sessionsBeforeLongBreak }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === sessionIndex ? 22 : 7,
                height: 7,
                borderRadius: 4,
                background: i <= sessionIndex ? dynamicColor : 'rgba(255,255,255,0.16)',
                boxShadow: i <= sessionIndex ? `0 0 10px ${dynamicColor}66` : 'none',
                transition: 'all 0.4s ease',
              }}
            />
          ))}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>
            完成 {sessionsBeforeLongBreak} 个后长休息
          </span>
        </div>

        {/* 控制按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 56 }}>
          <button
            onClick={onReset}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          >
            <RotateCcw style={{ width: 22, height: 22 }} />
          </button>

          <button
            onClick={onToggle}
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              border: 'none',
              background: dynamicColor,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 60px ${dynamicColor}55, 0 12px 40px rgba(0,0,0,0.35)`,
              transition: 'transform 0.15s ease, background 0.5s ease, box-shadow 0.5s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isRunning ? <Pause style={{ width: 32, height: 32 }} /> : <Play style={{ width: 32, height: 32, marginLeft: 4 }} />}
          </button>

          <button
            onClick={onSkip}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          >
            <SkipForward style={{ width: 22, height: 22 }} />
          </button>
        </div>

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
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>{suggestion.text}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>"{quote.text}"</p>
              {quote.author && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginTop: 6 }}>— {quote.author}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* 底部森林 */}
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
