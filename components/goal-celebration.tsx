'use client'

import { useEffect, useState } from 'react'
import { Trophy, X, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GoalCelebrationProps {
  open: boolean
  onClose: () => void
  /** 已连续达成天数（可选） */
  streakDays?: number
}

const ENCOURAGE = [
  '干得漂亮！',
  '今天的目标已达成，继续保持。',
  '番茄的力量！',
  '坚持就是胜利。',
  '你比昨天更专注。',
]

export function GoalCelebration({ open, onClose, streakDays }: GoalCelebrationProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const t = setTimeout(() => setMounted(true), 30)
      return () => clearTimeout(t)
    } else {
      setMounted(false)
    }
  }, [open])

  if (!open) return null

  const text = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300',
        mounted ? 'opacity-100' : 'opacity-0'
      )}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <Star
            key={i}
            className="absolute h-4 w-4 text-amber-400 animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.6}s`,
              opacity: 0.4 + Math.random() * 0.6,
            }}
          />
        ))}
      </div>

      <div
        className={cn(
          'relative z-10 w-[420px] max-w-[90vw] rounded-2xl border bg-card p-8 shadow-2xl transition-all',
          mounted ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-3 top-3 h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold">{text}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            今日专注目标已达成
          </p>

          {streakDays !== undefined && streakDays > 1 && (
            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              已连续 {streakDays} 天达成
            </div>
          )}

          <div className="mt-6 flex items-center gap-2">
            <Button onClick={onClose} size="sm">
              继续专注
            </Button>
            <Button onClick={onClose} variant="outline" size="sm">
              稍后再说
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
