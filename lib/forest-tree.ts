import type { TreeState } from '@/lib/types'

export function getTreeStateFromGrowth(growth: number): TreeState {
  if (growth <= 0) return 'seed'
  if (growth <= 25) return 'sprout'
  if (growth <= 50) return 'sapling'
  if (growth <= 75) return 'growing'
  return 'mature'
}

export function getNextTreeState(current: TreeState, growth: number): TreeState {
  // 树木死亡只代表当前这棵树；重新种植后按成长度正常进阶
  return getTreeStateFromGrowth(growth)
}

export function getTreeLabel(state: TreeState): string {
  const labels: Record<TreeState, string> = {
    seed: '种子',
    sprout: '发芽',
    sapling: '幼苗',
    growing: '成长中',
    mature: '已长成',
    withered: '已枯萎',
  }
  return labels[state]
}

export function getTreeColorClass(state: TreeState): string {
  switch (state) {
    case 'seed':
      return 'text-amber-700'
    case 'sprout':
      return 'text-chart-2/50'
    case 'sapling':
      return 'text-chart-2/70'
    case 'growing':
      return 'text-chart-2'
    case 'mature':
      return 'text-emerald-500'
    case 'withered':
      return 'text-stone-500'
    default:
      return 'text-chart-2'
  }
}

export interface ForestTree {
  /** 本地日期 yyyy-MM-dd */
  date: string
  /** 当日有效专注会话数（番茄/达标秒表） */
  count: number
  growth: number
  state: TreeState
}

interface SessionLike {
  type: string
  completedAt: Date | string
  duration?: number
}

/** 秒表会话达到该时长（秒）才计一棵树 */
const STOPWATCH_MIN_SECONDS = 25 * 60

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 森林墙派生：把专注会话按天聚合成树。
 * 每天的有效会话（work 番茄，或 ≥25 分钟的秒表）数 → growth=min(25*count,100)；
 * 当日没有有效会话但有放弃记录时记为枯萎树。
 */
export function buildForestTrees(
  sessions: SessionLike[],
  abandonedSessions: SessionLike[]
): ForestTree[] {
  const growthByDay = new Map<string, number>()
  const abandonedDays = new Set<string>()

  for (const s of sessions) {
    const at = s.completedAt instanceof Date ? s.completedAt : new Date(s.completedAt)
    if (isNaN(at.getTime())) continue
    const valid =
      s.type === 'work' || (s.type === 'stopwatch' && (s.duration ?? 0) >= STOPWATCH_MIN_SECONDS)
    if (!valid) continue
    const key = toLocalDateKey(at)
    growthByDay.set(key, (growthByDay.get(key) ?? 0) + 1)
  }
  for (const s of abandonedSessions) {
    const at = s.completedAt instanceof Date ? s.completedAt : new Date(s.completedAt)
    if (isNaN(at.getTime())) continue
    abandonedDays.add(toLocalDateKey(at))
  }

  const trees: ForestTree[] = []
  for (const [date, count] of growthByDay) {
    const growth = Math.min(25 * count, 100)
    trees.push({ date, count, growth, state: getTreeStateFromGrowth(growth) })
  }
  for (const date of abandonedDays) {
    if (!growthByDay.has(date)) {
      trees.push({ date, count: 0, growth: 0, state: 'withered' })
    }
  }
  trees.sort((a, b) => a.date.localeCompare(b.date))
  return trees
}

/** 与当前时刻的本地天数差（今天=0），供森林墙裁剪展示窗口 */
export function daysAgoFromNow(dateKey: string, now: Date = new Date()): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((base.getTime() - target.getTime()) / 86400000)
}
