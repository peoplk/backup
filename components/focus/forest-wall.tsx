'use client'

import { useMemo } from 'react'
import { Sprout, TreePine, TreeDeciduous, Ghost } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { buildForestTrees, daysAgoFromNow, getTreeLabel, getTreeColorClass } from '@/lib/forest-tree'
import type { TreeState } from '@/lib/types'
import { EmptyState } from '@/components/ui/empty-state'

const WINDOW_DAYS = 17 * 7
const TREE_ICON: Record<TreeState, typeof Sprout> = {
  seed: Sprout,
  sprout: Sprout,
  sapling: TreePine,
  growing: TreeDeciduous,
  mature: TreeDeciduous,
  withered: Ghost,
}

export function ForestWall() {
  const pomodoroSessions = useAppStore((s) => s.pomodoroSessions)
  const abandonedPomodoroSessions = useAppStore((s) => s.abandonedPomodoroSessions)

  const { weeks, trees } = useMemo(() => {
    const all = buildForestTrees(pomodoroSessions, abandonedPomodoroSessions)
      .filter((t) => {
        const ago = daysAgoFromNow(t.date)
        return ago >= 0 && ago < WINDOW_DAYS
      })
    const byDate = new Map(all.map((t) => [t.date, t]))

    // 以今天所在周为最后一列，向前推 17 周；列=周、行=周日..周六
    const today = new Date()
    const dayOfWeek = today.getDay()
    const cells: Array<{ key: string; date: Date; inWindow: boolean; future: boolean; tree?: (typeof all)[number] }> = []
    const start = new Date(today)
    start.setDate(today.getDate() - dayOfWeek - (WINDOW_DAYS / 7 - 1) * 7)
    for (let i = 0; i < WINDOW_DAYS / 7 * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const ago = daysAgoFromNow(key, today)
      cells.push({ key, date: d, inWindow: ago >= 0, future: ago < 0, tree: byDate.get(key) })
    }
    const weekCols: Array<typeof cells> = []
    for (let i = 0; i < cells.length; i += 7) weekCols.push(cells.slice(i, i + 7))
    return { weeks: weekCols, trees: all }
  }, [pomodoroSessions, abandonedPomodoroSessions])

  const stats = useMemo(() => {
    const totalTrees = trees.length
    return {
      totalTrees,
      mature: trees.filter((t) => t.state === 'mature').length,
      withered: trees.filter((t) => t.state === 'withered').length,
      pomodoros: trees.reduce((acc, t) => acc + t.count, 0),
    }
  }, [trees])

  if (trees.length === 0) {
    return (
      <EmptyState
        icon={<TreeDeciduous className="h-10 w-10" />}
        title="森林还是空的"
        description="完成番茄钟或 25 分钟以上的秒表专注，就会在这里种下一棵树"
      />
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-x-4 gap-y-1">
          专注森林
          <span className="text-xs font-normal text-muted-foreground">
            近 {WINDOW_DAYS / 7} 周 · {stats.totalTrees} 棵树 · {stats.pomodoros} 个番茄
            {stats.mature > 0 && <span className="text-emerald-500"> · {stats.mature} 已长成</span>}
            {stats.withered > 0 && <span className="text-stone-500"> · {stats.withered} 已枯萎</span>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1 min-w-max">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell) => {
                  if (!cell.inWindow || cell.future) {
                    return <div key={cell.key} className="w-6 h-6" />
                  }
                  if (!cell.tree) {
                    return (
                      <div key={cell.key} className="w-6 h-6 flex items-center justify-center" title={`${cell.key} 无专注`}>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                      </div>
                    )
                  }
                  const Icon = TREE_ICON[cell.tree.state]
                  return (
                    <div
                      key={cell.key}
                      className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted/60 transition-colors"
                      title={`${cell.key} · ${getTreeLabel(cell.tree.state)}${cell.tree.count > 0 ? ` · ${cell.tree.count} 个番茄` : ''}`}
                      aria-label={`${cell.key} ${getTreeLabel(cell.tree.state)}`}
                    >
                      <Icon className={cn('h-4 w-4', getTreeColorClass(cell.tree.state))} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(['seed', 'sprout', 'sapling', 'growing', 'mature', 'withered'] as TreeState[]).map((state) => {
            const Icon = TREE_ICON[state]
            return (
              <span key={state} className="flex items-center gap-1">
                <Icon className={cn('h-3.5 w-3.5', getTreeColorClass(state))} />
                {getTreeLabel(state)}
              </span>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
