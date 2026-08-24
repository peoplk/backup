'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DependencyChain {
  /** 所有上游前置任务（祖先，已去重，root 在前） */
  upstream: Task[]
  /** 所有下游被阻塞任务（后代，已去重，root 在前） */
  downstream: Task[]
  /** 链路中是否存在循环 */
  hasCycle: boolean
  /** 处于循环中的任务 id 集合 */
  cycleIds: Set<string>
}

function collectAncestors(tasks: Task[], taskId: string, seen: Set<string>, out: Task[]): { hasCycle: boolean } {
  let hasCycle = false
  const task = tasks.find((t) => t.id === taskId)
  if (!task || !task.dependsOn) return { hasCycle }
  for (const depId of task.dependsOn) {
    const dep = tasks.find((t) => t.id === depId)
    if (!dep) continue
    if (seen.has(dep.id)) {
      hasCycle = true
      continue
    }
    seen.add(dep.id)
    const sub = collectAncestors(tasks, dep.id, seen, out)
    hasCycle = hasCycle || sub.hasCycle
    out.push(dep)
  }
  return { hasCycle }
}

function collectDescendants(tasks: Task[], taskId: string, seen: Set<string>, out: Task[]): { hasCycle: boolean } {
  let hasCycle = false
  const task = tasks.find((t) => t.id === taskId)
  if (!task || !task.blockedBy) return { hasCycle }
  for (const blockedId of task.blockedBy) {
    const blocked = tasks.find((t) => t.id === blockedId)
    if (!blocked) continue
    if (seen.has(blocked.id)) {
      hasCycle = true
      continue
    }
    seen.add(blocked.id)
    const sub = collectDescendants(tasks, blocked.id, seen, out)
    hasCycle = hasCycle || sub.hasCycle
    out.push(blocked)
  }
  return { hasCycle }
}

function useDependencyChain(taskId: string): DependencyChain {
  const tasks = useAppStore((s) => s.tasks)

  return useMemo(() => {
    const upstream: Task[] = []
    const seenUp = new Set<string>()
    const upCycle = collectAncestors(tasks, taskId, seenUp, upstream)

    const downstream: Task[] = []
    const seenDown = new Set<string>()
    const downCycle = collectDescendants(tasks, taskId, seenDown, downstream)

    const cycleIds = new Set<string>()
    // 上游环：前置任务重新指向当前任务所在的环
    for (const t of upstream) {
      if (t.dependsOn?.some((id) => seenDown.has(id) || id === taskId)) cycleIds.add(t.id)
    }
    for (const t of downstream) {
      if (t.blockedBy?.some((id) => seenUp.has(id) || id === taskId)) cycleIds.add(t.id)
    }

    return {
      upstream,
      downstream,
      hasCycle: upCycle.hasCycle || downCycle.hasCycle || cycleIds.size > 0,
      cycleIds,
    }
  }, [tasks, taskId])
}

function ChainNode({ task, isBlocked }: { task: Task; isBlocked: boolean }) {
  const isDone = task.status === 'done'
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-3 py-2',
        isDone
          ? 'border-chart-2/25 bg-chart-2/5'
          : isBlocked
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border/50 bg-muted/40'
      )}
    >
      {isDone ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-chart-2" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={cn('flex-1 truncate text-sm', isDone && 'line-through text-muted-foreground')}>
        {task.title}
      </span>
      {task.priority === 'urgent' && !isDone && (
        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
          紧急
        </Badge>
      )}
      {isBlocked && !isDone && (
        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />
          阻塞
        </Badge>
      )}
    </div>
  )
}

/**
 * 任务依赖链路可视化：展示某任务的全部上游前置任务与下游被阻塞任务，
 * 标记阻塞项与循环依赖。
 */
export function TaskDependencyGraph({ taskId }: { taskId: string }) {
  const tasks = useAppStore((s) => s.tasks)
  const task = tasks.find((t) => t.id === taskId)
  const chain = useDependencyChain(taskId)

  if (!task) return null

  const hasUnfinishedDeps = (t: Task) =>
    (t.dependsOn || []).some((depId) => {
      const dep = tasks.find((x) => x.id === depId)
      return dep && dep.status !== 'done'
    })

  return (
    <div className="space-y-5">
      {chain.hasCycle && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <p className="text-sm text-destructive">
            检测到循环依赖，请检查任务间的依赖关系以免造成死锁
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowUp className="h-3.5 w-3.5" />
          上游链路（前置任务）
          <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
            {chain.upstream.length}
          </Badge>
        </div>
        {chain.upstream.length === 0 ? (
          <p className="rounded-lg border border-dashed py-3 text-center text-sm text-muted-foreground">
            无前置任务
          </p>
        ) : (
          <div className="space-y-1.5">
            {chain.upstream.map((t) => (
              <ChainNode key={t.id} task={t} isBlocked={t.status !== 'done'} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ArrowDown className="h-3.5 w-3.5" />
          下游链路（被阻塞任务）
          <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
            {chain.downstream.length}
          </Badge>
        </div>
        {chain.downstream.length === 0 ? (
          <p className="rounded-lg border border-dashed py-3 text-center text-sm text-muted-foreground">
            没有任务被此任务阻塞
          </p>
        ) : (
          <div className="space-y-1.5">
            {chain.downstream.map((t) => (
              <ChainNode key={t.id} task={t} isBlocked={t.status !== 'done' && hasUnfinishedDeps(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}