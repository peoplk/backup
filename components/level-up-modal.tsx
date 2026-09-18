'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

/**
 * 升级庆祝弹窗（全局挂载一次）：
 * addPoints 检测到跨级时置位 levelUpCelebration，这里弹出全屏庆祝；
 * 关闭后清空。无内容时不渲染任何 DOM。
 */
export function LevelUpModal() {
  const levelUpCelebration = useAppStore((s) => s.levelUpCelebration)
  const clearLevelUpCelebration = useAppStore((s) => s.clearLevelUpCelebration)
  const [show, setShow] = useState(false)

  // 延迟一帧置为可见：先以透明态挂载，再过渡入场
  useEffect(() => {
    if (levelUpCelebration) {
      const t = window.setTimeout(() => setShow(true), 20)
      return () => window.clearTimeout(t)
    }
    setShow(false)
  }, [levelUpCelebration])

  if (!levelUpCelebration) return null

  const close = () => {
    setShow(false)
    window.setTimeout(clearLevelUpCelebration, 200)
  }

  return (
    <div
      className={cnOverlay(show)}
      onClick={close}
      role="dialog"
      aria-label="升级庆祝"
    >
      <div
        className={cnCard(show)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30 animate-in zoom-in-95 duration-300">
          <Trophy className="h-10 w-10 text-white" />
        </div>
        <p className="text-sm text-muted-foreground">恭喜升级</p>
        <p className="mt-1 bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-4xl font-bold text-transparent">
          Lv.{levelUpCelebration.level}
        </p>
        <p className="mt-2 text-lg font-semibold">{levelUpCelebration.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          继续保持，下一阶段已经解锁
        </p>
        <Button onClick={close} className="mt-6 w-full">
          继续前行
        </Button>
      </div>
    </div>
  )
}

function cnOverlay(visible: boolean): string {
  return [
    'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200',
    visible ? 'opacity-100' : 'opacity-0',
  ].join(' ')
}

function cnCard(visible: boolean): string {
  return [
    'mx-4 w-full max-w-xs rounded-2xl border bg-card p-8 text-center shadow-2xl transition-all duration-200',
    visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
  ].join(' ')
}
