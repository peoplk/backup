import { describe, expect, it } from 'vitest'
import { buildForestTrees, daysAgoFromNow } from '@/lib/forest-tree'

const at = (daysAgo: number, hour = 10) => {
  const d = new Date(2026, 8, 19, hour) // 固定“今天”为 2026-09-19
  d.setDate(d.getDate() - daysAgo)
  return d
}
const work = (daysAgo: number) => ({ type: 'work', completedAt: at(daysAgo) })

describe('buildForestTrees', () => {
  it('每个 work 番茄 +25 成长，4 个成熟', () => {
    const trees = buildForestTrees([work(1), work(1), work(1), work(1)], [])
    expect(trees).toHaveLength(1)
    expect(trees[0].state).toBe('mature')
    expect(trees[0].count).toBe(4)
    expect(trees[0].growth).toBe(100)
  })

  it('1 个番茄为发芽档，超过 4 个封顶 mature', () => {
    const one = buildForestTrees([work(2)], [])
    expect(one[0].state).toBe('sprout')
    const many = buildForestTrees(Array.from({ length: 6 }, () => work(2)), [])
    expect(many[0].growth).toBe(100)
    expect(many[0].state).toBe('mature')
  })

  it('break 类型不计入；秒表达到 25 分钟才计入', () => {
    const trees = buildForestTrees(
      [
        { type: 'short-break', completedAt: at(1) },
        { type: 'stopwatch', completedAt: at(1), duration: 600 },
      ],
      []
    )
    expect(trees).toHaveLength(0)
    const withLongStopwatch = buildForestTrees(
      [{ type: 'stopwatch', completedAt: at(1), duration: 1500 }],
      []
    )
    expect(withLongStopwatch).toHaveLength(1)
  })

  it('仅有放弃记录的日子记为枯萎树', () => {
    const trees = buildForestTrees([], [{ type: 'work', completedAt: at(3), duration: 60 }])
    expect(trees).toHaveLength(1)
    expect(trees[0].state).toBe('withered')
    expect(trees[0].date).toBe('2026-09-16')
  })

  it('当天既有完成又有放弃时不算枯萎', () => {
    const trees = buildForestTrees([work(3)], [{ type: 'work', completedAt: at(3), duration: 60 }])
    expect(trees).toHaveLength(1)
    expect(trees[0].state).not.toBe('withered')
  })

  it('ISO 字符串 completedAt（持久化恢复后）也可解析', () => {
    const trees = buildForestTrees([{ type: 'work', completedAt: at(1).toISOString() }], [])
    expect(trees[0].date).toBe('2026-09-18')
  })

  it('跨天聚合并按日期升序', () => {
    const trees = buildForestTrees([work(0), work(2), work(2)], [])
    expect(trees.map((t) => t.date)).toEqual(['2026-09-17', '2026-09-19'])
    expect(trees[0].count).toBe(2)
  })
})

describe('daysAgoFromNow', () => {
  it('今天为 0，昨天为 1，未来为负', () => {
    const now = new Date(2026, 8, 19, 23, 59)
    expect(daysAgoFromNow('2026-09-19', now)).toBe(0)
    expect(daysAgoFromNow('2026-09-18', now)).toBe(1)
    expect(daysAgoFromNow('2026-09-20', now)).toBe(-1)
  })
})
