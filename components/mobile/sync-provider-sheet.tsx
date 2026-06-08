'use client'

/**
 * 云同步 Provider Sheet（移动端）
 *
 * 设计语言与 mobile-settings-view.tsx 完全一致：
 * - Section: 分组标题 + rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/20
 * - ActionRow: 图标(18px muted) + 标签(13px) + 值/箭头
 * - Row: 图标 + 标签 + 右侧控件
 * - 圆角: rounded-2xl, 字体: [10px]-[13px]
 * - 交互: active:bg-muted/30 transition-colors
 */

import { memo, useCallback, useEffect, useState } from 'react'
import { Cloud, Globe, Check, RefreshCw, ChevronRight, Shield, Lock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './bottom-sheet'
import { WebDAVPane } from './sync-webdav-pane'
import { Switch } from '@/components/ui/switch'
import { getIsWebDAVConfigured } from '@/lib/webdav'

const STORAGE_ENABLED = 'mobile-sync-enabled'
const STORAGE_LAST_SYNC = 'mobile-last-sync-at'

interface SyncProviderSheetProps {
  open: boolean
  onClose: () => void
}

function SyncProviderSheetInner({ open, onClose }: SyncProviderSheetProps) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_ENABLED) === 'true'
  })
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(STORAGE_LAST_SYNC)
    return stored ? new Date(stored) : null
  })
  const [showWebDAVConfig, setShowWebDAVConfig] = useState(false)
  const [isConfigured] = useState(() => getIsWebDAVConfigured())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ENABLED, String(enabled))
    }
  }, [enabled])

  const handleClose = useCallback(() => onClose(), [onClose])

  const handleEnabledChange = useCallback((v: boolean) => {
    if (v && !isConfigured) {
      setShowWebDAVConfig(true)
      return
    }
    setEnabled(v)
  }, [isConfigured])

  const handleSynced = useCallback((date: Date) => {
    setLastSyncAt(date)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LAST_SYNC, date.toISOString())
    }
  }, [])

  // 与 mobile-settings-view 一致的 Section 组件
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">{title}</p>
      <div className="rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </div>
  )

  // 与 mobile-settings-view 一致的 ActionRow 组件
  const ActionRow = ({ icon: Icon, label, value, onClick, destructive }: {
    icon: React.ElementType; label: string; value?: string; onClick?: () => void; destructive?: boolean
  }) => (
    <button
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 active:bg-muted/30 transition-colors text-left',
        destructive && 'text-red-500'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', destructive ? 'text-red-500' : 'text-muted-foreground')} />
      <span className="flex-1 text-[13px]">{label}</span>
      {value && <span className="text-[13px] text-muted-foreground">{value}</span>}
      {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </button>
  )

  // 与 mobile-settings-view 一致的 Row 组件
  const Row = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
      <span className="flex-1 text-[13px]">{label}</span>
      {children}
    </div>
  )

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="云同步"
      description="配置数据同步服务"
      className="pointer-events-auto"
    >
      <div className="space-y-1 pt-2">
        {/* 总开关 —— 使用 Row 组件 */}
        <Section title="">
          <Row icon={Cloud} label="启用云同步">
            <Switch
              checked={enabled}
              onCheckedChange={handleEnabledChange}
            />
          </Row>
        </Section>

        {/* 同步服务 */}
        <Section title="同步服务">
          <button
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 active:bg-muted/30 transition-colors text-left',
              enabled && isConfigured && 'bg-primary/5'
            )}
            onClick={() => setShowWebDAVConfig(true)}
          >
            <Globe className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px]">WebDAV</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isConfigured ? (enabled ? '已启用' : '已配置') : '点击配置'}
              </p>
            </div>
            {enabled && isConfigured ? (
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-3 w-3 text-primary" />
              </div>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            )}
          </button>
        </Section>

        {/* 同步状态 */}
        <Section title="同步状态">
          <div className="flex items-center gap-3 px-4 py-3">
            <RefreshCw className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <span className="flex-1 text-[13px]">上次同步</span>
            <span className="text-[13px] text-muted-foreground">
              {lastSyncAt ? lastSyncAt.toLocaleString('zh-CN') : '未同步'}
            </span>
          </div>
          <button
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors',
              enabled && isConfigured
                ? 'text-primary active:bg-primary/5'
                : 'text-muted-foreground active:bg-muted/30'
            )}
            onClick={() => {
              if (!enabled || !isConfigured) {
                setShowWebDAVConfig(true)
              }
              // 实际同步逻辑在 WebDAVPane 中
            }}
            disabled={!enabled || !isConfigured}
          >
            <RefreshCw className="h-4 w-4" />
            立即同步
          </button>
        </Section>

        {/* 账号与安全 */}
        <Section title="账号与安全">
          <ActionRow
            icon={User}
            label="账号管理"
            value={isConfigured ? '已配置' : '未配置'}
            onClick={() => setShowWebDAVConfig(true)}
          />
          <ActionRow
            icon={Lock}
            label="数据加密"
            value="端对端"
          />
        </Section>
      </div>

      {/* WebDAV 配置面板 */}
      <WebDAVConfigSheet
        open={showWebDAVConfig}
        onClose={() => setShowWebDAVConfig(false)}
        syncEnabled={enabled}
        onSyncEnabledChange={handleEnabledChange}
        lastSyncAt={lastSyncAt}
        onSynced={handleSynced}
      />
    </BottomSheet>
  )
}

export const SyncProviderSheet = memo(SyncProviderSheetInner)

// WebDAV 配置详情 Sheet
interface WebDAVConfigSheetProps {
  open: boolean
  onClose: () => void
  syncEnabled: boolean
  onSyncEnabledChange: (v: boolean) => void
  lastSyncAt: Date | null
  onSynced: (date: Date) => void
}

function WebDAVConfigSheetInner({
  open,
  onClose,
  syncEnabled,
  onSyncEnabledChange,
  lastSyncAt,
  onSynced,
}: WebDAVConfigSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="WebDAV 配置"
      description="配置 WebDAV 服务器连接"
      className="pointer-events-auto"
    >
      <WebDAVPane
        syncEnabled={syncEnabled}
        onSyncEnabledChange={onSyncEnabledChange}
        lastSyncAt={lastSyncAt}
        onSynced={onSynced}
        onClose={onClose}
      />
    </BottomSheet>
  )
}

const WebDAVConfigSheet = memo(WebDAVConfigSheetInner)
