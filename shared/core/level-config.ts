/**
 * 等级曲线单一配置源（gamification.ts 与 achievement-slice.ts 共用，避免双份常量漂移）。
 * 20 级，60000 分封顶。
 */
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500,
  10000, 13000, 16500, 20500, 25000, 30000, 36000, 43000, 51000, 60000
]

export const LEVEL_TITLES = [
  '新手', '入门', '学徒', '熟练', '精通',
  '专家', '大师', '宗师', '传奇', '神话',
  '至尊', '圣者', '贤者', '智者', '王者',
  '帝皇', '天尊', '神灵', '至尊神', '创世者'
]

/** 积分 → 等级（gamification 与 achievement-slice 共用，保证两处口径一致） */
export function levelFromPoints(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      return i + 1
    }
  }
  return 1
}
