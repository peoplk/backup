'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  Timer,
  Target,
  Flame,
  Trophy,
  Sparkles,
  Calendar,
  Star,
  ArrowRight,
  Heart,
  Smile,
  Moon,
  Sun,
  Cloud,
  CloudRain,
  Zap,
  BookOpen,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { JournalHistoryDialog } from '@/components/journal-history-dialog'

interface DailyReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

const MOOD_OPTIONS = [
  { id: 'great', icon: Sun, label: '超棒', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'good', icon: Smile, label: '不错', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'neutral', icon: Cloud, label: '一般', color: 'text-slate-500', bg: 'bg-slate-500/10' },
  { id: 'bad', icon: CloudRain, label: '糟糕', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'terrible', icon: Moon, label: '很糟', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
] as const

export function DailyReviewDialog({ open, onOpenChange, onComplete }: DailyReviewDialogProps) {
  const {
    tasks,
    pomodoroSessions,
    habits,
    habitCheckIns,
    focusGoals,
    dailyReviewSettings,
    markDailyReviewShown,
    addJournal,
    getJournalForDate,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    pomodoroSessions: s.pomodoroSessions,
    habits: s.habits,
    habitCheckIns: s.habitCheckIns,
    focusGoals: s.focusGoals,
    dailyReviewSettings: s.dailyReviewSettings,
    markDailyReviewShown: s.markDailyReviewShown,
    addJournal: s.addJournal,
    getJournalForDate: s.getJournalForDate,
  })))

  const [mood, setMood] = useState<'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null>(null)
  const [wins, setWins] = useState<string[]>([])
  const [winInput, setWinInput] = useState('')
  const [gratitude, setGratitude] = useState<string[]>([])
  const [gratitudeInput, setGratitudeInput] = useState('')
  const [reflection, setReflection] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayStr = today.toDateString()
  const dateKey = today.toISOString().slice(0, 10)

  const todayStats = useMemo(() => {
    const todayTasks = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt).toDateString() === todayStr
    )
    const todayPomodoros = pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
    )
    const todayFocusSeconds = todayPomodoros.reduce((acc, s) => acc + s.duration, 0)
    const todayFocusMinutes = Math.round(todayFocusSeconds / 60)
    const todayHabits = habits.filter((h) => !h.archived)
    const completedHabits = todayHabits.filter((h) =>
      habitCheckIns.some(
        (c) => c.habitId === h.id && new Date(c.date).toDateString() === todayStr && c.completed
      )
    )
    return {
      tasksCompleted: todayTasks.length,
      pomodoros: todayPomodoros.length,
      focusMinutes: todayFocusMinutes,
      habitsCompleted: completedHabits.length,
      habitsTotal: todayHabits.length,
      habitRate: todayHabits.length > 0 ? Math.round((completedHabits.length / todayHabits.length) * 100) : 0,
    }
  }, [tasks, pomodoroSessions, habits, habitCheckIns, todayStr])

  // 从已存在的日记加载数据
  useEffect(() => {
    if (!open) return
    const existing = getJournalForDate(today)
    if (existing) {
      setMood(existing.mood || null)
      setWins(existing.wins || [])
      setGratitude(existing.gratitude || [])
      setReflection(existing.content || '')
    } else {
      setMood(null)
      setWins([])
      setGratitude([])
      setReflection('')
    }
  }, [open, today, getJournalForDate])

  const dailyGoalProgress = Math.min((todayStats.focusMinutes / focusGoals.dailyMinutes) * 100, 100)
  const pomodoroGoalProgress = Math.min((todayStats.pomodoros / focusGoals.dailyPomodoros) * 100, 100)

  const handleAddWin = () => {
    const v = winInput.trim()
    if (!v) return
    if (wins.includes(v)) {
      setWinInput('')
      return
    }
    setWins([...wins, v])
    setWinInput('')
  }

  const handleAddGratitude = () => {
    const v = gratitudeInput.trim()
    if (!v) return
    if (gratitude.includes(v)) {
      setGratitudeInput('')
      return
    }
    setGratitude([...gratitude, v])
    setGratitudeInput('')
  }

  const handleSave = () => {
    addJournal({
      date: today,
      content: reflection.trim(),
      mood: mood || undefined,
      gratitude: gratitude.length > 0 ? gratitude : undefined,
      wins: wins.length > 0 ? wins : undefined,
    })
    markDailyReviewShown(dateKey)
    toast.success('今日回顾已保存')
    onOpenChange(false)
    onComplete?.()
  }

  const handleSkip = () => {
    markDailyReviewShown(dateKey)
    onOpenChange(false)
  }

  const formatMinutes = (m: number) => {
    if (m < 60) return `${m}分钟`
    const h = Math.floor(m / 60)
    const r = m % 60
    return r > 0 ? `${h}h ${r}m` : `${h}h`
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="relative overflow-hidden bg-gradient-to-br from-chart-1/10 via-chart-2/5 to-chart-3/10 px-6 pt-6 pb-4">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-chart-1/15 blur-2xl" />
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-chart-3/10 blur-2xl" />
          <DialogHeader className="relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-gradient-to-br from-chart-1 to-chart-3 p-2 shadow-lg shadow-chart-1/25">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight">每日回顾</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {today.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="回顾历史"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-chart-1" />
              今日数据
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl bg-chart-1/8 p-3 text-center">
                <CheckCircle2 className="h-4 w-4 mx-auto mb-1.5 text-chart-1" />
                <div className="text-xl font-bold tabular-nums">{todayStats.tasksCompleted}</div>
                <div className="text-2xs text-muted-foreground">完成任务</div>
              </div>
              <div className="rounded-xl bg-chart-3/8 p-3 text-center">
                <Flame className="h-4 w-4 mx-auto mb-1.5 text-chart-3" />
                <div className="text-xl font-bold tabular-nums">{todayStats.pomodoros}</div>
                <div className="text-2xs text-muted-foreground">番茄钟</div>
              </div>
              <div className="rounded-xl bg-chart-2/8 p-3 text-center">
                <Timer className="h-4 w-4 mx-auto mb-1.5 text-chart-2" />
                <div className="text-xl font-bold tabular-nums">{formatMinutes(todayStats.focusMinutes)}</div>
                <div className="text-2xs text-muted-foreground">专注时长</div>
              </div>
              <div className="rounded-xl bg-chart-4/8 p-3 text-center">
                <Trophy className="h-4 w-4 mx-auto mb-1.5 text-chart-4" />
                <div className="text-xl font-bold tabular-nums">{todayStats.habitRate}%</div>
                <div className="text-2xs text-muted-foreground">习惯 {todayStats.habitsCompleted}/{todayStats.habitsTotal}</div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">每日专注目标 ({focusGoals.dailyMinutes}分钟)</span>
                  <span className="font-medium tabular-nums">{Math.round(dailyGoalProgress)}%</span>
                </div>
                <Progress value={dailyGoalProgress} className="h-1.5" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">每日番茄目标 ({focusGoals.dailyPomodoros}个)</span>
                  <span className="font-medium tabular-nums">{Math.round(pomodoroGoalProgress)}%</span>
                </div>
                <Progress value={pomodoroGoalProgress} className="h-1.5" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Smile className="h-4 w-4 text-chart-2" />
              今日心情
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const selected = mood === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setMood(opt.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-all border',
                      selected
                        ? `${opt.bg} border-current ${opt.color}`
                        : 'border-border/50 hover:border-border bg-muted/20'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', selected ? opt.color : 'text-muted-foreground')} />
                    <span className={cn('text-2xs', selected ? 'font-medium' : 'text-muted-foreground')}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              今日成就
            </h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={winInput}
                  onChange={(e) => setWinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddWin())}
                  placeholder="比如：完成了产品原型设计"
                  className="h-9"
                />
                <Button size="sm" onClick={handleAddWin} className="h-9 gap-1 shrink-0">
                  <Star className="h-3.5 w-3.5" />
                  添加
                </Button>
              </div>
              {wins.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {wins.map((w, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 pr-1 cursor-pointer hover:bg-secondary/70"
                      onClick={() => setWins(wins.filter((_, idx) => idx !== i))}
                    >
                      <Star className="h-3 w-3 text-amber-500" />
                      {w}
                      <span className="text-muted-foreground ml-1">×</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              感恩三件事
            </h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={gratitudeInput}
                  onChange={(e) => setGratitudeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGratitude())}
                  placeholder="比如：感谢同事帮忙"
                  className="h-9"
                />
                <Button size="sm" onClick={handleAddGratitude} className="h-9 gap-1 shrink-0">
                  <Heart className="h-3.5 w-3.5" />
                  添加
                </Button>
              </div>
              {gratitude.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {gratitude.map((g, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 pr-1 cursor-pointer hover:bg-secondary/70"
                      onClick={() => setGratitude(gratitude.filter((_, idx) => idx !== i))}
                    >
                      <Heart className="h-3 w-3 text-rose-500" />
                      {g}
                      <span className="text-muted-foreground ml-1">×</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-chart-3" />
              反思与计划
            </h3>
            <Textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="今天学到了什么？明天要专注什么？..."
              className="min-h-[80px] text-sm"
            />
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background/95 backdrop-blur px-6 py-3">
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            稍后再说
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave} className="gap-1.5">
              <Zap className="h-4 w-4" />
              保存回顾
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>
      <JournalHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  )
}

// Inline simple Input to avoid an import cycle / import errors
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', props.className)} />
}
