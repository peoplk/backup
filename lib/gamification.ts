import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { PomodoroSession, Habit, Task, HabitCheckIn, Achievement } from '@/lib/types'
import { LEVEL_THRESHOLDS, LEVEL_TITLES, levelFromPoints } from '@/lib/level-config'
import { calculateHabitStreak as calculateUnifiedHabitStreak } from '@/lib/habit-streak'

export type { Achievement }

export interface GameProgress {
  level: number
  experience: number
  experienceToNextLevel: number
  coins: number
  trees: number
  achievements: string[]
  streak: number
  totalFocusTime: number
  completedTasks: number
  completedHabits: number
}

function tierForValue(value: number): Achievement['tier'] {
  if (value >= 500) return 'platinum'
  if (value >= 100) return 'gold'
  if (value >= 30) return 'silver'
  return 'bronze'
}

function def(
  id: string,
  name: string,
  description: string,
  icon: string,
  category: Achievement['category'],
  value: number,
  points: number,
  metric: string = 'count'
): Achievement {
  return {
    id,
    name,
    description,
    icon,
    category,
    requirement: { type: 'count', value, metric },
    earned: false,
    progress: 0,
    tier: tierForValue(value),
    points,
  }
}

const ACHIEVEMENTS: Achievement[] = [
  // 专注成就
  def('first-focus', '初次专注', '完成第一个番茄钟', '🍅', 'focus', 1, 10),
  def('focus-10', '专注新手', '完成10个番茄钟', '🌱', 'focus', 10, 30),
  def('focus-50', '专注达人', '完成50个番茄钟', '🌿', 'focus', 50, 100),
  def('focus-100', '专注大师', '完成100个番茄钟', '🌳', 'focus', 100, 200),
  def('focus-500', '专注传奇', '完成500个番茄钟', '🏆', 'focus', 500, 500),

  // 任务成就
  def('first-task', '任务起步', '完成第一个任务', '✅', 'tasks', 1, 10),
  def('tasks-10', '任务高手', '完成10个任务', '📋', 'tasks', 10, 50),
  def('tasks-50', '任务大师', '完成50个任务', '🎯', 'tasks', 50, 150),
  def('tasks-100', '任务传奇', '完成100个任务', '🏅', 'tasks', 100, 300),

  // 习惯成就
  def('first-habit', '习惯养成', '完成第一次习惯打卡', '⭐', 'habits', 1, 10),
  def('habit-streak-7', '周冠军', '连续打卡7天', '🔥', 'habits', 7, 100),
  def('habit-streak-30', '月度之星', '连续打卡30天', '💫', 'habits', 30, 300),
  def('habit-streak-100', '百日传奇', '连续打卡100天', '🌟', 'habits', 100, 1000),

  // 连续专注成就
  def('streak-7', '周专注', '连续7天专注', '📅', 'streak', 7, 100),
  def('streak-30', '月专注', '连续30天专注', '🗓️', 'streak', 30, 500),
  def('streak-100', '百日专注', '连续100天专注', '💎', 'streak', 100, 2000),

  // 特殊成就
  def('night-owl', '夜猫子', '在深夜(23:00-5:00)完成专注', '🦉', 'special', 1, 50),
  def('early-bird', '早起鸟', '在清晨(5:00-7:00)完成专注', '🐦', 'special', 1, 50),
  def('weekend-warrior', '周末战士', '在周末完成10个番茄钟', '⚔️', 'special', 10, 100),
  def('marathon-runner', '马拉松跑者', '单日完成6+个番茄钟', '🏃', 'special', 1, 150),
  def('dawn-patrol', '清晨守护者', '在 4:00-6:00 完成专注', '🌅', 'special', 1, 80),
  def('project-master', '项目大师', '完成5个不同的项目任务', '🗂️', 'tasks', 5, 200),
  def('task-terminator', '任务终结者', '一周内完成20个任务', '💥', 'tasks', 20, 250),
  def('tree-planter', '植树人', '种下100棵树（完成100个番茄）', '🌲', 'focus', 100, 300),
  def('time-traveler', '时间旅行者', '累计专注 100 小时', '⏳', 'focus', 6000, 500, 'minutes'),
  def('multi-tasker', '多面手', '同时关联 3 个任务到番茄钟', '🎭', 'special', 1, 100),
]

