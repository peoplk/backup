'use client'

import { useMemo } from 'react'
import { TimerMode, modeConfig, interpolateColor } from './timer-config'

function OrbitRing({ mode, color }: { mode: TimerMode; color?: string }) {
  const config = modeConfig[mode]
  const ringColor = color || config.gradientFrom
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 rounded-full border border-dashed transition-colors duration-500"
        style={{ borderColor: `${ringColor}30` }}
      />
    </div>
  )
}

function OrbitingDots({ mode, isRunning, color }: { mode: TimerMode; isRunning: boolean; color?: string }) {
  const config = modeConfig[mode]
  const dotColor = color || config.gradientFrom

  const dots = [
    { offset: 0, size: 5, opacity: 0.9 },
    { offset: 90, size: 4, opacity: 0.6 },
    { offset: 180, size: 3, opacity: 0.4 },
    { offset: 270, size: 4, opacity: 0.5 },
  ]

  return (
    <div
      className="absolute inset-0 pointer-events-none rounded-full overflow-hidden"
      style={{
        animation: isRunning ? 'orbitSpin 12s linear infinite' : 'none',
      }}
    >
      {dots.map((dot, i) => {
        const angle = ((dot.offset) * Math.PI) / 180
        const radius = 47
        const cx = 50 + Math.cos(angle - Math.PI / 2) * radius
        const cy = 50 + Math.sin(angle - Math.PI / 2) * radius

        return (
          <div
            key={i}
            className="absolute rounded-full transition-opacity duration-500"
            style={{
              width: dot.size,
              height: dot.size,
              left: `${cx}%`,
              top: `${cy}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: dotColor,
              boxShadow: `0 0 ${dot.size * 2}px ${dotColor}`,
              opacity: isRunning ? dot.opacity : dot.opacity * 0.3,
            }}
          />
        )
      })}
    </div>
  )
}

function GlowEffect({ mode, isRunning, colorFrom }: { mode: TimerMode; isRunning: boolean; colorFrom: string }) {
  return (
    <div
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        animation: isRunning ? 'glowBreath 4s ease-in-out infinite' : 'none',
        background: `radial-gradient(circle, ${colorFrom}26 0%, transparent 60%)`,
      }}
    />
  )
}

// 动态计时器环形组件
interface DynamicTimerRingProps {
  mode: TimerMode
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  progress: number
}

function DynamicTimerRing({ mode, timeLeft, totalDuration, isRunning, progress }: DynamicTimerRingProps) {
  const config = modeConfig[mode]
  const ModeIcon = config.icon

  // 计算当前进度百分比 (0-100)
  const currentProgress = useMemo(() => ((totalDuration - timeLeft) / totalDuration) * 100, [totalDuration, timeLeft])

  const dynamicColors = useMemo(() => interpolateColor(currentProgress, config.colorStages), [currentProgress, config.colorStages])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative mx-auto w-72 h-72">
      <GlowEffect mode={mode} isRunning={isRunning} colorFrom={dynamicColors.from} />

      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${dynamicColors.from}15 0%, ${dynamicColors.to}08 100%)`,
        }}
      />

      <OrbitRing mode={mode} color={dynamicColors.from} />

      <svg
        className="absolute inset-0 -rotate-90 rounded-full z-10"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id={`progressGradient-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={dynamicColors.from} />
            <stop offset="100%" stopColor={dynamicColors.to} />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted/20"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`url(#progressGradient-${mode})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${progress * 2.83} 283`}
          style={{
            filter: `drop-shadow(0 0 8px ${dynamicColors.from})`,
            transition: 'stroke 0.5s ease'
          }}
        />
      </svg>

      <OrbitingDots mode={mode} isRunning={isRunning} color={dynamicColors.from} />

      <div className="absolute inset-6 rounded-full bg-card/90 backdrop-blur-sm flex flex-col items-center justify-center z-20">
        <ModeIcon
          className="h-8 w-8 mb-2 transition-colors duration-500"
          style={{ color: dynamicColors.from }}
        />
        <span
          className="font-bold tracking-tight transition-colors duration-500"
          style={{
            fontSize: 48,
            lineHeight: 1,
            letterSpacing: '-1px',
            fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif',
            color: dynamicColors.from,
          }}
        >
          {formatTime(timeLeft)}
        </span>
        <span className="mt-1 text-sm text-muted-foreground">
          {config.label}
        </span>
      </div>
    </div>
  )
}

export { OrbitRing, OrbitingDots, GlowEffect, DynamicTimerRing }
