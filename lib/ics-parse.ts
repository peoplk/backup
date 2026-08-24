import type { ExternalCalendarEvent } from '@/lib/types'

/**
 * 轻量 ICS (iCalendar) 订阅解析：
 * 支持 VEVENT 的 SUMMARY / DTSTART / DTEND / UID，
 * 兼容 VALUE=DATE 全天事件、UTC(Z) 与本地时间两种格式、行折叠(folding)。
 * 时区规则(TZID/VTIMEZONE)暂按本地时间解释——对个人日历聚合场景误差可接受。
 */

function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

function parseIcsDate(value: string): { date: Date; allDay: boolean } | null {
  const v = value.trim()
  // 形如 20260822（全天）
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (dateOnly) {
    return {
      date: new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
      allDay: true,
    }
  }
  // 形如 20260822T093000Z 或 20260822T093000
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v)
  if (!dateTime) return null
  const [, y, mo, d, h, mi, s, z] = dateTime
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s || '00'}${z ? 'Z' : ''}`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return { date, allDay: false }
}

function unescapeText(text: string): string {
  return text
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** 从 ICS 文本解析出事件列表（已过滤过去 90 天之前的记录以限制体积） */
export function parseICS(text: string, calendarId: string): ExternalCalendarEvent[] {
  const lines = unfold(text)
  const events: ExternalCalendarEvent[] = []
  let cur: Partial<{ uid: string; summary: string; start: Date; end: Date; allDay: boolean }> | null = null

  const push = () => {
    if (!cur?.start || !cur.summary) return
    const end = cur.end ?? cur.start
    events.push({
      id: cur.uid || `${calendarId}-${cur.start.getTime()}`,
      calendarId,
      title: cur.summary.slice(0, 200),
      start: cur.start,
      end,
      allDay: cur.allDay ?? false,
    })
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      cur = {}
      continue
    }
    if (trimmed === 'END:VEVENT') {
      push()
      cur = null
      continue
    }
    if (!cur) continue

    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const left = trimmed.slice(0, colon)
    const value = trimmed.slice(colon + 1)
    const prop = left.split(';')[0].toUpperCase()

    if (prop === 'UID') {
      cur.uid = value.trim().slice(0, 180)
    } else if (prop === 'SUMMARY') {
      cur.summary = unescapeText(value).trim()
    } else if (prop === 'DTSTART') {
      const parsed = parseIcsDate(value)
      if (parsed) {
        cur.start = parsed.date
        cur.allDay = parsed.allDay
      }
    } else if (prop === 'DTEND') {
      const parsed = parseIcsDate(value)
      if (parsed) cur.end = parsed.date
    }
  }

  const cutoff = Date.now() - 90 * 86400000
  return events.filter((e) => e.start.getTime() >= cutoff).slice(0, 500)
}

/** 校验订阅 URL：仅允许 https 或本机 http 地址 */
export function isValidSubscriptionUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)
  } catch {
    return false
  }
}
