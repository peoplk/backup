'use client'

import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FocusShieldWindow } from '@/lib/types'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function newDefaultWindow(): Omit<FocusShieldWindow, 'id'> {
  return { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' }
}

export function ShieldScheduleSettings() {
  const { schedule, updateFocusShieldSchedule, upsertShieldWindow, removeShieldWindow } =
    useAppStore(
      useShallow((s) => ({
        schedule: s.focusShieldSchedule,
        updateFocusShieldSchedule: s.updateFocusShieldSchedule,
        upsertShieldWindow: s.upsertShieldWindow,
        removeShieldWindow: s.removeShieldWindow,
      }))
    )

  const toggleDay = (win: FocusShieldWindow, day: number) => {
    const days = win.days.includes(day)
      ? win.days.filter((d) => d !== day)
      : [...win.days, day].sort()
    upsertShieldWindow({ ...win, days })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              定时封锁会话
            </CardTitle>
            <CardDescription>
              在设定时间段自动开启/关闭专注盾，无需依赖意志力手动启动（桌面端生效）
            </CardDescription>
          </div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(v) => updateFocusShieldSchedule({ enabled: v })}
            aria-label="启用定时封锁会话"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!schedule.enabled && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            启用后，下方时间窗开始时将自动应用当前屏蔽清单，结束或跨夜越界时自动停止。
            窗口内手动停止后不会被强制重启，直到下一个窗口边界。
          </p>
        )}

        {schedule.windows.map((win) => (
          <div key={win.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={win.start}
                onChange={(e) => upsertShieldWindow({ ...win, start: e.target.value })}
                className="h-8 w-[110px] text-xs"
                aria-label="窗口开始时间"
              />
              <span className="text-xs text-muted-foreground">至</span>
              <Input
                type="time"
                value={win.end}
                onChange={(e) => upsertShieldWindow({ ...win, end: e.target.value })}
                className="h-8 w-[110px] text-xs"
                aria-label="窗口结束时间"
              />
              <span className="text-2xs text-muted-foreground">支持跨夜（如 22:00 → 07:00）</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeShieldWindow(win.id)}
                aria-label="删除该时间窗"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              {WEEKDAY_LABELS.map((label, idx) => {
                const active = win.days.includes(idx)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(win, idx)}
                    aria-label={`周${label}${active ? '已选' : '未选'}`}
                    aria-pressed={active}
                    className={cn(
                      'h-7 w-8 rounded-md border text-xs transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => upsertShieldWindow(newDefaultWindow())}
        >
          <Plus className="h-3.5 w-3.5" />
          添加时间窗
        </Button>
      </CardContent>
    </Card>
  )
}
