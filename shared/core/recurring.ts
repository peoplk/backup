/**
 * 重复任务推进引擎（跨端单一来源，取两端语义的并集）：
 * - 桌面语义：weekly 多星期几逐日扫描（避免"每周一、三"完成后固定 +7 天）、
 *   monthly 指定日（dayOfMonth 月末钳制）、custom 按字段回落
 * - Android 语义：weekdays/weekends 类型、byWeekdays 字段、endDate 到期返回 null、
 *   paused 返回原日期、yyyy-MM-dd 字符串出入参
 * 两端各自的结构类型与本引擎结构兼容，直接传入即可。
 */

export interface SharedRepeatRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays' | 'weekends' | 'custom'
  interval?: number
  /** weekly/custom 多星期几（0=周日..6=周六） */
  daysOfWeek?: number[]
  /** monthly 指定日（1-31，月末自动钳制） */
  dayOfMonth?: number
  endDate?: Date | string
  endAfterCount?: number
  completedCount?: number
  paused?: boolean
  /** Android custom 字段：归一到 daysOfWeek 语义 */
  byWeekdays?: number[]
}

const WEEKDAY_INTERVAL = [1, 2, 3, 4, 5]
const WEEKEND_INTERVAL = [0, 6]

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d)
  const day = d.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, maxDay))
  return next
}

/** 归一：weekdays/weekends 类型与 byWeekdays 字段都折算成 daysOfWeek */
function effectiveDaysOfWeek(rule: SharedRepeatRule): number[] | null {
  if (rule.type === 'weekdays') return WEEKDAY_INTERVAL
  if (rule.type === 'weekends') return WEEKEND_INTERVAL
  const days = rule.daysOfWeek && rule.daysOfWeek.length > 0
    ? rule.daysOfWeek
    : (rule.byWeekdays && rule.byWeekdays.length > 0 ? rule.byWeekdays : null)
  return days && days.length > 0 ? days : null
}

/** 在 daysOfWeek 内从 base 往后找第一个命中日（interval 周窗口内） */
function nextDayInWeeks(base: Date, days: number[], interval: number): Date {
  for (let i = 1; i <= 7 * Math.max(1, interval); i++) {
    const candidate = addDays(base, i)
    if (days.includes(candidate.getDay())) return candidate
  }
  return addDays(base, 7 * Math.max(1, interval))
}

function prevDayInWeeks(base: Date, days: number[], interval: number): Date {
  for (let i = 1; i <= 7 * Math.max(1, interval); i++) {
    const candidate = addDays(base, -i)
    if (days.includes(candidate.getDay())) return candidate
  }
  return addDays(base, -7 * Math.max(1, interval))
}

/**
 * 计算重复任务的下一个周期日期（桌面 completeTask/skipRepeatTask 与 Android 完成推进共用）。
 * 与桌面 task-slice 原实现语义一致：weekly 多星期几逐日扫描、monthly 月末钳制、custom 回落。
 */
export function advanceRepeatDueDate(rule: SharedRepeatRule, baseDate: Date): Date {
  const next = new Date(baseDate)
  const interval = Math.max(1, rule.interval ?? 1)
  const days = effectiveDaysOfWeek(rule)

  switch (rule.type) {
    case 'weekly':
    case 'weekdays':
    case 'weekends': {
      if (days) return nextDayInWeeks(baseDate, days, interval)
      next.setDate(next.getDate() + 7 * interval)
      return next
    }
    case 'monthly': {
      // 先定位目标月（避免 1月31日 setMonth 溢出到 3 月的经典 bug），再按目标月长度钳制
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + interval, 1)
      const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      const preferredDay = rule.dayOfMonth && rule.dayOfMonth >= 1 && rule.dayOfMonth <= 31
        ? rule.dayOfMonth
        : baseDate.getDate()
      target.setDate(Math.min(preferredDay, daysInTargetMonth))
      return target
    }
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval)
      return next
    case 'custom': {
      if (days) return nextDayInWeeks(baseDate, days, interval)
      if (rule.dayOfMonth && rule.dayOfMonth >= 1) {
        return advanceRepeatDueDate({ ...rule, type: 'monthly' }, baseDate)
      }
      next.setDate(next.getDate() + interval)
      return next
    }
    case 'daily':
    default:
      next.setDate(next.getDate() + interval)
      return next
  }
}

/** 上一个周期日期（Android 编辑页用） */
export function previousRepeatDueDate(rule: SharedRepeatRule, baseDate: Date): Date {
  const interval = Math.max(1, rule.interval ?? 1)
  const days = effectiveDaysOfWeek(rule)
  const base = startOfDay(baseDate)

  switch (rule.type) {
    case 'weekly':
    case 'weekdays':
    case 'weekends':
      if (days) return prevDayInWeeks(base, days, interval)
      return addDays(base, -7 * interval)
    case 'monthly':
      return addMonths(base, -interval)
    case 'yearly': {
      const prev = new Date(base)
      prev.setFullYear(prev.getFullYear() - interval)
      return prev
    }
    case 'custom':
      if (days) return prevDayInWeeks(base, days, interval)
      return addDays(base, -interval)
    case 'daily':
    default:
      return addDays(base, -interval)
  }
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDay(value?: Date | string): Date {
  if (!value) return startOfDay(new Date())
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return startOfDay(new Date())
  return startOfDay(d)
}

function hasReachedEnd(rule: SharedRepeatRule, nextDate: Date): boolean {
  if (rule.endDate) {
    const end = parseDay(rule.endDate)
    if (nextDate.getTime() > end.getTime()) return true
  }
  return false
}

/**
 * Android 侧入口：推进到下一到期日，返回 yyyy-MM-dd。
 * paused 返回原日期；越过 endDate 返回 null。
 */
export function getNextDueDateString(
  rule: SharedRepeatRule,
  currentDueDate?: Date | string
): string | null {
  if (rule.paused) return currentDueDate ? toLocalDateKey(parseDay(currentDueDate)) : null
  const base = parseDay(currentDueDate)
  const next = advanceRepeatDueDate(rule, base)
  if (hasReachedEnd(rule, next)) return null
  return toLocalDateKey(next)
}

/** Android 侧入口：回退到上一到期日（yyyy-MM-dd） */
export function getPreviousDueDateString(
  rule: SharedRepeatRule,
  currentDueDate?: Date | string
): string | null {
  const base = parseDay(currentDueDate)
  const prev = previousRepeatDueDate(rule, base)
  return toLocalDateKey(prev)
}