/** 判断某个成就当前是否已达成（返回新的已解锁成就，未解锁返回 null） */
function evaluateAchievement(
  achievement: Achievement,
  ctx: {
    workSessions: PomodoroSession[]
    completedTasks: Task[]
    maxHabitStreak: number
    focusStreak: number
  }
): Achievement | null {
  const { workSessions, completedTasks, maxHabitStreak, focusStreak } = ctx
  let unlocked = false

  switch (achievement.category) {
    case 'focus':
      if (achievement.id === 'time-traveler') {
        const totalMinutes = workSessions.reduce((acc, s) => acc + s.duration / 60, 0)
        unlocked = totalMinutes >= achievement.requirement.value
      } else if (achievement.id === 'tree-planter') {
        unlocked = workSessions.length >= achievement.requirement.value
      } else {
        unlocked = workSessions.length >= achievement.requirement.value
      }
      break
    case 'tasks':
      if (achievement.id === 'project-master') {
        const projects = new Set(completedTasks.filter((t) => !!t.project).map((t) => t.project as string))
        unlocked = projects.size >= achievement.requirement.value
      } else if (achievement.id === 'task-terminator') {
        const weekAgo = Date.now() - 7 * 86400_000
        unlocked = completedTasks.filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length >= achievement.requirement.value
      } else {
        unlocked = completedTasks.length >= achievement.requirement.value
      }
      break
    case 'habits':
      unlocked = maxHabitStreak >= achievement.requirement.value
      break
    case 'streak':
      unlocked = focusStreak >= achievement.requirement.value
      break
    case 'special':
      if (achievement.id === 'night-owl') {
        unlocked = workSessions.some((s) => {
          const h = new Date(s.completedAt).getHours()
          return h >= 23 || h < 5
        })
      } else if (achievement.id === 'early-bird') {
        unlocked = workSessions.some((s) => {
          const h = new Date(s.completedAt).getHours()
          return h >= 5 && h < 7
        })
      } else if (achievement.id === 'weekend-warrior') {
        unlocked =
          workSessions.filter((s) => {
            const d = new Date(s.completedAt).getDay()
            return d === 0 || d === 6
          }).length >= achievement.requirement.value
      } else if (achievement.id === 'marathon-runner') {
        const byDate = new Map<string, number>()
        workSessions.forEach((s) => {
          const d = new Date(s.completedAt).toDateString()
          byDate.set(d, (byDate.get(d) || 0) + 1)
        })
        unlocked = Array.from(byDate.values()).some((n) => n >= 6)
      } else if (achievement.id === 'dawn-patrol') {
        unlocked = workSessions.some((s) => {
          const h = new Date(s.completedAt).getHours()
          return h >= 4 && h < 6
        })
      } else if (achievement.id === 'multi-tasker') {
        const ids = new Set(workSessions.map((s) => s.taskId).filter(Boolean) as string[])
        unlocked = ids.size >= 3
      }
      break
  }

  if (unlocked) {
    return { ...achievement, earned: true, earnedAt: new Date(), progress: 100 }
  }
  return null
}

/** 纯函数：根据当前 store 状态检查成就并写入 store，返回新解锁的成就与新增积分 */
export function checkAchievementsNow(): { newlyUnlocked: Achievement[]; newPoints: number } {
  const { pomodoroSessions, tasks, habits, habitCheckIns, achievements } = useAppStore.getState()

  const workSessions = pomodoroSessions.filter((s) => s.type === 'work')
  const completedTasks = tasks.filter((t) => t.status === 'done')
  const maxStreak = maxHabitStreakAcross(habits, habitCheckIns)
  const focusStreak = calculateStreak(workSessions)

  const ctx = { workSessions, completedTasks, maxHabitStreak: maxStreak, focusStreak }
  const unlockedMap = new Map(achievements.map((a) => [a.id, a]))
  const newlyUnlocked = ACHIEVEMENTS.flatMap((achievement) => {
    if (unlockedMap.has(achievement.id)) return []
    const result = evaluateAchievement(achievement, ctx)
    return result ? [result] : []
  })

  if (newlyUnlocked.length > 0) {
    const store = useAppStore.getState()
    const newPoints = newlyUnlocked.reduce((acc, a) => acc + a.points, 0)
    useAppStore.setState({
      achievements: [...store.achievements, ...newlyUnlocked],
    })
    store.addPoints(newPoints)
  }

  return {
    newlyUnlocked,
    newPoints: newlyUnlocked.reduce((acc, a) => acc + a.points, 0),
  }
}

