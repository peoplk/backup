import type { Habit, HabitCheckIn } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultHabits } from '../utils'
import { clearNotifiedKeysWithPrefix } from '@/lib/notified-registry'

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
      let streak = 0
      if (completed && habit) {
        const checkDate = new Date(date)
        while (true) {
          const dStr = checkDate.toDateString()
          const checkIn = state.habitCheckIns.find(
            (c) => c.habitId === habitId && new Date(c.date).toDateString() === dStr
          )
          if (checkIn?.completed || dStr === dateStr) {
            streak++
            checkDate.setDate(checkDate.getDate() - 1)
          } else {
            break
          }
        }
      }

      const achievements = [7, 14, 21, 30, 60, 100]
      const achievement = completed && achievements.includes(streak)

      const notification = achievement && habit ? {
        type: 'achievement' as const,
        title: '连续打卡成就',
        message: `恭喜！"${habit.name}" 已连续打卡 ${streak} 天`,
      } : null

      if (existingIndex >= 0) {
        const newCheckIns = [...state.habitCheckIns]
        newCheckIns[existingIndex] = {
          ...newCheckIns[existingIndex],
          completed,
          note,
          value: value ?? newCheckIns[existingIndex].value,
        }
        return {
          habitCheckIns: newCheckIns,
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
      }
      return {
        habitCheckIns: [
          ...state.habitCheckIns,
          { id: generateId(), habitId, date, completed, note, value },
        ],
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
      import('@/lib/habit-goal-integration').then(({ HabitGoalIntegration }) => {
        HabitGoalIntegration.updateGoalProgressFromHabit(habitId)
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

      return {
        habits: state.habits.map(h =>
          h.id === habitId ? { ...h, streakFreezes: (h.streakFreezes || 0) + 1 } : h
        ),
        habitCheckIns: [
          ...state.habitCheckIns,
          { id: generateId(), habitId, date: yesterday, completed: true, note: '🧊 连续冻结保护' },
        ],
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
})
