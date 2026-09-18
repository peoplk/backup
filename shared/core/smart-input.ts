/**
 * 跨端共享的智能输入解析器（单一来源）：桌面与移动端共用同一套 NLP 规则。 跨端共享层不得依赖任一端的实体类型，优先级用字面量联合 */
export type SharedTaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface ParsedRepeatRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  daysOfWeek?: number[]
}

export interface ParsedTaskInput {
  title: string
  dueDate?: Date
  priority?: SharedTaskPriority
  project?: string
  tags?: string[]
  estimatedPomodoros?: number
  energy?: 'low' | 'medium' | 'high'
  startTime?: string
  endTime?: string
  repeat?: ParsedRepeatRule
  reminderMinutesBefore?: number
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
  { pattern: /明早|明晨/i, days: 1 },
  { pattern: /后天/i, days: 2 },
  { pattern: /大后天/i, days: 3 },
  { pattern: /下周[一二三四五六日天]|next week/i, days: 7 },
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
        result.priority = priority as SharedTaskPriority
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

  // 解析番茄钟数（2🍅 / 🍅2 / 2个番茄 三种写法，兼容两端历史习惯）
  const pomodoroMatch = title.match(/(\d+)\s*🍅/) || title.match(/🍅\s*(\d+)/) || title.match(/(\d+)\s*个?番茄/)
  if (pomodoroMatch) {
    result.estimatedPomodoros = parseInt(pomodoroMatch[1])
    title = title.replace(/\d+\s*🍅/g, '').trim()
    title = title.replace(/🍅\s*\d+/g, '').trim()
    title = title.replace(/\d+\s*个?番茄/g, '').trim()
  }

  // 解析重复规则（每天 / 工作日 / 每周一、三 / 每3天 / 每周 / 每月 / 每年）
  const parsedRepeat = parseRepeat(title)
  if (parsedRepeat) {
    result.repeat = parsedRepeat.rule
    title = parsedRepeat.remainingText
    // 重复任务补一个起始到期日：按星期几的取下一个命中日，其余取今天，
    // 保证任务能出现在"今天/智能列表"并可触发提醒
    if (!result.dueDate) {
      if (parsedRepeat.rule.type === 'weekly' && parsedRepeat.rule.daysOfWeek?.length) {
        result.dueDate = nextWeekdayOccurrence(parsedRepeat.rule.daysOfWeek)
      } else {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        result.dueDate = today
      }
    }
  }

  // 解析提醒（提前15分钟提醒 / 15分钟前提醒）
  const reminderMatch = title.match(/(?:提前\s*(\d{1,3})\s*分钟|(\d{1,3})\s*分钟前)\s*(?:再)?提醒/)
  if (reminderMatch) {
    result.reminderMinutesBefore = parseInt(reminderMatch[1] || reminderMatch[2], 10)
    title = title.replace(reminderMatch[0], '').trim()
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
    if (parsedTime.endTime) result.endTime = parsedTime.endTime
    title = parsedTime.remainingText
  }

  // 清理多余的空格
  result.title = title.replace(/\s+/g, ' ').trim()

  return result
}

/** 解析重复规则：每天/每日、工作日、每周X（可多选，须以"每"引导）、每N天/周、每周/每月/每年
 *  裸"周X/星期X"（无"每"字）不是重复规则，留给日期解析作为一次性日期。 */
