import type { Achievement } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { LEVEL_THRESHOLDS, LEVEL_TITLES, levelFromPoints } from '@/lib/level-config'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createAchievementSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  achievements: [] as Achievement[],
  userLevel: { level: 1, totalPoints: 0, currentLevelPoints: 0, nextLevelPoints: 100, title: '新手' },
  // 升级庆祝：等级提升时置位（瞬态，不持久化），弹窗关闭后清空
  levelUpCelebration: null as { level: number; title: string } | null,
  clearLevelUpCelebration: () => set({ levelUpCelebration: null }),
  // 统一委托给 gamification 主系统（动态 import 避免循环依赖）
  checkAchievements: () => {
    import('../../gamification').then(({ checkAchievementsNow }) => {
      checkAchievementsNow()
    })
  },
  addPoints: (points: number) =>
    set((state) => {
      const newTotalPoints = state.userLevel.totalPoints + points

      const newLevel = levelFromPoints(newTotalPoints)
      const currentLevelThreshold = LEVEL_THRESHOLDS[newLevel - 1] ?? 0
      const nextThreshold = LEVEL_THRESHOLDS[newLevel]
      // 已到最高级时不再有下一级阈值，避免 NaN
      const nextLevelPoints = nextThreshold === undefined ? 0 : nextThreshold - currentLevelThreshold

      // 检测跨级：一次性多积分也可能连升，取新等级与庆祝等级的较大者
      const celebrateLevel = state.levelUpCelebration?.level ?? 0
      const leveledUp = newLevel > state.userLevel.level && newLevel > celebrateLevel

      return {
        userLevel: {
          level: newLevel,
          totalPoints: newTotalPoints,
          currentLevelPoints: newTotalPoints - currentLevelThreshold,
          nextLevelPoints,
          title: LEVEL_TITLES[newLevel - 1] || '创世者',
        },
        ...(leveledUp
          ? { levelUpCelebration: { level: newLevel, title: LEVEL_TITLES[newLevel - 1] || '创世者' } }
          : {}),
      }
    }),
})
