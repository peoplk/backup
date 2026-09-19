'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Pause, RotateCcw, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format'

const STORAGE_KEY = 'focusflow:stopwatch'

interface StopwatchState {
  accumulated: number
  startedAt: number | null
}

function loadState(): StopwatchState {
  if (typeof window === 'undefined') return { accumulated: 0, startedAt: null }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accumulated: 0, startedAt: null }
    const parsed = JSON.parse(raw)
    if (typeof parsed?.accumulated === 'number' && parsed.accumulated >= 0) {
      return {
        accumulated: parsed.accumulated,
        startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      }
    }
  } catch {
    // 存储损坏时按未开始处理
  }
  return { accumulated: 0, startedAt: null }
}

const formatClock = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function StopwatchTimer() {
  const { tasks, addPomodoroSession, updateTask } = useAppStore(
    useShallow((state) => ({
      tasks: state.tasks,
      addPomodoroSession: state.addPomodoroSession,
      updateTask: state.updateTask,
    }))
  )

  const [baseline, setBaseline] = useState<StopwatchState>(() => ({ accumulated: 0, startedAt: null }))
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('none')
  const hydrated = useRef(false)

  // 恢复持久化状态（放在 effect 中避免 SSR 水合不一致）
  useEffect(() => {
    const st = loadState()
    setBaseline(st)
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!baseline.startedAt) {
      setElapsed(baseline.accumulated)
      return
    }
    const tick = () =>
      setElapsed(baseline.accumulated + Math.floor((Date.now() - (baseline.startedAt as number)) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [baseline])

  const persist = (st: StopwatchState) => {
    try {
      if (st.accumulated === 0 && st.startedAt === null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(st))
    } catch {
      // 存储不可用时仅内存计时
    }
  }

  const running = baseline.startedAt !== null

  const handleToggle = () => {
    if (running) {
      const acc = baseline.accumulated + Math.floor((Date.now() - (baseline.startedAt as number)) / 1000)
      const st = { accumulated: acc, startedAt: null }
      setBaseline(st)
      persist(st)
    } else {
      const st = { accumulated: baseline.accumulated, startedAt: Date.now() }
      setBaseline(st)
      persist(st)
    }
  }

  const handleReset = () => {
    setBaseline({ accumulated: 0, startedAt: null })
    setElapsed(0)
    persist({ accumulated: 0, startedAt: null })
  }

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks])
  const selectedTask = selectedTaskId !== 'none' ? activeTasks.find((t) => t.id === selectedTaskId) : null

  const handleFinish = () => {
    const seconds = running
      ? baseline.accumulated + Math.floor((Date.now() - (baseline.startedAt as number)) / 1000)
      : baseline.accumulated
    if (seconds < 10) {
      toast.info('不足 10 秒，不记录会话')
      return
    }
    addPomodoroSession({
      type: 'stopwatch',
      duration: seconds,
      taskId: selectedTask?.id,
      note: note.trim() || undefined,
      tags: selectedTask?.tags || [],
    })
    if (selectedTask) {
      updateTask(selectedTask.id, {
        timeSpent: (selectedTask.timeSpent || 0) + seconds,
      })
    }
    toast.success(`已记录专注 ${formatDuration(seconds)}${selectedTask ? ` · ${selectedTask.title}` : ''}`)
    setBaseline({ accumulated: 0, startedAt: null })
    setElapsed(0)
    setNote('')
    persist({ accumulated: 0, startedAt: null })
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-chart-4/8 via-chart-2/6 to-transparent p-6">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center">
          <div className="flex-1 text-center lg:text-left">
            <p className="text-6xl font-bold font-[var(--font-timer)] tracking-tight tabular-nums">
              {formatClock(elapsed)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {running ? '秒表运行中 · 正计时不打断思路，适合心流式专注' : '正计时模式：随时开始，完成时记录为专注会话'}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-[380px]">
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId} disabled={running}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="关联任务（可选）" />
              </SelectTrigger>
              <SelectContent align="center" className="min-w-[200px]">
                <SelectItem value="none">不关联任务</SelectItem>
                {activeTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[220px]">{task.title}</span>
                      {task.project && (
                        <Badge variant="secondary" className="text-2xs shrink-0">
                          {task.project}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="本次专注做了什么？（可选备注）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-12"
            />
            <div className="flex gap-2">
              <Button
                size="lg"
                className={cn('flex-1 gap-2', !running && elapsed > 0 && 'bg-chart-2 hover:bg-chart-2/90')}
                onClick={handleToggle}
              >
                {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                {running ? '暂停' : elapsed > 0 ? '继续' : '开始'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={handleReset}
                disabled={elapsed === 0}
                aria-label="归零"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="flex-1 gap-2"
                onClick={handleFinish}
                disabled={elapsed < 10}
              >
                <Square className="h-4 w-4" />
                完成并记录
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
