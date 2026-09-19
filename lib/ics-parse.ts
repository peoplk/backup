import type { ExternalCalendarEvent } from '@/lib/types'
import {
  parseICS as parseICSCore,
  isValidSubscriptionUrl,
  type SharedExternalCalendarEvent,
} from '@/shared/core/ics-parse'

/**
 * 桌面端 ICS 解析入口：解析核心在跨端共享层 @shared/core/ics-parse
 * （与移动端同一份代码），此处仅做类型对齐与再导出。
 */
export function parseICS(text: string, calendarId: string): ExternalCalendarEvent[] {
  return parseICSCore(text, calendarId) as ExternalCalendarEvent[]
}

export { isValidSubscriptionUrl }
export type { SharedExternalCalendarEvent }
