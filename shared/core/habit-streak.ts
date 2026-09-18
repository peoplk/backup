import type { SharedHabit, SharedHabitCheckIn } from './types'
import { isHabitScheduledOn, getHabitExpectedCount } from './habit-frequency'

/**
 * 统一连胜引擎（调度感知）：
 * - 连胜只统计「应做日」，休息日自动跳过不断链
 * - 「每周N次」弹性目标习惯按「达标周」计连胜（单位：周）
 * - 同时计算历史最佳纪录（best）
 */

export interface HabitStreakResult {
  current: number
  best: number
  unit: '天' | '周'
}

const MAX_SCAN_DAYS = 3650

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function completedDateSet(checkIns: SharedHabitCheckIn[]): Set<string> {
  return new Set(
    checkIns.filter(c => c.completed).map(c => startOfDay(new Date(c.date)).toDateString())
  )
}

/** 「每周N次」弹性目标习惯（连胜按周计） */
export function isFlexibleTargetHabit(habit: SharedHabit): boolean {
  return habit.frequency === 'weekly' && !!habit.weeklyTarget && habit.weeklyTarget > 1
}

/** 以周一为起点的周标识 */
function weekStartKey(d: Date): string {
  const x = startOfDay(d)
  const offset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - offset)
  return x.toDateString()
}

function countWeekCompletions(completed: Set<string>, weekStart: Date): number {
  let count = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    if (completed.has(d.toDateString())) count++
  }
  return count
}

/** 按天计的当前连胜：从今天往回，跳过非应做日，漏掉应做日即断链（今天未打卡不断链） */
function currentDayStreak(habit: SharedHabit, completed: Set<string>, today: Date): number {
  let streak = 0
  const cursor = startOfDay(today)
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    const scheduled = isHabitScheduledOn(habit, cursor)
    if (completed.has(cursor.toDateString())) {
      if (scheduled) streak++
    } else if (scheduled) {
      if (cursor.getTime() !== today.getTime()) break
      // 今天是应做日但尚未打卡：宽限，不计入也不断链
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** 历史最佳（按天）：从最早记录扫到今天 */
function bestDayStreak(habit: SharedHabit, completed: Set<string>, earliest: Date, today: Date): number {
  let best = 0
  let chain = 0
  const cursor = startOfDay(earliest)
  const end = startOfDay(today)
  while (cursor <= end) {
    const scheduled = isHabitScheduledOn(habit, cursor)
    const done = completed.has(cursor.toDateString())
    if (done && scheduled) {
      chain++
      if (chain > best) best = chain
    } else if (scheduled && !done && cursor.getTime() !== end.getTime()) {
      chain = 0
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return best
}

/** 弹性目标的当前连胜：连续达标周数（进行中的本周未达标不断链） */
function currentWeekStreak(habit: SharedHabit, completed: Set<string>, today: Date): number {
  const target = Math.min(Math.max(habit.weeklyTarget || 1, 1), 7)
  const thisWeek = new Date(weekStartKey(today))
  const cursor = new Date(thisWeek)
  let streak = 0
  for (let w = 0; w < MAX_SCAN_DAYS / 7; w++) {
    const count = countWeekCompletions(completed, cursor)
    if (count >= target) {
      streak++
    } else if (cursor.getTime() !== thisWeek.getTime()) {
      break
    }
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

/** 弹性目标的历史最佳（按周）：从最早记录所在周正向推进到本周 */
function bestWeekStreak(habit: SharedHabit, completed: Set<string>, earliest: Date, today: Date): number {
  const target = Math.min(Math.max(habit.weeklyTarget || 1, 1), 7)
  let best = 0
  let chain = 0
  const cursor = new Date(weekStartKey(earliest))
  const thisWeekStart = new Date(weekStartKey(today))
  // 修复：必须正向（自最早周向本周）推进；旧实现负向走永远到不了本周，会死循环
  while (cursor.getTime() < thisWeekStart.getTime()) {
    if (countWeekCompletions(completed, cursor) >= target) {
      chain++
      if (chain > best) best = chain
    } else {
      chain = 0
    }
    cursor.setDate(cursor.getDate() + 7)
  }
  return best
}

function earliestRelevantDate(checkIns: SharedHabitCheckIn[], habit: SharedHabit): Date {
  let earliest = startOfDay(new Date(habit.createdAt))
  for (const c of checkIns) {
    const d = startOfDay(new Date(c.date))
    if (d < earliest) earliest = d
  }
  return earliest
}

/** 计算某习惯的当前/最佳连胜 */
export function calculateHabitStreak(
  habit: SharedHabit,
  checkIns: SharedHabitCheckIn[],
  referenceDate: Date = new Date()
): HabitStreakResult {
  const today = startOfDay(referenceDate)
  const completed = completedDateSet(checkIns)

  if (isFlexibleTargetHabit(habit)) {
    const earliest = earliestRelevantDate(checkIns, habit)
    const currentWeek = currentWeekStreak(habit, completed, today)
    return {
      current: currentWeek,
      // 与日分支一致：历史最佳不低于当前连胜（进行中的本周已达标同样计入）
      best: Math.max(bestWeekStreak(habit, completed, earliest, today), currentWeek),
      unit: '周',
    }
  }

  const earliest = earliestRelevantDate(checkIns, habit)
  return {
    current: currentDayStreak(habit, completed, today),
    best: Math.max(bestDayStreak(habit, completed, earliest, today), currentDayStreak(habit, completed, today)),
    unit: '天',
  }
}

/**
 * 应做日感知的区间完成率：
 * - 普通频率：分母为区间内实际应做天数（排除休息日与未来日）
 * - 弹性目标（每周/每月N次）：分母为区间内期望次数（目标数折算），而非固定天数
 */
export function getScheduledCompletionRate(
  habit: SharedHabit,
  checkIns: SharedHabitCheckIn[],
  days: number = 30,
  referenceDate: Date = new Date()
): number {
  const completed = completedDateSet(checkIns)
  const today = startOfDay(referenceDate)
  const createdAt = startOfDay(new Date(habit.createdAt))
  const isFlexible =
    isFlexibleTargetHabit(habit) ||
    (habit.frequency === 'monthly' && !!habit.monthlyTarget && habit.monthlyTarget > 1)

  if (isFlexible) {
    const expected = getHabitExpectedCount(habit, days)
    let doneCount = 0
    for (let i = 0; i < days; i++) {
      const cursor = new Date(today)
      cursor.setDate(cursor.getDate() - i)
      if (cursor < createdAt) break
      if (completed.has(cursor.toDateString())) doneCount++
    }
    if (expected === 0) return doneCount > 0 ? 100 : 0
    return Math.min(100, Math.round((doneCount / expected) * 100))
  }

  let scheduledCount = 0
  let doneCount = 0
  for (let i = 0; i < days; i++) {
    const cursor = new Date(today)
    cursor.setDate(cursor.getDate() - i)
    if (cursor < createdAt) break
    if (!isHabitScheduledOn(habit, cursor)) continue
    scheduledCount++
    if (completed.has(cursor.toDateString())) doneCount++
  }
  if (scheduledCount === 0) return completed.size > 0 ? 100 : 0
  return Math.round((doneCount / scheduledCount) * 100)
}
