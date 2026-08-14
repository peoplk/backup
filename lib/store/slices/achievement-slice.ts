import type { Achievement } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

// 与 gamification.ts 保持一致的等级曲线（20 级，60000 封顶）
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

export const createAchievementSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  achievements: [] as Achievement[],
  userLevel: { level: 1, totalPoints: 0, currentLevelPoints: 0, nextLevelPoints: 100, title: '新手' },
  // 统一委托给 gamification 主系统（动态 import 避免循环依赖）
  checkAchievements: () => {
    import('../../gamification').then(({ checkAchievementsNow }) => {
      checkAchievementsNow()
    })
  },
  addPoints: (points: number) =>
    set((state) => {
      const newTotalPoints = state.userLevel.totalPoints + points
      
      let newLevel = 1
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (newTotalPoints >= LEVEL_THRESHOLDS[i]) {
          newLevel = i + 1
          break
        }
      }

      const currentLevelPoints = newTotalPoints - LEVEL_THRESHOLDS[newLevel - 1]
      const nextLevelPoints = LEVEL_THRESHOLDS[newLevel] - LEVEL_THRESHOLDS[newLevel - 1]

      return {
        userLevel: {
          level: newLevel,
          totalPoints: newTotalPoints,
          currentLevelPoints,
          nextLevelPoints,
          title: LEVEL_TITLES[newLevel - 1] || '创世者',
        },
      }
    }),
})
