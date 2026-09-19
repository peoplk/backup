'use client'

import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'

const CHALK_FONT: CSSProperties = { fontFamily: "'Kaiti SC', 'KaiTi', 'STKaiti', 'DFKai-SB', serif" }
const MONO_FONT: CSSProperties = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }

export type KioskStyleMode = 'oled' | 'chalk' | 'neon'

export interface KioskSkinTokens {
  badgeBorder: string
  badgeColor: string
  secondary: string
  ghostBorder: string
  playBg: string
  playColor: string
}

const PANEL_BG: Record<KioskStyleMode, string> = {
  oled: '#0a0a0a',
  chalk: 'rgba(255,255,255,0.07)',
  neon: 'rgba(13,16,28,0.94)',
}

/** 全屏沉浸计时器内的浮层面板：遮罩 + 玻璃面板 + 标题/关闭按钮，主题皮肤通过 CSS 变量下发 */
export function KioskPanel({
  onClose,
  title,
  icon,
  width = 440,
  styleMode,
  skin,
  children,
}: {
  onClose: () => void
  title: string
  icon?: ReactNode
  width?: number
  styleMode: KioskStyleMode
  skin: KioskSkinTokens
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        style={{
          width: `min(92vw, ${width}px)`,
          maxHeight: '82vh',
          overflowY: 'auto',
          borderRadius: 20,
          background: PANEL_BG[styleMode],
          border: skin.badgeBorder,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: '24px 26px',
          ...(styleMode === 'chalk' ? CHALK_FONT : {}),
          ['--kiosk-accent' as string]: skin.secondary,
          ['--kiosk-ghost-border' as string]: skin.ghostBorder,
          ['--kiosk-play-bg' as string]: skin.playBg,
          ['--kiosk-play-color' as string]: skin.playColor,
        } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: skin.badgeColor, display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label={`关闭${title}`}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** 标签 + 等宽高亮数值 + 滑杆的表单行 */
export function KioskSliderRow({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--kiosk-accent)', ...MONO_FONT }}>{value}</span>
      </div>
      {children}
    </div>
  )
}

export function KioskSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}

/** 可选中的卡片/胶囊按钮：统一的激活态描边与填充 */
export function KioskChoice({
  active,
  onClick,
  children,
  full,
  compact,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  full?: boolean
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 3 : 4,
        width: full ? '100%' : undefined,
        padding: compact ? '10px 4px' : '12px 6px',
        borderRadius: 12,
        cursor: 'pointer',
        border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
        background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
        color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  )
}

/** 预设组合等轻量胶囊选项 */
export function KioskPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 11,
        cursor: 'pointer',
        border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.14)',
        background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
        color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  )
}

/** 面板底部主操作按钮（完成 / 清空并停止） */
export function KioskFooterButton({
  onClick,
  disabled,
  muted,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  muted?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 42,
        borderRadius: 12,
        border: 'var(--kiosk-ghost-border)',
        background: muted ? 'rgba(255,255,255,0.08)' : disabled ? 'transparent' : 'var(--kiosk-play-bg)',
        color: muted ? 'rgba(255,255,255,0.85)' : disabled ? 'rgba(255,255,255,0.3)' : 'var(--kiosk-play-color)',
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  )
}

export function KioskNote({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
      {children}
    </p>
  )
}
