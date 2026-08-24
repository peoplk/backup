import type { Task, Anniversary } from '@/lib/types'

function formatDateToICS(date: Date | string): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  return dateObj.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** 全天事件的日期格式：使用本地日历日期，避免 UTC 转换导致日期偏移 */
function formatLocalDateToICS(date: Date | string): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,\n]/g, (match) => {
    if (match === '\n') return '\\n'
    return '\\' + match
  })
}

export function generateICS(tasks: Task[], anniversaries: Anniversary[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FocusFlow//Productivity App//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FocusFlow',
    'X-WR-TIMEZONE:Asia/Shanghai',
  ]

  tasks.forEach((task) => {
    if (!task.dueDate) return

    const startDate = new Date(task.dueDate)
    const endDate = new Date(startDate)

    if (task.type === 'event' && task.startTime && task.endTime) {
      const [startH, startM] = task.startTime.split(':').map(Number)
      const [endH, endM] = task.endTime.split(':').map(Number)
      startDate.setHours(startH, startM, 0)
      endDate.setHours(endH, endM, 0)

      lines.push('BEGIN:VEVENT')
      lines.push(`DTSTART:${formatDateToICS(startDate)}`)
      lines.push(`DTEND:${formatDateToICS(endDate)}`)
    } else {
      endDate.setDate(endDate.getDate() + 1)

      lines.push('BEGIN:VEVENT')
      lines.push(`DTSTART;VALUE=DATE:${formatLocalDateToICS(startDate)}`)
      lines.push(`DTEND;VALUE=DATE:${formatLocalDateToICS(endDate)}`)
    }

    lines.push(`UID:task-${task.id}@focusflow`)
    lines.push(`SUMMARY:${escapeICS(task.title)}`)

    if (task.description) {
      lines.push(`DESCRIPTION:${escapeICS(task.description)}`)
    }

    if (task.project) {
      lines.push(`CATEGORIES:${escapeICS(task.project)}`)
    }

    const priorityMap: Record<string, number> = {
      urgent: 1,
      high: 3,
      medium: 5,
      low: 7,
    }
    lines.push(`PRIORITY:${priorityMap[task.priority] || 5}`)

    if (task.status === 'done') {
      lines.push('STATUS:CONFIRMED')
      lines.push(`COMPLETED:${formatDateToICS(task.completedAt || new Date())}`)
    }

    if (task.repeatRule) {
      const freqMap: Record<string, string> = {
        daily: 'DAILY',
        weekly: 'WEEKLY',
        monthly: 'MONTHLY',
        yearly: 'YEARLY',
      }
      let rrule = `FREQ=${freqMap[task.repeatRule.type] || 'DAILY'}`
      if (task.repeatRule.interval > 1) {
        rrule += `;INTERVAL=${task.repeatRule.interval}`
      }
      if (task.repeatRule.endDate) {
        rrule += `;UNTIL=${formatLocalDateToICS(new Date(task.repeatRule.endDate))}T235959Z`
      }
      lines.push(`RRULE:${rrule}`)
    }

    if (task.reminders && task.reminders.length > 0) {
      task.reminders.forEach((reminder) => {
        let trigger = '-PT15M'
        if (reminder.type === 'absolute' && reminder.triggerAt) {
          const triggerTime = new Date(reminder.triggerAt)
          const diffMs = new Date(task.dueDate!).getTime() - triggerTime.getTime()
          const diffMin = Math.round(diffMs / 60000)
          if (diffMin > 0) trigger = `-PT${diffMin}M`
        } else if (reminder.type === 'before-due' && reminder.minutesBefore) {
          trigger = `-PT${reminder.minutesBefore}M`
        } else if (reminder.type === 'on-due') {
          trigger = 'PT0M'
        }
        lines.push('BEGIN:VALARM')
        lines.push(`TRIGGER:${trigger}`)
        lines.push('ACTION:DISPLAY')
        lines.push(`DESCRIPTION:${escapeICS(task.title)} 即将开始`)
        lines.push('END:VALARM')
      })
    } else if (task.dueDate) {
      lines.push('BEGIN:VALARM')
      lines.push('TRIGGER:-PT15M')
      lines.push('ACTION:DISPLAY')
      lines.push(`DESCRIPTION:${escapeICS(task.title)} 即将开始`)
      lines.push('END:VALARM')
    }

    lines.push('END:VEVENT')
  })

  anniversaries.forEach((anniversary) => {
    const date = new Date(anniversary.date)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    lines.push('BEGIN:VEVENT')
    lines.push(`DTSTART;VALUE=DATE:${formatLocalDateToICS(date)}`)
    lines.push(`DTEND;VALUE=DATE:${formatLocalDateToICS(nextDate)}`)
    lines.push(`UID:anniversary-${anniversary.id}@focusflow`)
    lines.push(`SUMMARY:${escapeICS(anniversary.title)}`)

    if (anniversary.note) {
      lines.push(`DESCRIPTION:${escapeICS(anniversary.note)}`)
    }

    if (anniversary.repeat) {
      lines.push('RRULE:FREQ=YEARLY')
    }

    if (anniversary.remindDays > 0) {
      lines.push('BEGIN:VALARM')
      lines.push(`TRIGGER:-P${anniversary.remindDays}D`)
      lines.push('ACTION:DISPLAY')
      lines.push(`DESCRIPTION:${escapeICS(anniversary.title)} 提前提醒`)
      lines.push('END:VALARM')
    }

    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

export function downloadICS(content: string, filename: string = 'focusflow-calendar') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
