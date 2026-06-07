import type { Task } from './types'

export interface ParsedTaskInput {
  title: string
  dueDate?: Date
  priority?: Task['priority']
  project?: string
  tags?: string[]
  estimatedPomodoros?: number
  energy?: 'low' | 'medium' | 'high'
  startTime?: string
  endTime?: string
}

const PRIORITY_PATTERNS = {
  urgent: [/p1/i, /紧急/i, /urgent/i, /‼️/g, /🔴/g],
  high: [/p2/i, /高优先/i, /high/i, /❗/g, /🟠/g],
  medium: [/p3/i, /中优先/i, /medium/i, /⚠️/g, /🟡/g],
  low: [/p4/i, /低优先/i, /low/i, /⬇️/g, /🟢/g],
}

const ENERGY_PATTERNS = {
  high: [/高能量/i, /high energy/i, /💪/g, /🔥/g],
  medium: [/中能量/i, /medium energy/i, /⚡/g],
  low: [/低能量/i, /low energy/i, /😴/g, /💤/g],
}

const DATE_PATTERNS = [
  { pattern: /今天|today/i, days: 0 },
  { pattern: /明天|tomorrow/i, days: 1 },
  { pattern: /后天/i, days: 2 },
  { pattern: /大后天/i, days: 3 },
  { pattern: /下周[一二三四五六日]|next week/i, days: 7 },
  { pattern: /下个月|next month/i, days: 30 },
]

const TIME_PATTERNS = [
  /(\d{1,2}):(\d{2})/,
  /(\d{1,2})点(\d{0,2})?/,
  /早上|上午|早晨/i,
  /中午/i,
  /下午|午后/i,
  /晚上|傍晚|夜晚/i,
]

const WEEKDAY_MAP: Record<string, number> = {
  '周一': 1, '星期一': 1, 'monday': 1, 'mon': 1,
  '周二': 2, '星期二': 2, 'tuesday': 2, 'tue': 2,
  '周三': 3, '星期三': 3, 'wednesday': 3, 'wed': 3,
  '周四': 4, '星期四': 4, 'thursday': 4, 'thu': 4,
  '周五': 5, '星期五': 5, 'friday': 5, 'fri': 5,
  '周六': 6, '星期六': 6, 'saturday': 6, 'sat': 6,
  '周日': 0, '星期日': 0, '星期天': 0, 'sunday': 0, 'sun': 0,
}

export function parseEnhancedInput(input: string): ParsedTaskInput {
  let title = input.trim()
  const result: ParsedTaskInput = { title }

  // 解析优先级
  for (const [priority, patterns] of Object.entries(PRIORITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(title)) {
        result.priority = priority as Task['priority']
        title = title.replace(pattern, '').trim()
        break
      }
    }
    if (result.priority) break
  }

  // 解析能量等级
  for (const [energy, patterns] of Object.entries(ENERGY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(title)) {
        result.energy = energy as 'low' | 'medium' | 'high'
        title = title.replace(pattern, '').trim()
        break
      }
    }
    if (result.energy) break
  }

  // 解析标签 (#标签)
  const tagMatches = title.match(/#(\S+)/g)
  if (tagMatches) {
    result.tags = tagMatches.map(t => t.slice(1))
    title = title.replace(/#\S+/g, '').trim()
  }

  // 解析项目 (@项目)
  const projectMatch = title.match(/@(\S+)/)
  if (projectMatch) {
    result.project = projectMatch[1]
    title = title.replace(/@\S+/g, '').trim()
  }

  // 解析番茄钟数 (数字🍅)
  const pomodoroMatch = title.match(/(\d+)\s*🍅/)
  if (pomodoroMatch) {
    result.estimatedPomodoros = parseInt(pomodoroMatch[1])
    title = title.replace(/\d+\s*🍅/g, '').trim()
  }

  // 解析日期
  const parsedDate = parseDate(title)
  if (parsedDate) {
    result.dueDate = parsedDate.date
    title = parsedDate.remainingText
  }

  // 解析时间
  const parsedTime = parseTime(title)
  if (parsedTime) {
    result.startTime = parsedTime.time
    title = parsedTime.remainingText
  }

  // 清理多余的空格
  result.title = title.replace(/\s+/g, ' ').trim()

  return result
}

function parseDate(text: string): { date: Date; remainingText: string } | null {
  const now = new Date()
  let date = new Date()
  let remainingText = text

  // 解析相对日期
  for (const { pattern, days } of DATE_PATTERNS) {
    if (pattern.test(text)) {
      date.setDate(date.getDate() + days)
      remainingText = text.replace(pattern, '').trim()
      return { date, remainingText }
    }
  }

  // 解析星期几
  for (const [weekday, dayOfWeek] of Object.entries(WEEKDAY_MAP)) {
    if (text.includes(weekday)) {
      const today = now.getDay()
      const daysUntil = (dayOfWeek - today + 7) % 7
      date.setDate(date.getDate() + (daysUntil === 0 ? 7 : daysUntil))
      remainingText = text.replace(new RegExp(weekday, 'g'), '').trim()
      return { date, remainingText }
    }
  }

  // 解析具体日期 (MM月DD日 或 MM-DD 或 MM/DD)
  const dateMatch = text.match(/(\d{1,2})[月\/\-](\d{1,2})[日号]?/)
  if (dateMatch) {
    const month = parseInt(dateMatch[1]) - 1
    const day = parseInt(dateMatch[2])
    date.setMonth(month)
    date.setDate(day)
    if (date < now) {
      date.setFullYear(date.getFullYear() + 1)
    }
    remainingText = text.replace(dateMatch[0], '').trim()
    return { date, remainingText }
  }

  // 解析具体日期 (YYYY年MM月DD日)
  const fullDateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})[日号]?/)
  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1])
    const month = parseInt(fullDateMatch[2]) - 1
    const day = parseInt(fullDateMatch[3])
    date = new Date(year, month, day)
    remainingText = text.replace(fullDateMatch[0], '').trim()
    return { date, remainingText }
  }

  return null
}

