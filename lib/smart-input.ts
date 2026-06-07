interface ParsedTask {
  title: string
  dueDate?: Date
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  tags: string[]
  project?: string
  type?: 'task' | 'event' | 'reminder'
  startTime?: string
  endTime?: string
}

export function parseSmartInput(input: string): ParsedTask {
  let remaining = input.trim()
  const result: ParsedTask = { title: '', tags: [] }

  const priorityMatch = remaining.match(/\s+p([1-4])\b/i)
  if (priorityMatch) {
    const priorityMap: Record<string, 'urgent' | 'high' | 'medium' | 'low'> = {
      '1': 'urgent',
      '2': 'high',
      '3': 'medium',
      '4': 'low',
    }
    result.priority = priorityMap[priorityMatch[1]]
    remaining = remaining.replace(priorityMatch[0], '')
  }

  const tagMatches = remaining.matchAll(/#(\S+)/g)
  for (const match of tagMatches) {
    result.tags.push(match[1])
    remaining = remaining.replace(match[0], '')
  }

  const projectMatch = remaining.match(/\+(\S+)/)
  if (projectMatch) {
    result.project = projectMatch[1]
    remaining = remaining.replace(projectMatch[0], '')
  }

  const typeMatch = remaining.match(/!(task|event|reminder|日程|提醒)/i)
  if (typeMatch) {
    const typeStr = typeMatch[1].toLowerCase()
    if (typeStr === 'event' || typeStr === '日程') result.type = 'event'
    else if (typeStr === 'reminder' || typeStr === '提醒') result.type = 'reminder'
    else result.type = 'task'
    remaining = remaining.replace(typeMatch[0], '')
  }

  const timeRangeMatch = remaining.match(/(\d{1,2}:\d{2})\s*[-~到至]\s*(\d{1,2}:\d{2})/)
  if (timeRangeMatch) {
    result.startTime = timeRangeMatch[1]
    result.endTime = timeRangeMatch[2]
    if (!result.type) result.type = 'event'
    remaining = remaining.replace(timeRangeMatch[0], '')
  }

  const timeMatch = remaining.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch && !result.startTime) {
    const hours = parseInt(timeMatch[1])
    const minutes = parseInt(timeMatch[2])
    if (!result.dueDate) {
      const date = new Date()
      date.setHours(hours, minutes, 0, 0)
      result.dueDate = date
    } else {
      result.dueDate.setHours(hours, minutes, 0, 0)
    }
    remaining = remaining.replace(timeMatch[0], '')
  }

  const dateInfo = parseDateKeywords(remaining)
  if (dateInfo.date) {
    result.dueDate = dateInfo.date
    remaining = dateInfo.remaining
  }

  result.title = remaining.replace(/\s+/g, ' ').trim()

  if (result.dueDate && result.startTime) {
    const [h, m] = result.startTime.split(':').map(Number)
    result.dueDate.setHours(h, m, 0, 0)
  }

  return result
}

function parseDateKeywords(input: string): { date?: Date; remaining: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let remaining = input

  const patterns: { pattern: RegExp; getDate: () => Date }[] = [
    {
      pattern: /今天/g,
      getDate: () => {
        const d = new Date(today)
        return d
      },
    },
    {
      pattern: /明天/g,
      getDate: () => {
        const d = new Date(today)
        d.setDate(d.getDate() + 1)
        return d
      },
    },
    {
      pattern: /后天/g,
      getDate: () => {
        const d = new Date(today)
        d.setDate(d.getDate() + 2)
        return d
      },
    },
    {
      pattern: /大后天/g,
      getDate: () => {
        const d = new Date(today)
        d.setDate(d.getDate() + 3)
        return d
      },
    },
    {
      pattern: /下周一/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntilMonday = ((8 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntilMonday)
        return d
      },
    },
    {
      pattern: /下周二/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntil = ((9 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntil)
        return d
      },
    },
    {
      pattern: /下周三/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntil = ((10 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntil)
        return d
      },
    },
    {
      pattern: /下周四/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntil = ((11 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntil)
        return d
      },
    },
    {
      pattern: /下周五/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntil = ((12 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntil)
        return d
      },
    },
    {
      pattern: /下周六/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntil = ((13 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntil)
        return d
      },
    },
    {
      pattern: /下周日/g,
      getDate: () => {
        const d = new Date(today)
        const daysUntil = ((7 - d.getDay()) % 7) || 7
        d.setDate(d.getDate() + daysUntil)
        return d
      },
    },
    {
      pattern: /下个?月/g,
      getDate: () => {
        const d = new Date(today)
        d.setMonth(d.getMonth() + 1)
        d.setDate(1)
        return d
      },
    },
    {
      pattern: /周[一二三四五六日]/g,
      getDate: () => {
        const dayMap: Record<string, number> = {
          '周一': 1, '周二': 2, '周三': 3, '周四': 4,
          '周五': 5, '周六': 6, '周日': 0,
        }
        const match = remaining.match(/周([一二三四五六日])/)
        if (match) {
          const targetDay = dayMap[`周${match[1]}`]
          const d = new Date(today)
          const currentDay = d.getDay()
          let diff = targetDay - currentDay
          if (diff <= 0) diff += 7
          d.setDate(d.getDate() + diff)
          return d
        }
        return new Date(today)
      },
    },
  ]

  for (const { pattern, getDate } of patterns) {
    if (pattern.test(remaining)) {
      const date = getDate()
      remaining = remaining.replace(pattern, '')
      return { date, remaining }
    }
  }

  const dateStrMatch = remaining.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dateStrMatch) {
    const month = parseInt(dateStrMatch[1]) - 1
    const day = parseInt(dateStrMatch[2])
    const year = dateStrMatch[3] ? parseInt(dateStrMatch[3]) + (parseInt(dateStrMatch[3]) < 100 ? 2000 : 0) : today.getFullYear()
    const date = new Date(year, month, day)
    remaining = remaining.replace(dateStrMatch[0], '')
    return { date, remaining }
  }

  const inDaysMatch = remaining.match(/(\d+)\s*天后/)
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1])
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    remaining = remaining.replace(inDaysMatch[0], '')
    return { date: d, remaining }
  }

  return { remaining }
}

export function getSmartInputHint(input: string): string[] {
  const hints: string[] = []
  const parsed = parseSmartInput(input)

  if (!input) {
    hints.push('输入任务名称，支持自然语言')
    hints.push('例如：明天3点开会 p1 #工作 +项目A')
    return hints
  }

  if (parsed.dueDate) {
    hints.push(`📅 ${parsed.dueDate.toLocaleDateString('zh-CN')}`)
  }
  if (parsed.priority) {
    const labels: Record<string, string> = { urgent: '🔴 紧急', high: '🟠 高', medium: '🔵 中', low: '⚪ 低' }
    hints.push(labels[parsed.priority])
  }
  if (parsed.tags.length > 0) {
    hints.push(`🏷️ ${parsed.tags.join(', ')}`)
  }
  if (parsed.project) {
    hints.push(`📁 ${parsed.project}`)
  }
  if (parsed.startTime) {
    hints.push(`🕐 ${parsed.startTime}${parsed.endTime ? ` - ${parsed.endTime}` : ''}`)
  }
  if (parsed.type === 'event') {
    hints.push('📋 日程')
  } else if (parsed.type === 'reminder') {
    hints.push('🔔 提醒')
  }

  return hints
}
