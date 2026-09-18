import type { Habit, HabitCheckIn } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultHabits } from '../utils'
import { clearNotifiedKeysWithPrefix } from '@/lib/notified-registry'
import { calculateHabitStreak } from '@/lib/habit-streak'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createHabitSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  habits: defaultHabits,
  habitCheckIns: [] as HabitCheckIn[],
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) =>
    set((state) => ({
      habits: [
        ...state.habits,
        { ...habit, id: generateId(), createdAt: new Date(), archived: false },
      ],
    })),
  updateHabit: (id: string, updates: Partial<Habit>) =>
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    })),
  deleteHabit: (id: string) =>
    set((state) => {
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return state
      clearNotifiedKeysWithPrefix(`habit-${id}`)
      return {
        habits: state.habits.filter((h) => h.id !== id),
        habitCheckIns: state.habitCheckIns.filter((c) => c.habitId !== id),
        notifications: state.notifications.filter(
          (n) => !(n.relatedType === 'habit' && n.relatedId === id && n.type === 'habit-reminder')
        ),
        reminders: state.reminders.filter(
          (r) => !(r.type === 'habit' && r.referenceId === id)
        ),
        // 清理目标中指向该习惯的引用，避免孤儿引用
        goals: state.goals.map((g) =>
          g.linkedHabits?.includes(id)
            ? { ...g, linkedHabits: g.linkedHabits.filter((hId) => hId !== id) }
            : g
        ),
        trashedItems: [
          { id, type: 'habit' as const, data: habit, deletedAt: new Date() },
          ...state.trashedItems,
        ],
      }
    }),
  checkInHabit: (habitId: string, date: Date, completed: boolean, note?: string, value?: number) => {
    set((state) => {
      const dateStr = new Date(date).toDateString()
      const existingIndex = state.habitCheckIns.findIndex(
        (c) => c.habitId === habitId && new Date(c.date).toDateString() === dateStr
      )

      const habit = state.habits.find(h => h.id === habitId)

      // 先落打卡记录，再用统一连胜引擎重算（应做日感知 + 最佳纪录）
      // value 语义 = 本次新增量（累加到当日总量）；不传则保持当日已有总量不变
      let updatedCheckIns: HabitCheckIn[]
      if (existingIndex >= 0) {
        const prev = state.habitCheckIns[existingIndex]
        updatedCheckIns = [...state.habitCheckIns]
        updatedCheckIns[existingIndex] = {
          ...prev,
          completed,
          note: note ?? prev.note,
          value: value !== undefined ? (prev.value ?? 0) + value : prev.value,
        }
      } else {
        updatedCheckIns = [
          ...state.habitCheckIns,
          { id: generateId(), habitId, date, completed, note, value },
        ]
      }

      let notification: { type: 'achievement'; title: string; message: string } | null = null
      let newBestStreak: number | null = null

      if (completed && habit) {
        const habitCheckInsForHabit = updatedCheckIns.filter(c => c.habitId === habitId)
        const result = calculateHabitStreak(habit, habitCheckInsForHabit, date)
        if (result.unit === '天') {
          // 按天计的成就里程碑
          const milestones = [7, 14, 21, 30, 60, 100]
          if (milestones.includes(result.current)) {
            notification = {
              type: 'achievement' as const,
              title: '连续打卡成就',
              message: `恭喜！"${habit.name}" 已连续打卡 ${result.current} 天`,
            }
          }
        }
        if (result.best > (habit.bestStreak || 0)) {
          newBestStreak = result.best
        }
      }

      const updatedHabits = newBestStreak !== null
        ? state.habits.map(h => h.id === habitId ? { ...h, bestStreak: newBestStreak! } : h)
        : state.habits

      return {
        habitCheckIns: updatedCheckIns,
        habits: updatedHabits,
        notifications: notification ? [
          {
            ...notification,
            id: generateId(),
            timestamp: new Date(),
            read: false,
          },
          ...state.notifications,
        ].slice(0, 50) : state.notifications,
      }
    })
    if (completed) {
      // 打卡即时评估成就（习惯类成就不再只在番茄钟完成时触发）
      get().checkAchievements?.()
      // 目标进度统一走 data-link-service 单一公式（含习惯调度完成率）
      import('@/lib/data-link-service').then(({ dataLinkService }) => {
        dataLinkService.handleHabitCheck(habitId, date, completed)
      })
    }
  },
  useStreakFreeze: (habitId: string) =>
    set((state) => {
      const habit = state.habits.find(h => h.id === habitId)
      if (!habit) return state
      const maxFreezes = habit.maxStreakFreezes || 3
      const currentFreezes = habit.streakFreezes || 0
      if (currentFreezes >= maxFreezes) return state

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toDateString()
      const yesterdayCheckIn = state.habitCheckIns.find(
        c => c.habitId === habitId && new Date(c.date).toDateString() === yesterdayStr
      )
      if (yesterdayCheckIn?.completed) return state

      // 已存在昨日未完成记录时更新该条，而不是追加重复的同日记录
      const nextCheckIns = yesterdayCheckIn
        ? state.habitCheckIns.map(c =>
            c.id === yesterdayCheckIn.id
              ? { ...c, completed: true, note: '🧊 连续冻结保护' }
              : c
          )
        : [
            ...state.habitCheckIns,
            { id: generateId(), habitId, date: yesterday, completed: true, note: '🧊 连续冻结保护' },
          ]

      return {
        habits: state.habits.map(h =>
          h.id === habitId ? { ...h, streakFreezes: (h.streakFreezes || 0) + 1 } : h
        ),
        habitCheckIns: nextCheckIns,
        notifications: [
          {
            id: generateId(),
            type: 'achievement' as const,
            title: '🧊 连续冻结',
            message: `"${habit.name}" 使用了连续冻结保护，连续天数不会被重置（${currentFreezes + 1}/${maxFreezes}）`,
            timestamp: new Date(),
            read: false,
          },
          ...state.notifications,
        ].slice(0, 50),
      }
    }),
  batchCheckInHabits: (habitIds: string[], dates: Date[]) => {
    set((state) => {
      const existing = new Set(
        state.habitCheckIns.map(c => `${c.habitId}|${new Date(c.date).toDateString()}`)
      )
      const newCheckIns: HabitCheckIn[] = []
      for (const habitId of habitIds) {
        for (const date of dates) {
          const key = `${habitId}|${new Date(date).toDateString()}`
          if (existing.has(key)) continue
          newCheckIns.push({
            id: generateId(),
            habitId,
            date: new Date(date),
            completed: true,
            note: '📝 批量补卡',
          })
        }
      }
      if (newCheckIns.length === 0) return state
      return {
        habitCheckIns: [...state.habitCheckIns, ...newCheckIns],
        habits: state.habits.map(h => {
          if (!habitIds.includes(h.id)) return h
          const result = calculateHabitStreak(
            h,
            [...state.habitCheckIns, ...newCheckIns].filter(c => c.habitId === h.id),
            new Date()
          )
          return result.best > (h.bestStreak || 0) ? { ...h, bestStreak: result.best } : h
        }),
      }
    })
    // 补卡后同步目标进度与成就评估（统一走 data-link-service 单一公式）
    habitIds.forEach((habitId) => {
      import('@/lib/data-link-service').then(({ dataLinkService }) => {
        dataLinkService.handleHabitCheck(habitId, new Date(), true)
      })
    })
    get().checkAchievements?.()
  },
})
