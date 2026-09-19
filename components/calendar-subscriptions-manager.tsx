'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { CalendarSync, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { refreshSubscribedCalendar, refreshAllSubscriptions } from '@/lib/calendar-subscriptions'
import { cn } from '@/lib/utils'

export function CalendarSubscriptionsManager() {
  const { calendars, addSubscribedCalendar, removeSubscribedCalendar, toggleSubscribedCalendar } =
    useAppStore(
      useShallow((s) => ({
        calendars: s.subscribedCalendars,
        addSubscribedCalendar: s.addSubscribedCalendar,
        removeSubscribedCalendar: s.removeSubscribedCalendar,
        toggleSubscribedCalendar: s.toggleSubscribedCalendar,
      }))
    )

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [refreshingAll, setRefreshingAll] = useState(false)

  const handleAdd = () => {
    setError('')
    const created = addSubscribedCalendar({ name, url })
    if (!created) {
      setError('请填写名称与有效的订阅地址（仅支持 https 或本机地址）')
      return
    }
    setName('')
    setUrl('')
    void refreshSubscribedCalendar(created.id)
  }

  const handleRefreshAll = async () => {
    setRefreshingAll(true)
    try {
      await refreshAllSubscriptions()
    } finally {
      setRefreshingAll(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarSync className="h-3.5 w-3.5" />
          订阅日历
          {calendars.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-2xs">
              {calendars.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>订阅日历（ICS）</DialogTitle>
          <DialogDescription>
            粘贴日历服务的 ICS 订阅链接（Google 日历设置 → 集成日历 →
            「私密地址 iCal 格式」），事件将只读叠加到月视图中。每 30 分钟自动同步。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2 rounded-xl border border-border/50 p-3">
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="名称，如 Google 日历"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-1 h-8 text-xs"
              />
              <Input
                placeholder="https://…/basic.ics"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="col-span-2 h-8 text-xs font-mono"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={handleAdd} disabled={!name.trim() || !url.trim()}>
                <Plus className="h-3.5 w-3.5" />
                添加订阅
              </Button>
            </div>
          </div>

          {calendars.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">已添加 {calendars.length} 个</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={refreshingAll}
                  onClick={handleRefreshAll}
                >
                  <RefreshCw className={cn('h-3 w-3', refreshingAll && 'animate-spin')} />
                  全部刷新
                </Button>
              </div>
              {calendars.map((cal) => (
                <div
                  key={cal.id}
                  className="flex items-center gap-2 rounded-xl border border-border/50 p-2.5"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cal.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cal.name}</p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {cal.status === 'syncing' && '同步中…'}
                      {cal.status === 'error' && `同步失败：${cal.lastError || '未知错误'}`}
                      {cal.status === 'synced' &&
                        `上次同步 ${cal.lastFetchedAt ? new Date(cal.lastFetchedAt).toLocaleTimeString('zh-CN') : ''}`}
                      {(cal.status ?? 'idle') === 'idle' && '尚未同步'}
                    </p>
                  </div>
                  <Switch
                    checked={cal.enabled}
                    onCheckedChange={() => toggleSubscribedCalendar(cal.id)}
                    aria-label={`启用或停用 ${cal.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`立即刷新 ${cal.name}`}
                    onClick={() => void refreshSubscribedCalendar(cal.id)}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`删除 ${cal.name}`}
                    onClick={() => removeSubscribedCalendar(cal.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
