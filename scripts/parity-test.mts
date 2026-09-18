const assert = (cond: boolean, msg: string) => { if (!cond) { console.error('FAIL:', msg); process.exit(1) } console.log('ok:', msg) }
import { parseEnhancedInput } from '../shared/core/smart-input.ts'
import { advanceRepeatDueDate, getNextDueDateString } from '../shared/core/recurring.ts'
import { pomodoroXp, XP_RULES } from '../shared/core/xp-rules.ts'

// ---- NLP（桌面修复过的语义必须在共享层成立）----
const p1 = parseEnhancedInput('每天读书')
assert(p1.repeat?.type === 'daily', '"每天" → daily（不误判为每周日）')

const p2 = parseEnhancedInput('每周一、三开会')
assert(p2.repeat?.type === 'weekly' && JSON.stringify(p2.repeat?.daysOfWeek) === '[1,3]', '"每周一、三" → weekly daysOfWeek [1,3]')

const p3 = parseEnhancedInput('明天下午3点写周报 #工作 @工作台 p1 🍅2')
assert(p3.dueDate && p3.dueDate > new Date(Date.now() - 86400000), '明天解析出日期')
assert(p3.startTime === '15:00', '下午3点 → 15:00')
assert(p3.priority === 'urgent', 'p1 → urgent')
assert(p3.tags?.[0] === '工作', '#工作 → 标签')
assert(p3.project === '工作台', '@工作台 → 项目')
assert(p3.estimatedPomodoros === 2, '🍅2 → 2 个番茄')
assert(p3.title.includes('写周报') && !p3.title.includes('明天'), '标题剥离修饰词')

// ---- 重复推进（桌面语义）----
const base = new Date(2026, 8, 7) // 2026-09-07 周一
const monWed = advanceRepeatDueDate({ type: 'weekly', interval: 1, daysOfWeek: [1, 3] }, base)
assert(monWed.getDay() === 3 && (monWed.getTime() - base.getTime()) / 86400000 === 2, '周一完成 → 推进到周三（而非 +7 天）')
const monthEnd = advanceRepeatDueDate({ type: 'monthly', interval: 1, dayOfMonth: 31 }, new Date(2026, 0, 31))
assert(monthEnd.getMonth() === 1 && monthEnd.getDate() === 28, '1月31日月重复 → 2月末钳制到28日')
const fri = new Date(2026, 8, 11) // 周五
const nextWorkday = advanceRepeatDueDate({ type: 'weekdays', interval: 1 }, fri)
assert(nextWorkday.getDay() === 1, '工作日重复周五完成 → 下周一')

// ---- Android 语义桥（endDate / paused / 字符串出入参）----
assert(getNextDueDateString({ type: 'daily', interval: 1, endDate: '2026-09-08' }, '2026-09-08') === null, '越过 endDate 返回 null')
assert(getNextDueDateString({ type: 'daily', interval: 1, paused: true }, '2026-09-07') === '2026-09-07', 'paused 返回原日期')

// ---- XP 口径 ----
assert(pomodoroXp(1500) === 25, '25 分钟番茄 = 25 分（按分钟，非固定 5）')
assert(pomodoroXp(30) === 1, '不足 1 分钟保底 1 分')
assert(XP_RULES.completeTask === 10 && XP_RULES.habitCheckIn === 5, '任务 10 分 / 习惯 5 分（桌面口径）')

console.log('ALL PARITY TESTS PASSED')
