import { describe, it, expect } from 'vitest'
import { parseEnhancedInput, parseDate } from '@/lib/smart-input-enhanced'

describe('parseEnhancedInput 综合解析', () => {
  it('一次解析优先级/日期/番茄数/项目/标签', () => {
    const r = parseEnhancedInput('写方案 p1 明天 3🍅 @工作 #草稿')
    expect(r.priority).toBe('urgent')
    expect(r.estimatedPomodoros).toBe(3)
    expect(r.project).toBe('工作')
    expect(r.tags).toEqual(['草稿'])
    expect(r.title).toBe('写方案')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(r.dueDate!.getDate()).toBe(tomorrow.getDate())
  })

  it('重复语义：每天 / 每周一、周三 / 工作日', () => {
    const daily = parseEnhancedInput('每天 晨跑')
    expect(daily.repeat).toEqual({ type: 'daily', interval: 1 })
    expect(daily.title).toBe('晨跑')
    // 重复任务自动补今天的到期日，保证进入今日列表
    expect(daily.dueDate!.setHours(0, 0, 0, 0)).toBe(new Date().setHours(0, 0, 0, 0))

    const multi = parseEnhancedInput('每周一、周三 团队复盘')
    expect(multi.repeat?.type).toBe('weekly')
    expect(multi.repeat?.daysOfWeek).toEqual([1, 3])

    const workdays = parseEnhancedInput('工作日 站会')
    expect(workdays.repeat?.daysOfWeek).toEqual([1, 2, 3, 4, 5])
  })

  it('裸“周五”是一次性日期而非重复规则', () => {
    const r = parseEnhancedInput('周五 交材料')
    expect(r.repeat).toBeUndefined()
    expect(r.dueDate).toBeInstanceOf(Date)
    expect(r.dueDate!.getDay()).toBe(5)
    expect(r.title).toBe('交材料')
  })

  it('提醒语义：提前N分钟提醒', () => {
    const r = parseEnhancedInput('交周报 提前30分钟提醒')
    expect(r.reminderMinutesBefore).toBe(30)
    expect(r.title).toBe('交周报')
  })

  it('时刻与时间段', () => {
    expect(parseEnhancedInput('和设计组开会 下午3点').startTime).toBe('15:00')
    const range = parseEnhancedInput('评审 14:00-15:30')
    expect(range.startTime).toBe('14:00')
    expect(range.endTime).toBe('15:30')
  })

  it('能量等级与番茄钟多种写法', () => {
    const e = parseEnhancedInput('深度写作 高能量 🍅4')
    expect(e.energy).toBe('high')
    expect(e.estimatedPomodoros).toBe(4)
    expect(parseEnhancedInput('整理桌面 2个番茄').estimatedPomodoros).toBe(2)
  })
})

describe('parseDate', () => {
  it('相对日期：后天 / 下个月取下月 1 日', () => {
    const d2 = parseDate('大后天 体检')!.date
    const expectD = new Date()
    expectD.setDate(expectD.getDate() + 3)
    expect(d2.getDate()).toBe(expectD.getDate())

    const now = new Date()
    const nm = parseDate('下个月 续约')!.date
    expect(nm.getMonth()).toBe((now.getMonth() + 1) % 12)
    expect(nm.getDate()).toBe(1)
  })

  it('MM-DD 已过则顺延到明年', () => {
    const past = parseDate('01-05 年假')!.date
    expect(past.getFullYear()).toBe(new Date().getFullYear() + 1)
  })

  it('无日期词返回 null', () => {
    expect(parseDate('普通标题')).toBeNull()
  })
})
