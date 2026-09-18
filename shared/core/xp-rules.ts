/**
 * 经验/积分规则（跨端单一来源，以桌面端口径为准）：
 * - 完成任务 +10；完成子任务 +2
 * - 番茄按实际分钟计分（不足 1 分钟按 1 分），而非固定值
 * - 习惯打卡 +5；写日记 +5；添加任务 +1；完成目标 +50
 */
export const XP_RULES = {
  completeTask: 10,
  completeSubTask: 2,
  pomodoroPerMinute: 1,
  pomodoroMinPoints: 1,
  habitCheckIn: 5,
  journalWrite: 5,
  addTask: 1,
  completeGoal: 50,
} as const

/** 番茄会话经验：按时长折算（duration 单位为秒） */
export function pomodoroXp(durationSeconds: number): number {
  const minutes = Math.round((durationSeconds || 0) / 60)
  return Math.max(XP_RULES.pomodoroMinPoints, minutes * XP_RULES.pomodoroPerMinute)
}
