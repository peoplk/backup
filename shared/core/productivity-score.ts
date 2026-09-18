/**
 * 生产力评分（跨端单一来源，自桌面版移植）：
 * 四分项加权——任务完成 40 / 专注番茄 30 / 时间块规划 15 / 习惯打卡 15，S-D 评级。
 * 类型为结构兼容的最小输入：桌面 Task/PomodoroSession/TimeBlock/Habit/HabitCheckIn
 * 与移动端对应实体均可直接映射后传入。
 */

export type ScoreGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface DailyScore {
  score: number
  grade: ScoreGrade
  taskScore: number
  focusScore: number
  planScore: number
  habitScore: number
}

export function gradeFor(score: number): ScoreGrade {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

/** 结构兼容的最小输入（date/createdAt 等两端形态不同，统一 Date | string） */
export interface ScoreInput {
  tasks: Array<{
    id: string
    status: string
    dueDate?: Date | string
    completedAt?: Date | string
    archived?: boolean
  }>
  pomodoroSessions: Array<{ type: string; completedAt: Date | string }>
  timeBlocks: Array<{ date: Date | string; completed?: boolean }>
  habits: Array<{ id: string; archived?: boolean }>
  habitCheckIns: Array<{ habitId: string; date: Date | string; completed: boolean }>
  /** 每日番茄目标（默认 8） */
  dailyPomodoroGoal?: number
  /** 移动端番茄会话的"工作"类型标识（默认 'work'，Android 为 'focus'） */
  workSessionType?: string
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const ts = (v: Date | string | undefined): number => new Date(v as Date).getTime()

export function computeDailyScore(date: Date, data: ScoreInput): DailyScore {
  const dayStart = startOfDay(date)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const workType = data.workSessionType ?? 'work'

  const inDay = (v: Date | string | undefined) => {
    const t = ts(v)
    return t >= dayStart.getTime() && t < dayEnd.getTime()
  }

  const tasksDueOrCompleted = data.tasks.filter((t) => {
    if (t.status === 'done' && inDay(t.completedAt)) return true
    if (t.status !== 'done' && t.dueDate && inDay(t.dueDate)) return true
    return false
  })
  const completedOfDay = tasksDueOrCompleted.filter((t) => t.status === 'done' && inDay(t.completedAt)).length
  const taskScore =
    tasksDueOrCompleted.length > 0
      ? Math.round((completedOfDay / tasksDueOrCompleted.length) * 40)
      : 40

  const dayPomodoros = data.pomodoroSessions.filter((s) => s.type === workType && inDay(s.completedAt)).length
  const pomodoroGoal = data.dailyPomodoroGoal ?? 8
  const focusScore = Math.min(30, Math.round((dayPomodoros / Math.max(1, pomodoroGoal)) * 30))

  const dayBlocks = data.timeBlocks.filter((b) => inDay(b.date))
  const planScore =
    dayBlocks.length > 0
      ? Math.round((dayBlocks.filter((b) => b.completed).length / dayBlocks.length) * 15)
      : 15

  const activeHabits = data.habits.filter((h) => !h.archived)
  const completedHabitIds = new Set(
    data.habitCheckIns.filter((c) => c.completed && inDay(c.date)).map((c) => c.habitId)
  )
  const doneCount = activeHabits.filter((h) => completedHabitIds.has(h.id)).length
  const habitScore =
    activeHabits.length > 0
      ? Math.round((doneCount / activeHabits.length) * 15)
      : 15

  const score = Math.min(100, taskScore + focusScore + planScore + habitScore)
  return {
    score,
    grade: gradeFor(score),
    taskScore,
    focusScore,
    planScore,
    habitScore,
  }
}

/** 过去 N 天每日评分（含今天） */
export function computeScoreTrend(
  days: number,
  data: ScoreInput,
  includeToday = true
): { date: string; score: number; grade: string }[] {
  const result: { date: string; score: number; grade: string }[] = []
  const today = startOfDay(new Date())
  const count = includeToday ? days - 1 : days
  for (let i = count; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const s = computeDailyScore(d, data)
    result.push({
      date: d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
      score: s.score,
      grade: s.grade,
    })
  }
  return result
}
