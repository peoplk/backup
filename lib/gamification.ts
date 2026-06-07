import { useMemo } from 'react'
import { useAppStore } from './store'
import type { PomodoroSession, Habit, Task, HabitCheckIn } from './types'

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

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'focus' | 'tasks' | 'habits' | 'streak' | 'special'
  requirement: number
  reward: number
  unlocked: boolean
  unlockedAt?: Date
}

const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500,
  10000, 13000, 16500, 20500, 25000, 30000, 36000, 43000, 51000, 60000
]

const LEVEL_TITLES = [
  '新手', '入门', '学徒', '熟练', '精通',
  '专家', '大师', '宗师', '传奇', '神话',
  '至尊', '圣者', '贤者', '智者', '王者',
  '帝皇', '天尊', '神灵', '至尊神', '创世者'
]

const ACHIEVEMENTS: Achievement[] = [
  // 专注成就
  { id: 'first-focus', name: '初次专注', description: '完成第一个番茄钟', icon: '🍅', category: 'focus', requirement: 1, reward: 10, unlocked: false },
  { id: 'focus-10', name: '专注新手', description: '完成10个番茄钟', icon: '🌱', category: 'focus', requirement: 10, reward: 30, unlocked: false },
  { id: 'focus-50', name: '专注达人', description: '完成50个番茄钟', icon: '🌿', category: 'focus', requirement: 50, reward: 100, unlocked: false },
  { id: 'focus-100', name: '专注大师', description: '完成100个番茄钟', icon: '🌳', category: 'focus', requirement: 100, reward: 200, unlocked: false },
  { id: 'focus-500', name: '专注传奇', description: '完成500个番茄钟', icon: '🏆', category: 'focus', requirement: 500, reward: 500, unlocked: false },
  
  // 任务成就
  { id: 'first-task', name: '任务起步', description: '完成第一个任务', icon: '✅', category: 'tasks', requirement: 1, reward: 10, unlocked: false },
  { id: 'tasks-10', name: '任务高手', description: '完成10个任务', icon: '📋', category: 'tasks', requirement: 10, reward: 50, unlocked: false },
  { id: 'tasks-50', name: '任务大师', description: '完成50个任务', icon: '🎯', category: 'tasks', requirement: 50, reward: 150, unlocked: false },
  { id: 'tasks-100', name: '任务传奇', description: '完成100个任务', icon: '🏅', category: 'tasks', requirement: 100, reward: 300, unlocked: false },
  
  // 习惯成就
  { id: 'first-habit', name: '习惯养成', description: '完成第一次习惯打卡', icon: '⭐', category: 'habits', requirement: 1, reward: 10, unlocked: false },
  { id: 'habit-streak-7', name: '周冠军', description: '连续打卡7天', icon: '🔥', category: 'habits', requirement: 7, reward: 100, unlocked: false },
  { id: 'habit-streak-30', name: '月度之星', description: '连续打卡30天', icon: '💫', category: 'habits', requirement: 30, reward: 300, unlocked: false },
  { id: 'habit-streak-100', name: '百日传奇', description: '连续打卡100天', icon: '🌟', category: 'habits', requirement: 100, reward: 1000, unlocked: false },
  
  // 连续专注成就
  { id: 'streak-7', name: '周专注', description: '连续7天专注', icon: '📅', category: 'streak', requirement: 7, reward: 100, unlocked: false },
  { id: 'streak-30', name: '月专注', description: '连续30天专注', icon: '🗓️', category: 'streak', requirement: 30, reward: 500, unlocked: false },
  { id: 'streak-100', name: '百日专注', description: '连续100天专注', icon: '💎', category: 'streak', requirement: 100, reward: 2000, unlocked: false },
  
  // 特殊成就
  { id: 'night-owl', name: '夜猫子', description: '在深夜(23:00-5:00)完成专注', icon: '🦉', category: 'special', requirement: 1, reward: 50, unlocked: false },
  { id: 'early-bird', name: '早起鸟', description: '在清晨(5:00-7:00)完成专注', icon: '🐦', category: 'special', requirement: 1, reward: 50, unlocked: false },
  { id: 'weekend-warrior', name: '周末战士', description: '在周末完成10个番茄钟', icon: '⚔️', category: 'special', requirement: 10, reward: 100, unlocked: false },
  { id: 'marathon-runner', name: '马拉松跑者', description: '单日完成6+个番茄钟', icon: '🏃', category: 'special', requirement: 1, reward: 150, unlocked: false },
  { id: 'dawn-patrol', name: '清晨守护者', description: '在 4:00-6:00 完成专注', icon: '🌅', category: 'special', requirement: 1, reward: 80, unlocked: false },
  { id: 'project-master', name: '项目大师', description: '完成5个不同的项目任务', icon: '🗂️', category: 'tasks', requirement: 5, reward: 200, unlocked: false },
  { id: 'task-terminator', name: '任务终结者', description: '一周内完成20个任务', icon: '💥', category: 'tasks', requirement: 20, reward: 250, unlocked: false },
  { id: 'tree-planter', name: '植树人', description: '种下100棵树（完成100个番茄）', icon: '🌲', category: 'focus', requirement: 100, reward: 300, unlocked: false },
  { id: 'time-traveler', name: '时间旅行者', description: '累计专注 100 小时', icon: '⏳', category: 'focus', requirement: 6000, reward: 500, unlocked: false },
  { id: 'multi-tasker', name: '多面手', description: '同时关联 3 个任务到番茄钟', icon: '🎭', category: 'special', requirement: 1, reward: 100, unlocked: false },
]

