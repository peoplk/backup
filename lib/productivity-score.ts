import type { Task, Habit, HabitCheckIn, PomodoroSession, TimeBlock } from '@/lib/types'

export interface DailyScore {
  score: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  taskScore: number
  focusScore: number
  planScore: number
  habitScore: number
}

export function gradeFor(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

interface DailyInput {
  tasks: Task[]
  pomodoroSessions: PomodoroSession[]
  timeBlocks: TimeBlock[]
  habits: Habit[]
  habitCheckIns: HabitCheckIn[]
  dailyPomodoroGoal?: number
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function computeDailyScore(date: Date, data: DailyInput): DailyScore {
  const dayStart = startOfDay(date)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const dayStr = dayStart.toDateString()

  const tasksDueOrCompleted = data.tasks.filter((t) => {
    if (t.status === 'done' && t.completedAt && new Date(t.completedAt) >= dayStart && new Date(t.completedAt) < dayEnd) {
      return true
    }
    if (t.status !== 'done' && t.dueDate && new Date(t.dueDate) >= dayStart && new Date(t.dueDate) < dayEnd) {
      return true
    }
    return false
  })
  const completedOfDay = tasksDueOrCompleted.filter(
    (t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= dayStart && new Date(t.completedAt) < dayEnd
  ).length
  const taskScore =
    tasksDueOrCompleted.length > 0
      ? Math.round((completedOfDay / tasksDueOrCompleted.length) * 40)
      : 40

  const dayPomodoros = data.pomodoroSessions.filter(
    (s) => s.type === 'work' && new Date(s.completedAt) >= dayStart && new Date(s.completedAt) < dayEnd
  ).length
  const pomodoroGoal = data.dailyPomodoroGoal ?? 8
  const focusScore = Math.min(30, Math.round((dayPomodoros / Math.max(1, pomodoroGoal)) * 30))

  const dayBlocks = data.timeBlocks.filter(
    (b) => new Date(b.date) >= dayStart && new Date(b.date) < dayEnd
  )
  const planScore =
    dayBlocks.length > 0
      ? Math.round((dayBlocks.filter((b) => b.completed).length / dayBlocks.length) * 15)
      : 15

  const activeHabits = data.habits.filter((h) => !h.archived)
  const dayCheckIns = data.habitCheckIns.filter(
    (c) => new Date(c.date) >= dayStart && new Date(c.date) < dayEnd && c.completed
  )
  const completedHabitIds = new Set(dayCheckIns.map((c) => c.habitId))
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

/** 过去 N 天每日评分（不含今天，含今天可选） */
export function computeScoreTrend(
  days: number,
  data: DailyInput,
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
