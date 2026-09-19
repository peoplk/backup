import { describe, it, expect } from 'vitest'
import {
  advanceRepeatDueDate,
  previousRepeatDueDate,
  getNextDueDateString,
  getPreviousDueDateString,
} from '@/shared/core/recurring'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)
const key = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

describe('advanceRepeatDueDate', () => {
  it('daily 按 interval 推进', () => {
    expect(advanceRepeatDueDate({ type: 'daily', interval: 1 }, d(2026, 9, 19))).toEqual(d(2026, 9, 20))
    expect(advanceRepeatDueDate({ type: 'daily', interval: 3 }, d(2026, 9, 19))).toEqual(d(2026, 9, 22))
  })

  it('weekly 多星期几逐日扫描（每周一、三：周一完成落周三）', () => {
    const mon = d(2026, 9, 21) // 周一
    const wed = d(2026, 9, 23)
    expect(advanceRepeatDueDate({ type: 'weekly', interval: 1, daysOfWeek: [1, 3] }, mon)).toEqual(wed)
    expect(advanceRepeatDueDate({ type: 'weekly', interval: 1, daysOfWeek: [1, 3] }, wed)).toEqual(d(2026, 9, 28))
  })

  it('weekly 无 daysOfWeek 时整周推进', () => {
    expect(advanceRepeatDueDate({ type: 'weekly', interval: 2 }, d(2026, 9, 19))).toEqual(d(2026, 10, 3))
  })

  it('monthly 月末钳制且无 1月31日溢出 bug', () => {
    expect(advanceRepeatDueDate({ type: 'monthly', interval: 1 }, d(2026, 1, 31))).toEqual(d(2026, 2, 28))
    expect(advanceRepeatDueDate({ type: 'monthly', interval: 1 }, d(2024, 1, 31))).toEqual(d(2024, 2, 29)) // 闰年
    expect(advanceRepeatDueDate({ type: 'monthly', interval: 1 }, d(2026, 3, 15))).toEqual(d(2026, 4, 15))
  })

  it('monthly 显式 dayOfMonth 优先', () => {
    expect(advanceRepeatDueDate({ type: 'monthly', interval: 1, dayOfMonth: 5 }, d(2026, 9, 27))).toEqual(d(2026, 10, 5))
  })

  it('weekdays/weekends 归一到工作日与周末', () => {
    expect(advanceRepeatDueDate({ type: 'weekdays', interval: 1 }, d(2026, 9, 25))).toEqual(d(2026, 9, 28)) // 周五→周一
    expect(advanceRepeatDueDate({ type: 'weekends', interval: 1 }, d(2026, 9, 28))).toEqual(d(2026, 10, 3)) // 周一→周六
  })

  it('custom 回落顺序：daysOfWeek > dayOfMonth > interval 天', () => {
    expect(advanceRepeatDueDate({ type: 'custom', interval: 1, daysOfWeek: [2] }, d(2026, 9, 21))).toEqual(d(2026, 9, 22))
    expect(advanceRepeatDueDate({ type: 'custom', interval: 1, dayOfMonth: 10 }, d(2026, 9, 21))).toEqual(d(2026, 10, 10))
    expect(advanceRepeatDueDate({ type: 'custom', interval: 5 }, d(2026, 9, 21))).toEqual(d(2026, 9, 26))
  })

  it('yearly 整年推进', () => {
    expect(advanceRepeatDueDate({ type: 'yearly', interval: 1 }, d(2026, 2, 28))).toEqual(d(2027, 2, 28))
  })
})

describe('previousRepeatDueDate', () => {
  it('weekly 多星期几向前扫描', () => {
    const wed = d(2026, 9, 23)
    expect(previousRepeatDueDate({ type: 'weekly', interval: 1, daysOfWeek: [1, 3] }, wed)).toEqual(d(2026, 9, 21))
  })
  it('monthly 向前跳月并钳制', () => {
    expect(previousRepeatDueDate({ type: 'monthly', interval: 1 }, d(2026, 3, 31))).toEqual(d(2026, 2, 28))
  })
})

describe('getNextDueDateString / getPreviousDueDateString（Android 侧入口）', () => {
  it('返回本地 yyyy-MM-dd 字符串', () => {
    expect(getNextDueDateString({ type: 'daily', interval: 1 }, '2026-09-19')).toBe('2026-09-20')
    expect(getPreviousDueDateString({ type: 'daily', interval: 2 }, '2026-09-19')).toBe('2026-09-17')
  })

  it('paused 返回原日期', () => {
    expect(getNextDueDateString({ type: 'daily', interval: 1, paused: true }, '2026-09-19')).toBe('2026-09-19')
    expect(getNextDueDateString({ type: 'daily', interval: 1, paused: true })).toBeNull()
  })

  it('越过 endDate 返回 null', () => {
    expect(getNextDueDateString({ type: 'daily', interval: 1, endDate: '2026-09-25' }, '2026-09-25')).toBeNull()
    expect(getNextDueDateString({ type: 'daily', interval: 1, endDate: '2026-09-30' }, '2026-09-25')).toBe('2026-09-26')
  })

  it('缺失日期时以今天为基准', () => {
    const result = getNextDueDateString({ type: 'daily', interval: 1 })
    expect(result).toBe(key(advanceRepeatDueDate({ type: 'daily', interval: 1 }, new Date())))
  })
})
