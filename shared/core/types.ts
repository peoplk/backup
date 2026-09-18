/**
 * 跨端共享层的最小结构类型：
 * shared/ 不得 import 主库或 android-app 的任何代码（保持零依赖、双端可用），
 * 因此这里用结构兼容的最小类型描述习惯实体——两端的真实类型均可直接赋值。
 */

/** 与主库 Habit / Android 习惯实体结构兼容的最小面 */
export interface SharedHabit {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  weeklyPattern?: number[]
  intervalDays?: number
  weeklyTarget?: number
  monthlyTarget?: number
  /** 两端存储形态不同（Date / ISO 字符串），统一在此兼容 */
  createdAt: Date | string
}

/** 与 HabitCheckIn 结构兼容的最小面 */
export interface SharedHabitCheckIn {
  date: Date | string
  completed: boolean
}