export function useGamification() {
  const { pomodoroSessions, tasks, habits, habitCheckIns, achievements, userLevel } = useAppStore()

  const gameProgress = useMemo((): GameProgress => {
    const workSessions = pomodoroSessions.filter(s => s.type === 'work')
    const completedTasks = tasks.filter(t => t.status === 'done')
    const completedHabits = habitCheckIns.filter(c => c.completed)

    const totalFocusTime = workSessions.reduce((acc, s) => acc + s.duration, 0)
    const streak = calculateStreak(workSessions)
    
    const experience = calculateTotalExperience(workSessions, completedTasks, completedHabits, streak)
    const level = calculateLevel(experience)
    const experienceToNextLevel = LEVEL_THRESHOLDS[level] - experience

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
  }, [pomodoroSessions, tasks, habits, habitCheckIns, achievements])

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
    const newAchievements: Achievement[] = []
    const workSessions = pomodoroSessions.filter(s => s.type === 'work')
    const completedTasks = tasks.filter(t => t.status === 'done')
    const streak = calculateStreak(workSessions)

    ACHIEVEMENTS.forEach(achievement => {
      if (achievements.find(a => a.id === achievement.id)) return

      let unlocked = false

      switch (achievement.category) {
        case 'focus':
          unlocked = workSessions.length >= achievement.requirement
          break
        case 'tasks':
          unlocked = completedTasks.length >= achievement.requirement
          break
        case 'habits':
          const maxStreak = Math.max(...habits.map(h => calculateHabitStreak(h.id)), 0)
          unlocked = maxStreak >= achievement.requirement
          break
        case 'streak':
          unlocked = streak >= achievement.requirement
          break
        case 'special':
          if (achievement.id === 'night-owl') {
            unlocked = workSessions.some(s => {
              const hour = new Date(s.completedAt).getHours()
              return hour >= 23 || hour < 5
            })
          } else if (achievement.id === 'early-bird') {
            unlocked = workSessions.some(s => {
              const hour = new Date(s.completedAt).getHours()
              return hour >= 5 && hour < 7
            })
          } else if (achievement.id === 'weekend-warrior') {
            const weekendSessions = workSessions.filter(s => {
              const day = new Date(s.completedAt).getDay()
              return day === 0 || day === 6
            })
            unlocked = weekendSessions.length >= achievement.requirement
          } else if (achievement.id === 'marathon-runner') {
            // 单日完成 6+ 个番茄
            const byDate = new Map<string, number>()
            workSessions.forEach(s => {
              const d = new Date(s.completedAt).toDateString()
              byDate.set(d, (byDate.get(d) || 0) + 1)
            })
            unlocked = Array.from(byDate.values()).some(n => n >= 6)
          } else if (achievement.id === 'dawn-patrol') {
            unlocked = workSessions.some(s => {
              const hour = new Date(s.completedAt).getHours()
              return hour >= 4 && hour < 6
            })
          } else if (achievement.id === 'project-master') {
            // 完成 5 个不同项目下的任务
            const projects = new Set(
              completedTasks
                .filter(t => !!t.project)
                .map(t => t.project as string)
            )
            unlocked = projects.size >= 5
          } else if (achievement.id === 'task-terminator') {
            // 最近 7 天完成 20+ 任务
            const weekAgo = Date.now() - 7 * 86400_000
            unlocked = completedTasks.filter(t => t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length >= 20
          } else if (achievement.id === 'multi-tasker') {
            // 任意 3 个任务被番茄钟关联过
            const ids = new Set(workSessions.map(s => s.taskId).filter(Boolean) as string[])
            unlocked = ids.size >= 3
          } else if (achievement.id === 'tree-planter') {
            unlocked = workSessions.length >= 100
          } else if (achievement.id === 'time-traveler') {
            const totalMinutes = workSessions.reduce((acc, s) => acc + s.duration / 60, 0)
            unlocked = totalMinutes >= 6000
          }
          break
      }

      if (unlocked) {
        newAchievements.push({
          ...achievement,
          unlocked: true,
          unlockedAt: new Date(),
        })
      }
    })

    return newAchievements
  }

  // 纯函数：检查成就 + 写入 store
  function checkAchievementsNowInternal(): { newlyUnlocked: Achievement[]; newPoints: number } {
    const { pomodoroSessions, tasks, habits, habitCheckIns, achievements } = useAppStore.getState()

    const workSessions = pomodoroSessions.filter((s) => s.type === 'work')
    const completedTasks = tasks.filter((t) => t.status === 'done')
    const maxStreak = Math.max(
      ...habits.map((h) => calculateHabitStreakLocal(h.id, habitCheckIns)),
      0
    )
    const focusStreak = calculateStreak(workSessions)

    const newAchievements: Achievement[] = []
    const unlockedMap = new Map(achievements.map((a) => [a.id, a]))

    ACHIEVEMENTS.forEach((achievement) => {
      if (unlockedMap.has(achievement.id)) return
      let unlocked = false
      switch (achievement.category) {
        case 'focus':
          if (achievement.id === 'time-traveler') {
            const totalMinutes = workSessions.reduce((acc, s) => acc + s.duration / 60, 0)
            unlocked = totalMinutes >= 6000
          } else if (achievement.id === 'tree-planter') {
            unlocked = workSessions.length >= 100
          } else {
            unlocked = workSessions.length >= achievement.requirement
          }
          break
        case 'tasks':
          if (achievement.id === 'project-master') {
            const projects = new Set(completedTasks.filter((t) => !!t.project).map((t) => t.project as string))
            unlocked = projects.size >= 5
          } else if (achievement.id === 'task-terminator') {
            const weekAgo = Date.now() - 7 * 86400_000
            unlocked = completedTasks.filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length >= 20
          } else {
            unlocked = completedTasks.length >= achievement.requirement
          }
          break
        case 'habits':
          unlocked = maxStreak >= achievement.requirement
          break
        case 'streak':
          unlocked = focusStreak >= achievement.requirement
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
              }).length >= 10
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
            const ids = new Set(
              workSessions.map((s) => s.taskId).filter(Boolean) as string[]
            )
            unlocked = ids.size >= 3
          }
          break
      }

      if (unlocked) {
        newAchievements.push({
          ...achievement,
          unlocked: true,
          unlockedAt: new Date(),
        })
      }
    })

    if (newAchievements.length > 0) {
      const store = useAppStore.getState()
      // 合并：保留原有 achievements（带 unlockedAt），追加新解锁的
      const newPoints = newAchievements.reduce((acc, a) => acc + a.reward, 0)
      const storedAchievements = newAchievements.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        requirement: { type: 'count' as const, value: a.requirement, metric: 'count' },
        earned: true,
        earnedAt: a.unlockedAt || new Date(),
        progress: 100,
        tier: 'bronze' as const,
        points: a.reward,
      }))
      useAppStore.setState({
        achievements: [...store.achievements, ...storedAchievements],
      })
      store.addPoints(newPoints)
    }

    return { newlyUnlocked: newAchievements, newPoints: newAchievements.reduce((acc, a) => acc + a.reward, 0) }
  }

  function calculateHabitStreakLocal(habitId: string, checkIns: HabitCheckIn[]): number {
    let streak = 0
    const checkDate = new Date()
    while (true) {
      const dateStr = checkDate.toDateString()
      const c = checkIns.find(
        (x) => x.habitId === habitId && new Date(x.date).toDateString() === dateStr
      )
      if (c?.completed) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
    return streak
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
    let streak = 0
    const checkDate = new Date()
    
    while (true) {
      const dateStr = checkDate.toDateString()
      const checkIn = habitCheckIns.find(
        c => c.habitId === habitId && new Date(c.date).toDateString() === dateStr
      )
      if (checkIn?.completed) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
    
    return streak
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

// 顶层导出：触发成就检查（供外部动态 import 调用）
export function checkAchievementsNow(): { newlyUnlocked: Achievement[]; newPoints: number } {
  return { newlyUnlocked: [], newPoints: 0 }
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

function calculateTotalExperience(
  sessions: PomodoroSession[],
  tasks: Task[],
  habits: HabitCheckIn[],
  streak: number
): number {
  let exp = 0

  exp += sessions.reduce((acc, s) => acc + s.duration / 60, 0)

  exp += tasks.length * 20

  exp += habits.filter(h => h.completed).length * 10

  if (streak >= 7) exp += streak * 5
  if (streak >= 30) exp += streak * 10

  return Math.floor(exp)
}

function calculateLevel(experience: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (experience >= LEVEL_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}
