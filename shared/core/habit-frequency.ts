/**
 * 习惯频率与排班判定（跨端单一来源）：
 * 判断习惯在指定日期是否属于"应做"日、频率文案、区间期望次数。
 * 类型用结构兼容的 SharedHabit，主库与 Android 的真实实体均可直接传入。
 */
import type { SharedHabit } from './types'

export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/** 判断习惯在指定日期是否属于"应做"日 */
export function isHabitScheduledOn(habit: SharedHabit, date: Date): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  switch (habit.frequency) {
    case 'daily':
      return true
    case 'weekly':
      return true
    case 'monthly':
      return true
    case 'custom': {
      if (habit.weeklyPattern && habit.weeklyPattern.length > 0) {
        return habit.weeklyPattern.includes(d.getDay())
      }
      const intervalDays = habit.intervalDays && habit.intervalDays > 0 ? habit.intervalDays : 2
      const createdAt = new Date(habit.createdAt)
      createdAt.setHours(0, 0, 0, 0)
      const daysSince = Math.floor((d.getTime() - createdAt.getTime()) / 86400000)
      return daysSince >= 0 && daysSince % intervalDays === 0
    }
    default:
      return true
  }
}

export function habitFrequencyLabel(habit: SharedHabit): string {
  switch (habit.frequency) {
    case 'daily':
      return '每天'
    case 'weekly':
      return habit.weeklyTarget && habit.weeklyTarget > 1 ? `每周${habit.weeklyTarget}次` : '每周'
    case 'monthly':
      return habit.monthlyTarget && habit.monthlyTarget > 1 ? `每月${habit.monthlyTarget}次` : '每月'
    case 'custom':
      if (habit.weeklyPattern && habit.weeklyPattern.length > 0) {
        if (habit.weeklyPattern.length === 7) return '每天'
        const sorted = [...habit.weeklyPattern].sort((a, b) => a - b)
        return `每周${sorted.map((d) => WEEKDAY_NAMES[d]).join('/')}`
      }
      if (habit.intervalDays && habit.intervalDays > 0) {
        return `每 ${habit.intervalDays} 天`
      }
      return '自定义'
    default:
      return '自定义'
  }
}

/**
 * 区间内"应做"期望次数：
 * - 弹性目标（每周N次/每月N次）按目标数折算，而不是按每天应做（否则完成率被系统性低估）
 * - 其余频率按 isHabitScheduledOn 逐日统计实际应做天数
 */
export function getHabitExpectedCount(habit: SharedHabit, days: number): number {
  if (days <= 0) return 0
  if (habit.frequency === 'weekly' && habit.weeklyTarget && habit.weeklyTarget > 1) {
    return Math.min(days, Math.max(1, Math.round((habit.weeklyTarget * days) / 7)))
  }
  if (habit.frequency === 'monthly' && habit.monthlyTarget && habit.monthlyTarget > 1) {
    return Math.min(days, Math.max(1, Math.round((habit.monthlyTarget * days) / 30)))
  }
  let count = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (isHabitScheduledOn(habit, d)) count++
  }
  return count
}
