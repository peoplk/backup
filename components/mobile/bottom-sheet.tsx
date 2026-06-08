'use client'

/**
 * 移动端底部弹出面板（Bottom Sheet）
 *
 * 为什么不直接用 @/components/ui/sheet：
 * 1. Radix Sheet 在 Android Capacitor WebView 中，关闭动画（data-[state=closed]:animate-out fade-out-0）
 *    残留 pointer-events: none 阻断内部点击
 * 2. SheetPrimitive.Content 的 inert 属性挂载时机不一致
 * 3. 每次 open=true 都要重新走完整的 fade + slide 动画链
 *
 * 替代方案：
 * - 用原生 <dialog> 元素（Capacitor WebView Chromium 99+ 支持）
 * - 用 transform + transition，手动控制动画
 * - 关闭后立即 unmount，避免残留
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function BottomSheet({ open, onClose, title, description, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // 锁 body 滚动
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      // overlay 点击关闭 + 阻止内部冒泡
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      {/* 半透明背景 */}
      <div
        className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Sheet 主体 */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // 关键：明确 pointer-events-auto，确保内部可点击
        className={cn(
          'relative w-full max-h-[90vh] overflow-y-auto bg-background rounded-t-2xl shadow-xl',
          'animate-[slideUp_0.25s_cubic-bezier(0.32,0.72,0,1)]',
          'pointer-events-auto touch-auto',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        // 阻止 touch 事件冒泡到 overlay
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* 拖拽手柄 */}
        <div className="sticky top-0 z-10 bg-background pt-2 pb-1 -mt-1">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-3 top-3 h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-90 transition-transform z-20"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        {(title || description) && (
          <div className="px-5 pt-2 pb-3">
            {title && <h2 className="text-base font-semibold pr-10">{title}</h2>}
            {description && (
              <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}
