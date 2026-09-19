'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Activity, Trash2, Monitor, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ActivityCategory, ActivityAppUsage } from '@/lib/types'

const CATEGORY_META: Record<ActivityCategory, { label: string; className: string; bar: string }> = {
  work: { label: '工作', className: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10', bar: 'bg-emerald-500' },
  distraction: { label: '分心', className: 'text-destructive border-destructive/30 bg-destructive/10', bar: 'bg-destructive' },
  neutral: { label: '中性', className: 'text-muted-foreground border-border bg-muted', bar: 'bg-muted-foreground/50' },
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} 分钟`
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`
}

export function ActivityTimelineCard() {
  const { activitySettings, activityDays, activityStatus, setActivityEnabled, updateActivitySettings, setAppCategoryRule, addTimeEntry, clearActivityData } = useAppStore(
    useShallow((s) => ({
      activitySettings: s.activitySettings,
      activityDays: s.activityDays,
      activityStatus: s.activityStatus,
      setActivityEnabled: s.setActivityEnabled,
      updateActivitySettings: s.updateActivitySettings,
      setAppCategoryRule: s.setAppCategoryRule,
      addTimeEntry: s.addTimeEntry,
      clearActivityData: s.clearActivityData,
    }))
  )

  const today = useMemo(() => {
    const key = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    return activityDays.find((d) => d.date === key)
  }, [activityDays])

  const totalSeconds = today?.apps.reduce((acc, a) => acc + a.seconds, 0) ?? 0
  const topApps = today?.apps.slice(0, 8) ?? []
  const distractionSeconds =
    today?.apps.filter((a) => a.category === 'distraction').reduce((acc, a) => acc + a.seconds, 0) ?? 0
  const distractionPct = totalSeconds > 0 ? Math.round((distractionSeconds / totalSeconds) * 100) : 0

  const handleClear = async () => {
    clearActivityData()
    toast.success('已清除本地应用使用记录')
  }

  /** 一键把某应用今日用量转为可编辑的时间记录（在时间追踪页可改项目/时长） */
  const handleConvert = (app: ActivityAppUsage) => {
    const start = app.firstAt ? new Date(app.firstAt) : new Date(Date.now() - app.seconds * 1000)
    const end = app.lastAt ? new Date(app.lastAt) : new Date()
    addTimeEntry({
      project: '应用追踪',
      description: `自动追踪 · ${app.title || app.name}`,
      tags: [],
      startTime: start,
      endTime: end,
      duration: app.seconds,
    })
    toast.success(`已转为时间记录（${formatDuration(app.seconds)}）`, {
      description: '在「时间追踪」页可修改项目与时长',
    })
  }

  const notElectron = typeof window !== 'undefined' && !window.electronAPI?.setActivityTracking

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              应用时间线（今日）
            </CardTitle>
            <CardDescription>
              自动记录前台应用使用分布 · 仅存储在本机，不上传云端
            </CardDescription>
          </div>
          <Switch
            checked={activitySettings.enabled}
            onCheckedChange={(v) => setActivityEnabled(v)}
            aria-label="启用应用时间线追踪"
            disabled={notElectron}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notElectron && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            该功能仅在 FocusFlow 桌面端可用。
          </p>
        )}

        {!notElectron && (activityStatus.state === 'unsupported' || activityStatus.state === 'error') && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {activityStatus.message || '自动追踪不可用'}
          </p>
        )}

        {!activitySettings.enabled && !notElectron && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            追踪未开启。打开右上角开关后自动在后台统计前台应用时长。
          </p>
        )}

        {activitySettings.enabled && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                <Activity className="h-3 w-3" />
                今日已记录 {formatDuration(totalSeconds)}
              </Badge>
              {totalSeconds > 0 && (
                <Badge variant={distractionPct > 40 ? 'destructive' : 'secondary'}>
                  分心占比 {distractionPct}%
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-2xs">保留</span>
                <Select
                  value={String(activitySettings.retentionDays ?? 14)}
                  onValueChange={(v) => updateActivitySettings({ retentionDays: Number(v) })}
                >
                  <SelectTrigger className="h-7 w-[86px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 14, 30, 60, 90].map((d) => (
                      <SelectItem key={d} value={String(d)} className="text-xs">
                        {d} 天
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activityDays.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleClear}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    清除记录
                  </Button>
                )}
              </div>
            </div>

            {topApps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                正在采样中，约半分钟后可见数据…
              </p>
            ) : (
              <div className="space-y-2">
                {topApps.map((app) => {
                  const meta = CATEGORY_META[app.category]
                  const pct = totalSeconds > 0 ? Math.round((app.seconds / totalSeconds) * 100) : 0
                  return (
                    <div key={app.name} className="group/app space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{app.title || app.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Select
                            value={app.category}
                            onValueChange={(v) => setAppCategoryRule(app.name, v as ActivityCategory)}
                          >
                            <SelectTrigger
                              className={cn(
                                'h-5 w-[68px] border-0 bg-transparent px-1 text-2xs shadow-none focus-visible:ring-1 focus-visible:ring-ring/40',
                                meta.className
                              )}
                              aria-label="修改归类"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(CATEGORY_META) as ActivityCategory[]).map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">
                                  {CATEGORY_META[c].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-2xs opacity-0 group-hover/app:opacity-100 transition-opacity"
                            onClick={() => handleConvert(app)}
                          >
                            转记录
                          </Button>
                          <span className="tabular-nums text-muted-foreground">
                            {formatDuration(app.seconds)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={cn('h-full rounded-full transition-all', meta.bar)}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
