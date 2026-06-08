import { parseEnhancedInput, parseDate, type ParsedTaskInput } from './smart-input-enhanced'

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

function mapToParsedTask(parsed: ParsedTaskInput): ParsedTask {
  return {
    title: parsed.title,
    dueDate: parsed.dueDate,
    priority: parsed.priority,
    tags: parsed.tags ?? [],
    project: parsed.project,
    startTime: parsed.startTime,
  }
}

export function parseSmartInput(input: string): ParsedTask {
  const parsed = parseEnhancedInput(input)
  return mapToParsedTask(parsed)
}

export function parseDateKeywords(input: string): { date?: Date; remaining: string } {
  const result = parseDate(input)
  if (!result) {
    return { remaining: input }
  }
  return { date: result.date, remaining: result.remainingText }
}

export function getSmartInputHint(input: string): string[] {
  const hints: string[] = []
  const parsed = parseEnhancedInput(input)

  if (!input) {
    hints.push('输入任务名称，支持自然语言')
    hints.push('例如：明天3点开会 p1 #工作 @项目A 或 +项目A')
    return hints
  }

  if (parsed.dueDate) {
    hints.push(`📅 ${parsed.dueDate.toLocaleDateString('zh-CN')}`)
  }
  if (parsed.priority) {
    const labels: Record<string, string> = { urgent: '🔴 紧急', high: '🟠 高', medium: '🔵 中', low: '⚪ 低' }
    hints.push(labels[parsed.priority])
  }
  if (parsed.tags && parsed.tags.length > 0) {
    hints.push(`🏷️ ${parsed.tags.join(', ')}`)
  }
  if (parsed.project) {
    hints.push(`📁 ${parsed.project}`)
  }
  if (parsed.startTime) {
    hints.push(`🕐 ${parsed.startTime}`)
  }
  if (parsed.estimatedPomodoros) {
    hints.push(`🍅 ${parsed.estimatedPomodoros}`)
  }
  if (parsed.energy) {
    const energyLabels: Record<string, string> = { high: '🔥 高能量', medium: '⚡ 中能量', low: '💤 低能量' }
    hints.push(energyLabels[parsed.energy])
  }

  return hints
}
