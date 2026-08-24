'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarCheck2, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const RANGE_PRESETS = [
  { id: 'yesterday', label: '昨天', days: 1 },
  { id: 'last3', label: '最近3天', days: 3 },
  { id: 'last7', label: '最近7天', days: 7 },
  { id: 'last14', label: '最近14天', days: 14 },
]

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function HabitBatchCheckIn() {
  const habits = useAppStore((s) => s.habits)
  const habitCheckIns = useAppStore((s) => s.habitCheckIns)
  const batchCheckInHabits = useAppStore((s) => s.batchCheckInHabits)
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState('last7')
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set())

  const activeHabits = habits.filter((h) => !h.archived)

  const dates = useMemo(() => {
    const preset = RANGE_PRESETS.find((r) => r.id === range) || RANGE_PRESETS[1]
    const today = startOfDay(new Date())
    const out: Date[] = []
    for (let i = 1; i <= preset.days; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      out.push(d)
    }
    return out
  }, [range])

  const pendingCount = useMemo(() => {
    const existing = new Set(
      habitCheckIns.map((c) => `${c.habitId}|${new Date(c.date).toDateString()}`)
    )
    let count = 0
    for (const habitId of selectedHabitIds) {
      for (const date of dates) {
        if (!existing.has(`${habitId}|${new Date(date).toDateString()}`)) count++
      }
    }
    return count
  }, [selectedHabitIds, dates, habitCheckIns])

  const toggleHabit = (id: string) => {
    setSelectedHabitIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedHabitIds((prev) =>
      prev.size === activeHabits.length
        ? new Set()
        : new Set(activeHabits.map((h) => h.id))
    )
  }

  const handleConfirm = () => {
    if (selectedHabitIds.size === 0) {
      toast.error('请至少选择一个习惯')
      return
    }
    if (pendingCount === 0) {
      toast.info('所选日期均已打卡，无需补卡')
      return
    }
    batchCheckInHabits(Array.from(selectedHabitIds), dates)
    toast.success(`补卡成功，共补录 ${pendingCount} 次打卡`)
    setSelectedHabitIds(new Set())
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <History className="h-4 w-4" />
          批量补卡
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5" />
            批量补卡
          </DialogTitle>
          <DialogDescription>
            为过去遗漏打卡的日期批量补录完成记录，用于回顾补录
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">补卡范围</label>
            <div className="grid grid-cols-4 gap-2">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setRange(preset.id)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-sm transition-all',
                    range === preset.id
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              将补录 {dates.length} 个日期（不含今天）
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">选择习惯</label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                {selectedHabitIds.size === activeHabits.length && activeHabits.length > 0
                  ? '取消全选'
                  : '全选'}
              </Button>
            </div>
            <ScrollArea className="h-[220px] rounded-lg border">
              <div className="p-2">
                {activeHabits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">暂无习惯</p>
                ) : (
                  <div className="space-y-1">
                    {activeHabits.map((habit) => {
                      const selected = selectedHabitIds.has(habit.id)
                      return (
                        <button
                          key={habit.id}
                          onClick={() => toggleHabit(habit.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                            selected
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-transparent hover:bg-muted/50'
                          )}
                        >
                          <span className="text-base">{habit.icon}</span>
                          <span className="flex-1 truncate font-medium">{habit.name}</span>
                          {selected && (
                            <Badge variant="secondary" className="text-[10px]">
                              已选
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="items-center">
          <span className="mr-auto text-xs text-muted-foreground">
            {pendingCount > 0
              ? `将补录 ${pendingCount} 次打卡`
              : '所选日期均已打卡'}
          </span>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={selectedHabitIds.size === 0}>
            <CalendarCheck2 className="h-4 w-4 mr-1.5" />
            确认补卡
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}