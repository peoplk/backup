'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { formatDuration } from '@/lib/format'
import type { Task } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Calendar,
  FolderOpen,
  Tag,
  Repeat,
  Bell,
  Link2,
  ListTodo,
  Pencil,
  CheckCircle2,
  Timer,
  Clock,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIORITY_CONFIG: Record<Task['priority'], { label: string; className: string }> = {
  urgent: { label: '紧急', className: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  high: { label: '高', className: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  medium: { label: '中', className: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  low: { label: '低', className: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
}

const STATUS_CONFIG: Record<Task['status'], { label: string; className: string }> = {
  todo: { label: '待办', className: 'text-muted-foreground bg-muted/40 border-border' },
  'in-progress': { label: '进行中', className: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  done: { label: '已完成', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: '已取消', className: 'text-muted-foreground bg-muted/40 border-border' },
}

const ENERGY_CONFIG: Record<NonNullable<Task['energy']>, string> = {
  high: '⚡ 高能量',
  medium: '🔋 中能量',
  low: '🌙 低能量',
}

const REPEAT_TYPE_LABEL: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  custom: '自定义',
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

function formatRepeatRule(rule: NonNullable<Task['repeatRule']>): string {
  let text = REPEAT_TYPE_LABEL[rule.type] || rule.type
  if (rule.type === 'weekly' && rule.daysOfWeek?.length) {
    text += rule.daysOfWeek.map((d) => `周${WEEKDAY_NAMES[d]}`).join('、')
  } else if (rule.interval > 1) {
    text += ` 每 ${rule.interval} ${
      rule.type === 'daily' ? '天' : rule.type === 'weekly' ? '周' : rule.type === 'monthly' ? '月' : '年'
    }`
  }
  if (rule.paused) text += '（已暂停）'
  return text
}

function formatDate(date?: Date | string): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface TaskDetailDrawerProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (task: Task) => void
}

export function TaskDetailDrawer({ taskId, open, onOpenChange, onEdit }: TaskDetailDrawerProps) {
  const task = useAppStore((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined))
  const tasks = useAppStore((s) => s.tasks)
  const toggleSubTask = useAppStore((s) => s.toggleSubTask)
  const completeTask = useAppStore((s) => s.completeTask)
  const uncompleteTask = useAppStore((s) => s.uncompleteTask)

  const relatedTasks = useMemo(() => {
    if (!task) return { blockedBy: [] as Task[], dependsOn: [] as Task[] }
    const find = (id: string) => tasks.find((t) => t.id === id)
    return {
      blockedBy: (task.blockedBy || []).map(find).filter((t): t is Task => !!t),
      dependsOn: (task.dependsOn || []).map(find).filter((t): t is Task => !!t),
    }
  }, [task, tasks])

  if (!task) return null

  const statusConfig = STATUS_CONFIG[task.status]
  const priorityConfig = PRIORITY_CONFIG[task.priority]
  const subTasks = task.subTasks || []
  const doneSubTasks = subTasks.filter((st) => st.completed).length
  const pomodoroProgress = task.estimatedPomodoros
    ? Math.min((task.completedPomodoros / task.estimatedPomodoros) * 100, 100)
    : task.completedPomodoros > 0
    ? 100
    : 0
  const enabledReminders = (task.reminders || []).filter((r) => r.enabled)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/60 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-[11px]', statusConfig.className)}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className={cn('text-[11px]', priorityConfig.className)}>
              {priorityConfig.label}
            </Badge>
            {task.starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            {task.isRepeatInstance && (
              <Badge variant="outline" className="text-[11px] text-purple-500 border-purple-500/20">
                <Repeat className="h-2.5 w-2.5 mr-0.5" />
                重复实例
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-semibold leading-snug text-left">{task.title}</DialogTitle>
          <DialogDescription className="sr-only">任务详情</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {task.description && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground mb-1.5">描述</h3>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </section>
          )}

          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">信息</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {task.dueDate ? formatDate(task.dueDate) : '无截止日期'}
                  {task.dueDate && task.startTime ? ` ${task.startTime}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{task.project || '未关联项目'}</span>
              </div>
              {task.energy && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">{ENERGY_CONFIG[task.energy]}</span>
                </div>
              )}
              {task.repeatRule && (
                <div className="flex items-center gap-2 min-w-0">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{formatRepeatRule(task.repeatRule)}</span>
                </div>
              )}
              {enabledReminders.length > 0 && (
                <div className="flex items-center gap-2 min-w-0">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{enabledReminders.length} 条提醒</span>
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">创建于 {formatDate(task.createdAt)}</span>
              </div>
            </div>
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px] gap-1">
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">专注投入</h3>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="font-medium tabular-nums">
                    🍅 {task.completedPomodoros}
                    {task.estimatedPomodoros ? ` / ${task.estimatedPomodoros}` : ''} 个番茄
                  </span>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatDuration(task.timeSpent || 0, 'full')}
                </span>
              </div>
              <Progress value={pomodoroProgress} className="h-1.5" />
            </div>
          </section>

          {subTasks.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ListTodo className="h-3.5 w-3.5" />
                  子任务
                </h3>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                  {doneSubTasks}/{subTasks.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {subTasks.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => toggleSubTask(task.id, st.id)}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox checked={st.completed} className="h-4 w-4 pointer-events-none" />
                    <span className={cn('text-sm truncate', st.completed && 'line-through text-muted-foreground')}>
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(relatedTasks.blockedBy.length > 0 || relatedTasks.dependsOn.length > 0) && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                依赖关系
              </h3>
              <div className="space-y-2">
                {relatedTasks.blockedBy.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">被阻塞于</p>
                    {relatedTasks.blockedBy.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm py-0.5">
                        <span className={cn('truncate', t.status === 'done' && 'line-through text-muted-foreground')}>
                          {t.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto shrink-0">
                          {STATUS_CONFIG[t.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {relatedTasks.dependsOn.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">前置任务</p>
                    {relatedTasks.dependsOn.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm py-0.5">
                        <span className={cn('truncate', t.status === 'done' && 'line-through text-muted-foreground')}>
                          {t.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto shrink-0">
                          {STATUS_CONFIG[t.status].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 px-5 py-3.5 flex items-center gap-2 bg-muted/20">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </Button>
          )}
          {task.status !== 'done' ? (
            <Button
              size="sm"
              className="gap-1.5 ml-auto"
              onClick={() => {
                completeTask(task.id)
                onOpenChange(false)
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              标记完成
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 ml-auto"
              onClick={() => uncompleteTask(task.id)}
            >
              撤销完成
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
