const assert = (cond: boolean, msg: string) => { if (!cond) { console.error('FAIL:', msg); process.exit(1) } console.log('ok:', msg) }
import { AMBIENT_SOUNDS, resolveFocusSoundKey, SOUND_KEY_ALIASES } from '../shared/core/focus-sound-engine.ts'
import { calculateHabitStreak } from './_test-shared/habit-streak.ts'

// ---- 音色目录与别名解析（Android 历史 key 全部可播放）----
assert(AMBIENT_SOUNDS.length === 24, '音色目录 24 种（桌面 13 + Android 移植 11）')
const androidKeys = ['rain','storm','ocean','stream','forest','wind','cafe','train','subway','street','whitenoise','pinknoise','brownnoise','binaural','fireplace','clock','fountain','temple','nightbug','lullaby','nightsea','starlight']
const unresolved = androidKeys.filter(k => resolveFocusSoundKey(k) === null)
assert(unresolved.length === 0, `Android 全部 22 个历史 key 可解析（未解析: ${unresolved.join(',')}）`)
assert(resolveFocusSoundKey('whitenoise')?.kind === 'ambient' && resolveFocusSoundKey('whitenoise')?.id === 'white', 'whitenoise → white')
assert(resolveFocusSoundKey('ocean')?.id === 'waves', 'ocean → waves')
assert(resolveFocusSoundKey('binaural')?.kind === 'music' && resolveFocusSoundKey('binaural')?.id === 'alpha', 'binaural → Alpha 节拍')
assert(resolveFocusSoundKey('nonexistent') === null, '未知 key 返回 null')

// ---- 连胜引擎（调度感知语义）----
const daily = { frequency: 'daily' as const, createdAt: '2026-01-01' }
const today = new Date(2026, 8, 7) // 周一
const iso = (d: Date) => d.toDateString()
const day = (offset: number) => new Date(today.getTime() - offset * 86400000)
// 昨天与前天完成、今天未打 → current=2（今日宽限不断链）
const r1 = calculateHabitStreak(daily, [
  { date: iso(day(1)), completed: true },
  { date: iso(day(2)), completed: true },
], today)
assert(r1.current === 2 && r1.best >= 2, '今日未打不断链（宽限），current=2')
// 前天漏打 → 断链
const r2 = calculateHabitStreak(daily, [
  { date: iso(day(1)), completed: true },
  { date: iso(day(3)), completed: true },
], today)
assert(r2.current === 1, '漏打日断链 current=1')
// 每周 3 次弹性目标：本周已达标 + 上周达标 → 连胜 2 周
const flex = { frequency: 'weekly' as const, weeklyTarget: 3, createdAt: '2026-01-01' }
const weekStart = new Date(today)
weekStart.setDate(weekStart.getDate() - ((today.getDay() + 6) % 7))
const checkIns = [0, 1, 2, -1, -2, -3].flatMap((o) => { const base = new Date(weekStart.getTime() + o * 86400000); const prev = new Date(base.getTime() - 7 * 86400000); return [{ date: iso(base), completed: true }, { date: iso(prev), completed: true }] })
const r3 = calculateHabitStreak(flex, checkIns, today)
assert(r3.unit === '周' && r3.current === 3 && r3.best >= 3, '弹性目标按达标周计连胜（3 周）')

console.log('ALL ENGINE TESTS PASSED')
