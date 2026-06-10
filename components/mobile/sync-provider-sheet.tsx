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
 *
 * 支持四种同步服务：Firebase / Supabase / WebDAV / S3 兼容存储
 */

import { memo, useCallback, useEffect, useState } from 'react'
import { Cloud, Check, RefreshCw, ChevronRight, Lock, User, Server, Flame, Database, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './bottom-sheet'
import { S3Pane } from './sync-s3-pane'
import { WebDAVPane } from './sync-webdav-pane'
import { FirebasePane } from './sync-firebase-pane'
import { SupabasePane } from './sync-supabase-pane'
import { Switch } from '@/components/ui/switch'
import { getIsS3Configured } from '@/lib/s3-sync'
import { getIsWebDAVConfigured } from '@/lib/webdav'
import { getIsFirebaseConfigured } from '@/lib/firebase'
import { getIsSupabaseConfigured } from '@/lib/supabase'

const STORAGE_ENABLED = 'mobile-sync-enabled'
const STORAGE_LAST_SYNC = 'mobile-last-sync-at'
const STORAGE_PROVIDER = 'mobile-sync-provider'
type SyncProvider = 'firebase' | 'supabase' | 'webdav' | 's3'

const PROVIDER_CONFIG: { key: SyncProvider; label: string; description: string; icon: React.ElementType }[] = [
  { key: 'firebase', label: 'Firebase', description: 'Google 云服务，Firestore 实时同步', icon: Flame },
  { key: 'supabase', label: 'Supabase', description: '开源 BaaS，PostgreSQL + Realtime', icon: Database },
  { key: 'webdav', label: 'WebDAV', description: '坚果云 / 自建 WebDAV 服务器', icon: FolderOpen },
  { key: 's3', label: 'S3 兼容存储', description: '阿里云 OSS / MinIO / AWS', icon: Server },
]

function isProviderConfigured(provider: SyncProvider): boolean {
  switch (provider) {
    case 'firebase': return getIsFirebaseConfigured()
    case 'supabase': return getIsSupabaseConfigured()
    case 'webdav': return getIsWebDAVConfigured()
    case 's3': return getIsS3Configured()
  }
}

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
  const [activeProvider, setActiveProvider] = useState<SyncProvider>(() => {
    if (typeof window === 'undefined') return 's3'
    return (localStorage.getItem(STORAGE_PROVIDER) as SyncProvider) || 's3'
  })
  const [showConfig, setShowConfig] = useState<SyncProvider | null>(null)

  const isActiveConfigured = isProviderConfigured(activeProvider)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ENABLED, String(enabled))
    }
  }, [enabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_PROVIDER, activeProvider)
    }
  }, [activeProvider])

  const handleClose = useCallback(() => onClose(), [onClose])

  const handleEnabledChange = useCallback((v: boolean) => {
    if (v && !isActiveConfigured) {
      setShowConfig(activeProvider)
      return
    }
    setEnabled(v)
  }, [isActiveConfigured, activeProvider])

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
        {/* 总开关 */}
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
          {PROVIDER_CONFIG.map(({ key, label, description, icon: Icon }) => {
            const configured = isProviderConfigured(key)
            const isActive = activeProvider === key
            return (
              <button
                key={key}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 active:bg-muted/30 transition-colors text-left',
                  isActive && enabled && configured && 'bg-primary/5'
                )}
                onClick={() => {
                  setActiveProvider(key)
                  setShowConfig(key)
                }}
              >
                <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {configured ? (isActive && enabled ? '已启用' : '已配置') : description}
                  </p>
                </div>
                {isActive && enabled && configured ? (
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                )}
              </button>
            )
          })}
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
              enabled && isActiveConfigured
                ? 'text-primary active:bg-primary/5'
                : 'text-muted-foreground active:bg-muted/30'
            )}
            onClick={() => {
              if (!enabled || !isActiveConfigured) {
                setShowConfig(activeProvider)
              }
            }}
            disabled={!enabled || !isActiveConfigured}
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
            value={isActiveConfigured ? '已配置' : '未配置'}
            onClick={() => setShowConfig(activeProvider)}
          />
          <ActionRow
            icon={Lock}
            label="数据加密"
            value="端对端"
          />
        </Section>
      </div>

      {/* Firebase 配置面板 */}
      <ProviderConfigSheet
        provider="firebase"
        open={showConfig === 'firebase'}
        onClose={() => setShowConfig(null)}
        syncEnabled={enabled && activeProvider === 'firebase'}
        onSyncEnabledChange={handleEnabledChange}
        lastSyncAt={lastSyncAt}
        onSynced={handleSynced}
        pane={<FirebasePane
          syncEnabled={enabled && activeProvider === 'firebase'}
          onSyncEnabledChange={handleEnabledChange}
          lastSyncAt={lastSyncAt}
          onSynced={handleSynced}
          onClose={() => setShowConfig(null)}
        />}
      />

      {/* Supabase 配置面板 */}
      <ProviderConfigSheet
        provider="supabase"
        open={showConfig === 'supabase'}
        onClose={() => setShowConfig(null)}
        syncEnabled={enabled && activeProvider === 'supabase'}
        onSyncEnabledChange={handleEnabledChange}
        lastSyncAt={lastSyncAt}
        onSynced={handleSynced}
        pane={<SupabasePane
          syncEnabled={enabled && activeProvider === 'supabase'}
          onSyncEnabledChange={handleEnabledChange}
          lastSyncAt={lastSyncAt}
          onSynced={handleSynced}
          onClose={() => setShowConfig(null)}
        />}
      />

      {/* WebDAV 配置面板 */}
      <ProviderConfigSheet
        provider="webdav"
        open={showConfig === 'webdav'}
        onClose={() => setShowConfig(null)}
        syncEnabled={enabled && activeProvider === 'webdav'}
        onSyncEnabledChange={handleEnabledChange}
        lastSyncAt={lastSyncAt}
        onSynced={handleSynced}
        pane={<WebDAVPane
          syncEnabled={enabled && activeProvider === 'webdav'}
          onSyncEnabledChange={handleEnabledChange}
          lastSyncAt={lastSyncAt}
          onSynced={handleSynced}
          onClose={() => setShowConfig(null)}
        />}
      />

      {/* S3 配置面板 */}
      <ProviderConfigSheet
        provider="s3"
        open={showConfig === 's3'}
        onClose={() => setShowConfig(null)}
        syncEnabled={enabled && activeProvider === 's3'}
        onSyncEnabledChange={handleEnabledChange}
        lastSyncAt={lastSyncAt}
        onSynced={handleSynced}
        pane={<S3Pane
          syncEnabled={enabled && activeProvider === 's3'}
          onSyncEnabledChange={handleEnabledChange}
          lastSyncAt={lastSyncAt}
          onSynced={handleSynced}
          onClose={() => setShowConfig(null)}
        />}
      />
    </BottomSheet>
  )
}

export const SyncProviderSheet = memo(SyncProviderSheetInner)

// 通用 Provider 配置详情 Sheet
interface ProviderConfigSheetProps {
  provider: SyncProvider
  open: boolean
  onClose: () => void
  syncEnabled: boolean
  onSyncEnabledChange: (v: boolean) => void
  lastSyncAt: Date | null
  onSynced: (date: Date) => void
  pane: React.ReactNode
}

const PROVIDER_LABELS: Record<SyncProvider, { title: string; description: string }> = {
  firebase: { title: 'Firebase', description: '配置 Google Firebase 同步' },
  supabase: { title: 'Supabase', description: '配置 Supabase PostgreSQL 同步' },
  webdav: { title: 'WebDAV', description: '配置 WebDAV / 坚果云同步' },
  s3: { title: 'S3 兼容存储', description: '配置 S3 / 阿里云 OSS / MinIO' },
}

function ProviderConfigSheetInner({
  provider,
  open,
  onClose,
  pane,
}: ProviderConfigSheetProps) {
  const { title, description } = PROVIDER_LABELS[provider]
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="pointer-events-auto"
    >
      {pane}
    </BottomSheet>
  )
}

const ProviderConfigSheet = memo(ProviderConfigSheetInner)