function parseRepeat(text: string): { rule: ParsedRepeatRule; remainingText: string } | null {
  // 每周末 → 每周六、周日
  if (/每个?周末/.test(text)) {
    return {
      rule: { type: 'weekly', interval: 1, daysOfWeek: [0, 6] },
      remainingText: text.replace(/每个?周末/, '').trim(),
    }
  }
  // 每周多选："每周一、周三" / "每周一和周四" / "每周一二三五"（连续多日字）
  const weekdayGroup = text.match(/每(?:周|星期)((?:[一二三四五六日天]|周|星期|[、,和及与]|\s)+)/)
  if (weekdayGroup) {
    const dayChars = weekdayGroup[1].match(/[一二三四五六日天]/g) || []
    if (dayChars.length > 0) {
      const nameMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
      const daysOfWeek = [...new Set(dayChars.map(c => nameMap[c]))].sort((a, b) => a - b)
      return {
        rule: { type: 'weekly', interval: 1, daysOfWeek },
        remainingText: text.replace(weekdayGroup[0], '').trim(),
      }
    }
    // 纯"每周"（未指明星期几）
    return {
      rule: { type: 'weekly', interval: 1 },
      remainingText: text.replace(weekdayGroup[0], '').trim(),
    }
  }

  if (/工作日/.test(text)) {
    return {
      rule: { type: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] },
      remainingText: text.replace(/工作日/g, '').trim(),
    }
  }

  const everyNDays = text.match(/每个?\s*(\d{1,2})\s*天/)
  if (everyNDays) {
    return {
      rule: { type: 'daily', interval: parseInt(everyNDays[1], 10) || 1 },
      remainingText: text.replace(everyNDays[0], '').trim(),
    }
  }

  const everyNWeeks = text.match(/每个?\s*(\d{1,2})\s*周/)
  if (everyNWeeks) {
    return {
      rule: { type: 'weekly', interval: parseInt(everyNWeeks[1], 10) || 1 },
      remainingText: text.replace(everyNWeeks[0], '').trim(),
    }
  }

  if (/每天|每日|every day/i.test(text)) {
    return {
      rule: { type: 'daily', interval: 1 },
      remainingText: text.replace(/每天|每日|every day/i, '').trim(),
    }
  }

  if (/每月|every month/i.test(text)) {
    return {
      rule: { type: 'monthly', interval: 1 },
      remainingText: text.replace(/每月|every month/i, '').trim(),
    }
  }

  if (/每年|every year/i.test(text)) {
    return {
      rule: { type: 'yearly', interval: 1 },
      remainingText: text.replace(/每年|every year/i, '').trim(),
    }
  }

  if (/每周|每星期|every week/i.test(text)) {
    return {
      rule: { type: 'weekly', interval: 1 },
      remainingText: text.replace(/每周|每星期|every week/i, '').trim(),
    }
  }

  return null
}

/** 返回今天或未来 7 天内第一个命中给定星期几的日期（00:00） */
function nextWeekdayOccurrence(daysOfWeek: number[]): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    if (daysOfWeek.includes(d.getDay())) return d
    d.setDate(d.getDate() + 1)
  }
  return d
}

