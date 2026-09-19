/**
 * 轻量 ICS (iCalendar) 订阅解析（跨端共享层，桌面与移动端共用）：
 * 支持 VEVENT 的 SUMMARY / DTSTART / DTEND / UID / RRULE，
 * 兼容 VALUE=DATE 全天事件、UTC(Z) 与本地时间两种格式、行折叠(folding)。
 * 时区规则(TZID/VTIMEZONE)暂按本地时间解释——对个人日历聚合场景误差可接受。
 * RRULE 支持 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY + INTERVAL/BYDAY/BYMONTHDAY/COUNT/UNTIL，
 * 只展开窗口期（过去 90 天 ~ 未来 90 天）内的实例。
 */

export interface SharedExternalCalendarEvent {
  id: string
  calendarId: string
  title: string
  start: Date
  end: Date
  allDay: boolean
}

interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  byDay?: number[]
  byMonthDay?: number
  count?: number
  until?: number
}

const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

function parseRRule(value: string): RRule | null {
  const parts = value.trim().toUpperCase().split(';').map(p => p.split('='))
  const rule: Partial<RRule> & { interval: number } = { interval: 1 }
  for (const [k, v] of parts) {
    if (!v) continue
    if (k === 'FREQ' && ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(v)) rule.freq = v as RRule['freq']
    else if (k === 'INTERVAL') rule.interval = Math.max(1, Math.min(366, parseInt(v) || 1))
    else if (k === 'BYDAY') {
      const days = v.split(',').map(d => DAY_MAP[d.replace(/^[+-]?\d+/, '')]).filter((d): d is number => d !== undefined)
      if (days.length) rule.byDay = [...new Set(days)]
    } else if (k === 'BYMONTHDAY') {
      const n = parseInt(v)
      if (Number.isFinite(n)) rule.byMonthDay = n
    } else if (k === 'COUNT') rule.count = Math.max(1, Math.min(1000, parseInt(v) || 1))
    else if (k === 'UNTIL') {
      const parsed = parseIcsDate(v)
      if (parsed) rule.until = parsed.date.getTime()
    }
  }
  if (!rule.freq) return null
  return rule as RRule
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate()
}

/** 以 base 的时分与时长展开 RRULE，产出 [fromMs, toMs] 内的实例 */
function expandRecurring(
  base: { start: Date; end: Date; allDay: boolean },
  rule: RRule,
  fromMs: number,
  toMs: number,
): Date[] {
  const out: Date[] = []
  const s = base.start
  const capCount = rule.count ?? 0
  let emitted = 0
  const pushOcc = (d: Date) => {
    emitted++
    const t = d.getTime()
    if (t >= fromMs && t <= toMs && out.length < 200) out.push(d)
  }
  const at = (y: number, m: number, day: number) => {
    const clamped = Math.min(day, daysInMonth(y, m))
    return new Date(y, m, clamped, s.getHours(), s.getMinutes(), s.getSeconds())
  }

  if (rule.freq === 'DAILY') {
    for (let t = s.getTime(); t <= toMs; t += rule.interval * 86400000) {
      if (capCount && emitted >= capCount) break
      if (rule.until && t > rule.until) break
      pushOcc(new Date(t))
      if (t < fromMs) { /* 早期实例快速推进，仍计入 COUNT */ }
    }
  } else if (rule.freq === 'WEEKLY') {
    const targetDays = rule.byDay ?? [s.getDay()]
    // 从 base 所在周的周日起逐周推进
    const weekStart = new Date(s)
    weekStart.setDate(weekStart.getDate() - s.getDay())
    weekStart.setHours(s.getHours(), s.getMinutes(), s.getSeconds())
    for (let w = 0; ; w += rule.interval) {
      const weekBase = weekStart.getTime() + w * 7 * 86400000
      if (weekBase > toMs) break
      const sorted = [...targetDays].sort((a, b) => (a - s.getDay() + 7) % 7 - ((b - s.getDay() + 7) % 7))
      for (const wd of sorted) {
        const occ = new Date(weekBase)
        occ.setDate(occ.getDate() + ((wd - weekStart.getDay() + 7) % 7))
        if (occ.getTime() < s.getTime()) continue
        if (capCount && emitted >= capCount) break
        if (rule.until && occ.getTime() > rule.until) break
        pushOcc(occ)
      }
      if (capCount && emitted >= capCount) break
    }
  } else if (rule.freq === 'MONTHLY') {
    for (let i = 0; ; i += rule.interval) {
      const y = s.getFullYear() + Math.floor((s.getMonth() + i) / 12)
      const m = (s.getMonth() + i) % 12
      if (capCount && emitted >= capCount) break
      if (rule.until && at(y, m, 28).getTime() > rule.until) break
      if (rule.byDay?.length) {
        for (const wd of rule.byDay) {
          for (let week = 0; week < 5; week++) {
            const day = 1 + week * 7 + ((wd - new Date(y, m, 1).getDay() + 7) % 7)
            if (day > daysInMonth(y, m)) continue
            const occ = at(y, m, day)
            if (occ.getTime() < s.getTime() || (rule.until && occ.getTime() > rule.until)) continue
            pushOcc(occ)
            break
          }
        }
      } else {
        const occ = at(y, m, rule.byMonthDay ?? s.getDate())
        if (occ.getTime() < s.getTime()) continue
        pushOcc(occ)
      }
      if (at(y, m, 1).getTime() > toMs) break
    }
  } else {
    for (let i = 0; ; i += rule.interval) {
      const y = s.getFullYear() + i
      if (capCount && emitted >= capCount) break
      const occ = new Date(y, s.getMonth(), s.getDate(), s.getHours(), s.getMinutes(), s.getSeconds())
      if (occ.getTime() > toMs || (rule.until && occ.getTime() > rule.until)) break
      if (occ.getTime() >= s.getTime()) pushOcc(occ)
    }
  }
  return out
}


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
export function parseICS(text: string, calendarId: string): SharedExternalCalendarEvent[] {
  const lines = unfold(text)
  const events: SharedExternalCalendarEvent[] = []
  let cur: Partial<{ uid: string; summary: string; start: Date; end: Date; allDay: boolean; rrule: RRule }> | null = null

  const push = () => {
    if (!cur?.start || !cur.summary) return
    const end = cur.end ?? cur.start
    const allDay = cur.allDay ?? false
    if (cur.rrule) {
      const now = Date.now()
      const instances = expandRecurring(
        { start: cur.start, end, allDay },
        cur.rrule,
        now - 90 * 86400000,
        now + 90 * 86400000,
      )
      const duration = end.getTime() - cur.start.getTime()
      const baseId = cur.uid || `${calendarId}-${cur.start.getTime()}`
      instances.forEach((d) => {
        events.push({
          id: `${baseId}-${d.getTime()}`,
          calendarId,
          title: cur!.summary!.slice(0, 200),
          start: d,
          end: new Date(d.getTime() + duration),
          allDay,
        })
      })
      return
    }
    events.push({
      id: cur.uid || `${calendarId}-${cur.start.getTime()}`,
      calendarId,
      title: cur.summary.slice(0, 200),
      start: cur.start,
      end,
      allDay,
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
    } else if (prop === 'RRULE') {
      const rule = parseRRule(value)
      if (rule) cur.rrule = rule
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
