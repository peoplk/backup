'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  ChevronDown,
  Star,
  Heart,
  Sun,
  Smile,
  Cloud,
  CloudRain,
  Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyJournal } from '@/lib/types'

const MOOD_META: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  great: { icon: Sun, label: '超棒', className: 'text-amber-500' },
  good: { icon: Smile, label: '不错', className: 'text-emerald-500' },
  neutral: { icon: Cloud, label: '一般', className: 'text-slate-500' },
  bad: { icon: CloudRain, label: '糟糕', className: 'text-blue-500' },
  terrible: { icon: Moon, label: '很糟', className: 'text-indigo-500' },
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function JournalHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const journals = useAppStore(useShallow((s) => s.journals))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(
    () =>
      [...journals].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [journals]
  )

  const summaryOf = (j: DailyJournal) => {
    if (j.content) return j.content
    const parts = [...(j.wins ?? []), ...(j.gratitude ?? [])]
    return parts.length > 0 ? parts.join('、') : '未填写内容'
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setExpandedId(null)
      }}
    >
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-chart-3" />
            回顾历史
          </DialogTitle>
          <DialogDescription className="text-xs">
            共 {sorted.length} 条回顾记录
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">还没有回顾记录</p>
              <p className="mt-1 text-xs text-muted-foreground">
                完成每日回顾后，记录会出现在这里
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((j) => {
                const d = new Date(j.date)
                const meta = j.mood ? MOOD_META[j.mood] : null
                const MoodIcon = meta?.icon
                const expanded = expandedId === j.id
                return (
                  <button
                    key={j.id}
                    onClick={() => setExpandedId(expanded ? null : j.id)}
                    className="w-full text-left rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      {MoodIcon && (
                        <MoodIcon className={cn('h-4 w-4 shrink-0', meta!.className)} />
                      )}
                      <span className="text-sm font-medium">
                        {d.getMonth() + 1}月{d.getDate()}日 {WEEKDAYS[d.getDay()]}
                      </span>
                      <span className="text-2xs text-muted-foreground truncate">
                        {meta?.label}
                        {(j.wins?.length ?? 0) > 0 && ` · ${j.wins!.length} 个成就`}
                        {(j.gratitude?.length ?? 0) > 0 && ` · 感恩 ${j.gratitude!.length}`}
                      </span>
                      <ChevronDown
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          expanded && 'rotate-180'
                        )}
                      />
                    </div>
                    {!expanded ? (
                      <p className="mt-1.5 text-xs text-muted-foreground truncate">
                        {summaryOf(j)}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {j.content && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {j.content}
                          </p>
                        )}
                        {(j.wins?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {j.wins!.map((w, i) => (
                              <Badge key={i} variant="secondary" className="gap-1">
                                <Star className="h-3 w-3 text-amber-500" />
                                {w}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(j.gratitude?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {j.gratitude!.map((g, i) => (
                              <Badge key={i} variant="secondary" className="gap-1">
                                <Heart className="h-3 w-3 text-rose-500" />
                                {g}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
