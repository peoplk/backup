import type { Achievement, ShopItem } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { LEVEL_THRESHOLDS, LEVEL_TITLES, levelFromPoints } from '@/lib/level-config'

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'freeze-slot',
    name: '冻结扩容卡',
    description: '为目标习惯永久增加 1 个连续冻结名额',
    icon: '🧊',
    cost: 150,
  },
  {
    id: 'freeze-reset',
    name: '冻结恢复卡',
    description: '重置目标习惯已使用的连续冻结次数',
    icon: '❄️',
    cost: 80,
  },
]

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createAchievementSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  achievements: [] as Achievement[],
  userLevel: { level: 1, totalPoints: 0, currentLevelPoints: 0, nextLevelPoints: 100, title: '新手', coins: 0 },
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
          // 硬币随经验同步发放，但可被商店消耗（与 totalPoints 只增账本解耦）
          coins: (state.userLevel.coins ?? 0) + points,
        },
        ...(leveledUp
          ? { levelUpCelebration: { level: newLevel, title: LEVEL_TITLES[newLevel - 1] || '创世者' } }
          : {}),
      }
    }),
  /** 硬币商店：消耗硬币兑换习惯冻结道具，返回结果供 UI 提示 */
  purchaseShopItem: (itemId: ShopItem['id'], habitId: string) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId)
    const state = get()
    if (!item) return { ok: false, message: '未知道具' }
    const habit = state.habits.find((h) => h.id === habitId)
    if (!habit) return { ok: false, message: '请先选择目标习惯' }
    const balance = state.userLevel.coins ?? 0
    if (balance < item.cost) return { ok: false, message: `硬币不足（还需 ${item.cost - balance}）` }

    const currentFreezes = habit.streakFreezes || 0
    const maxFreezes = habit.maxStreakFreezes || 3
    if (itemId === 'freeze-slot' && maxFreezes >= 10) return { ok: false, message: '该习惯冻结名额已达上限（10）' }
    if (itemId === 'freeze-reset' && currentFreezes === 0) return { ok: false, message: '该习惯没有已使用的冻结次数' }

    set((s) => ({
      userLevel: { ...s.userLevel, coins: (s.userLevel.coins ?? 0) - item.cost },
      habits: s.habits.map((h) =>
        h.id === habitId
          ? itemId === 'freeze-slot'
            ? { ...h, maxStreakFreezes: (h.maxStreakFreezes || 3) + 1 }
            : { ...h, streakFreezes: 0 }
          : h
      ),
    }))
    return { ok: true, message: `已为「${habit.name}」兑换${item.name}` }
  },
})
