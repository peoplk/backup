import type { Habit } from '@/lib/types'

export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/** 判断习惯在指定日期是否属于"应做"日 */
export function isHabitScheduledOn(habit: Habit, date: Date): boolean {
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

export function habitFrequencyLabel(habit: Habit): string {
  switch (habit.frequency) {
    case 'daily':
      return '每天'
    case 'weekly':
      return '每周'
    case 'monthly':
      return '每月'
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