function parseTime(text: string): { time: string; remainingText: string } | null {
  let remainingText = text

  // 解析 HH:MM 格式
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0')
    const minutes = timeMatch[2]
    remainingText = text.replace(timeMatch[0], '').trim()
    return { time: `${hours}:${minutes}`, remainingText }
  }

  // 解析 X点 格式
  const hourMatch = text.match(/(\d{1,2})点(\d{0,2})?/)
  if (hourMatch) {
    const hours = hourMatch[1].padStart(2, '0')
    const minutes = hourMatch[2] ? hourMatch[2].padStart(2, '0') : '00'
    remainingText = text.replace(hourMatch[0], '').trim()
    return { time: `${hours}:${minutes}`, remainingText }
  }

  // 解析时间段
  if (/早上|上午|早晨/i.test(text)) {
    remainingText = text.replace(/早上|上午|早晨/gi, '').trim()
    return { time: '09:00', remainingText }
  }
  if (/中午/i.test(text)) {
    remainingText = text.replace(/中午/gi, '').trim()
    return { time: '12:00', remainingText }
  }
  if (/下午|午后/i.test(text)) {
    remainingText = text.replace(/下午|午后/gi, '').trim()
    return { time: '14:00', remainingText }
  }
  if (/晚上|傍晚|夜晚/i.test(text)) {
    remainingText = text.replace(/晚上|傍晚|夜晚/gi, '').trim()
    return { time: '19:00', remainingText }
  }

  return null
}

export function formatParsedTask(parsed: ParsedTaskInput): string {
  const parts = [parsed.title]

  if (parsed.dueDate) {
    const dateStr = parsed.dueDate.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
    })
    parts.push(`📅 ${dateStr}`)
  }

  if (parsed.startTime) {
    parts.push(`⏰ ${parsed.startTime}`)
  }

  if (parsed.priority) {
    const priorityEmoji = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }
    parts.push(`${priorityEmoji[parsed.priority]} ${parsed.priority}`)
  }

  if (parsed.project) {
    parts.push(`📁 ${parsed.project}`)
  }

  if (parsed.tags && parsed.tags.length > 0) {
    parts.push(`🏷️ ${parsed.tags.join(', ')}`)
  }

  if (parsed.estimatedPomodoros) {
    parts.push(`🍅 ${parsed.estimatedPomodoros}`)
  }

  if (parsed.energy) {
    const energyEmoji = {
      high: '🔥',
      medium: '⚡',
      low: '💤',
    }
    parts.push(`${energyEmoji[parsed.energy]} ${parsed.energy} energy`)
  }

  return parts.join(' | ')
}

export function validateParsedInput(parsed: ParsedTaskInput): {
  valid: boolean
  warnings: string[]
  suggestions: string[]
} {
  const warnings: string[] = []
  const suggestions: string[] = []

  // 检查标题是否为空
  if (!parsed.title || parsed.title.trim().length === 0) {
    return {
      valid: false,
      warnings: ['任务标题不能为空'],
      suggestions: ['请输入任务标题，例如："完成项目报告 #工作 p1"'],
    }
  }

  // 检查标题长度
  if (parsed.title.length > 100) {
    warnings.push('任务标题过长，建议控制在100字符以内')
  }

  // 检查是否设置了截止日期
  if (!parsed.dueDate && !parsed.startTime) {
    suggestions.push('建议添加截止日期，例如："明天" 或 "下周五"')
  }

  // 检查是否设置了优先级
  if (!parsed.priority) {
    suggestions.push('建议设置优先级，例如："p1" 或 "高优先"')
  }

  // 检查是否设置了项目
  if (!parsed.project) {
    suggestions.push('建议关联项目，例如："@工作"')
  }

  // 检查是否设置了预估番茄钟
  if (!parsed.estimatedPomodoros) {
    suggestions.push('建议预估番茄钟数，例如："2🍅"')
  }

  return {
    valid: true,
    warnings,
    suggestions,
  }
}

export function getSmartSuggestions(input: string): string[] {
  const suggestions: string[] = []
  const parsed = parseEnhancedInput(input)

  // 根据输入内容提供智能建议
  if (input.includes('会议') || input.includes('meeting')) {
    suggestions.push('添加会议室信息，例如："会议室A"')
    suggestions.push('设置提醒，例如："提前15分钟提醒"')
  }

  if (input.includes('报告') || input.includes('文档')) {
    suggestions.push('添加预估时间，例如："2🍅"')
    suggestions.push('关联项目，例如："@项目A"')
  }

  if (input.includes('学习') || input.includes('study')) {
    suggestions.push('设置能量等级，例如："高能量"')
    suggestions.push('添加标签，例如："#学习"')
  }

  return suggestions
}
