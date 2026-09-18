'use client'

import { useState } from 'react'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  CloudOff,
  Cloud,
} from 'lucide-react'
import { useS3SyncStore } from '@/lib/s3-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

const STATUS_META: Record<SyncStatus, { icon: React.ElementType; className: string; label: string; spin?: boolean }> = {
  idle: { icon: Cloud, className: 'text-muted-foreground', label: '未同步' },
  syncing: { icon: Loader2, className: 'text-chart-1', label: '同步中', spin: true },
  synced: { icon: CheckCircle2, className: 'text-chart-2', label: '已同步' },
  error: { icon: AlertCircle, className: 'text-destructive', label: '同步失败' },
  offline: { icon: CloudOff, className: 'text-muted-foreground', label: '离线' },
}

/** 顶栏云同步状态指示：仅在已启用同步时显示，点击手动触发一次同步 */
export function SyncStatusIndicator() {
  const s3 = useS3SyncStore()
  const [busy, setBusy] = useState(false)

  const active = s3.isEnabled
    ? {
        provider: 'S3',
        status: s3.status as SyncStatus,
        lastSyncAt: s3.lastSyncAt ?? null,
        error: s3.error ?? null,
        forceSync: s3.forceSync,
      }
    : null

  if (!active) return null

  const meta = STATUS_META[active.status] ?? STATUS_META.idle
  const Icon = meta.icon
  const timeText = active.lastSyncAt
    ? (active.lastSyncAt instanceof Date ? active.lastSyncAt : new Date(active.lastSyncAt)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : null

  const title = [
    `${active.provider} · ${meta.label}`,
    timeText ? `上次 ${timeText}` : null,
    active.status === 'error' && active.error ? active.error : null,
  ].filter(Boolean).join(' · ')

  const handleManualSync = async () => {
    if (busy || active.status === 'syncing') return
    setBusy(true)
    try {
      await active.forceSync()
    } catch {
      toast.error('手动同步失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleManualSync}
      title={title}
      aria-label={`云同步状态：${meta.label}`}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 rounded-xl px-2.5 text-xs transition-colors',
        'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        busy || active.status === 'syncing' ? 'cursor-default opacity-80' : ''
      )}
    >
      <Icon className={cn('h-4 w-4', meta.className, (meta.spin || busy) && 'animate-spin')} />
      <span className={cn('hidden lg:inline', active.status === 'error' && 'text-destructive')}>
        {busy ? '同步中' : meta.label}
      </span>
    </button>
  )
}
