import { describe, it, expect, vi } from 'vitest'

// lib/hooks 顶层引入 zustand store（模块初始化会碰 localStorage），
// 本测试只覆盖纯函数 isRepeatTaskDue / isRepeatTaskCompletedToday，直接 mock 掉 store 与统计模块。
vi.mock('@/lib/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/lib/productivity-score', () => ({ computeDailyScore: () => 0, computeScoreTrend: () => [] }))
vi.mock('@/lib/habit-streak', () => ({ calculateHabitStreak: () => 0, getScheduledCompletionRate: () => 0 }))

import { isRepeatTaskDue, isRepeatTaskCompletedToday } from '@/lib/hooks'
import type { Task } from '@/lib/types'

function mkTask(partial: Partial<Task>): Task {
  return { id: 'x', title: 't', type: 'task', priority: 'medium', status: 'todo', tags: [], ...partial } as Task
}

const at = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d
}

describe('isRepeatTaskDue', () => {
  const rule = { type: 'daily' as const, interval: 1 }

  it('无重复规则不算到期', () => {
    expect(isRepeatTaskDue(mkTask({}))).toBe(false)
  })
  it('paused 规则不算到期', () => {
    expect(isRepeatTaskDue(mkTask({ repeatRule: { ...rule, paused: true }, dueDate: at(-1) }))).toBe(false)
  })
  it('endDate 已过不算到期', () => {
    expect(isRepeatTaskDue(mkTask({ repeatRule: { ...rule, endDate: at(-2) }, dueDate: at(-1) }))).toBe(false)
  })
  it('dueDate 已过或今天算到期（含时分归零比较）', () => {
    expect(isRepeatTaskDue(mkTask({ repeatRule: rule, dueDate: at(-3) }))).toBe(true)
    const lateToday = new Date()
    lateToday.setHours(23, 59, 0, 0)
    expect(isRepeatTaskDue(mkTask({ repeatRule: rule, dueDate: lateToday }))).toBe(true)
  })
  it('dueDate 在未来不算到期；重复任务无 dueDate 视为即期', () => {
    expect(isRepeatTaskDue(mkTask({ repeatRule: rule, dueDate: at(1) }))).toBe(false)
    expect(isRepeatTaskDue(mkTask({ repeatRule: rule }))).toBe(true)
  })
})

describe('isRepeatTaskCompletedToday', () => {
  const task = mkTask({ id: 't9', repeatRule: { type: 'daily', interval: 1 } })
  it('今日完成记录命中', () => {
    expect(isRepeatTaskCompletedToday(task, [
      { id: 'c1', taskId: 't9', completedAt: new Date() },
    ])).toBe(true)
  })
  it('昨日完成/他人任务/畸形记录不命中', () => {
    const yesterday = at(-1)
    expect(isRepeatTaskCompletedToday(task, [
      { id: 'c2', taskId: 't9', completedAt: yesterday },
      { id: 'c3', taskId: 'other', completedAt: new Date() },
      null as never,
    ])).toBe(false)
  })
  it('非重复任务永远 false', () => {
    expect(isRepeatTaskCompletedToday(mkTask({ id: 't9' }), [{ id: 'c', taskId: 't9', completedAt: new Date() }])).toBe(false)
  })
})
