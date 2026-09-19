import { describe, it, expect } from 'vitest'
import { parseICS, isValidSubscriptionUrl } from '@/lib/ics-parse'

function icsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function icsDateTimeUTC(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

function wrapICS(vevent: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', ...vevent, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}

const daysFromNow = (n: number, h = 9) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(h, 0, 0, 0)
  return d
}

describe('parseICS 基础解析', () => {
  it('解析普通事件的 SUMMARY/DTSTART/DTEND/UID', () => {
    const text = wrapICS([
      'UID:evt-1',
      'SUMMARY:产品评审',
      `DTSTART:${icsDate(daysFromNow(1))}`,
      `DTEND:${icsDate(daysFromNow(1, 10))}`,
    ])
    const events = parseICS(text, 'cal-a')
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('产品评审')
    expect(events[0].id).toBe('evt-1')
    expect(events[0].calendarId).toBe('cal-a')
    expect(events[0].allDay).toBe(false)
    expect(events[0].end.getTime() - events[0].start.getTime()).toBe(3600000)
  })

  it('支持 VALUE=DATE 全天事件与 UTC 时间', () => {
    const allDay = wrapICS(['UID:a2', 'SUMMARY:假期', 'DTSTART;VALUE=DATE:20991231'])
    expect(parseICS(allDay, 'c')[0].allDay).toBe(true)
    const utc = wrapICS(['UID:a3', 'SUMMARY:UTC 会议', `DTSTART:${icsDateTimeUTC(daysFromNow(2))}`])
    const ev = parseICS(utc, 'c')[0]
    expect(Math.abs(ev.start.getTime() - daysFromNow(2).getTime())).toBeLessThan(2000)
  })

  it('处理行折叠（ continuation 行）与文本转义', () => {
    const text = wrapICS(['UID:f1', 'SUMMARY:很长的标', ' 题，含逗号\\,与转义', `DTSTART:${icsDate(daysFromNow(1))}`])
    const ev = parseICS(text, 'c')[0]
    expect(ev.title).toBe('很长的标题，含逗号,与转义')
  })

  it('过滤 90 天以前的事件', () => {
    const text = wrapICS(['UID:old', 'SUMMARY:很久以前', `DTSTART:${icsDate(daysFromNow(-200))}`])
    expect(parseICS(text, 'c')).toHaveLength(0)
  })
})

describe('parseICS RRULE 展开', () => {
  it('FREQ=DAILY;COUNT=5 展开 5 个实例', () => {
    const text = wrapICS([
      'UID:r-daily',
      'SUMMARY:每日站会',
      `DTSTART:${icsDate(daysFromNow(-1))}`,
      'RRULE:FREQ=DAILY;COUNT=5',
    ])
    const events = parseICS(text, 'c')
    expect(events).toHaveLength(5)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].start.getTime() - events[i - 1].start.getTime()).toBe(86400000)
    }
  })

  it('FREQ=WEEKLY;BYDAY=MO,WE 只落在周一与周三', () => {
    const text = wrapICS([
      'UID:r-weekly',
      'SUMMARY:周例会',
      `DTSTART:${icsDate(daysFromNow(-30))}`,
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=8',
    ])
    const events = parseICS(text, 'c')
    expect(events.length).toBeGreaterThan(0)
    events.forEach(e => expect([1, 3]).toContain(e.start.getDay()))
  })

  it('FREQ=MONTHLY;BYMONTHDAY=31 在短月钳制到月末', () => {
    // 以今年 12 月 31 日为基准向前推，MONTHLY 展开会覆盖后续月份
    const base = new Date()
    base.setDate(1)
    base.setHours(9, 0, 0, 0)
    const text = wrapICS([
      'UID:r-monthly',
      'SUMMARY:月度账单',
      `DTSTART:${icsDate(base)}`,
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=3',
    ])
    const events = parseICS(text, 'c')
    expect(events.length).toBeGreaterThanOrEqual(2)
    events.forEach(e => {
      const lastDay = new Date(e.start.getFullYear(), e.start.getMonth() + 1, 0).getDate()
      expect(e.start.getDate()).toBe(Math.min(31, lastDay))
    })
  })

  it('UNTIL 终止展开', () => {
    const text = wrapICS([
      'UID:r-until',
      'SUMMARY:限时打卡',
      `DTSTART:${icsDate(daysFromNow(-5))}`,
      `RRULE:FREQ=DAILY;UNTIL=${icsDate(daysFromNow(5)).slice(0, 8)}T000000`,
    ])
    const events = parseICS(text, 'c')
    expect(events.length).toBeGreaterThanOrEqual(9)
    expect(events.length).toBeLessThanOrEqual(11)
    const last = events[events.length - 1]
    expect(last.start.getTime()).toBeLessThanOrEqual(daysFromNow(5).getTime())
  })

  it('重复事件保留事件时长且实例 id 唯一', () => {
    const text = wrapICS([
      'UID:r-dur',
      'SUMMARY:双周冲刺',
      `DTSTART:${icsDate(daysFromNow(0))}`,
      `DTEND:${icsDate(daysFromNow(0, 11))}`,
      'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4',
    ])
    const events = parseICS(text, 'c')
    expect(events.length).toBeGreaterThan(1)
    events.forEach(e => expect(e.end.getTime() - e.start.getTime()).toBe(2 * 3600000))
    expect(new Set(events.map(e => e.id)).size).toBe(events.length)
    expect(events[0].id.startsWith('r-dur-')).toBe(true)
  })
})

describe('isValidSubscriptionUrl', () => {
  it('允许 https 与本机 http', () => {
    expect(isValidSubscriptionUrl('https://calendar.example.com/feed.ics')).toBe(true)
    expect(isValidSubscriptionUrl('http://localhost:8080/a.ics')).toBe(true)
    expect(isValidSubscriptionUrl('http://127.0.0.1:9/a.ics')).toBe(true)
  })
  it('拒绝明文 http 外链与非法输入', () => {
    expect(isValidSubscriptionUrl('http://evil.example.com/feed.ics')).toBe(false)
    expect(isValidSubscriptionUrl('ftp://x/y')).toBe(false)
    expect(isValidSubscriptionUrl('not a url')).toBe(false)
  })
})