export function useGamification() {
  const { pomodoroSessions, tasks, habits, habitCheckIns, achievements, userLevel } = useAppStore()

  const gameProgress = useMemo((): GameProgress => {
    const workSessions = pomodoroSessions.filter(s => s.type === 'work')
    const completedTasks = tasks.filter(t => t.status === 'done')
    const completedHabits = habitCheckIns.filter(c => c.completed)

    const totalFocusTime = workSessions.reduce((acc, s) => acc + s.duration, 0)
    const streak = calculateStreak(workSessions)

    // 等级/经验统一取自积分账本（userLevel.totalPoints，与成就系统同一数据源），
    // 不再从历史全量重算，避免双轨账本显示不同等级
    const experience = userLevel.totalPoints
    const level = levelFromPoints(experience)
    const nextThreshold = LEVEL_THRESHOLDS[level]
    const experienceToNextLevel = nextThreshold === undefined ? 0 : Math.max(0, nextThreshold - experience)

    return {
      level,
      experience,
      experienceToNextLevel,
      coins: experience,
      trees: workSessions.length,
      achievements: achievements.map(a => a.id),
      streak,
      totalFocusTime,
      completedTasks: completedTasks.length,
      completedHabits: completedHabits.length,
    }
  }, [pomodoroSessions, tasks, habitCheckIns, achievements, userLevel])

  const calculateExperienceForSession = (session: PomodoroSession): number => {
    let exp = session.duration / 60

    if (session.taskId) exp *= 1.5

    const streak = calculateStreak(pomodoroSessions.filter(s => s.type === 'work'))
    if (streak >= 7) exp *= 1.2
    if (streak >= 30) exp *= 1.5

    const hour = new Date(session.completedAt).getHours()
    if (hour >= 23 || hour < 5) exp *= 1.3
    if (hour >= 5 && hour < 7) exp *= 1.2

    const dayOfWeek = new Date(session.completedAt).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) exp *= 1.2

    return Math.floor(exp)
  }

  const checkNewAchievements = (): Achievement[] => {
    const { pomodoroSessions, tasks, habits, habitCheckIns, achievements } = useAppStore.getState()
    const workSessions = pomodoroSessions.filter(s => s.type === 'work')
    const completedTasks = tasks.filter(t => t.status === 'done')
    const maxStreak = maxHabitStreakAcross(habits, habitCheckIns)
    const streak = calculateStreak(workSessions)
    const unlockedMap = new Map(achievements.map(a => [a.id, a]))

    return ACHIEVEMENTS.flatMap((achievement) => {
      if (unlockedMap.has(achievement.id)) return []
      const result = evaluateAchievement(achievement, {
        workSessions,
        completedTasks,
        maxHabitStreak: maxStreak,
        focusStreak: streak,
      })
      return result ? [result] : []
    })
  }

  const getLevelTitle = (level: number): string => {
    return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  }

  const getLevelProgress = (): number => {
    if (gameProgress.level === 1) {
      return (gameProgress.experience / LEVEL_THRESHOLDS[1]) * 100
    }
    const currentLevelExp = LEVEL_THRESHOLDS[gameProgress.level - 1]
    const nextLevelExp = LEVEL_THRESHOLDS[gameProgress.level]
    const progress = ((gameProgress.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100
    return Math.min(progress, 100)
  }

  const calculateHabitStreak = (habitId: string): number => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return 0
    return calculateUnifiedHabitStreak(
      habit,
      habitCheckIns.filter(c => c.habitId === habitId)
    ).current
  }

  return {
    gameProgress,
    calculateExperienceForSession,
    checkNewAchievements,
    getLevelTitle,
    getLevelProgress,
    calculateHabitStreak,
    achievements: ACHIEVEMENTS,
    levelThresholds: LEVEL_THRESHOLDS,
  }
}

/** 全部习惯中的最大当前连胜（统一走 lib/habit-streak.ts 调度感知引擎） */
function maxHabitStreakAcross(
  habits: Habit[],
  checkIns: HabitCheckIn[]
): number {
  return habits.reduce((max, habit) => {
    const streak = calculateUnifiedHabitStreak(
      habit,
      checkIns.filter(c => c.habitId === habit.id)
    ).current
    return streak > max ? streak : max
  }, 0)
}

function calculateStreak(sessions: PomodoroSession[]): number {
  const dates = [...new Set(sessions.map(s => new Date(s.completedAt).toDateString()))]
  dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  let count = 0
  const checkDate = new Date()
  
  for (let i = 0; i < dates.length; i++) {
    const dateStr = checkDate.toDateString()
    if (dates.includes(dateStr)) {
      count++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (i === 0) {
      checkDate.setDate(checkDate.getDate() - 1)
      i--
    } else {
      break
    }
  }
  
  return count
}