export function parseDate(text: string): { date: Date; remainingText: string } | null {
  const now = new Date()
  let date = new Date()
  let remainingText = text

  // 下个月 → 下月 1 日（而非 +30 天）
  if (/下个月|下月|next month/i.test(text)) {
    date = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    remainingText = text.replace(/下个月|下月|next month/i, '').trim()
    return { date, remainingText }
  }

  // 周末 → 下一个周六
  if (/周末/.test(text)) {
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7
    date.setDate(date.getDate() + daysUntilSaturday)
    remainingText = text.replace(/周末/, '').trim()
    return { date, remainingText }
  }

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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseTime(text: string): { time: string; endTime?: string; remainingText: string } | null {
  let remainingText = text

  // 解析时间段 HH:MM-HH:MM（含 至/到/~ 连接）
  const rangeMatch = text.match(/(\d{1,2})[:：](\d{2})\s*(?:-|—|~|至|到)\s*(\d{1,2})[:：](\d{2})/)
  if (rangeMatch) {
    const time = `${pad2(parseInt(rangeMatch[1], 10))}:${rangeMatch[2]}`
    const endTime = `${pad2(parseInt(rangeMatch[3], 10))}:${rangeMatch[4]}`
    remainingText = text.replace(rangeMatch[0], '').trim()
    return { time, endTime, remainingText }
  }

  // 解析 HH:MM 格式
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const hours = pad2(parseInt(timeMatch[1], 10))
    const minutes = timeMatch[2]
    remainingText = text.replace(timeMatch[0], '').trim()
    return { time: `${hours}:${minutes}`, remainingText }
  }

  // 组合解析：时段词 + 数字时刻（"下午3点"→15:00、"晚上8点半"→20:30，时段词不再残留标题）
  const comboMatch = text.match(/(凌晨|清晨|早上|早晨|上午|中午|午后|下午|傍晚|晚上|夜晚)?\s*(\d{1,2})\s*[点时]\s*(半|\d{1,2}\s*分?)?/)
  if (comboMatch && comboMatch[0].trim()) {
    let hour = parseInt(comboMatch[2], 10)
    const period = comboMatch[1]
    let minute = 0
    if (comboMatch[3]) {
      const m = comboMatch[3].trim()
      minute = m === '半' ? 30 : parseInt(m.replace(/\D/g, ''), 10) || 0
    }
    if (period === '下午' || period === '午后' || period === '傍晚' || period === '晚上' || period === '夜晚') {
      if (hour < 12) hour += 12
    } else if (period === '凌晨' && hour === 12) {
      hour = 0
    }
    if (hour <= 23 && minute <= 59) {
      remainingText = text.replace(comboMatch[0], '').trim()
      return { time: `${pad2(hour)}:${pad2(minute)}`, remainingText }
    }
  }

  // 仅时段词 → 默认时刻
  const periodDefaults: Array<[RegExp, string]> = [
    [/凌晨|清晨/, '06:00'],
    [/早上|早晨|上午/, '09:00'],
    [/中午/, '12:00'],
    [/下午|午后/, '14:00'],
    [/晚上|傍晚|夜晚|今晚/, '19:00'],
  ]
  for (const [pattern, time] of periodDefaults) {
    if (pattern.test(text)) {
      remainingText = text.replace(new RegExp(pattern.source, 'gi'), '').trim()
      return { time, remainingText }
    }
  }

  return null
}

/** 将解析结果映射为 addTask 可用的字段（SmartQuickAddTask / QuickAddTask / QuickCapture 共用） */
export function buildParsedTaskFields(parsed: ParsedTaskInput) {
  return {
    priority: parsed.priority || ('medium' as const),
    project: parsed.project || '',
    tags: parsed.tags || [],
    dueDate: parsed.dueDate,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    energy: parsed.energy,
    repeatRule: parsed.repeat
      ? {
          type: parsed.repeat.type,
          interval: parsed.repeat.interval,
          ...(parsed.repeat.daysOfWeek && parsed.repeat.daysOfWeek.length > 0
            ? { daysOfWeek: parsed.repeat.daysOfWeek }
            : {}),
        }
      : undefined,
    reminders: parsed.reminderMinutesBefore
      ? [{
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'before-due' as const,
          minutesBefore: parsed.reminderMinutesBefore,
          enabled: true,
        }]
      : undefined,
  }
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
    parts.push(`⏰ ${parsed.startTime}${parsed.endTime ? ` - ${parsed.endTime}` : ''}`)
  }

  if (parsed.repeat) {
    const typeLabel = { daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' }[parsed.repeat.type]
    const dayNames = ['日', '一', '二', '三', '四', '五', '六']
    const detail = parsed.repeat.daysOfWeek?.length
      ? parsed.repeat.daysOfWeek.map(d => `周${dayNames[d]}`).join('、')
      : parsed.repeat.interval > 1 ? `${parsed.repeat.interval}` : ''
    parts.push(`🔁 ${typeLabel}${detail}`)
  }

  if (parsed.reminderMinutesBefore) {
    parts.push(`🔔 提前${parsed.reminderMinutesBefore}分钟`)
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
